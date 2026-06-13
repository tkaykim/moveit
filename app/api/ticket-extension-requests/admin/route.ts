import { NextResponse } from 'next/server';
import { createBookingsForPeriodTicket } from '@/lib/db/period-ticket-bookings';
import { getSchedulesForPeriodTicket } from '@/lib/db/period-ticket-bookings';
import { getAuthenticatedUser, getAuthenticatedSupabase } from '@/lib/supabase/server-auth';
import { insertEnrollmentActivityLog, logTicketEvent } from '@/lib/db/enrollment-activity-log';
import { isPeriodTicket as checkIsPeriodTicket } from '@/lib/utils/ticket-type';

/**
 * POST: 관리자 직접 연장/일시정지 생성 및 즉시 승인 - 쿠키 또는 Authorization Bearer
 * Body: { academyId, user_ticket_id, request_type: 'EXTENSION'|'PAUSE', absent_start_date, absent_end_date }
 */
export async function POST(request: Request) {
  try {
    const adminUser = await getAuthenticatedUser(request);
    if (!adminUser) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const supabase = await getAuthenticatedSupabase(request) as any;

    const body = await request.json();
    const { academyId, user_ticket_id, request_type, extension_days, absent_start_date, absent_end_date, reason } = body;

    if (!academyId || !user_ticket_id || !request_type) {
      return NextResponse.json({ error: 'academyId, user_ticket_id, request_type가 필요합니다.' }, { status: 400 });
    }
    if (!['EXTENSION', 'PAUSE'].includes(request_type)) {
      return NextResponse.json({ error: 'request_type는 EXTENSION 또는 PAUSE 여야 합니다.' }, { status: 400 });
    }
    if (!reason || typeof reason !== 'string' || !reason.trim()) {
      return NextResponse.json({ error: '사유를 입력해주세요.' }, { status: 400 });
    }

    // 연장: extension_days 필수
    if (request_type === 'EXTENSION') {
      if (!extension_days || typeof extension_days !== 'number' || extension_days <= 0) {
        return NextResponse.json({ error: '연장 일수를 입력해주세요.' }, { status: 400 });
      }
    }

    // 일시정지: 시작일/종료일 필수
    let pauseDays = 0;
    if (request_type === 'PAUSE') {
      if (!absent_start_date || !absent_end_date) {
        return NextResponse.json({ error: '일시정지 시작일과 종료일을 입력해주세요.' }, { status: 400 });
      }
      const start = new Date(absent_start_date);
      const end = new Date(absent_end_date);
      if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) {
        return NextResponse.json({ error: '유효한 일시정지 기간(시작일~종료일)을 입력해주세요.' }, { status: 400 });
      }
      pauseDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    }

    const { data: userTicket, error: utError } = await supabase
      .from('user_tickets')
      .select('id, user_id, ticket_id, expiry_date, tickets(academy_id, ticket_type)')
      .eq('id', user_ticket_id)
      .single();
    if (utError || !userTicket) {
      return NextResponse.json({ error: '수강권을 찾을 수 없습니다.' }, { status: 404 });
    }
    const ticketAcademyId = userTicket.tickets?.academy_id;
    if (!ticketAcademyId || ticketAcademyId !== academyId) {
      return NextResponse.json({ error: '해당 학원의 수강권이 아닙니다.' }, { status: 403 });
    }

    const now = new Date().toISOString();
    const { data: inserted, error: insertError } = await supabase
      .from('ticket_extension_requests')
      .insert({
        user_ticket_id,
        request_type,
        extension_days: request_type === 'EXTENSION' ? extension_days : null,
        absent_start_date: request_type === 'PAUSE' ? absent_start_date : null,
        absent_end_date: request_type === 'PAUSE' ? absent_end_date : null,
        reason: reason.trim(),
        status: 'APPROVED',
        processed_at: now,
        processed_by: adminUser.id,
        updated_at: now,
      })
      .select()
      .single();
    if (insertError) {
      console.error(insertError);
      return NextResponse.json({ error: '등록에 실패했습니다.' }, { status: 500 });
    }

    // 즉시 반영: 만료일 연장 및 기간권 예약 재생성
    const addDays = request_type === 'EXTENSION' ? extension_days : pauseDays;
    let cancelledBookingIds: string[] = [];
    let newExpiryStr: string | null = null;

    if (userTicket.expiry_date && addDays > 0) {
      const currentExpiry = new Date(userTicket.expiry_date);
      const newExpiry = new Date(currentExpiry);
      newExpiry.setDate(newExpiry.getDate() + addDays);
      newExpiryStr = newExpiry.toISOString().slice(0, 10);

      await supabase
        .from('user_tickets')
        .update({ expiry_date: newExpiryStr })
        .eq('id', user_ticket_id);

      const ticketType = userTicket.tickets?.ticket_type;
      const ticketId = userTicket.ticket_id;
      const userId = userTicket.user_id;

      // 일시정지(PAUSE)일 때만 기간권 예약 취소 및 재생성
      if (request_type === 'PAUSE' && checkIsPeriodTicket(ticketType) && ticketId && userId) {
        const schedulesInAbsent = await getSchedulesForPeriodTicket(ticketId, absent_start_date, absent_end_date);
        for (const sch of schedulesInAbsent || []) {
          const { data: toCancel } = await supabase
            .from('bookings')
            .select('id, status, schedule_id, class_id')
            .eq('user_ticket_id', user_ticket_id)
            .eq('schedule_id', sch.id)
            .in('status', ['CONFIRMED', 'PENDING']);
          if (toCancel?.length) {
            // 활동 로그: 관리자 강제 일시정지로 인한 예약 취소 (예약별 1건씩)
            for (const b of toCancel as any[]) {
              await logTicketEvent({
                academy_id: academyId,
                user_id: userId,
                user_ticket_id: user_ticket_id,
                booking_id: b.id,
                extension_request_id: inserted?.id ?? null,
                action: 'CANCEL',
                before: { status: b.status },
                after: { status: 'CANCELLED' },
                via: 'period_pause',
                reason: `admin_pause:${absent_start_date}..${absent_end_date}`,
                context: {
                  schedule_id: b.schedule_id,
                  class_id: b.class_id,
                  absent_start_date,
                  absent_end_date,
                },
                actor_user_id: adminUser.id,
              }, supabase).catch(() => {});
            }
            cancelledBookingIds.push(...toCancel.map((b: any) => b.id));
            await supabase.from('bookings').update({ status: 'CANCELLED' }).in('id', toCancel.map((b: any) => b.id));
            // current_students 는 sync_schedule_student_count 트리거가 자동 재계산 — 수동 차감 시 이중 차감되어 제거.
          }
        }
        const extendStart = new Date(currentExpiry);
        extendStart.setDate(extendStart.getDate() + 1);
        const extendStartStr = extendStart.toISOString().slice(0, 10);
        await createBookingsForPeriodTicket(userId, user_ticket_id, ticketId, extendStartStr, newExpiryStr);
      }
    }

    // 활동 로그: 관리자 연장/일시정지 (만료일 before/after, 취소된 예약 정보 포함)
    await logTicketEvent({
      academy_id: academyId,
      user_id: userTicket.user_id,
      user_ticket_id: user_ticket_id,
      extension_request_id: inserted?.id ?? null,
      action: 'ADMIN_EXTEND',
      before: { expiry_date: userTicket.expiry_date ?? null },
      after: { expiry_date: newExpiryStr ?? userTicket.expiry_date ?? null },
      via: 'extension_approval',
      reason: reason?.trim(),
      context: {
        request_type,
        days: request_type === 'EXTENSION' ? extension_days : pauseDays,
        absent_start_date: request_type === 'PAUSE' ? absent_start_date : null,
        absent_end_date: request_type === 'PAUSE' ? absent_end_date : null,
        cancelled_booking_count: cancelledBookingIds.length,
        cancelled_booking_ids: cancelledBookingIds,
      },
      actor_user_id: adminUser.id,
    }, supabase).catch(() => {});

    return NextResponse.json({ data: inserted });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e.message || '서버 오류' }, { status: 500 });
  }
}
