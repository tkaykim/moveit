"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, MapPin, User, Calendar } from 'lucide-react';
import { ViewState } from '@/types';
import { useLocale } from '@/contexts/LocaleContext';

interface BottomNavProps {
  activeTab: ViewState;
  onTabChange: (tab: ViewState) => void;
}

const tabConfig = [
  { id: 'HOME' as ViewState, icon: Home, labelKey: 'bottomNav.home', href: '/home' },
  { id: 'ACADEMY' as ViewState, icon: MapPin, labelKey: 'bottomNav.academy', href: '/academy' },
  { id: 'DANCER' as ViewState, icon: User, labelKey: 'bottomNav.instructor', href: '/instructor' },
  { id: 'SAVED' as ViewState, icon: Calendar, labelKey: 'bottomNav.schedule', href: '/schedule' },
  { id: 'MY' as ViewState, icon: User, labelKey: 'bottomNav.my', href: '/my' },
];

export const BottomNav = ({ activeTab, onTabChange }: BottomNavProps) => {
  const pathname = usePathname();
  const { t } = useLocale();
  
  const isActive = (tabId: ViewState, href: string) => {
    if (tabId === 'HOME' && (pathname === '/' || pathname === '/home')) return true;
    if (tabId === 'ACADEMY' && pathname.startsWith('/academy')) return true;
    if (tabId === 'DANCER' && pathname.startsWith('/instructor')) return true;
    if (tabId === 'SAVED' && pathname === '/schedule') return true;
    if (tabId === 'MY' && pathname.startsWith('/my')) return true;
    return false;
  };

  const hiddenTabs = ['PAYMENT', 'PAYMENT_SUCCESS', 'DETAIL_DANCER', 'SEARCH_RESULTS', 'TICKETS', 'PAYMENT_HISTORY', 'SETTINGS', 'FAQ', 'NOTICES'];
  if (hiddenTabs.includes(activeTab)) return null;

  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[420px] bg-white/90 dark:bg-neutral-950/90 backdrop-blur-xl border-t border-neutral-200 dark:border-neutral-800 pt-2 px-6 flex justify-between items-center z-40" style={{ paddingBottom: 'calc(12px + max(env(safe-area-inset-bottom, 0px), var(--app-safe-bottom, 0px)))', minHeight: '64px' }}>
      {tabConfig.map((tab) => {
        const Icon = tab.icon;
        const active = isActive(tab.id, tab.href);
        return (
          <Link
            key={tab.id}
            href={tab.href}
            onClick={() => onTabChange(tab.id)}
            className={`flex flex-col items-center gap-1 transition-all duration-300 w-12 ${
              active 
                ? 'text-primary dark:text-[#CCFF00] -translate-y-1' 
                : 'text-neutral-500 dark:text-neutral-500'
            }`}
          >
            <Icon size={24} strokeWidth={active ? 2.5 : 2} />
            <span className="text-[10px] font-medium">{t(tab.labelKey)}</span>
          </Link>
        );
      })}
    </nav>
  );
};

