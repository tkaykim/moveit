'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';

export function MiniHeader({ slug, name, logoUrl }: { slug: string; name: string; logoUrl: string | null }) {
  const pathname = usePathname();
  const isHome = pathname === `/s/${slug}`;

  // 홈은 자체 히어로(큰 로고+이름)가 있으므로 헤더를 띄우지 않는다
  if (isHome) return null;

  return (
    <header className="sticky top-0 z-40 bg-white/92 dark:bg-neutral-950/92 backdrop-blur-md">
      <Link href={`/s/${slug}`} className="flex items-center gap-2.5 px-6 py-3.5">
        {logoUrl ? (
          <Image src={logoUrl} alt={name} width={30} height={30} className="w-[30px] h-[30px] rounded-[10px] object-cover" />
        ) : (
          <span
            className="w-[30px] h-[30px] rounded-[10px] flex items-center justify-center text-[13px] font-extrabold text-white"
            style={{ backgroundColor: 'var(--primary)' }}
          >
            {name.slice(0, 1)}
          </span>
        )}
        <span className="text-[15px] font-extrabold tracking-tight truncate">{name}</span>
      </Link>
    </header>
  );
}
