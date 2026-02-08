import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

/**
 * GET /api/academies/[id]/consultation-availability
 * 학원의 상담 가능 시간 조회
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: academyId } = await params;
    const supabase = await createClient() as any;

    const { data, error } = await supabase
      .from('academies')
      .select('consultation_availability')
      .eq('id', academyId)
      .single();

    if (error) {
      console.error(error);
      return NextResponse.json({ error: '조회에 실패했습니다.' }, { status: 500 });
    }

    // 기본값 설정: 모든 요일 24시간 가능
    const allDaysSlot = [{ start: "00:00", end: "23:59" }];
    const defaultAvailability = {
      phone: { mon: allDaysSlot, tue: allDaysSlot, wed: allDaysSlot, thu: allDaysSlot, fri: allDaysSlot, sat: allDaysSlot, sun: allDaysSlot },
      visit: { mon: allDaysSlot, tue: allDaysSlot, wed: allDaysSlot, thu: allDaysSlot, fri: allDaysSlot, sat: allDaysSlot, sun: allDaysSlot },
    };

    return NextResponse.json({ 
      data: data?.consultation_availability || defaultAvailability 
    });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e.message || '서버 오류' }, { status: 500 });
  }
}

/**
 * PUT /api/academies/[id]/consultation-availability
 * 학원의 상담 가능 시간 업데이트
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: academyId } = await params;
    const supabase = await createClient() as any;
    const body = await request.json();

    // 유효성 검사
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 });
    }

    const { error } = await supabase
      .from('academies')
      .update({ 
        consultation_availability: body,
        updated_at: new Date().toISOString()
      })
      .eq('id', academyId);

    if (error) {
      console.error(error);
      return NextResponse.json({ error: '저장에 실패했습니다.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: '저장되었습니다.' });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e.message || '서버 오류' }, { status: 500 });
  }
}
