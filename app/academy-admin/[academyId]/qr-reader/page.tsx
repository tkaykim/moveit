import { QrReaderView } from '../../components/views/qr-reader-view';

export default async function QrReaderPage({
  params,
}: {
  params: Promise<{ academyId: string }>;
}) {
  const { academyId } = await params;
  return <QrReaderView academyId={academyId} />;
}
