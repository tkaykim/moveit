import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { sendNotification } from '@/lib/notifications';

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
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const body = await request.json();
    const { status, updateScheduleCount = true, restoreTicket = false } = body;

    if (!status) {
      return NextResponse.json(
        { error: '상태 값이 필요합니다.' },
        { status: 400 }
      );
    }

    const validStatuses = ['CONFIRMED', 'COMPLETED', 'CANCELLED', 'PENDING'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: '유효하지 않은 상태 값입니다.' },
        { status: 400 }
      );
    }

    // 현재 예약 정보 조회
    const { data: currentBooking, error: bookingError } = await (supabase as any)
      .from('bookings')
      .select('*, schedule_id, status')
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

    // 상태 변경
    const { data: updatedBooking, error: updateError } = await (supabase as any)
      .from('bookings')
      .update({ status })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('Booking update error:', updateError);
      return NextResponse.json(
        { error: '예약 상태 변경에 실패했습니다.' },
        { status: 500 }
      );
    }

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
      }
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
