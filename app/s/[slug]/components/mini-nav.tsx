'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, CalendarDays, Ticket, Sparkles, User } from 'lucide-react';

const TABS = [
  { seg: '', label: '홈', icon: Home },
  { seg: 'schedule', label: '시간표', icon: CalendarDays },
  { seg: 'tickets', label: '수강권', icon: Ticket },
  { seg: 'workshops', label: '워크샵', icon: Sparkles },
  { seg: 'my', label: 'MY', icon: User },
];

export function MiniNav({ slug }: { slug: string }) {
  const pathname = usePathname();
  const base = `/s/${slug}`;

  return (
    <nav
      className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-lg bg-white/95 dark:bg-neutral-950/95 backdrop-blur-sm border-t border-neutral-100 dark:border-neutral-900 z-40"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="grid grid-cols-5">
        {TABS.map(({ seg, label, icon: Icon }) => {
          const href = seg ? `${base}/${seg}` : base;
          const active = seg ? pathname?.startsWith(href) : pathname === base;
          return (
            <Link key={label} href={href} className="relative flex flex-col items-center gap-1 pt-2.5 pb-2">
              {active && (
                <span
                  className="absolute top-0 w-8 h-[3px] rounded-b-full"
                  style={{ backgroundColor: 'var(--primary)' }}
                />
              )}
              <Icon
                size={21}
                strokeWidth={active ? 2.4 : 1.8}
                className={active ? '' : 'text-neutral-400 dark:text-neutral-600'}
                style={active ? { color: 'var(--primary)' } : undefined}
              />
              <span
                className={`text-[10px] ${active ? 'font-bold' : 'font-medium text-neutral-400 dark:text-neutral-600'}`}
                style={active ? { color: 'var(--primary)' } : undefined}
              >
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
