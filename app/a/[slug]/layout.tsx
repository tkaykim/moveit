import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getAcademyBySlug } from '@/lib/db/miniapp';
import { LiteAdminShell } from '@/components/lite-admin/lite-admin-shell';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const academy = await getAcademyBySlug(slug);
  const name = academy?.name_kr || academy?.name_en || '학원';
  return {
    title: { absolute: `${name} 관리` },
    robots: { index: false, follow: false },
  };
}

/**
 * 라이트 어드민 — 학원별 화이트라벨 운영 콘솔 (/a/[slug]).
 * slug → 학원 해석은 학생 미니앱(/s/[slug])과 동일한 규율(getAcademyBySlug)을 따른다.
 * 직원 여부 검증은 셸(LiteAdminShell)에서, 실제 데이터 API 는 각 라우트의 assertAcademyAdmin 이 막는다.
 */
export default async function LiteAdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const academy = await getAcademyBySlug(slug);
  if (!academy) notFound();

  return (
    <LiteAdminShell
      academy={{
        id: academy.id,
        slug: academy.slug || academy.id,
        name: academy.name_kr || academy.name_en || '학원',
        brand: academy.brand_color || '#111111',
      }}
    >
      {children}
    </LiteAdminShell>
  );
}
