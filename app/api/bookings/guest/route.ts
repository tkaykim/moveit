import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

/**
 * POST /api/bookings/guest
 * 비회원(게스트) 예약 생성
 * Body: {
 *   scheduleId: string,
 *   guestName: string,
 *   guestPhone: string,
 * }
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { scheduleId, guestName, guestPhone } = await request.json();

    // 필수 값 검증
    if (!scheduleId) {
      return NextResponse.json(
        { error: '세션 ID가 필요합니다.' },
        { status: 400 }
      );
    }

    if (!guestName || !guestName.trim()) {
      return NextResponse.json(
        { error: '이름을 입력해주세요.' },
        { status: 400 }
      );
    }

    if (!guestPhone || !guestPhone.trim()) {
      return NextResponse.json(
        { error: '연락처를 입력해주세요.' },
        { status: 400 }
      );
    }

    // 세션 정보 조회
    const { data: schedule, error: scheduleError } = await (supabase as any)
      .from('schedules')
      .select(`
        id, 
        class_id, 
        max_students, 
        current_students, 
        start_time, 
        is_canceled,
        classes (
          academy_id,
          price
        )
      `)
      .eq('id', scheduleId)
      .single();

    if (scheduleError || !schedule) {
      console.error('Schedule error:', scheduleError);
      return NextResponse.json(
        { error: '세션을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 예약 가능 여부 확인
    if (schedule.is_canceled) {
      return NextResponse.json(
        { error: '취소된 수업입니다.' },
        { status: 400 }
      );
    }

    if (new Date(schedule.start_time) < new Date()) {
      return NextResponse.json(
        { error: '이미 종료된 수업입니다.' },
        { status: 400 }
      );
    }

    const maxStudents = schedule.max_students || 20;
    const currentStudents = schedule.current_students || 0;

    if (currentStudents >= maxStudents) {
      return NextResponse.json(
        { error: '정원이 마감되었습니다.' },
        { status: 400 }
      );
    }

    // 중복 예약 확인 (같은 연락처로 같은 세션 예약)
    const { data: existingBooking } = await (supabase as any)
      .from('bookings')
      .select('id')
      .eq('schedule_id', scheduleId)
      .eq('guest_phone', guestPhone.trim())
      .not('status', 'eq', 'CANCELLED')
      .maybeSingle();

    if (existingBooking) {
      return NextResponse.json(
        { error: '이미 예약된 수업입니다. 동일한 연락처로 중복 예약할 수 없습니다.' },
        { status: 400 }
      );
    }

    // 예약 생성
    const { data: booking, error: bookingError } = await (supabase as any)
      .from('bookings')
      .insert({
        schedule_id: scheduleId,
        class_id: schedule.class_id,
        user_id: null,  // 게스트이므로 null
        user_ticket_id: null,
        guest_name: guestName.trim(),
        guest_phone: guestPhone.trim(),
        status: 'PENDING',  // 현장 결제 대기
        payment_status: 'PENDING',
      })
      .select()
      .single();

    if (bookingError) {
      console.error('Booking error:', bookingError);
      return NextResponse.json(
        { error: '예약 생성에 실패했습니다.' },
        { status: 500 }
      );
    }

    // 현재 학생 수 증가
    const { error: updateError } = await (supabase as any)
      .from('schedules')
      .update({ current_students: currentStudents + 1 })
      .eq('id', scheduleId);

    if (updateError) {
      console.error('Update students count error:', updateError);
      // 예약은 생성되었으므로 에러를 무시하고 진행
    }

    return NextResponse.json({
      data: booking,
      message: '예약이 완료되었습니다. 현장에서 결제해주세요.',
    });
  } catch (error: any) {
    console.error('Error in POST /api/bookings/guest:', error);
    return NextResponse.json(
      { error: '예약 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
