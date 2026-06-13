import { GuideView } from '../../components/views/guide-view';
import { resolveAcademyId } from '@/lib/db/academies';

export const metadata = {
  title: '사용 가이드 · MOVE IT 학원 관리자',
};

export default async function GuidePage({
  params,
}: {
  params: Promise<{ academyId: string }>;
}) {
  const { academyId: slugOrId } = await params;
  const academy = await resolveAcademyId(slugOrId);
  const academyId = academy?.id ?? slugOrId;
  return <GuideView academyId={academyId} />;
}
