import { InstructorView } from '../../components/views/instructor-view';
import { resolveAcademyId } from '@/lib/db/academies';

export default async function InstructorsPage({
  params,
}: {
  params: Promise<{ academyId: string }>;
}) {
  const { academyId: slugOrId } = await params;
  const academy = await resolveAcademyId(slugOrId);
  const academyId = academy?.id ?? slugOrId;
  return <InstructorView academyId={academyId} />;
}
