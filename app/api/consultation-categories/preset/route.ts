import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

const PRESETS = [
  { name: '입시반', duration_minutes: 30 },
  { name: '오디션반', duration_minutes: 30 },
  { name: '전문반', duration_minutes: 30 },
  { name: '일반 상담', duration_minutes: 10 },
];

/**
 * POST ?academyId=xxx - 프리셋 카테고리 적용 (입시반 30분, 오디션반 30분, 전문반 30분, 일반 상담 10분)
 */
export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const academyId = searchParams.get('academyId');
    if (!academyId) {
      return NextResponse.json({ error: 'academyId 필요' }, { status: 400 });
    }
    const supabase = await createClient() as any;
    const existing = await supabase
      .from('consultation_categories')
      .select('id')
      .eq('academy_id', academyId);
    if ((existing.data?.length ?? 0) > 0) {
      return NextResponse.json(
        { error: '이미 카테고리가 있으면 프리셋을 적용할 수 없습니다. 기존 카테고리를 삭제한 후 시도하세요.' },
        { status: 400 }
      );
    }
    const inserts = PRESETS.map((p, i) => ({
      academy_id: academyId,
      name: p.name,
      duration_minutes: p.duration_minutes,
      display_order: i,
    }));
    const { data, error } = await supabase
      .from('consultation_categories')
      .insert(inserts)
      .select();
    if (error) throw error;
    return NextResponse.json({ data, message: '프리셋이 적용되었습니다.' });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || '서버 오류' }, { status: 500 });
  }
}
