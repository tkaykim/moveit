import { createClient } from '@/lib/supabase/server';
import { getAuthenticatedUser } from '@/lib/supabase/server-auth';
import { assertAcademyAdmin } from '@/lib/supabase/academy-admin-auth';
import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';


export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const supabase = await createClient() as any;

    // 대상 카테고리의 academy_id 확인 (소속 학원 검증용)
    const { data: category, error: fetchError } = await supabase
      .from('consultation_categories')
      .select('academy_id')
      .eq('id', id)
      .single();
    if (fetchError || !category) {
      return NextResponse.json({ error: '카테고리를 찾을 수 없습니다.' }, { status: 404 });
    }

    try {
      await assertAcademyAdmin(category.academy_id, user.id);
    } catch {
      return NextResponse.json({ error: '학원 관리자 권한이 필요합니다.' }, { status: 403 });
    }

    const { error } = await supabase.from('consultation_categories').delete().eq('id', id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || '서버 오류' }, { status: 500 });
  }
}
