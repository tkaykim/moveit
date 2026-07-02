import { notFound } from 'next/navigation';
import { getAcademyBySlug } from '@/lib/db/miniapp';
import { MyTicketsView } from './my-tickets-view';

export const dynamic = 'force-dynamic';

export default async function MiniMyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const academy = await getAcademyBySlug(slug);
  if (!academy) notFound();

  return <MyTicketsView academyId={academy.id} academyName={academy.name_kr || academy.name_en || '학원'} />;
}
