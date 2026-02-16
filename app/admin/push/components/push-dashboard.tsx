"use client";

import { Smartphone, Users, MonitorSmartphone } from 'lucide-react';

interface PushDashboardProps {
  status: {
    summary: {
      total_users: number;
      users_with_tokens: number;
      total_active_tokens: number;
      android_tokens: number;
      ios_tokens: number;
    };
  } | null;
  loading: boolean;
}

export function PushDashboard({ status, loading }: PushDashboardProps) {
  const s = status?.summary;

  const cards = [
    {
      label: '전체 유저',
      value: s?.total_users ?? '-',
      icon: Users,
      color: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400',
    },
    {
      label: '토큰 등록 유저',
      value: s?.users_with_tokens ?? '-',
      icon: Smartphone,
      color: 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400',
    },
    {
      label: '활성 디바이스',
      value: s?.total_active_tokens ?? '-',
      icon: MonitorSmartphone,
      color: 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400',
    },
    {
      label: 'Android / iOS',
      value: s ? `${s.android_tokens} / ${s.ios_tokens}` : '-',
      icon: Smartphone,
      color: 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div key={card.label} className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-4">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${card.color}`}>
              <Icon size={20} />
            </div>
            <div className="text-2xl font-bold text-neutral-900 dark:text-white">
              {loading ? <div className="w-12 h-7 bg-neutral-200 dark:bg-neutral-700 rounded animate-pulse" /> : card.value}
            </div>
            <div className="text-xs text-neutral-500 mt-1">{card.label}</div>
          </div>
        );
      })}
    </div>
  );
}
