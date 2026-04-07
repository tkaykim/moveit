import { StudentView } from '../../components/views/student-view';
import { resolveAcademyId } from '@/lib/db/academies';

export default async function StudentsPage({
  params,
}: {
  params: Promise<{ academyId: string }>;
}) {
  const { academyId: slugOrId } = await params;
  const academy = await resolveAcademyId(slugOrId);
  const academyId = academy?.id ?? slugOrId;
  return <StudentView academyId={academyId} />;
}
