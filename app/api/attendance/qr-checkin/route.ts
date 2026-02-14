import { verifyQrToken, verifyQrTokenSignature } from '@/lib/qr-token';
import { NextResponse } from 'next/server';
import { getAuthenticatedUser, getAuthenticatedSupabase } from '@/lib/supabase/server-auth';

/**
 * POST /api/attendance/qr-checkin
 * QR 코드를 스캔하여 출석 처리합니다. - 쿠키 또는 Authorization Bearer
 * Body: { token: string, academyId: string }
 * Response: { success: true, booking: {...}, userName: string }
 */
export async function POST(request: Request) {
  try {
    const authUser = await getAuthenticatedUser(request);
    if (!authUser) {
      return NextResponse.json(
        { error: '로그인이 필요합니다.' },
        { status: 401 }
      );
    }

    const supabase = await getAuthenticatedSupabase(request);

    const body = await request.json();
    const { token, academyId } = body;

    if (!token) {
      return NextResponse.json(
        { error: 'QR 토큰이 필요합니다.' },
        { status: 400 }
      );
    }

    if (!academyId) {
      return NextResponse.json(
        { error: '학원 ID가 필요합니다.' },
        { status: 400 }
      );
    }

    // 1단계: QR 토큰 기본 검증 (형식 + 만료 시간)
    const verification = verifyQrToken(token);
    if (!verification.valid) {
      return NextResponse.json(
        { error: verification.error },
        { status: 400 }
      );
    }

    const { bookingId } = verification;

    // 2단계: 예약 정보 조회
    const { data: booking, error: bookingError } = await (supabase as any)
      .from('bookings')
      .select(`
        id, user_id, status, schedule_id, class_id,
        classes(title, academy_id, academies(name_kr)),
        schedules(start_time, end_time),
        users(name, nickname, email)
      `)
      .eq('id', bookingId)
      .single();

    if (bookingError || !booking) {
      return NextResponse.json(
        { error: '예약을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 3단계: DB에서 가져온 userId로 서명 최종 검증
    if (!verifyQrTokenSignature(token, booking.user_id)) {
      return NextResponse.json(
        { error: '유효하지 않은 QR 코드입니다.' },
        { status: 400 }
      );
    }

    // 예약의 학원과 요청한 학원이 일치하는지 확인
    if (booking.classes?.academy_id !== academyId) {
      return NextResponse.json(
        { error: '이 학원의 예약이 아닙니다.' },
        { status: 400 }
      );
    }

    // 이미 출석 처리된 예약인지 확인
    if (booking.status === 'COMPLETED') {
      return NextResponse.json(
        { error: '이미 출석 처리된 예약입니다.', alreadyCheckedIn: true },
        { status: 409 }
      );
    }

    // 예약 상태 확인 (CONFIRMED만 출석 처리 가능)
    if (booking.status !== 'CONFIRMED') {
      return NextResponse.json(
        { error: `출석 처리할 수 없는 상태입니다. (현재: ${booking.status})` },
        { status: 400 }
      );
    }

    // 출석 처리: 상태를 COMPLETED로 변경
    const { data: updatedBooking, error: updateError } = await (supabase as any)
      .from('bookings')
      .update({ status: 'COMPLETED' })
      .eq('id', bookingId)
      .select()
      .single();

    if (updateError) {
      console.error('Booking update error:', updateError);
      return NextResponse.json(
        { error: '출석 처리에 실패했습니다.' },
        { status: 500 }
      );
    }

    // schedules.current_students 업데이트 (CONFIRMED + COMPLETED 합산)
    if (booking.schedule_id) {
      const { data: activeBookings, error: countError } = await (supabase as any)
        .from('bookings')
        .select('id')
        .eq('schedule_id', booking.schedule_id)
        .in('status', ['CONFIRMED', 'COMPLETED']);

      if (!countError) {
        const totalCount = activeBookings?.length || 0;
        await (supabase as any)
          .from('schedules')
          .update({ current_students: totalCount })
          .eq('id', booking.schedule_id);
      }
    }

    // 사용자 이름 결정
    const userName = booking.users?.nickname || booking.users?.name || booking.users?.email?.split('@')[0] || '회원';

    return NextResponse.json({
      success: true,
      booking: {
        id: booking.id,
        className: booking.classes?.title || '클래스',
        academyName: booking.classes?.academies?.name_kr || '',
        startTime: booking.schedules?.start_time,
        endTime: booking.schedules?.end_time,
      },
      userName,
      checkedInAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Error in POST /api/attendance/qr-checkin:', error);
    return NextResponse.json(
      { error: '출석 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
