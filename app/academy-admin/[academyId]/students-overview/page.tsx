import { ConsoleStudentsView } from '../../components/views/console/students-view';
import { resolveAcademyId } from '@/lib/db/academies';

export default async function Page({
  params,
}: {
  params: Promise<{ academyId: string }>;
}) {
  const { academyId: slugOrId } = await params;
  const academy = await resolveAcademyId(slugOrId);
  const academyId = academy?.id ?? slugOrId;
  return <ConsoleStudentsView academyId={academyId} />;
}
