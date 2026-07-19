import { notFound } from 'next/navigation';
import { getAcademyBySlug, getWeekBoard } from '@/lib/db/miniapp';
import { createClient } from '@/lib/supabase/server';
import { resolveMiniSkin } from '@/lib/miniapp/skin';
import { clampWeekOffset, weekStartFromOffset } from '@/lib/miniapp/week';
import { ScheduleBoard } from './schedule-board';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

/**
 * 시간표 탭 (T10)
 *
 * 한 주치를 **질의 한 번**으로 읽는다. 회차마다 추가 요청은 결함이다.
 * 조회는 **사용자 세션 클라이언트**로 한다 — 대상 한정 수업을 가리는 정본은
 * RLS 이고, 화면은 돌려받은 것을 그대로 그린다(클라이언트 필터링 금지).
 */
export default async function MiniSchedulePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ w?: string }>;
}) {
  const { slug } = await params;
  const { w } = await searchParams;
  const academy = await getAcademyBySlug(slug);
  if (!academy) notFound();

  const offset = clampWeekOffset(parseInt(w || '0', 10) || 0);
  const weekStart = weekStartFromOffset(offset);

  const supabase = await createClient();
  const items = await getWeekBoard(supabase as unknown as { from: (t: string) => any }, {
    academyId: academy.id,
    academyBookingPolicy: academy.booking_policy,
    weekStart,
  });

  return (
    <ScheduleBoard
      slug={slug}
      academyId={academy.id}
      skin={resolveMiniSkin(academy)}
      offset={offset}
      weekStartIso={weekStart.toISOString()}
      items={items}
    />
  );
}
