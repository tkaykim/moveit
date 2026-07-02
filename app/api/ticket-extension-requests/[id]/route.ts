import { NextResponse } from 'next/server';
import { createBookingsForPeriodTicket } from '@/lib/db/period-ticket-bookings';
import { getSchedulesForPeriodTicket } from '@/lib/db/period-ticket-bookings';
import { getAuthenticatedUser, getAuthenticatedSupabase } from '@/lib/supabase/server-auth';
import { assertAcademyAdmin } from '@/lib/supabase/academy-admin-auth';
import { sendNotification } from '@/lib/notifications';
import { insertEnrollmentActivityLog, logTicketEvent } from '@/lib/db/enrollment-activity-log';
import { isPeriodTicket as checkIsPeriodTicket } from '@/lib/utils/ticket-type';
export const dynamic = 'force-dynamic';


/**
 * PATCH: 연장/일시정지 신청 승인 또는 거절 (관리자) - 쿠키 또는 Authorization Bearer
 * Body: { status: 'APPROVED' | 'REJECTED', reject_reason?: string }
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminUser = await getAuthenticatedUser(request);
    if (!adminUser) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const { id } = await params;
    const supabase = await getAuthenticatedSupabase(request) as any;
    const body = await request.json();
    const { status, reject_reason } = body;
    if (!status || !['APPROVED', 'REJECTED'].includes(status)) {
      return NextResponse.json(
        { error: 'status는 APPROVED 또는 REJECTED 여야 합니다.' },
        { status: 400 }
      );
    }
    if (status === 'REJECTED' && typeof reject_reason !== 'string') {
      return NextResponse.json(
        { error: '거절 시 reject_reason을 입력해주세요.' },
        { status: 400 }
      );
    }

    const { data: reqRow, error: fetchErr } = await supabase
      .from('ticket_extension_requests')
      .select('*, user_tickets(id, user_id, expiry_date, ticket_id, tickets(ticket_type, name, academy_id, academies(name_kr, name_en)))')
      .eq('id', id)
      .single();
    if (fetchErr || !reqRow) {
      return NextResponse.json({ error: '신청을 찾을 수 없습니다.' }, { status: 404 });
    }

    // 인가: 대상 요청 → user_ticket → ticket.academy_id 로 해당 학원의 관리자인지 검증.
    const academyId = (reqRow.user_tickets as any)?.tickets?.academy_id;
    if (!academyId) {
      return NextResponse.json({ error: '신청을 찾을 수 없습니다.' }, { status: 404 });
    }
    try {
      await assertAcademyAdmin(academyId, adminUser.id);
    } catch {
      return NextResponse.json({ error: '학원 관리자 권한이 필요합니다.' }, { status: 403 });
    }

    if (reqRow.status !== 'PENDING') {
      return NextResponse.json({ error: '이미 처리된 신청입니다.' }, { status: 400 });
    }

    // 원자적 claim: status='PENDING' 인 행만 갱신. 0행이면 이미 처리됨(더블클릭 등) → 중단.
    const { data: claimedRows, error: updateErr } = await supabase
      .from('ticket_extension_requests')
      .update({
        status,
        reject_reason: status === 'REJECTED' ? (reject_reason || null) : null,
        processed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('status', 'PENDING')
      .select('id');
    if (updateErr) throw updateErr;
    if (!claimedRows || claimedRows.length === 0) {
      return NextResponse.json({ error: '이미 처리된 신청입니다.' }, { status: 400 });
    }

    if (status === 'APPROVED' && reqRow.user_tickets?.expiry_date) {
      // 연장 일수 계산: EXTENSION은 extension_days, PAUSE는 absent 기간
      let addDays = 0;
      if (reqRow.request_type === 'EXTENSION' && reqRow.extension_days) {
        addDays = reqRow.extension_days;
      } else if (reqRow.request_type === 'PAUSE' && reqRow.absent_start_date && reqRow.absent_end_date) {
        const start = new Date(reqRow.absent_start_date);
        const end = new Date(reqRow.absent_end_date);
        addDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      }

      if (addDays > 0) {
        const currentExpiry = new Date(reqRow.user_tickets.expiry_date);
        const previousExpiryStr = (reqRow.user_tickets.expiry_date as string).slice(0, 10);
        const newExpiry = new Date(currentExpiry);
        newExpiry.setDate(newExpiry.getDate() + addDays);
        const newExpiryStr = newExpiry.toISOString().slice(0, 10);

        await supabase
          .from('user_tickets')
          .update({ expiry_date: newExpiryStr })
          .eq('id', reqRow.user_ticket_id);

        const ticketType = reqRow.user_tickets?.tickets?.ticket_type;
        const ticketId = reqRow.user_tickets?.ticket_id;
        const userId = reqRow.user_tickets?.user_id;
        const academyIdForLog = (reqRow.user_tickets as any)?.tickets?.academy_id ?? null;

        // 일시정지(PAUSE)일 때만 기간권 예약 취소 및 재생성
        let cancelledBookingIds: string[] = [];
        if (reqRow.request_type === 'PAUSE' && checkIsPeriodTicket(ticketType) && ticketId && userId) {
          const absentStart = reqRow.absent_start_date;
          const absentEnd = reqRow.absent_end_date;
          const schedulesInAbsent = await getSchedulesForPeriodTicket(ticketId, absentStart, absentEnd);
          for (const sch of schedulesInAbsent || []) {
            const { data: toCancel } = await supabase
              .from('bookings')
              .select('id, status, schedule_id, class_id')
              .eq('user_ticket_id', reqRow.user_ticket_id)
              .eq('schedule_id', sch.id)
              .in('status', ['CONFIRMED', 'PENDING']);
            if (toCancel?.length) {
              // 활동 로그: 일시정지로 인한 예약 취소 (예약별 1건씩)
              if (academyIdForLog) {
                for (const b of toCancel as any[]) {
                  await logTicketEvent({
                    academy_id: academyIdForLog,
                    user_id: userId,
                    user_ticket_id: reqRow.user_ticket_id,
                    booking_id: b.id,
                    extension_request_id: id,
                    action: 'CANCEL',
                    before: { status: b.status },
                    after: { status: 'CANCELLED' },
                    via: 'period_pause',
                    reason: `extension_pause:${absentStart}..${absentEnd}`,
                    context: {
                      schedule_id: b.schedule_id,
                      class_id: b.class_id,
                      absent_start_date: absentStart,
                      absent_end_date: absentEnd,
                    },
                    actor_user_id: adminUser.id,
                  }, supabase).catch(() => {});
                }
              }
              cancelledBookingIds.push(...toCancel.map((b: any) => b.id));
              await supabase.from('bookings').update({ status: 'CANCELLED' }).in('id', toCancel.map((b: any) => b.id));
              // current_students 는 bookings 업데이트 시 sync_schedule_student_count 트리거가 자동 재계산.
              // 수동으로 또 빼면 이중 차감되어 정원 카운트가 음수 방향으로 드리프트하므로 제거.
            }
          }
          const extendStart = new Date(currentExpiry);
          extendStart.setDate(extendStart.getDate() + 1);
          const extendStartStr = extendStart.toISOString().slice(0, 10);
          await createBookingsForPeriodTicket(userId, reqRow.user_ticket_id, ticketId, extendStartStr, newExpiryStr);
        }

        // 활동 로그: 연장/일시정지 승인 (만료일 before/after, 취소된 예약 수 포함)
        if (academyIdForLog) {
          await logTicketEvent({
            academy_id: academyIdForLog,
            user_id: userId ?? null,
            user_ticket_id: reqRow.user_ticket_id,
            extension_request_id: id,
            action: 'EXTENSION_APPROVED',
            before: { expiry_date: previousExpiryStr },
            after: { expiry_date: newExpiryStr },
            via: 'extension_approval',
            reason: reqRow.request_type,
            context: {
              request_type: reqRow.request_type,
              extension_days: addDays,
              absent_start_date: reqRow.absent_start_date ?? null,
              absent_end_date: reqRow.absent_end_date ?? null,
              cancelled_booking_count: cancelledBookingIds.length,
              cancelled_booking_ids: cancelledBookingIds,
            },
            actor_user_id: adminUser.id,
          }, supabase).catch(() => {});
        }
      }
    }

    const { data: updated } = await supabase
      .from('ticket_extension_requests')
      .select('*')
      .eq('id', id)
      .single();

    // 연장/일시정지 승인/거절 알림 발송
    const targetUserId = reqRow.user_tickets?.user_id;
    if (targetUserId) {
      const requestTypeLabel = reqRow.request_type === 'EXTENSION' ? '연장' : '일시정지';
      const statusLabel = status === 'APPROVED' ? '승인' : '거절';
      
      const ticketName = reqRow.user_tickets?.tickets?.name || '수강권';
      const academyName = reqRow.user_tickets?.tickets?.academies?.name_kr || 
                          reqRow.user_tickets?.tickets?.academies?.name_en || 
                          '학원';
      
      sendNotification({
        user_id: targetUserId,
        type: status === 'APPROVED' ? 'extension_approved' : 'extension_rejected',
        title: `${academyName} 수강권 ${requestTypeLabel} ${statusLabel}`,
        body: status === 'APPROVED'
          ? `${ticketName} ${requestTypeLabel} 요청이 승인되었습니다.`
          : `${ticketName} ${requestTypeLabel} 요청이 거절되었습니다.${reject_reason ? ` 사유: ${reject_reason}` : ''}`,
        data: { extension_request_id: id, url: '/my/tickets', academy_name: academyName },
        academy_id: reqRow.user_tickets?.tickets?.academy_id,
      }).catch((err) => console.error('[extension-notification]', err));
    }

    return NextResponse.json({ data: updated });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e.message || '서버 오류' }, { status: 500 });
  }
}
