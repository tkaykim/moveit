/**
 * PATCH /api/academy-admin/[academyId]/instructors/[instructorId]/link-user
 * 해당 학원에 등록된 강사에게 로그인 유저 계정 연결 (또는 연결 해제).
 * Body: { userId: string | null } — null이면 연결 해제.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/supabase/server-auth';
import { createServiceClient } from '@/lib/supabase/server';

export async function PATCH(
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

    const isSuperAdmin = (
      await serviceClient.from('users').select('role').eq('id', user.id).single()
    ).data?.role === 'SUPER_ADMIN';

    if (!isSuperAdmin) {
      const { data: roleData, error: roleError } = await serviceClient
        .from('academy_user_roles')
        .select('role')
        .eq('academy_id', academyId)
        .eq('user_id', user.id)
        .single();

      if (roleError || !roleData || !['ACADEMY_OWNER', 'ACADEMY_MANAGER'].includes(roleData.role)) {
        return NextResponse.json(
          { error: '학원 관리자 권한이 필요합니다.' },
          { status: 403 }
        );
      }
    }

    const body = await request.json().catch(() => ({}));
    const userId = body.userId === undefined ? undefined : body.userId;

    if (userId !== null && typeof userId !== 'string') {
      return NextResponse.json(
        { error: 'userId는 문자열이거나 null이어야 합니다.' },
        { status: 400 }
      );
    }

    const { data: linkRow } = await serviceClient
      .from('academy_instructors')
      .select('id')
      .eq('academy_id', academyId)
      .eq('instructor_id', instructorId)
      .maybeSingle();

    if (!linkRow) {
      return NextResponse.json(
        { error: '해당 학원에 등록된 강사가 아닙니다.' },
        { status: 404 }
      );
    }

    const { error: updateError } = await serviceClient
      .from('instructors')
      .update({ user_id: userId ?? null } as any)
      .eq('id', instructorId);

    if (updateError) {
      console.error('[link-user]', updateError);
      return NextResponse.json(
        { error: '연결 정보를 저장하는 데 실패했습니다.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: userId ? '계정이 연결되었습니다.' : '연결이 해제되었습니다.',
      instructor_id: instructorId,
      user_id: userId ?? null,
    });
  } catch (e) {
    console.error('[PATCH academy-admin instructors link-user]', e);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
