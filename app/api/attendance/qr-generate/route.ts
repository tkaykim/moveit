import { generateQrToken } from '@/lib/qr-token';
import { NextResponse } from 'next/server';
import { getAuthenticatedUser, getAuthenticatedSupabase } from '@/lib/supabase/server-auth';

/**
 * POST /api/attendance/qr-generate
 * 인증된 사용자의 예약에 대해 QR 출석 토큰을 생성합니다. - 쿠키 또는 Authorization Bearer
 * Body: { bookingId: string }
 * Response: { token: string }
 */
export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json(
        { error: '인증이 필요합니다.' },
        { status: 401 }
      );
    }

    const supabase = await getAuthenticatedSupabase(request);

    const body = await request.json();
    const { bookingId } = body;

    if (!bookingId) {
      return NextResponse.json(
        { error: '예약 ID가 필요합니다.' },
        { status: 400 }
      );
    }

    // 예약 정보 조회
    const { data: booking, error: bookingError } = await (supabase as any)
      .from('bookings')
      .select('id, user_id, status, schedule_id, class_id, classes(title, academy_id, academies(name_kr)), schedules(start_time, end_time)')
      .eq('id', bookingId)
      .single();

    if (bookingError || !booking) {
      return NextResponse.json(
        { error: '예약을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 예약 상태 확인 (CONFIRMED 상태만 QR 생성 가능)
    if (booking.status !== 'CONFIRMED') {
      const statusMessages: Record<string, string> = {
        COMPLETED: '이미 출석완료된 수업입니다. QR 출석이 불필요합니다.',
        PENDING: '예약이 아직 확정되지 않았습니다. 학원에서 확정 후 QR 출석이 가능합니다.',
        CANCELLED: '취소된 예약입니다. QR 출석이 불가능합니다.',
      };
      const message = statusMessages[booking.status] ?? '확정된 예약만 QR 출석이 가능합니다.';
      return NextResponse.json(
        { error: message },
        { status: 400 }
      );
    }

    // QR 토큰 생성 (booking의 실제 user_id 사용)
    const tokenUserId = booking.user_id || user.id;
    const token = generateQrToken(bookingId, tokenUserId);

    return NextResponse.json({
      token,
      booking: {
        id: booking.id,
        className: booking.classes?.title || '클래스',
        academyName: booking.classes?.academies?.name_kr || '',
        startTime: booking.schedules?.start_time,
        endTime: booking.schedules?.end_time,
      },
    });
  } catch (error: any) {
    console.error('Error in POST /api/attendance/qr-generate:', error);
    return NextResponse.json(
      { error: 'QR 코드 생성 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
