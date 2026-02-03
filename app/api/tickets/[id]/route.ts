import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

/**
 * GET /api/tickets/[id]
 * 단일 수강권 조회 (구매 링크용 - 공개·판매중인 것만)
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient() as any;
    const { data: ticket, error } = await supabase
      .from('tickets')
      .select(`
        id,
        name,
        price,
        ticket_type,
        total_count,
        valid_days,
        academy_id,
        is_on_sale,
        is_public,
        ticket_category,
        count_options,
        academies (
          id,
          name_kr,
          name_en,
          address,
          contact_number
        ),
        ticket_classes (
          class_id,
          classes (
            id,
            title,
            class_type
          )
        )
      `)
      .eq('id', id)
      .single();

    if (error || !ticket) {
      return NextResponse.json({ error: '수강권을 찾을 수 없습니다.' }, { status: 404 });
    }
    if (!ticket.is_on_sale) {
      return NextResponse.json({ error: '현재 판매 중인 수강권이 아닙니다.' }, { status: 400 });
    }
    if (ticket.is_public === false) {
      return NextResponse.json({ error: '비공개 수강권입니다.' }, { status: 403 });
    }

    return NextResponse.json({ data: ticket });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e.message || '서버 오류' }, { status: 500 });
  }
}
