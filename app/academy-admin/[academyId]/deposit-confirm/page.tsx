import { DepositConfirmView } from '../../components/views/deposit-confirm-view';

export default async function DepositConfirmPage({
  params,
}: {
  params: Promise<{ academyId: string }>;
}) {
  const { academyId } = await params;
  return <DepositConfirmView academyId={academyId} />;
}
