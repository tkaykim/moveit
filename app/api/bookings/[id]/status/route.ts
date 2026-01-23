import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

/**
 * PATCH /api/bookings/[id]/status
 * 예약 상태 변경 (PENDING -> CONFIRMED, CONFIRMED -> COMPLETED, 취소 등)
 * Body: {
 *   status: 'CONFIRMED' | 'COMPLETED' | 'CANCELLED' | 'PENDING',
 *   updateScheduleCount?: boolean  // schedules.current_students 업데이트 여부
 * }
 * 
 * 참고: 기간권(PERIOD) 예약의 경우 remaining_count가 null이므로
 * 취소 시 수강권 횟수 복원이 필요 없습니다.
 * 횟수권(COUNT) 예약의 경우에만 별도 복원 로직이 필요할 수 있습니다.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const body = await request.json();
    const { status, updateScheduleCount = true } = body;

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
