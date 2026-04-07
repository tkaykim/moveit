import { BillingView } from '../../components/views/billing-view';
import { resolveAcademyId } from '@/lib/db/academies';

export default async function BillingPage({
  params,
}: {
  params: Promise<{ academyId: string }>;
}) {
  const { academyId: slugOrId } = await params;
  const academy = await resolveAcademyId(slugOrId);
  const academyId = academy?.id ?? slugOrId;
  return <BillingView academyId={academyId} />;
}
