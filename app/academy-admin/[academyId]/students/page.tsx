import { StudentView } from '../../components/views/student-view';

export default async function StudentsPage({
  params,
}: {
  params: Promise<{ academyId: string }>;
}) {
  const { academyId } = await params;
  return <StudentView academyId={academyId} />;
}

