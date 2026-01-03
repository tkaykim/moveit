import { ConsultationView } from '../../components/views/consultation-view';

export default async function ConsultationsPage({
  params,
}: {
  params: Promise<{ academyId: string }>;
}) {
  const { academyId } = await params;
  return <ConsultationView academyId={academyId} />;
}

