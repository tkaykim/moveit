import { SettingsView } from '../../components/views/settings-view';

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ academyId: string }>;
}) {
  const { academyId } = await params;
  return <SettingsView academyId={academyId} />;
}

