import { notFound } from 'next/navigation';
import { getAcademyBySlug } from '@/lib/db/miniapp';
import { resolveMiniSkin } from '@/lib/miniapp/skin';
import { OrderStatusView } from './order-status-view';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export default async function MiniOrderPage({
  params,
}: {
  params: Promise<{ slug: string; orderId: string }>;
}) {
  const { slug, orderId } = await params;
  const academy = await getAcademyBySlug(slug);
  if (!academy) notFound();

  return (
    <OrderStatusView
      slug={slug}
      academyId={academy.id}
      providerOrderId={decodeURIComponent(orderId)}
      skin={resolveMiniSkin(academy)}
    />
  );
}
