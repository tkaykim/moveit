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
      className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-lg bg-white dark:bg-neutral-950 border-t border-neutral-100 dark:border-neutral-800 z-40"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="grid grid-cols-5">
        {TABS.map(({ seg, label, icon: Icon }) => {
          const href = seg ? `${base}/${seg}` : base;
          const active = seg ? pathname?.startsWith(href) : pathname === base;
          return (
            <Link
              key={label}
              href={href}
              className="flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium"
              style={{ color: active ? 'var(--primary)' : undefined }}
            >
              <Icon size={20} className={active ? '' : 'text-neutral-400 dark:text-neutral-500'} />
              <span className={active ? '' : 'text-neutral-400 dark:text-neutral-500'}>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
