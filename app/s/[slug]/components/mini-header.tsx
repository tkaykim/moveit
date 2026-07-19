'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ShoppingCart } from 'lucide-react';
import { readCart } from '@/lib/miniapp/cart';

export function MiniHeader({
  slug,
  academyId,
  name,
  logoUrl,
}: {
  slug: string;
  academyId: string;
  name: string;
  logoUrl: string | null;
}) {
  const pathname = usePathname();
  const isHome = pathname === `/s/${slug}`;
  const [count, setCount] = useState(0);

  useEffect(() => {
    const sync = () => setCount(readCart(academyId).length);
    sync();
    window.addEventListener('miniapp-cart-changed', sync);
    return () => window.removeEventListener('miniapp-cart-changed', sync);
  }, [academyId, pathname]);

  // 홈은 자체 히어로(큰 로고+이름)가 있으므로 헤더를 띄우지 않는다
  if (isHome) return null;

  return (
    <header className="sticky top-0 z-40 bg-white/92 dark:bg-neutral-950/92 backdrop-blur-md">
      <div className="flex items-center gap-2 px-5 py-3.5">
        <Link href={`/s/${slug}`} className="flex items-center gap-2.5 min-w-0 flex-1">
          {logoUrl ? (
            <Image
              src={logoUrl}
              alt={name}
              width={30}
              height={30}
              className="w-[30px] h-[30px] rounded-[10px] object-cover flex-shrink-0"
            />
          ) : (
            <span
              className="w-[30px] h-[30px] rounded-[10px] flex items-center justify-center text-[13px] font-extrabold text-white flex-shrink-0"
              style={{ backgroundColor: 'var(--primary)' }}
            >
              {name.slice(0, 1)}
            </span>
          )}
          <span className="text-[15px] font-extrabold tracking-tight truncate">{name}</span>
        </Link>

        <Link
          href={`/s/${slug}/cart`}
          data-testid="cart-link"
          aria-label="장바구니"
          className="relative w-9 h-9 rounded-full flex items-center justify-center text-neutral-500 flex-shrink-0"
        >
          <ShoppingCart size={18} />
          {count > 0 && (
            <span
              data-testid="cart-count"
              className="absolute top-0.5 right-0.5 min-w-[16px] h-4 px-1 rounded-full text-[10px] font-extrabold text-white flex items-center justify-center"
              style={{ backgroundColor: 'var(--primary)' }}
            >
              {count}
            </span>
          )}
        </Link>
      </div>
    </header>
  );
}
