/**
 * 라이트 어드민(/a/[slug]) 전용 얇은 서버 게이트.
 *
 * 권한은 **서버에서만** 판정한다 (assertAcademyAdmin). 클라이언트 플래그는 신뢰하지 않는다.
 * 이 레이어는 비즈니스 로직을 새로 만들지 않는다 — 인증 + 위임 + 에러 매핑만 한다.
 * 실제 도메인 규칙(예약 가능 조건·휴강 전파 등)은 전부 기존 엔진/트리거가 정본으로 갖는다.
 */
import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/supabase/server-auth';
import { createServiceClient } from '@/lib/supabase/server';
import { assertAcademyAdmin } from '@/lib/supabase/academy-admin-auth';

const ADMIN_REQUIRED = '학원 관리자 권한이 필요합니다.';

export interface StaffCtx {
  user: { id: string };
  supabase: any;
}

export async function withStaff(
  request: Request,
  academyId: string,
  handler: (ctx: StaffCtx) => Promise<Record<string, unknown> | NextResponse>
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
    const result = await handler({ user, supabase: createServiceClient() as any });
    if (result instanceof NextResponse) return result;
    return NextResponse.json({ success: true, ...result });
  } catch (e: unknown) {
    if (e && typeof e === 'object' && 'message' in e && (e as Error).message === ADMIN_REQUIRED) {
      return NextResponse.json({ error: ADMIN_REQUIRED }, { status: 403 });
    }
    console.error('[api/a] error:', e);
    return NextResponse.json({ error: '처리에 실패했습니다.' }, { status: 500 });
  }
}

export function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

/** 주어진 행이 이 학원에 속하는지 확인 (교차 학원 접근 차단) */
export async function belongsToAcademy(
  supabase: any,
  table: string,
  id: string,
  academyId: string
): Promise<boolean> {
  const { data } = await supabase.from(table).select('id').eq('id', id).eq('academy_id', academyId).maybeSingle();
  return !!data;
}
