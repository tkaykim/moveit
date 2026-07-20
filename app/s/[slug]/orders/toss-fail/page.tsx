import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { getAcademyBySlug } from '@/lib/db/miniapp';
import { TossFailView } from './toss-fail-view';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

/**
 * Toss 일회성 결제 **실패/취소** 리다이렉트 착지점 (T-P)
 *
 * Toss 는 failUrl 로 ?code=&message=&orderId= 를 붙여 돌려보낸다.
 * 여기서는 아무것도 만들지도 확정하지도 않는다 — 기존 PENDING 주문은 그대로 두고
 * (만료되거나 재시도 가능) 취소되었음을 알린 뒤 장바구니로 돌아갈 길을 준다.
 */
export default async function TossFailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const academy = await getAcademyBySlug(slug);
  if (!academy) notFound();

  return (
    <Suspense fallback={null}>
      <TossFailView slug={slug} />
    </Suspense>
  );
}
