import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { Database } from '@/types/database';

/**
 * POST /api/bookings/admin-add
 * 관리자 권한으로 수강권 없이 수업에 인원을 수기 추가
 * Body: { scheduleId: string, userId: string, academyId: string }
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient() as any;
    const body = await request.json();
    const { scheduleId, userId, academyId } = body;

    if (!scheduleId || !userId || !academyId) {
      return NextResponse.json(
        { error: 'scheduleId, userId, academyId가 필요합니다.' },
        { status: 400 }
      );
    }

    const { data: schedule, error: scheduleError } = await supabase
      .from('schedules')
      .select(`
        id,
        class_id,
        hall_id,
        classes (
          id,
          academy_id
        )
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

    // 이미 해당 스케줄에 같은 사용자가 예약되어 있는지 확인
    const { data: existing } = await supabase
      .from('bookings')
      .select('id')
      .eq('schedule_id', scheduleId)
      .eq('user_id', userId)
      .in('status', ['CONFIRMED', 'PENDING', 'COMPLETED'])
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: '이미 해당 수업에 신청되어 있습니다.' },
        { status: 400 }
      );
    }

    const bookingData: Database['public']['Tables']['bookings']['Insert'] = {
      user_id: userId,
      class_id: schedule.class_id,
      schedule_id: scheduleId,
      hall_id: schedule.hall_id ?? null,
      user_ticket_id: null,
      status: 'CONFIRMED',
      is_admin_added: true,
      payment_status: null,
    };

    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .insert(bookingData)
      .select()
      .single();

    if (bookingError) {
      console.error('Admin-add booking error:', bookingError);
      return NextResponse.json(
        { error: '수기 추가에 실패했습니다.' },
        { status: 500 }
      );
    }

    // 스케줄 current_students 증가
    const { data: currentSchedule } = await supabase
      .from('schedules')
      .select('current_students')
      .eq('id', scheduleId)
      .single();

    if (currentSchedule) {
      await supabase
        .from('schedules')
        .update({ current_students: (currentSchedule.current_students || 0) + 1 })
        .eq('id', scheduleId);
    }

    return NextResponse.json({
      data: booking,
      message: '관리자 권한으로 수강 명단에 추가되었습니다.',
    });
  } catch (error: any) {
    console.error('Error in POST /api/bookings/admin-add:', error);
    return NextResponse.json(
      { error: '수기 추가에 실패했습니다.' },
      { status: 500 }
    );
  }
}
