import { NextRequest, NextResponse } from 'next/server';
import { getAcademyBySlug } from '@/lib/db/miniapp';

export const dynamic = 'force-dynamic';
// 사용자 화면은 절대 캐시된 DB 읽기를 보면 안 된다 (Next Data Cache 는 디스크에 남는다)
export const fetchCache = 'force-no-store';

/**
 * 학원별 동적 PWA manifest — "홈 화면에 추가" 시 그 학원 이름·색·아이콘의 앱이 된다.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const academy = await getAcademyBySlug(slug);
  if (!academy) {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }

  const name = academy.name_kr || academy.name_en || '학원';
  const brand = academy.brand_color || '#111111';

  // 로고가 없으면 이니셜 SVG 아이콘을 동적 생성 (외부 자산 의존 없음)
  const initial = name.slice(0, 1);
  const svgIcon = `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512"><rect width="512" height="512" rx="96" fill="${brand}"/><text x="50%" y="50%" dy=".36em" text-anchor="middle" font-family="sans-serif" font-size="280" font-weight="700" fill="#ffffff">${initial}</text></svg>`,
  )}`;
  const icons = academy.logo_url
    ? [
        { src: academy.logo_url, sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: academy.logo_url, sizes: '512x512', type: 'image/png', purpose: 'any' },
      ]
    : [{ src: svgIcon, sizes: '512x512', type: 'image/svg+xml', purpose: 'any' }];

  const manifest = {
    name,
    short_name: name.length > 12 ? name.slice(0, 12) : name,
    description: academy.description || `${name} 시간표·수강권·워크샵`,
    start_url: `/s/${slug}`,
    scope: `/s/${slug}`,
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: brand,
    icons,
  };

  return NextResponse.json(manifest, {
    headers: { 'Content-Type': 'application/manifest+json', 'Cache-Control': 'public, max-age=300' },
  });
}
