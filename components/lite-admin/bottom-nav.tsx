'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CalendarDays, GraduationCap, Wallet, Users, Star } from 'lucide-react';

/**
 * 라이트 어드민 하단 탭 바 — 모바일 인포데스크 눈높이.
 * Phase 2: 오늘 / 수업 / 입금·결제 / 수강생 / 전문반 5개 전부 활성.
 * 큰 터치 타깃(≥44px), 한 화면 = 한 일.
 */
export function BottomNav({ slug, brand }: { slug: string; brand: string }) {
  const pathname = usePathname();
  const base = `/a/${slug}`;

  const tabs = [
    { href: base, label: '오늘', icon: CalendarDays, active: pathname === base, testId: 'tab-today' },
    { href: `${base}/classes`, label: '수업', icon: GraduationCap, active: !!pathname?.startsWith(`${base}/classes`), testId: 'tab-classes' },
    { href: `${base}/pay`, label: '입금·결제', icon: Wallet, active: !!pathname?.startsWith(`${base}/pay`), testId: 'tab-pay' },
    { href: `${base}/students`, label: '수강생', icon: Users, active: !!pathname?.startsWith(`${base}/students`), testId: 'tab-students' },
    { href: `${base}/pro`, label: '전문반', icon: Star, active: !!pathname?.startsWith(`${base}/pro`), testId: 'tab-pro' },
  ];

  const cls = (active: boolean) =>
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
        {tabs.map(({ href, label, icon: Icon, active, testId }) => (
          <Link key={testId} href={href} data-testid={testId} className={cls(active)} style={active ? { color: brand } : undefined}>
            <Icon size={22} strokeWidth={active ? 2.4 : 2} />
            {label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
