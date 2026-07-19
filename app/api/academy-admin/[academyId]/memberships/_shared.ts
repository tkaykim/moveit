/**
 * academy-admin 멤버십 라우트 공통 (T3)
 * - 스태프 전용 게이트 (기존 assertAcademyAdmin 패턴 재사용)
 * - 도메인 에러 → HTTP 상태코드 매핑
 */
import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/supabase/server-auth';
import { createServiceClient } from '@/lib/supabase/server';
import { assertAcademyAdmin } from '@/lib/supabase/academy-admin-auth';
import { MembershipError } from '@/lib/db/memberships';

const STATUS_BY_CODE: Record<string, number> = {
  NOT_AUTHENTICATED: 401,
  NOT_AUTHORIZED: 403,
  NOT_ACADEMY_STAFF: 403,
  MEMBERSHIP_NOT_FOUND: 404,
  STUDENT_MEMBERSHIP_NOT_FOUND: 404,
  NOT_FOUND: 404,
  MEMBERSHIP_ACADEMY_MISMATCH: 403,
  ALREADY_ACTIVE_MEMBERSHIP: 409,
  INVALID_STATE_TRANSITION: 409,
  MEMBERSHIP_INACTIVE: 400,
  BUNDLED_TICKET_INVALID: 400,
  INVALID_DATE_RANGE: 400,
  INVALID_ARGUMENT: 400,
};

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/**
 * 스태프 인증 + 서비스 클라이언트 반환.
 * 권한이 없으면 HttpError 를 던진다 (withStaff 가 응답으로 변환).
 */
export async function requireStaff(request: Request, academyId: string) {
  const user = await getAuthenticatedUser(request);
  if (!user) throw new HttpError(401, '로그인이 필요합니다.');
  try {
    await assertAcademyAdmin(academyId, user.id);
  } catch {
    throw new HttpError(403, '학원 관리자 권한이 필요합니다.');
  }
  // 권한은 위에서 이미 검증했으므로 RLS 우회 클라이언트를 쓴다.
  return { user, supabase: createServiceClient() as any };
}

export async function withStaff<T>(
  request: Request,
  academyId: string,
  handler: (ctx: { user: { id: string }; supabase: any }) => Promise<T>
): Promise<NextResponse> {
  try {
    const ctx = await requireStaff(request, academyId);
    const data = await handler(ctx);
    return NextResponse.json(data as Record<string, unknown>);
  } catch (e: unknown) {
    if (e instanceof HttpError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    if (e instanceof MembershipError) {
      return NextResponse.json(
        { error: e.message, code: e.code },
        { status: STATUS_BY_CODE[e.code] ?? 400 }
      );
    }
    console.error('[academy-admin/memberships] error:', e);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

export function badRequest(message: string): never {
  throw new HttpError(400, message);
}
