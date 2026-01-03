import { ClassesView } from '../../components/views/classes-view';

export default async function ClassesPage({
  params,
}: {
  params: Promise<{ academyId: string }>;
}) {
  const { academyId } = await params;
  return <ClassesView academyId={academyId} />;
}

