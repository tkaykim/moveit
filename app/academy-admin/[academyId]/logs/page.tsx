import { DailyLogView } from '../../components/views/daily-log-view';

export default async function LogsPage({
  params,
}: {
  params: Promise<{ academyId: string }>;
}) {
  const { academyId } = await params;
  return <DailyLogView academyId={academyId} />;
}

