import { ScheduleChangeRequestsView } from '../../components/views/schedule-change-requests-view';

export default async function ScheduleChangeRequestsPage({
  params,
}: {
  params: Promise<{ academyId: string }>;
}) {
  const { academyId } = await params;
  return <ScheduleChangeRequestsView academyId={academyId} />;
}
