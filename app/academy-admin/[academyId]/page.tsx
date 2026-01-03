import { DashboardView } from '../components/views/dashboard-view';

export default async function AcademyAdminDashboardPage({
  params,
}: {
  params: Promise<{ academyId: string }>;
}) {
  const { academyId } = await params;
  return <DashboardView academyId={academyId} />;
}

