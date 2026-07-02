import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getAuthenticatedUser } from '@/lib/supabase/server-auth';

export const dynamic = 'force-dynamic';

/** 워크샵 정원 마감 시 대기열 등록 (비회원 허용) */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const scheduleId: string = body?.scheduleId;
    const name: string = body?.name?.trim();
    const phone: string = body?.phone?.trim();
    if (!scheduleId || !name || !phone) {
      return NextResponse.json({ error: '이름과 연락처를 입력해 주세요.' }, { status: 400 });
    }

    const supabase = createServiceClient();

    const { data: schedule } = await supabase
      .from('schedules')
      .select('id, max_students, current_students, is_canceled, classes!inner(academy_id)')
      .eq('id', scheduleId)
      .maybeSingle();

    if (!schedule || (schedule as { is_canceled: boolean | null }).is_canceled) {
      return NextResponse.json({ error: '해당 일정을 찾을 수 없습니다.' }, { status: 404 });
    }
    const sc = schedule as unknown as {
      max_students: number | null;
      current_students: number | null;
      classes: { academy_id: string };
    };
    const full = typeof sc.max_students === 'number' && (sc.current_students ?? 0) >= sc.max_students;
    if (!full) {
      return NextResponse.json({ error: '아직 자리가 남아 있습니다. 바로 신청해 주세요.' }, { status: 409 });
    }

    const user = await getAuthenticatedUser(request);

    const { error } = await supabase.from('workshop_waitlist').insert({
      academy_id: sc.classes.academy_id,
      schedule_id: scheduleId,
      user_id: user?.id ?? null,
      name,
      phone,
      email: body?.email?.trim() || null,
    } as never);

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: '이미 대기 신청이 되어 있습니다.' }, { status: 409 });
      }
      console.error('[workshops/waitlist] insert:', error);
      return NextResponse.json({ error: '대기 신청에 실패했습니다.' }, { status: 500 });
    }

    return NextResponse.json({ ok: true, message: '대기 신청이 완료되었습니다. 자리가 나면 연락드립니다.' });
  } catch (error) {
    console.error('[workshops/waitlist] Error:', error);
    return NextResponse.json({ error: '대기 신청 처리 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
