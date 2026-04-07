import { EnrollmentsView } from '../../components/views/enrollments-view';
import { resolveAcademyId } from '@/lib/db/academies';

export default async function EnrollmentsPage({
  params,
}: {
  params: Promise<{ academyId: string }>;
}) {
  const { academyId: slugOrId } = await params;
  const academy = await resolveAcademyId(slugOrId);
  const academyId = academy?.id ?? slugOrId;
  return <EnrollmentsView academyId={academyId} />;
}
