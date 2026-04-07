import { DailyLogView } from '../../components/views/daily-log-view';
import { resolveAcademyId } from '@/lib/db/academies';

export default async function LogsPage({
  params,
}: {
  params: Promise<{ academyId: string }>;
}) {
  const { academyId: slugOrId } = await params;
  const academy = await resolveAcademyId(slugOrId);
  const academyId = academy?.id ?? slugOrId;
  return <DailyLogView academyId={academyId} />;
}
