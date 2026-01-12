import { ClassMastersView } from '../../components/views/class-masters-view';

export default async function ClassMastersPage({
  params,
}: {
  params: Promise<{ academyId: string }>;
}) {
  const { academyId } = await params;
  return <ClassMastersView academyId={academyId} />;
}
