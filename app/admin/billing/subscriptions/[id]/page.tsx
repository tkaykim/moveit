import { SubscriptionDetailView } from '../../components/subscription-detail-view';

export default async function AdminBillingSubscriptionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <SubscriptionDetailView subscriptionId={id} />;
}
