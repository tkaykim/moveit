import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { getAcademyBySlug } from '@/lib/db/miniapp';
import { TossCallbackView } from './toss-callback-view';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

/**
 * Toss 일회성 결제 **성공** 리다이렉트 착지점 (T-P)
 *
 * Toss 는 successUrl 로 ?paymentKey=&orderId=&amount= 를 붙여 돌려보낸다.
 * 여기서 서버 승인·이행을 부르고(주문 상태의 정본은 서버), 끝나면 주문 상태 화면으로 보낸다.
 */
export default async function TossCallbackPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const academy = await getAcademyBySlug(slug);
  if (!academy) notFound();

  return (
    <Suspense fallback={null}>
      <TossCallbackView slug={slug} academyId={academy.id} />
    </Suspense>
  );
}
