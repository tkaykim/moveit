/**
 * GET /api/s/[slug]/week?w=<주 오프셋>   (T10)
 *
 * 학생 미니앱 시간표의 데이터 경로. **질의 한 번**으로 한 주 전체를 돌려준다
 * (회차마다 요청이 늘면 결함이다).
 *
 * ⚠ 스케줄 조회는 **사용자 세션 클라이언트**로만 한다.
 *   대상 한정(멤버십 전용) 수업을 가리는 정본은 RLS 이고,
 *   서비스롤로 읽으면 그 가림막이 통째로 사라진다.
 *   학원 자체 정보만 공개 필드로 서비스롤에서 읽는다.
 */
import { NextResponse } from 'next/server';
import { getAcademyBySlug, getWeekBoard } from '@/lib/db/miniapp';
import { getAuthenticatedSupabase } from '@/lib/supabase/server-auth';
import { weekStartFromOffset } from '@/lib/miniapp/week';

// getAcademyBySlug 가 서비스 클라이언트를 쓰므로 Data Cache 를 완전히 끈다.
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const revalidate = 0;

const NO_CACHE = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
  Pragma: 'no-cache',
} as const;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const academy = await getAcademyBySlug(slug);
    if (!academy) {
      return NextResponse.json({ error: '학원을 찾을 수 없습니다.' }, { status: 404, headers: NO_CACHE });
    }

    const { searchParams } = new URL(request.url);
    const offset = parseInt(searchParams.get('w') || '0', 10) || 0;
    const weekStart = weekStartFromOffset(offset);

    // RLS 를 지키는 클라이언트 — 이 사용자가 볼 자격이 있는 것만 돌아온다.
    const supabase = await getAuthenticatedSupabase(request);

    const items = await getWeekBoard(supabase as unknown as { from: (t: string) => any }, {
      academyId: academy.id,
      academyBookingPolicy: academy.booking_policy,
      weekStart,
    });

    return NextResponse.json(
      { week_start: weekStart.toISOString(), offset, items },
      { headers: NO_CACHE }
    );
  } catch (e: unknown) {
    console.error('[s/week]', (e as Error)?.message);
    return NextResponse.json(
      { error: '시간표를 불러오지 못했습니다.' },
      { status: 500, headers: NO_CACHE }
    );
  }
}
