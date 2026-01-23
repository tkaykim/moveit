import { EnrollmentsView } from '../../components/views/enrollments-view';

export default async function EnrollmentsPage({
  params,
}: {
  params: Promise<{ academyId: string }>;
}) {
  const { academyId } = await params;
  return <EnrollmentsView academyId={academyId} />;
}
