import { DashboardPageClient } from '../components/dashboard-page-client';

export default async function AcademyAdminDashboardPage({
  params,
}: {
  params: Promise<{ academyId: string }>;
}) {
  const { academyId } = await params;
  return <DashboardPageClient academyId={academyId} />;
}

