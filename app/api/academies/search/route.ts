import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

/**
 * GET /api/academies/search
 * 학원 검색 (수강권 구매용)
 * Query params: q - 검색어
 */
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');

    if (!query || query.trim().length === 0) {
      return NextResponse.json({ data: [] });
    }

    const searchTerm = query.trim();

    const { data, error } = await supabase
      .from('academies')
      .select('id, name_kr, name_en')
      .or(`name_kr.ilike.%${searchTerm}%,name_en.ilike.%${searchTerm}%`)
      .limit(20)
      .order('name_kr', { ascending: true });

    if (error) {
      console.error('Error searching academies:', error);
      return NextResponse.json(
        { error: '학원 검색에 실패했습니다.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: data || [] });
  } catch (error: any) {
    console.error('Error in academy search API:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}



