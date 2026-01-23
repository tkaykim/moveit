import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

/**
 * GET /api/tickets
 * 판매 중인 티켓 목록 조회
 * Query params: academyId (optional) - 특정 학원의 수강권만 조회
 */
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const academyId = searchParams.get('academyId');

    let query = supabase
      .from('tickets')
      .select(`
        *,
        academies (*),
        ticket_classes (
          class_id,
          classes (
            class_type
          )
        )
      `)
      .eq('is_on_sale', true)
      .order('created_at', { ascending: false });

    if (academyId) {
      // 특정 학원의 수강권만 조회
      query = query.eq('academy_id', academyId);
    } else {
      // 전체 수강권만 조회 (is_general=true)
      query = query.eq('is_general', true);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching tickets:', error);
      return NextResponse.json(
        { error: '수강권 목록을 불러오는데 실패했습니다.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: data || [] });
  } catch (error: any) {
    console.error('Error in tickets API:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

