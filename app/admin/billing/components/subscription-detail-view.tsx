'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { authFetch } from '@/lib/supabase/auth-fetch';
import { SUBSCRIPTION_STATUS_LABELS, BILLING_CYCLE_LABELS, PAYMENT_STATUS_LABELS } from '@/types/billing';
import type { SubscriptionStatus, PaymentStatus } from '@/types/billing';

interface SubscriptionDetailViewProps {
  subscriptionId: string;
}

function formatDate(s: string | null): string {
  if (!s) return '-';
  return new Date(s).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
}

export function SubscriptionDetailView({ subscriptionId }: SubscriptionDetailViewProps) {
  const router = useRouter();
  const [subscription, setSubscription] = useState<any>(null);
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch(`/api/admin/billing/subscriptions/${subscriptionId}`);
      if (!res.ok) {
        const data = await res.json();
        setError(data?.error ?? '구독 정보를 불러오지 못했습니다.');
        setSubscription(null);
        setPayments([]);
        return;
      }
      const data = await res.json();
      setSubscription(data.subscription);
      setPayments(data.payments ?? []);
    } catch {
      setError('구독 정보를 불러오지 못했습니다.');
      setSubscription(null);
      setPayments([]);
    } finally {
      setLoading(false);
    }
  }, [subscriptionId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Link
          href="/admin/billing"
          className="inline-flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white"
        >
          <ArrowLeft size={16} /> 구독 목록
        </Link>
        <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6 animate-pulse">
          <div className="h-6 bg-neutral-200 dark:bg-neutral-700 rounded w-1/3 mb-4" />
          <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-2/3 mb-2" />
          <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-1/2" />
        </div>
      </div>
    );
  }

  if (error || !subscription) {
    return (
      <div className="space-y-6">
        <Link
          href="/admin/billing"
          className="inline-flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white"
        >
          <ArrowLeft size={16} /> 구독 목록
        </Link>
        <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-6">
          <p className="text-red-700 dark:text-red-300">{error ?? '구독을 찾을 수 없습니다.'}</p>
        </div>
      </div>
    );
  }

  const academy = subscription.academies;
  const plan = subscription.billing_plans;

  return (
    <div className="space-y-6">
      <Link
        href="/admin/billing"
        className="inline-flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white"
      >
        <ArrowLeft size={16} /> 구독 목록
      </Link>

      <section className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6">
        <h2 className="text-lg font-semibold text-black dark:text-white mb-4">구독 정보</h2>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-neutral-500 dark:text-neutral-400">학원</dt>
            <dd className="font-medium text-black dark:text-white">
              {academy?.name_kr ?? academy?.name_en ?? subscription.academy_id}
            </dd>
            {academy?.contact_number && (
              <dd className="text-neutral-600 dark:text-neutral-300 text-xs mt-0.5">{academy.contact_number}</dd>
            )}
          </div>
          <div>
            <dt className="text-neutral-500 dark:text-neutral-400">플랜</dt>
            <dd className="font-medium text-black dark:text-white">{plan?.display_name ?? subscription.plan_id}</dd>
          </div>
          <div>
            <dt className="text-neutral-500 dark:text-neutral-400">결제 주기</dt>
            <dd className="text-black dark:text-white">
              {BILLING_CYCLE_LABELS[subscription.billing_cycle as keyof typeof BILLING_CYCLE_LABELS] ?? subscription.billing_cycle}
            </dd>
          </div>
          <div>
            <dt className="text-neutral-500 dark:text-neutral-400">상태</dt>
            <dd>
              <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-neutral-100 dark:bg-neutral-700 text-neutral-800 dark:text-neutral-200">
                {SUBSCRIPTION_STATUS_LABELS[subscription.status as SubscriptionStatus] ?? subscription.status}
              </span>
            </dd>
          </div>
          <div>
            <dt className="text-neutral-500 dark:text-neutral-400">현재 기간</dt>
            <dd className="text-black dark:text-white">
              {formatDate(subscription.current_period_start)} ~ {formatDate(subscription.current_period_end)}
            </dd>
          </div>
          <div>
            <dt className="text-neutral-500 dark:text-neutral-400">카드</dt>
            <dd className="font-mono text-xs text-neutral-600 dark:text-neutral-400">
              {subscription.card_company} {subscription.card_number_masked ?? '-'}
            </dd>
          </div>
          {subscription.cancel_at_period_end && (
            <div className="sm:col-span-2">
              <dt className="text-neutral-500 dark:text-neutral-400">취소 예정</dt>
              <dd className="text-amber-600 dark:text-amber-400">기간 종료 시 취소</dd>
            </div>
          )}
        </dl>
      </section>

      <section className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6">
        <h2 className="text-lg font-semibold text-black dark:text-white mb-4">결제 이력</h2>
        {payments.length === 0 ? (
          <p className="text-neutral-500 dark:text-neutral-400 text-sm">결제 이력이 없습니다.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="border-b border-neutral-200 dark:border-neutral-700 text-neutral-500 dark:text-neutral-400">
                  <th className="py-2 pr-4 font-medium">결제일</th>
                  <th className="py-2 pr-4 font-medium">금액</th>
                  <th className="py-2 pr-4 font-medium">주기</th>
                  <th className="py-2 pr-4 font-medium">상태</th>
                  <th className="py-2 font-medium">주문 ID</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p: any) => (
                  <tr key={p.id} className="border-b border-neutral-100 dark:border-neutral-800">
                    <td className="py-2 pr-4 text-black dark:text-white">
                      {formatDate(p.paid_at ?? p.created_at)}
                    </td>
                    <td className="py-2 pr-4 text-black dark:text-white">
                      {p.amount?.toLocaleString()}원
                    </td>
                    <td className="py-2 pr-4 text-neutral-600 dark:text-neutral-400">
                      {BILLING_CYCLE_LABELS[p.billing_cycle as keyof typeof BILLING_CYCLE_LABELS] ?? p.billing_cycle}
                    </td>
                    <td className="py-2 pr-4">
                      <span
                        className={
                          p.status === 'completed' ? 'text-green-600 dark:text-green-400' : p.status === 'failed' ? 'text-red-600 dark:text-red-400' : ''
                        }
                      >
                        {PAYMENT_STATUS_LABELS[p.status as PaymentStatus] ?? p.status}
                      </span>
                    </td>
                    <td className="py-2 text-neutral-500 dark:text-neutral-400 font-mono text-xs">
                      {p.toss_order_id ?? '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
