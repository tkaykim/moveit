"use client";

import { Home, MapPin, User, Calendar } from 'lucide-react';
import { ViewState } from '@/types';

interface BottomNavProps {
  activeTab: ViewState;
  onTabChange: (tab: ViewState) => void;
}

const tabs = [
  { id: 'HOME' as ViewState, icon: Home, label: '홈' },
  { id: 'ACADEMY' as ViewState, icon: MapPin, label: '학원' },
  { id: 'DANCER' as ViewState, icon: User, label: '강사' },
  { id: 'SAVED' as ViewState, icon: Calendar, label: '일정' },
  { id: 'MY' as ViewState, icon: User, label: '마이' },
];

export const BottomNav = ({ activeTab, onTabChange }: BottomNavProps) => {
  const isActive = (tabId: ViewState) => {
    return activeTab === tabId || 
           (tabId === 'ACADEMY' && activeTab === 'DETAIL_ACADEMY') || 
           (tabId === 'DANCER' && activeTab === 'DETAIL_DANCER');
  };

  const hiddenTabs = ['PAYMENT', 'PAYMENT_SUCCESS', 'DETAIL_DANCER', 'SEARCH_RESULTS'];
  if (hiddenTabs.includes(activeTab)) return null;

  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[420px] bg-white/90 dark:bg-neutral-950/90 backdrop-blur-xl border-t border-neutral-200 dark:border-neutral-800 pb-safe pt-2 px-6 flex justify-between items-center z-40 h-[80px]">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const active = isActive(tab.id);
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`flex flex-col items-center gap-1 transition-all duration-300 w-12 ${
              active 
                ? 'text-primary dark:text-[#CCFF00] -translate-y-1' 
                : 'text-neutral-500 dark:text-neutral-500'
            }`}
          >
            <Icon size={24} strokeWidth={active ? 2.5 : 2} />
            <span className="text-[10px] font-medium">{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
};

