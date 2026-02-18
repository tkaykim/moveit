/**
 * GET /api/academy-admin/[academyId]/instructors/search?q=
 * 해당 학원에 등록된 강사만 검색 (다른 학원 강사 개인정보 미노출).
 */
import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/supabase/server-auth';
import { createServiceClient } from '@/lib/supabase/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ academyId: string }> }
) {
  try {
    const { academyId } = await params;
    const user = await getAuthenticatedUser(request);

    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const serviceClient = createServiceClient();
    const { data: userData } = await serviceClient
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();
    const isSuperAdmin = userData?.role === 'SUPER_ADMIN';

    if (!isSuperAdmin) {
      const { data: roleData, error: roleError } = await serviceClient
        .from('academy_user_roles')
        .select('role')
        .eq('academy_id', academyId)
        .eq('user_id', user.id)
        .single();
      if (roleError || !roleData || !['ACADEMY_OWNER', 'ACADEMY_MANAGER'].includes(roleData.role)) {
        return NextResponse.json({ error: '학원 관리자 권한이 필요합니다.' }, { status: 403 });
      }
    }

    const q = request.nextUrl.searchParams.get('q')?.trim() || '';

    // 학원 소속 강사만: academy_instructors 조인
    const { data: rows, error } = await serviceClient
      .from('academy_instructors')
      .select(
        `
        instructor_id,
        instructors (
          id,
          name_kr,
          name_en,
          contact,
          email
        )
      `
      )
      .eq('academy_id', academyId)
      .eq('is_active', true)
      .limit(50);

    if (error) {
      console.error('[instructors/search]', error);
      return NextResponse.json({ error: '검색에 실패했습니다.' }, { status: 500 });
    }

    const instructors = (rows || [])
      .map((r: any) => r.instructors)
      .filter((i: any) => i != null);

    const term = q.length >= 2 ? q.toLowerCase() : '';
    const filtered = term
      ? instructors.filter(
          (i: any) =>
            (i.name_kr && i.name_kr.toLowerCase().includes(term)) ||
            (i.name_en && i.name_en.toLowerCase().includes(term))
        )
      : instructors;

    return NextResponse.json({ instructors: filtered });
  } catch (e) {
    console.error('[GET academy-admin instructors/search]', e);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
