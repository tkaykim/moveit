/**
 * GET /api/academy-admin/[academyId]/console/students   (T9)
 *
 * 수강생 목록 — 보유 수강권(잔여/만료/미시작)과 현재 멤버십을 함께.
 *
 * ⚠ 한 번의 요청으로 전체 페이지를 채운다. 학생 1명당 1요청(N+1)은 결함이다.
 *   집계는 lib/db/operator-console.ts 가 고정 쿼리 수로 처리한다.
 */
import { NextRequest } from 'next/server';
import { getStudentOverview } from '@/lib/db/operator-console';
import { withConsoleStaff } from '../_shared';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ academyId: string }> }
) {
  const { academyId } = await params;
  return withConsoleStaff(request, academyId, ({ supabase }) =>
    getStudentOverview(supabase, academyId)
  );
}
