import { BillingView } from '../../components/views/billing-view';

export default async function BillingPage({
  params,
}: {
  params: Promise<{ academyId: string }>;
}) {
  const { academyId } = await params;
  return <BillingView academyId={academyId} />;
}
