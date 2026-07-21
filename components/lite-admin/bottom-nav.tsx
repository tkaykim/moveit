'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CalendarDays, GraduationCap, Wallet, Users, Star } from 'lucide-react';

/**
 * 라이트 어드민 하단 탭 바 — 모바일 인포데스크 눈높이.
 * 이번 단계(Phase 1): 오늘 / 수업 활성. 나머지 3개는 "준비 중" 자리만 잡아둔다.
 * 큰 터치 타깃(≥44px), 한 화면 = 한 일.
 */
export function BottomNav({ slug, brand }: { slug: string; brand: string }) {
  const pathname = usePathname();
  const base = `/a/${slug}`;
  const isToday = pathname === base || pathname === `${base}`;
  const isClasses = pathname?.startsWith(`${base}/classes`);

  const tab = (active: boolean) =>
    `flex-1 flex flex-col items-center justify-center gap-1 min-h-[56px] py-2 text-[11px] font-bold transition-colors ${
      active ? '' : 'text-neutral-400 dark:text-neutral-500'
    }`;

  return (
    <nav
      data-testid="lite-bottom-nav"
      className="fixed bottom-0 inset-x-0 z-30 border-t border-neutral-200 dark:border-neutral-800 bg-white/95 dark:bg-neutral-950/95 backdrop-blur"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="mx-auto max-w-lg flex items-stretch">
        <Link href={base} data-testid="tab-today" className={tab(!!isToday)} style={isToday ? { color: brand } : undefined}>
          <CalendarDays size={22} strokeWidth={isToday ? 2.4 : 2} />
          오늘
        </Link>
        <Link
          href={`${base}/classes`}
          data-testid="tab-classes"
          className={tab(!!isClasses)}
          style={isClasses ? { color: brand } : undefined}
        >
          <GraduationCap size={22} strokeWidth={isClasses ? 2.4 : 2} />
          수업
        </Link>

        {/* 준비 중 자리 */}
        {[
          { icon: Wallet, label: '입금·결제' },
          { icon: Users, label: '수강생' },
          { icon: Star, label: '전문반' },
        ].map(({ icon: Icon, label }) => (
          <button
            key={label}
            type="button"
            disabled
            aria-disabled="true"
            title="준비 중"
            className="flex-1 flex flex-col items-center justify-center gap-1 min-h-[56px] py-2 text-[11px] font-bold text-neutral-300 dark:text-neutral-600 relative"
          >
            <Icon size={22} strokeWidth={2} />
            {label}
            <span className="absolute top-1 right-1/2 translate-x-[22px] text-[8px] font-semibold text-neutral-400 dark:text-neutral-500">
              준비중
            </span>
          </button>
        ))}
      </div>
    </nav>
  );
}
