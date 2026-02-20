'use client';

import { useRouter } from 'next/navigation';
import { SUBSCRIPTION_STATUS_LABELS, BILLING_CYCLE_LABELS } from '@/types/billing';
import type { SubscriptionStatus } from '@/types/billing';

interface SubItem {
  id: string;
  academy_id: string;
  plan_id: string;
  billing_cycle: string;
  status: string;
  current_period_end: string | null;
  card_number_masked: string | null;
  billing_plans?: { id: string; display_name: string; monthly_price: number; annual_price_per_month: number };
  academies?: { id: string; name_kr: string | null; name_en: string | null };
}

interface SubscriptionListProps {
  items: SubItem[];
  total: number;
  page: number;
  limit: number;
  loading: boolean;
  statusFilter: string;
  planFilter: string;
  search: string;
  onStatusChange: (v: string) => void;
  onPlanChange: (v: string) => void;
  onSearchChange: (v: string) => void;
  onPageChange: (p: number) => void;
}

function formatDate(s: string | null): string {
  if (!s) return '-';
  return new Date(s).toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function SubscriptionList({
  items,
  total,
  page,
  limit,
  loading,
  statusFilter,
  planFilter,
  search,
  onStatusChange,
  onPlanChange,
  onSearchChange,
  onPageChange,
}: SubscriptionListProps) {
  const router = useRouter();
  const totalPages = Math.max(1, Math.ceil(total / limit));

  if (loading) {
    return (
      <section className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6">
        <h2 className="text-lg font-semibold text-black dark:text-white mb-4">구독 목록</h2>
        <div className="animate-pulse space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-12 bg-neutral-200 dark:bg-neutral-700 rounded" />
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6">
      <h2 className="text-lg font-semibold text-black dark:text-white mb-4">구독 목록</h2>

      <div className="flex flex-wrap gap-3 mb-4">
        <select
          value={statusFilter}
          onChange={(e) => onStatusChange(e.target.value)}
          className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-black dark:text-white px-3 py-2 text-sm"
        >
          <option value="all">상태 전체</option>
          <option value="trial">체험 중</option>
          <option value="active">활성</option>
          <option value="past_due">미납</option>
          <option value="canceled">취소됨</option>
          <option value="expired">만료됨</option>
        </select>
        <select
          value={planFilter}
          onChange={(e) => onPlanChange(e.target.value)}
          className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-black dark:text-white px-3 py-2 text-sm"
        >
          <option value="all">플랜 전체</option>
          <option value="starter">스타터</option>
          <option value="growth">그로스</option>
          <option value="pro">프로</option>
        </select>
        <input
          type="search"
          placeholder="학원명 검색"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-black dark:text-white px-3 py-2 text-sm min-w-[160px]"
        />
      </div>

      {items.length === 0 ? (
        <p className="text-neutral-500 dark:text-neutral-400 text-sm">구독이 없습니다.</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="border-b border-neutral-200 dark:border-neutral-700 text-neutral-500 dark:text-neutral-400">
                  <th className="py-2 pr-4 font-medium">학원</th>
                  <th className="py-2 pr-4 font-medium">플랜</th>
                  <th className="py-2 pr-4 font-medium">주기</th>
                  <th className="py-2 pr-4 font-medium">상태</th>
                  <th className="py-2 pr-4 font-medium">기간 종료</th>
                  <th className="py-2 font-medium">카드</th>
                </tr>
              </thead>
              <tbody>
                {items.map((s) => (
                  <tr
                    key={s.id}
                    className="border-b border-neutral-100 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 cursor-pointer"
                    onClick={() => router.push(`/admin/billing/subscriptions/${s.id}`)}
                  >
                    <td className="py-2 pr-4 text-black dark:text-white">
                      {s.academies?.name_kr ?? s.academies?.name_en ?? s.academy_id.slice(0, 8)}
                    </td>
                    <td className="py-2 pr-4 text-neutral-700 dark:text-neutral-300">
                      {s.billing_plans?.display_name ?? s.plan_id}
                    </td>
                    <td className="py-2 pr-4 text-neutral-600 dark:text-neutral-400">
                      {BILLING_CYCLE_LABELS[s.billing_cycle as keyof typeof BILLING_CYCLE_LABELS] ?? s.billing_cycle}
                    </td>
                    <td className="py-2 pr-4">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                          s.status === 'active'
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                            : s.status === 'trial'
                              ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
                              : s.status === 'past_due'
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400'
                                : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-700 dark:text-neutral-400'
                        }`}
                      >
                        {SUBSCRIPTION_STATUS_LABELS[s.status as SubscriptionStatus] ?? s.status}
                      </span>
                    </td>
                    <td className="py-2 pr-4 text-neutral-600 dark:text-neutral-400">
                      {formatDate(s.current_period_end)}
                    </td>
                    <td className="py-2 text-neutral-500 dark:text-neutral-400 font-mono text-xs">
                      {s.card_number_masked ?? '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-neutral-200 dark:border-neutral-700">
              <p className="text-sm text-neutral-500 dark:text-neutral-400">
                총 {total}건
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => onPageChange(page - 1)}
                  disabled={page <= 1}
                  className="px-3 py-1 rounded border border-neutral-300 dark:border-neutral-600 text-sm disabled:opacity-50"
                >
                  이전
                </button>
                <span className="px-3 py-1 text-sm text-neutral-600 dark:text-neutral-300">
                  {page} / {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => onPageChange(page + 1)}
                  disabled={page >= totalPages}
                  className="px-3 py-1 rounded border border-neutral-300 dark:border-neutral-600 text-sm disabled:opacity-50"
                >
                  다음
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
