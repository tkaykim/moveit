import { DepositConfirmView } from '../../components/views/deposit-confirm-view';
import { resolveAcademyId } from '@/lib/db/academies';

export const dynamic = 'force-dynamic';

export default async function DepositConfirmPage({
  params,
}: {
  params: Promise<{ academyId: string }>;
}) {
  const { academyId: slugOrId } = await params;
  const academy = await resolveAcademyId(slugOrId);
  const academyId = academy?.id ?? slugOrId;
  return <DepositConfirmView academyId={academyId} />;
}
