import { InstructorView } from '../../components/views/instructor-view';

export default async function InstructorsPage({
  params,
}: {
  params: Promise<{ academyId: string }>;
}) {
  const { academyId } = await params;
  return <InstructorView academyId={academyId} />;
}

