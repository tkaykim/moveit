import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

/**
 * POST /api/bookings/admin-add-guest
 * 관리자 권한으로 비회원(이름·연락처·사유 직접 입력) 수기 추가 — docs/update .md 4-B
 * Body: {
 *   scheduleId: string,
 *   academyId: string,
 *   guestName: string,
 *   guestPhone: string,
 *   adminNote?: string,
 * }
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient() as any;
    const body = await request.json();
    const { scheduleId, academyId, guestName, guestPhone, adminNote } = body;

    if (!scheduleId || !academyId) {
      return NextResponse.json(
        { error: 'scheduleId, academyId가 필요합니다.' },
        { status: 400 }
      );
    }

    if (!guestName || !String(guestName).trim()) {
      return NextResponse.json(
        { error: '이름을 입력해주세요.' },
        { status: 400 }
      );
    }

    if (!guestPhone || !String(guestPhone).trim()) {
      return NextResponse.json(
        { error: '연락처를 입력해주세요.' },
        { status: 400 }
      );
    }

    const { data: schedule, error: scheduleError } = await supabase
      .from('schedules')
      .select(`
        id,
        class_id,
        hall_id,
        current_students,
        max_students,
        is_canceled,
        classes ( id, academy_id )
      `)
      .eq('id', scheduleId)
      .single();

    if (scheduleError || !schedule) {
      return NextResponse.json(
        { error: '스케줄을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    const scheduleAcademyId = schedule.classes?.academy_id;
    if (!scheduleAcademyId || scheduleAcademyId !== academyId) {
      return NextResponse.json(
        { error: '해당 학원의 스케줄이 아닙니다.' },
        { status: 403 }
      );
    }

    if (schedule.is_canceled) {
      return NextResponse.json(
        { error: '취소된 수업입니다.' },
        { status: 400 }
      );
    }

    const currentStudents = schedule.current_students || 0;
    const maxStudents = schedule.max_students || 0;
    if (maxStudents > 0 && currentStudents >= maxStudents) {
      return NextResponse.json(
        { error: '정원이 마감되었습니다.' },
        { status: 400 }
      );
    }

    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .insert({
        schedule_id: scheduleId,
        class_id: schedule.class_id,
        hall_id: schedule.hall_id ?? null,
        user_id: null,
        user_ticket_id: null,
        guest_name: String(guestName).trim(),
        guest_phone: String(guestPhone).trim(),
        status: 'CONFIRMED',
        is_admin_added: true,
        payment_status: null,
        admin_note: adminNote ? String(adminNote).trim() : null,
      })
      .select()
      .single();

    if (bookingError) {
      console.error('Admin-add-guest booking error:', bookingError);
      return NextResponse.json(
        { error: '수기 추가에 실패했습니다.' },
        { status: 500 }
      );
    }

    await supabase
      .from('schedules')
      .update({ current_students: currentStudents + 1 })
      .eq('id', scheduleId);

    return NextResponse.json({
      data: booking,
      message: '게스트로 수강 명단에 추가되었습니다.',
    });
  } catch (error: any) {
    console.error('Error in POST /api/bookings/admin-add-guest:', error);
    return NextResponse.json(
      { error: '수기 추가에 실패했습니다.' },
      { status: 500 }
    );
  }
}
