/**
 * GET /api/academy-admin/[academyId]/console/roster?date=YYYY-MM-DD   (T9)
 *
 * "이 수업에 누가 오는가" 를 한 화면에서 답하기 위한 조회.
 * 날짜(KST) → 회차 → 예약자(이름·연락처·사용 수강권·차감 상태·출석 상태·홀드 여부).
 */
import { NextRequest } from 'next/server';
import { getRoster } from '@/lib/db/operator-console';
import { kstToday } from '@/lib/date/kst';
import { withConsoleStaff } from '../_shared';

export const dynamic = 'force-dynamic';
// 운영 화면은 절대 캐시된 DB 읽기를 보면 안 된다 (Next Data Cache 는 디스크에 남는다)
export const fetchCache = 'force-no-store';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ academyId: string }> }
) {
  const { academyId } = await params;
  const raw = new URL(request.url).searchParams.get('date');
  const date = raw && DATE_RE.test(raw) ? raw : kstToday();

  return withConsoleStaff(request, academyId, ({ supabase }) =>
    getRoster(supabase, academyId, date)
  );
}
