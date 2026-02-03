import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

/**
 * GET ?academyId=xxx - 목록
 * POST - 생성 { academy_id, name, duration_minutes }
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const academyId = searchParams.get('academyId');
    if (!academyId) {
      return NextResponse.json({ error: 'academyId 필요' }, { status: 400 });
    }
    const supabase = await createClient() as any;
    const { data, error } = await supabase
      .from('consultation_categories')
      .select('*')
      .eq('academy_id', academyId)
      .order('display_order')
      .order('name');
    if (error) throw error;
    return NextResponse.json({ data: data || [] });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || '서버 오류' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient() as any;
    const body = await request.json();
    const { academy_id, name, duration_minutes } = body;
    if (!academy_id || !name?.trim()) {
      return NextResponse.json({ error: 'academy_id, name 필요' }, { status: 400 });
    }
    const { data, error } = await supabase
      .from('consultation_categories')
      .insert({
        academy_id,
        name: String(name).trim(),
        duration_minutes: duration_minutes ?? 30,
      })
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json({ data });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || '서버 오류' }, { status: 500 });
  }
}
