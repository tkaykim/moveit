import { SalesSystemView } from '../../components/views/sales-system-view';
import { RevenueView } from '../../components/views/revenue-view';
import { resolveAcademyId } from '@/lib/db/academies';

export default async function RevenuePage({
  params,
  searchParams,
}: {
  params: Promise<{ academyId: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { academyId: slugOrId } = await params;
  const { tab } = await searchParams;
  const academy = await resolveAcademyId(slugOrId);
  const academyId = academy?.id ?? slugOrId;

  if (tab === 'sales') {
    return <SalesSystemView academyId={academyId} />;
  }

  return <RevenueView academyId={academyId} />;
}
