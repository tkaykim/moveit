'use client';

import type { BillingStats } from '@/types/billing';

interface BillingStatsDashboardProps {
  stats: BillingStats | null;
  loading: boolean;
}

function formatCurrency(n: number): string {
  return `${(n / 10000).toFixed(0)}만원`;
}

export function BillingStatsDashboard({ stats, loading }: BillingStatsDashboardProps) {
  if (loading) {
    return (
      <section className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6">
        <h2 className="text-lg font-semibold text-black dark:text-white mb-4">구독 요약</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 animate-pulse">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 bg-neutral-200 dark:bg-neutral-700 rounded-lg" />
          ))}
        </div>
      </section>
    );
  }

  if (!stats) {
    return (
      <section className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6">
        <h2 className="text-lg font-semibold text-black dark:text-white mb-4">구독 요약</h2>
        <p className="text-neutral-500 dark:text-neutral-400 text-sm">통계를 불러오지 못했습니다.</p>
      </section>
    );
  }

  const cards = [
    { label: 'MRR', value: formatCurrency(stats.mrr), sub: '월 반복 매출' },
    { label: 'ARR', value: formatCurrency(stats.arr), sub: '연 반복 매출' },
    { label: '전체 구독', value: stats.total_subscriptions, sub: `활성 ${stats.active_subscriptions} · 체험 ${stats.trial_subscriptions}` },
    { label: '미납/취소/만료', value: `${stats.past_due_subscriptions} / ${stats.canceled_subscriptions} / ${stats.expired_subscriptions}`, sub: 'past_due / canceled / expired' },
  ];

  return (
    <section className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6">
      <h2 className="text-lg font-semibold text-black dark:text-white mb-4">구독 요약</h2>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {cards.map((c) => (
          <div
            key={c.label}
            className="rounded-lg bg-neutral-50 dark:bg-neutral-800 p-4 border border-neutral-100 dark:border-neutral-700"
          >
            <p className="text-xs text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">{c.label}</p>
            <p className="text-xl font-bold text-black dark:text-white mt-1">{c.value}</p>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">{c.sub}</p>
          </div>
        ))}
      </div>
      <div className="mt-4 pt-4 border-t border-neutral-200 dark:border-neutral-700 flex flex-wrap gap-4 text-sm">
        <span className="text-neutral-600 dark:text-neutral-300">
          플랜별: 스타터 {stats.by_plan?.starter ?? 0} · 그로스 {stats.by_plan?.growth ?? 0} · 프로 {stats.by_plan?.pro ?? 0}
        </span>
        <span className="text-neutral-600 dark:text-neutral-300">
          주기별: 월간 {stats.by_cycle?.monthly ?? 0} · 연간 {stats.by_cycle?.annual ?? 0}
        </span>
      </div>
    </section>
  );
}
