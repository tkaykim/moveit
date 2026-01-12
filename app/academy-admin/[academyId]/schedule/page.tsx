import { ScheduleView } from '../../components/views/schedule-view';

export default async function SchedulePage({
  params,
}: {
  params: Promise<{ academyId: string }>;
}) {
  const { academyId } = await params;
  return <ScheduleView academyId={academyId} />;
}
