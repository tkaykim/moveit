import { QrReaderView } from '../../components/views/qr-reader-view';
import { resolveAcademyId } from '@/lib/db/academies';

export default async function QrReaderPage({
  params,
}: {
  params: Promise<{ academyId: string }>;
}) {
  const { academyId: slugOrId } = await params;
  const academy = await resolveAcademyId(slugOrId);
  const academyId = academy?.id ?? slugOrId;
  return <QrReaderView academyId={academyId} />;
}
