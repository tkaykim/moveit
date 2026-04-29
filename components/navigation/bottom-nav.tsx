"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Sparkles, Calendar, Ticket, User } from 'lucide-react';
import { ViewState } from '@/types';
import { useLocale } from '@/contexts/LocaleContext';

interface BottomNavProps {
  activeTab: ViewState;
  onTabChange: (tab: ViewState) => void;
}

// 5탭 구조 (Claude design / moveit Studio OS):
// Studios (등록 학원 목록 = /academy) / Today (/home) / Classes (/schedule) / My Pass (/tickets) / Me (/my)
const TABS: Array<{ id: ViewState; icon: any; labelKey: string; href: string; matchPath: (p: string) => boolean }> = [
  {
    id: 'ACADEMY' as ViewState,
    icon: Home,
    labelKey: 'bottomNav.studios',
    href: '/academy',
    matchPath: (p) => p.startsWith('/academy'),
  },
  {
    id: 'HOME' as ViewState,
    icon: Sparkles,
    labelKey: 'bottomNav.today',
    href: '/home',
    matchPath: (p) => p === '/' || p === '/home',
  },
  {
    id: 'SAVED' as ViewState,
    icon: Calendar,
    labelKey: 'bottomNav.classes',
    href: '/schedule',
    matchPath: (p) => p === '/schedule',
  },
  {
    id: 'TICKETS' as ViewState,
    icon: Ticket,
    labelKey: 'bottomNav.myPass',
    href: '/tickets',
    matchPath: (p) => p.startsWith('/tickets'),
  },
  {
    id: 'MY' as ViewState,
    icon: User,
    labelKey: 'bottomNav.me',
    href: '/my',
    matchPath: (p) => p.startsWith('/my'),
  },
];

export const BottomNav = ({ activeTab, onTabChange }: BottomNavProps) => {
  const pathname = usePathname();
  const { t } = useLocale();

  const hiddenTabs = ['PAYMENT', 'PAYMENT_SUCCESS', 'DETAIL_DANCER', 'SEARCH_RESULTS', 'PAYMENT_HISTORY', 'SETTINGS', 'FAQ', 'NOTICES'];
  if (hiddenTabs.includes(activeTab)) return null;

  return (
    <nav
      className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[420px] h-[76px] bg-surface/95 backdrop-blur-xl border-t border-border px-2 pb-4 grid items-center z-40"
      style={{ gridTemplateColumns: `repeat(${TABS.length}, 1fr)` }}
    >
      {TABS.map((tab) => {
        const Icon = tab.icon;
        const active = tab.matchPath(pathname);
        return (
          <Link
            key={tab.id}
            href={tab.href}
            onClick={() => onTabChange(tab.id)}
            className={`flex flex-col items-center justify-center gap-1.5 h-full transition-colors ${
              active ? 'text-text' : 'text-text-4'
            }`}
          >
            <Icon size={20} strokeWidth={active ? 2.2 : 1.8} className={active ? 'opacity-100' : 'opacity-70'} />
            <span className="text-[10px] font-medium tracking-[0.04em]">{t(tab.labelKey)}</span>
          </Link>
        );
      })}
    </nav>
  );
};
