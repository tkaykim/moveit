import { getAcademyBySlug, getScheduleOccurrence } from '@/lib/db/miniapp';
import { createClient } from '@/lib/supabase/server';
import { resolveMiniSkin } from '@/lib/miniapp/skin';
import { ClassLinkView } from './class-link-view';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

/**
 * 수업 회차 딥링크 (Task L) — /s/[slug]/c/[scheduleId]
 *
 * "인스타 프로필 링크 → 전날 밤 특정 수업 신청" 이라는 MID 운영 방식을 그대로 담는,
 * **한 수업 한 링크**. 학원이 이 링크 하나를 붙이면 학생은 곧장 그 회차만 본다.
 *
 * 조회는 **사용자 세션 클라이언트**로 한다 — 대상 한정(멤버십 전용) 회차를 가리는
 * 정본은 RLS 다. 비회원/비자격자에겐 아예 null 이 돌아오고 "찾을 수 없음"으로 끝난다
 * (없는 회차와 못 보는 회차를 구분하지 않아 명단·존재 여부가 새지 않는다).
 */
export default async function ClassLinkPage({
  params,
}: {
  params: Promise<{ slug: string; scheduleId: string }>;
}) {
  const { slug, scheduleId } = await params;
  const academy = await getAcademyBySlug(slug);

  const uuidLike = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    scheduleId
  );

  const supabase = await createClient();
  const occurrence =
    academy && uuidLike
      ? await getScheduleOccurrence(
          supabase as unknown as { from: (t: string) => any },
          {
            academyId: academy.id,
            academyBookingPolicy: academy.booking_policy,
            scheduleId,
          }
        )
      : null;

  return (
    <ClassLinkView
      slug={slug}
      academyId={academy?.id ?? ''}
      academyName={academy ? academy.name_kr || academy.name_en || '학원' : '학원'}
      skin={academy ? resolveMiniSkin(academy) : null}
      occurrence={occurrence}
    />
  );
}
