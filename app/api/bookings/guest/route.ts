import { createServiceClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { insertEnrollmentActivityLog } from '@/lib/db/enrollment-activity-log';

/**
 * POST /api/bookings/guest
 * 비회원(게스트) 예약 생성
 * Body: {
 *   scheduleId: string,
 *   guestName: string,
 *   guestPhone?: string,
 *   guestEmail?: string,
 * }
 * guestPhone 또는 guestEmail 중 하나는 필수
 */
export async function POST(request: Request) {
  try {
    // 게스트(비회원)는 세션이 없어 anon 역할이 됨 → bookings RLS를 로그인 전용으로 잠그기 위해
    // 이 라우트는 service-role로 동작(서버측 검증으로 안전). anon은 bookings에 직접 접근 불가.
    const supabase = createServiceClient();
    const { scheduleId, guestName, guestPhone, guestEmail } = await request.json();

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

    const phone = guestPhone ? String(guestPhone).trim() : '';
    const email = guestEmail ? String(guestEmail).trim() : '';

    // B-4 (2026-04-27): 이메일 필수화 (영수증·알림 채널 단일화 + 외국인 수용).
    // 전화는 옵션 — 한국 전화 없는 외국인이 Gmail만으로 결제 가능.
    if (!email) {
      return NextResponse.json(
        { error: '이메일을 입력해주세요. (영수증·알림 발송용)' },
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
        hall_id,
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

    // 중복 예약 확인 (같은 연락처 또는 이메일로 같은 세션 예약)
    if (phone) {
      const { data: existingByPhone } = await (supabase as any)
        .from('bookings')
        .select('id')
        .eq('schedule_id', scheduleId)
        .eq('guest_phone', phone)
        .not('status', 'eq', 'CANCELLED')
        .maybeSingle();

      if (existingByPhone) {
        return NextResponse.json(
          { error: '이미 예약된 수업입니다. 동일한 연락처로 중복 예약할 수 없습니다.' },
          { status: 400 }
        );
      }
    }
    if (email) {
      const { data: existingByEmail } = await (supabase as any)
        .from('bookings')
        .select('id')
        .eq('schedule_id', scheduleId)
        .eq('guest_email', email)
        .not('status', 'eq', 'CANCELLED')
        .maybeSingle();

      if (existingByEmail) {
        return NextResponse.json(
          { error: '이미 예약된 수업입니다. 동일한 이메일로 중복 예약할 수 없습니다.' },
          { status: 400 }
        );
      }
    }

    // 예약 생성
    const { data: booking, error: bookingError } = await (supabase as any)
      .from('bookings')
      .insert({
        schedule_id: scheduleId,
        class_id: schedule.class_id,
        hall_id: schedule.hall_id ?? null,
        user_id: null,
        user_ticket_id: null,
        guest_name: guestName.trim(),
        guest_phone: phone || null,
        guest_email: email || null,
        status: 'PENDING',
        payment_status: 'PENDING',
      })
      .select()
      .single();

    if (bookingError) {
      console.error('Booking error:', bookingError);
      // DB 백스톱(유니크 인덱스/정원 트리거)에서 올라온 경합 에러를 사용자 메시지로 매핑
      if (bookingError.code === '23505') {
        return NextResponse.json(
          { error: '이미 예약된 수업입니다.' },
          { status: 409 }
        );
      }
      if (typeof bookingError.message === 'string' && bookingError.message.includes('SCHEDULE_FULL')) {
        return NextResponse.json({ error: '정원이 마감되었습니다.' }, { status: 409 });
      }
      if (typeof bookingError.message === 'string' && bookingError.message.includes('SCHEDULE_CANCELED')) {
        return NextResponse.json({ error: '취소된 수업입니다.' }, { status: 400 });
      }
      return NextResponse.json(
        { error: '예약 생성에 실패했습니다.' },
        { status: 500 }
      );
    }

    // current_students 는 bookings 트리거(sync_schedule_student_count)가 자동 동기화한다.
    // (기존 수동 +1 은 stale 스냅샷 기반이라 트리거 값을 클로버하므로 제거)

    // 활동 로그: 비회원 수강신청
    const academyId = schedule.classes?.academy_id;
    if (academyId) {
      insertEnrollmentActivityLog({
        academy_id: academyId,
        user_id: null,
        booking_id: booking.id,
        action: 'ENROLL',
        payload: {
          via: 'guest_onsite',
          guest_name: guestName.trim(),
          guest_phone: phone || null,
          guest_email: email || null,
          schedule_id: scheduleId,
          class_id: schedule.class_id,
        },
      }, supabase as any).catch(() => {});
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
