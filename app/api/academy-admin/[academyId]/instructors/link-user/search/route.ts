/**
 * GET /api/academy-admin/[academyId]/instructors/link-user/search?q=
 * 강사 계정 연결 시 유저 검색 (이메일·이름 일부). 학원 관리자만 호출 가능.
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
    if (q.length < 2) {
      return NextResponse.json({ users: [] });
    }

    const pattern = `%${q.replace(/%/g, '\\%').replace(/_/g, '\\_')}%`;
    const { data: users, error } = await serviceClient
      .from('users')
      .select('id, email, name, nickname')
      .or(`email.ilike.${pattern},name.ilike.${pattern},nickname.ilike.${pattern}`)
      .limit(15);

    if (error) {
      console.error('[link-user search]', error);
      return NextResponse.json({ error: '검색에 실패했습니다.' }, { status: 500 });
    }

    return NextResponse.json({
      users: (users || []).map((u: any) => ({
        id: u.id,
        email: u.email ?? null,
        name: u.name ?? u.nickname ?? null,
      })),
    });
  } catch (e) {
    console.error('[GET academy-admin instructors link-user search]', e);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
