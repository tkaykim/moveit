import { ClassMastersView } from '../../components/views/class-masters-view';
import { resolveAcademyId } from '@/lib/db/academies';

export default async function ClassMastersPage({
  params,
}: {
  params: Promise<{ academyId: string }>;
}) {
  const { academyId: slugOrId } = await params;
  const academy = await resolveAcademyId(slugOrId);
  const academyId = academy?.id ?? slugOrId;
  return <ClassMastersView academyId={academyId} />;
}
