import { ScheduleChangeRequestsView } from '../../components/views/schedule-change-requests-view';
import { resolveAcademyId } from '@/lib/db/academies';

export default async function ScheduleChangeRequestsPage({
  params,
}: {
  params: Promise<{ academyId: string }>;
}) {
  const { academyId: slugOrId } = await params;
  const academy = await resolveAcademyId(slugOrId);
  const academyId = academy?.id ?? slugOrId;
  return <ScheduleChangeRequestsView academyId={academyId} />;
}
