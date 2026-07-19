/**
 * 운영 콘솔 조회 라우트 공통 게이트 (T9)
 *
 * 권한은 **서버에서만** 판정한다 (assertAcademyAdmin). 클라이언트 플래그는 신뢰하지 않는다.
 */
import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/supabase/server-auth';
import { createServiceClient } from '@/lib/supabase/server';
import { assertAcademyAdmin } from '@/lib/supabase/academy-admin-auth';

const ADMIN_REQUIRED = '학원 관리자 권한이 필요합니다.';

export async function withConsoleStaff<T>(
  request: Request,
  academyId: string,
  handler: (ctx: { user: { id: string }; supabase: any }) => Promise<T>
): Promise<NextResponse> {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }
    try {
      await assertAcademyAdmin(academyId, user.id);
    } catch {
      return NextResponse.json({ error: ADMIN_REQUIRED }, { status: 403 });
    }
    const data = await handler({ user, supabase: createServiceClient() as any });
    return NextResponse.json({ success: true, ...(data as Record<string, unknown>) });
  } catch (e: unknown) {
    if (e && typeof e === 'object' && 'message' in e && (e as Error).message === ADMIN_REQUIRED) {
      return NextResponse.json({ error: ADMIN_REQUIRED }, { status: 403 });
    }
    console.error('[academy-admin/console] error:', e);
    return NextResponse.json({ error: '조회에 실패했습니다.' }, { status: 500 });
  }
}
