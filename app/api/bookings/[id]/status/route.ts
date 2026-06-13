import { createClient, createServiceClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { sendNotification } from '@/lib/notifications';
import { getAuthenticatedUser } from '@/lib/supabase/server-auth';
import { insertEnrollmentActivityLog, logTicketEvent } from '@/lib/db/enrollment-activity-log';
import { isCountTicket } from '@/lib/utils/ticket-type';
import { formatKSTDate, formatKSTTime } from '@/lib/utils/kst-time';

/**
 * PATCH /api/bookings/[id]/status
 * 예약 상태 변경 (PENDING -> CONFIRMED, CONFIRMED -> COMPLETED, 취소 등)
 * Body: {
 *   status: 'CONFIRMED' | 'COMPLETED' | 'CANCELLED' | 'PENDING',
 *   updateScheduleCount?: boolean  // schedules.current_students 업데이트 여부
 *   restoreTicket?: boolean        // 취소 시 쿠폰제(COUNT) 수강권 횟수 회원에게 반환 여부
 * }
 * 
 * 기간권(PERIOD)은 remaining_count가 null이므로 복원 없음.
 * 횟수권(COUNT) 취소 시 restoreTicket === true 이면 해당 user_ticket의 remaining_count 1 증가.
 */

async function getSupabaseForAdmin(request: Request) {
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return createServiceClient();
  }
  return await createClient();
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await getSupabaseForAdmin(request);
    const body = await request.json();
    const { status, updateScheduleCount = true, restoreTicket = false } = body;

    if (!status) {
      return NextResponse.json(
        { error: '상태 값이 필요합니다.' },
        { status: 400 }
      );
    }

    const validStatuses = ['CONFIRMED', 'COMPLETED', 'CANCELLED', 'PENDING', 'ABSENT'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: '유효하지 않은 상태 값입니다.' },
        { status: 400 }
      );
    }

    // 현재 예약 정보 조회 (활동 로그용 academy_id + user.is_guest 포함)
    const { data: currentBooking, error: bookingError } = await (supabase as any)
      .from('bookings')
      .select('*, schedule_id, status, classes(academy_id), users(is_guest)')
      .eq('id', id)
      .single();

    if (bookingError || !currentBooking) {
      return NextResponse.json(
        { error: '예약을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    const oldStatus = currentBooking.status;
    const scheduleId = currentBooking.schedule_id;
    const academyId = (currentBooking as any).classes?.academy_id;
    // 인증된 호출자 ID 가 우선이지만, fetch credentials 가 cookie 를 못 잡는 케이스에서는
    // booking 의 user_id (= 회원 self-cancel 의 정상 actor) 로 fallback 한다.
    const actorId = (await getAuthenticatedUser(request))?.id ?? currentBooking.user_id ?? null;
    // B-3 (2026-04-21): users.is_guest를 일등시민으로 사용. guest_name은 병합 후에도
    // 보존되므로 is_guest가 false로 바뀌어도(병합 완료) 과거 비회원 주문임을 payload에
    // 남기기 위한 보조 신호로 유지. 둘 중 하나라도 참이면 guest payload 첨부.
    const userIsGuest = (currentBooking as any).users?.is_guest === true;
    const isGuestBooking = userIsGuest || !!currentBooking.guest_name;
    const guestPayload = isGuestBooking
      ? { guest_name: currentBooking.guest_name, guest_phone: currentBooking.guest_phone || null }
      : {};

    // 계좌이체 PENDING 주문이 연결된 booking은 수동 확정 차단
    // (수강권 미발급·매출 미기록 상태로 CONFIRMED 되는 것을 방지)
    if (status === 'CONFIRMED' && (currentBooking as any).bank_transfer_order_id) {
      const { data: linkedOrder } = await (supabase as any)
        .from('bank_transfer_orders')
        .select('status')
        .eq('id', (currentBooking as any).bank_transfer_order_id)
        .single();
      if (linkedOrder?.status === 'PENDING') {
        return NextResponse.json(
          { error: '계좌이체 예약은 수동 입금확인 탭에서 입금 확인 후 자동으로 확정됩니다.' },
          { status: 400 }
        );
      }
    }

    // 상태 변경
    const { error: updateError } = await (supabase as any)
      .from('bookings')
      .update({ status })
      .eq('id', id);

    if (updateError) {
      console.error('Booking update error:', updateError);
      return NextResponse.json(
        { error: '예약 상태 변경에 실패했습니다.', detail: updateError.message, code: updateError.code },
        { status: 500 }
      );
    }

    // 업데이트된 예약 조회
    const { data: updatedBooking } = await (supabase as any)
      .from('bookings')
      .select()
      .eq('id', id)
      .single();

    // 취소 시 쿠폰제(COUNT) 수강권 횟수 반환
    // 멱등성 가드: 이미 CANCELLED 였던 예약을 다시 취소해도 횟수를 중복 복원하지 않는다.
    // (운영자 더블클릭/요청 재시도로 remaining_count 가 무한 증가하던 버그 차단)
    if (status === 'CANCELLED' && oldStatus !== 'CANCELLED' && restoreTicket && currentBooking.user_ticket_id) {
      const { data: userTicket, error: utError } = await (supabase as any)
        .from('user_tickets')
        .select('id, remaining_count, status, tickets(ticket_type, total_count)')
        .eq('id', currentBooking.user_ticket_id)
        .single();

      if (!utError && isCountTicket(userTicket?.tickets?.ticket_type) && typeof userTicket.remaining_count === 'number') {
        const newRemaining = userTicket.remaining_count + 1;
        const previousStatus = userTicket.status as string;
        const updateData: any = { remaining_count: newRemaining };

        // USED 상태였다면 복원 시 ACTIVE로 변경
        if (userTicket.status === 'USED' && newRemaining > 0) {
          updateData.status = 'ACTIVE';
        }

        await (supabase as any)
          .from('user_tickets')
          .update(updateData)
          .eq('id', currentBooking.user_ticket_id);

        // 활동 로그: 횟수 복구 (표준 envelope: before/after 포함)
        if (academyId) {
          await logTicketEvent({
            academy_id: academyId,
            user_id: currentBooking.user_id,
            user_ticket_id: currentBooking.user_ticket_id,
            booking_id: id,
            action: 'COUNT_RESTORE',
            before: { remaining_count: userTicket.remaining_count, status: previousStatus },
            after: { remaining_count: newRemaining, status: updateData.status ?? previousStatus },
            via: 'cancel',
            reason: 'booking_cancelled',
            context: guestPayload,
            actor_user_id: actorId,
          }).catch(() => {});
        }
      }
    }

    // 활동 로그: 예약 취소 (표준 envelope: before/after status)
    if (academyId && status === 'CANCELLED') {
      await logTicketEvent({
        academy_id: academyId,
        user_id: currentBooking.user_id,
        user_ticket_id: currentBooking.user_ticket_id ?? null,
        booking_id: id,
        action: 'CANCEL',
        before: { status: oldStatus },
        after: { status: 'CANCELLED' },
        via: 'cancel',
        context: { ...guestPayload, restored_ticket: !!(restoreTicket && currentBooking.user_ticket_id) },
        actor_user_id: actorId,
      }).catch(() => {});
    }

    // schedules.current_students 는 bookings 트리거(sync_schedule_student_count)가
    // 상태 변경 시 자동 재계산한다. 여기서 수동 갱신하면 트리거 값과 충돌하므로 제거.
    // updateScheduleCount 파라미터는 하위 호환을 위해 수용만 하고 무시한다.
    void updateScheduleCount;

    // 취소 알림 발송 (비동기)
    if (status === 'CANCELLED' && updatedBooking?.user_id) {
      // 예약 상세 정보 조회 (학원명, 수업명, 시간 포함)
      (supabase as any)
        .from('bookings')
        .select(`
          id,
          classes!inner(title, academy_id, academies!inner(name_kr)),
          schedules(start_time, end_time)
        `)
        .eq('id', id)
        .single()
        .then(({ data: bookingDetail }: any) => {
          if (!bookingDetail) return;
          
          const academyName = bookingDetail.classes?.academies?.name_kr || '학원';
          const classTitle = bookingDetail.classes?.title || '수업';
          const startTime = bookingDetail.schedules?.start_time;
          
          let timeStr = '';
          if (startTime) {
            timeStr = ` (${formatKSTDate(new Date(startTime))} ${formatKSTTime(startTime)})`;
          }
          
          return sendNotification({
            user_id: updatedBooking.user_id,
            type: 'booking_cancelled',
            title: '예약 취소',
            body: `${academyName} ${classTitle} 예약이 취소되었습니다.${timeStr}`,
            data: { booking_id: id, url: '/my/bookings', academy_name: academyName },
            academy_id: bookingDetail.classes?.academy_id,
          });
        })
        .catch((err: any) => console.error('[cancel-notification]', err));
    }

    // 활동 로그: 출석 체크 (수동) — G10: 잔여 스냅샷 포함
    if (academyId && status === 'COMPLETED' && oldStatus === 'CONFIRMED') {
      let attendanceSnapshot: { remaining_count: number | null; status: string | null } | null = null;
      if (currentBooking.user_ticket_id) {
        // RLS 우회: snapshot 조회는 service client 로 강제 (anon/cookie 컨텍스트에서도 안정적으로 잔여를 읽기 위함)
        const snapshotClient = createServiceClient() as any;
        const { data: utNow } = await snapshotClient
          .from('user_tickets')
          .select('remaining_count, status')
          .eq('id', currentBooking.user_ticket_id)
          .maybeSingle();
        if (utNow) {
          attendanceSnapshot = { remaining_count: utNow.remaining_count, status: utNow.status };
        }
      }
      await logTicketEvent({
        academy_id: academyId,
        user_id: currentBooking.user_id,
        user_ticket_id: currentBooking.user_ticket_id ?? null,
        booking_id: id,
        action: 'ATTENDANCE_CHECKED',
        // 출석 체크는 잔여를 변동시키지 않으므로 before == after
        before: attendanceSnapshot ?? undefined,
        after: attendanceSnapshot ?? undefined,
        via: 'manual',
        context: guestPayload,
        actor_user_id: actorId,
      }).catch(() => {});
    }

    // 활동 로그: 결석 처리 / 결석 취소 (표준 envelope)
    if (academyId && status === 'ABSENT' && oldStatus !== 'ABSENT') {
      await logTicketEvent({
        academy_id: academyId,
        user_id: currentBooking.user_id,
        user_ticket_id: currentBooking.user_ticket_id ?? null,
        booking_id: id,
        action: 'ABSENT_MARKED',
        before: { status: oldStatus },
        after: { status: 'ABSENT' },
        via: 'manual',
        context: guestPayload,
        actor_user_id: actorId,
      }).catch(() => {});
    }
    if (academyId && oldStatus === 'ABSENT' && status !== 'ABSENT') {
      await logTicketEvent({
        academy_id: academyId,
        user_id: currentBooking.user_id,
        user_ticket_id: currentBooking.user_ticket_id ?? null,
        booking_id: id,
        action: 'ABSENT_CLEARED',
        before: { status: 'ABSENT' },
        after: { status },
        via: 'manual',
        context: guestPayload,
        actor_user_id: actorId,
      }).catch(() => {});
    }

    // 출석 완료 알림 발송 (비동기)
    if (status === 'COMPLETED' && oldStatus === 'CONFIRMED' && updatedBooking?.user_id) {
      // 예약 상세 정보 조회 (학원명, 수업명, 시간 포함)
      (supabase as any)
        .from('bookings')
        .select(`
          id,
          classes!inner(title, academy_id, academies!inner(name_kr)),
          schedules(start_time, end_time)
        `)
        .eq('id', id)
        .single()
        .then(({ data: bookingDetail }: any) => {
          if (!bookingDetail) return;
          
          const academyName = bookingDetail.classes?.academies?.name_kr || '학원';
          const classTitle = bookingDetail.classes?.title || '수업';
          const startTime = bookingDetail.schedules?.start_time;
          
          let timeStr = '';
          if (startTime) {
            timeStr = ` ${formatKSTDate(new Date(startTime))} ${formatKSTTime(startTime)}`;
          }
          
          return sendNotification({
            user_id: updatedBooking.user_id,
            type: 'attendance_checked',
            title: '출석 체크 완료',
            body: `${academyName} ${classTitle} 출석이 확인되었습니다.${timeStr}`,
            data: { booking_id: id, url: '/my/bookings', academy_name: academyName },
            academy_id: bookingDetail.classes?.academy_id,
          });
        })
        .catch((err: any) => console.error('[attendance-notification]', err));
    }

    return NextResponse.json({
      data: updatedBooking,
      message: '예약 상태가 변경되었습니다.',
      oldStatus,
      newStatus: status,
    });
  } catch (error: any) {
    console.error('Error in PATCH /api/bookings/[id]/status:', error);
    return NextResponse.json(
      { error: '예약 상태 변경 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
