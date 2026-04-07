import { ScheduleView } from '../../components/views/schedule-view';
import { resolveAcademyId } from '@/lib/db/academies';

export default async function SchedulePage({
  params,
}: {
  params: Promise<{ academyId: string }>;
}) {
  const { academyId: slugOrId } = await params;
  const academy = await resolveAcademyId(slugOrId);
  const academyId = academy?.id ?? slugOrId;
  return <ScheduleView academyId={academyId} />;
}
