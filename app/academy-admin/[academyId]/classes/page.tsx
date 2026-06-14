import { ClassesView } from '../../components/views/classes-view';
import { resolveAcademyId } from '@/lib/db/academies';

export default async function ClassesPage({
  params,
}: {
  params: Promise<{ academyId: string }>;
}) {
  const { academyId: slugOrId } = await params;
  // URL 세그먼트는 slug이므로 UUID로 해석해 전달(미해석 시 halls/classes 쿼리가 academy_id=slug 로 400).
  const academy = await resolveAcademyId(slugOrId);
  const academyId = academy?.id ?? slugOrId;
  return <ClassesView academyId={academyId} />;
}
