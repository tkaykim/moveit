import { createClient, createServiceClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { sendNotification } from '@/lib/notifications';
import { getAuthenticatedUser } from '@/lib/supabase/server-auth';
import { insertEnrollmentActivityLog } from '@/lib/db/enrollment-activity-log';

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

    // 현재 예약 정보 조회 (활동 로그용 academy_id 포함)
    const { data: currentBooking, error: bookingError } = await (supabase as any)
      .from('bookings')
      .select('*, schedule_id, status, classes(academy_id)')
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
    const actorId = (await getAuthenticatedUser(request))?.id ?? null;
    // B-2 (2026-04-21): guest_name 존재로 비회원 판별. bank-transfer-order가 guest user.id를
    // booking.user_id에 채우기 시작한 이후로 user_id IS NULL 기준만으로는 비회원 booking을
    // 식별할 수 없음. guest_name은 가입 병합 후에도 보존되므로 activity log의 비회원
    // 표시 일관성 유지에 사용.
    const isGuestBooking = !!currentBooking.guest_name;
    const guestPayload = isGuestBooking
      ? { guest_name: currentBooking.guest_name, guest_phone: currentBooking.guest_phone || null }
      : {};

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
    if (status === 'CANCELLED' && restoreTicket && currentBooking.user_ticket_id) {
      const { data: userTicket, error: utError } = await (supabase as any)
        .from('user_tickets')
        .select('id, remaining_count, status, tickets(ticket_type, total_count)')
        .eq('id', currentBooking.user_ticket_id)
        .single();

      if (!utError && userTicket?.tickets?.ticket_type === 'COUNT' && typeof userTicket.remaining_count === 'number') {
        const newRemaining = userTicket.remaining_count + 1;
        const updateData: any = { remaining_count: newRemaining };
        
        // USED 상태였다면 복원 시 ACTIVE로 변경
        if (userTicket.status === 'USED' && newRemaining > 0) {
          updateData.status = 'ACTIVE';
        }
        
        await (supabase as any)
          .from('user_tickets')
          .update(updateData)
          .eq('id', currentBooking.user_ticket_id);

        // 활동 로그: 횟수 복구
        if (academyId) {
          insertEnrollmentActivityLog({
            academy_id: academyId,
            user_id: currentBooking.user_id,
            user_ticket_id: currentBooking.user_ticket_id,
            booking_id: id,
            action: 'COUNT_RESTORE',
            payload: { delta: 1, reason: 'booking_cancelled', ...guestPayload },
            actor_user_id: actorId,
          }).catch(() => {});
        }
      }
    }

    // 활동 로그: 예약 취소
    if (academyId && status === 'CANCELLED') {
      insertEnrollmentActivityLog({
        academy_id: academyId,
        user_id: currentBooking.user_id,
        user_ticket_id: currentBooking.user_ticket_id ?? null,
        booking_id: id,
        action: 'CANCEL',
        payload: { previous_status: oldStatus, ...guestPayload },
        actor_user_id: actorId,
      }).catch(() => {});
    }

    // schedules.current_students 업데이트
    if (updateScheduleCount && scheduleId) {
      // 해당 스케줄의 CONFIRMED + COMPLETED 예약 수 계산 (출석완료와 구입승인 모두 합산)
      const { data: confirmedBookings, error: confirmedError } = await (supabase as any)
        .from('bookings')
        .select('id')
        .eq('schedule_id', scheduleId)
        .in('status', ['CONFIRMED', 'COMPLETED']);

      if (!confirmedError) {
        const totalCount = confirmedBookings?.length || 0;
        
        // 스케줄의 current_students 업데이트
        const { error: scheduleUpdateError } = await (supabase as any)
          .from('schedules')
          .update({ current_students: totalCount })
          .eq('id', scheduleId);

        if (scheduleUpdateError) {
          console.error('Schedule update error:', scheduleUpdateError);
          // 예약은 업데이트되었으므로 에러를 무시하고 진행
        }
      }
    }

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
            const d = new Date(startTime);
            timeStr = ` (${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')})`;
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

    // 활동 로그: 출석 체크
    if (academyId && status === 'COMPLETED' && oldStatus === 'CONFIRMED') {
      insertEnrollmentActivityLog({
        academy_id: academyId,
        user_id: currentBooking.user_id,
        user_ticket_id: currentBooking.user_ticket_id ?? null,
        booking_id: id,
        action: 'ATTENDANCE_CHECKED',
        payload: { via: 'manual', ...guestPayload },
        actor_user_id: actorId,
      }).catch(() => {});
    }

    // 활동 로그: 결석 처리 / 결석 취소
    if (academyId && status === 'ABSENT' && oldStatus !== 'ABSENT') {
      insertEnrollmentActivityLog({
        academy_id: academyId,
        user_id: currentBooking.user_id,
        user_ticket_id: currentBooking.user_ticket_id ?? null,
        booking_id: id,
        action: 'ABSENT_MARKED',
        payload: { previous_status: oldStatus, ...guestPayload },
        actor_user_id: actorId,
      }).catch(() => {});
    }
    if (academyId && oldStatus === 'ABSENT' && status !== 'ABSENT') {
      insertEnrollmentActivityLog({
        academy_id: academyId,
        user_id: currentBooking.user_id,
        user_ticket_id: currentBooking.user_ticket_id ?? null,
        booking_id: id,
        action: 'ABSENT_CLEARED',
        payload: { next_status: status, ...guestPayload },
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
            const d = new Date(startTime);
            timeStr = ` ${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
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
