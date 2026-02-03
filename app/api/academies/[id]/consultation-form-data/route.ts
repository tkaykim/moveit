import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

/**
 * GET /api/academies/[id]/consultation-form-data
 * 학원 상담 신청 폼용: 카테고리 목록 + 상담 가능 시각
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: academyId } = await params;
    const supabase = await createClient() as any;

    const [catRes, academyRes] = await Promise.all([
      supabase.from('consultation_categories').select('*').eq('academy_id', academyId).order('display_order').order('name'),
      supabase.from('academies').select('consultation_availability').eq('id', academyId).single(),
    ]);

    const categories = catRes.data || [];
    const availability = academyRes.data?.consultation_availability || { phone: [], visit: [] };

    return NextResponse.json({ data: { categories, availability } });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e.message || '서버 오류' }, { status: 500 });
  }
}
