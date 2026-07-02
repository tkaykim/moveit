import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getAcademyBySlug } from '@/lib/db/miniapp';
import { MiniNav } from './components/mini-nav';
import { MiniHeader } from './components/mini-header';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const academy = await getAcademyBySlug(slug);
  if (!academy) return {};
  const title = academy.name_kr || academy.name_en || '학원';
  return {
    title: { absolute: title },
    description: academy.description || `${title} 시간표·수강권·워크샵`,
    manifest: `/api/manifest/${slug}`,
    openGraph: {
      title,
      description: academy.description || `${title} 시간표·수강권·워크샵`,
      ...(academy.logo_url ? { images: [academy.logo_url] } : {}),
    },
    appleWebApp: { capable: true, title, statusBarStyle: 'default' },
  };
}

/**
 * 학원 미니앱 셸 — 화이트라벨.
 * 이 레이아웃 안에서는 MOVEIT 마켓플레이스 요소(타 학원·추천·글로벌 네비)를 절대 노출하지 않는다.
 * --primary 를 학원 brand_color 로 오버라이드해 하위 전체가 학원 색을 쓴다.
 */
export default async function MiniAppLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const academy = await getAcademyBySlug(slug);
  if (!academy) notFound();

  const brand = academy.brand_color || '#111111';

  return (
    <div
      className="min-h-[100dvh] bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100"
      style={{ ['--primary' as string]: brand, ['--primary-foreground' as string]: '#ffffff' }}
    >
      <div className="mx-auto max-w-lg min-h-[100dvh] flex flex-col bg-white dark:bg-neutral-950">
        <MiniHeader
          slug={slug}
          name={academy.name_kr || academy.name_en || '학원'}
          logoUrl={academy.logo_url}
        />
        <main className="flex-1 pb-24">{children}</main>
        <MiniNav slug={slug} />
      </div>
    </div>
  );
}
