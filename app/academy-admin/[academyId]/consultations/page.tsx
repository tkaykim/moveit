import { ConsultationView } from '../../components/views/consultation-view';
import { resolveAcademyId } from '@/lib/db/academies';

export default async function ConsultationsPage({
  params,
}: {
  params: Promise<{ academyId: string }>;
}) {
  const { academyId: slugOrId } = await params;
  const academy = await resolveAcademyId(slugOrId);
  const academyId = academy?.id ?? slugOrId;
  return <ConsultationView academyId={academyId} />;
}
