import { ExtensionRequestsView } from '../../components/views/extension-requests-view';

export default async function ExtensionRequestsPage({
  params,
}: {
  params: Promise<{ academyId: string }>;
}) {
  const { academyId } = await params;
  return <ExtensionRequestsView academyId={academyId} />;
}
