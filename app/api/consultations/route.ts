import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

/**
 * POST /api/consultations
 * 상담 신청 (공개 - 학원 상세에서 사용)
 * Body: { academy_id, name, phone, category_id?, detail?, visit_datetime?, topic? }
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient() as any;
    const body = await request.json();
    const { academy_id, name, phone, category_id, detail, visit_datetime, topic } = body;

    if (!academy_id || !name || !String(name).trim()) {
      return NextResponse.json(
        { error: 'academy_id와 이름이 필요합니다.' },
        { status: 400 }
      );
    }

    const { error } = await supabase.from('consultations').insert({
      academy_id,
      name: String(name).trim(),
      phone: phone ? String(phone).trim() : null,
      topic: topic || '상담 신청',
      status: 'NEW',
      category_id: category_id || null,
      detail: detail ? String(detail).trim() : null,
      visit_datetime: visit_datetime || null,
    });

    if (error) {
      console.error(error);
      return NextResponse.json({ error: '상담 신청 저장에 실패했습니다.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: '상담 신청이 접수되었습니다.' });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e.message || '서버 오류' }, { status: 500 });
  }
}
