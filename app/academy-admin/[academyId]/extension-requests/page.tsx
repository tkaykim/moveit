import { ExtensionRequestsView } from '../../components/views/extension-requests-view';
import { resolveAcademyId } from '@/lib/db/academies';

export default async function ExtensionRequestsPage({
  params,
}: {
  params: Promise<{ academyId: string }>;
}) {
  const { academyId: slugOrId } = await params;
  const academy = await resolveAcademyId(slugOrId);
  const academyId = academy?.id ?? slugOrId;
  return <ExtensionRequestsView academyId={academyId} />;
}
