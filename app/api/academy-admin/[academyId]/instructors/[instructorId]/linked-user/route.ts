/**
 * GET /api/academy-admin/[academyId]/instructors/[instructorId]/linked-user
 * 해당 강사에 연결된 유저 정보 (id, email, name). 학원 관리자만.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/supabase/server-auth';
import { createServiceClient } from '@/lib/supabase/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ academyId: string; instructorId: string }> }
) {
  try {
    const { academyId, instructorId } = await params;
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

    const { data: instructor } = await serviceClient
      .from('instructors')
      .select('user_id')
      .eq('id', instructorId)
      .single();

    if (!instructor?.user_id) {
      return NextResponse.json({ user: null });
    }

    const { data: linkedUser } = await serviceClient
      .from('users')
      .select('id, email, name, nickname')
      .eq('id', instructor.user_id)
      .single();

    if (!linkedUser) {
      return NextResponse.json({ user: null });
    }

    return NextResponse.json({
      user: {
        id: linkedUser.id,
        email: (linkedUser as any).email ?? null,
        name: (linkedUser as any).name ?? (linkedUser as any).nickname ?? null,
      },
    });
  } catch (e) {
    console.error('[GET linked-user]', e);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
