'use client';

import { useState } from 'react';
import { authFetch } from '@/lib/supabase/auth-fetch';
import type { BillingPlan, BillingCycle, BillingPlanId } from '@/types/billing';
import { BILLING_CYCLE_LABELS } from '@/types/billing';

interface PlanChangeFormProps {
  academyId: string;
  plans: BillingPlan[];
  currentPlanId: BillingPlanId;
  currentBillingCycle: BillingCycle;
  initialPlanId?: BillingPlanId;
  initialCycle?: BillingCycle;
  subscriptionStatus: string;
  onSuccess: () => void;
}

export function PlanChangeForm({
  academyId,
  plans,
  currentPlanId,
  currentBillingCycle,
  initialPlanId,
  initialCycle,
  subscriptionStatus,
  onSuccess,
}: PlanChangeFormProps) {
  const [newPlanId, setNewPlanId] = useState<BillingPlanId>(initialPlanId ?? currentPlanId);
  const [newCycle, setNewCycle] = useState<BillingCycle>(initialCycle ?? currentBillingCycle);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isCardOnly = subscriptionStatus === 'card_only';
  const isTrial = subscriptionStatus === 'trial';
  const isActive = subscriptionStatus === 'active';
  const canChange = isCardOnly || isActive || isTrial;
  const isFirstSubscribe = isCardOnly || isTrial;
  const isSame = newPlanId === currentPlanId && newCycle === currentBillingCycle;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canChange || loading) return;
    if (isActive && isSame) return;
    setError(null);
    setLoading(true);
    try {
      if (isFirstSubscribe) {
        const res = await authFetch('/api/billing/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ academyId, planId: newPlanId, billingCycle: newCycle }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data?.error ?? '구독 시작에 실패했습니다.');
          return;
        }
      } else {
        const res = await authFetch('/api/billing/change-plan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            academyId,
            newPlanId,
            newBillingCycle: newCycle,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data?.error ?? '플랜 변경에 실패했습니다.');
          return;
        }
      }
      onSuccess();
    } catch {
      setError(isFirstSubscribe ? '구독 시작 처리 중 오류가 발생했습니다.' : '플랜 변경 처리 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  if (!canChange) {
    return (
      <section className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-2">플랜 선택 및 결제</h3>
        <p className="text-gray-600 dark:text-gray-400 text-sm">
          활성 또는 체험 중인 구독에서만 플랜을 변경할 수 있습니다.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
      <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">
        {isCardOnly ? '플랜 선택 및 결제' : isTrial ? '구독 시작' : '플랜 변경'}
      </h3>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            플랜
          </label>
          <select
            value={newPlanId}
            onChange={(e) => setNewPlanId(e.target.value as BillingPlanId)}
            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2 text-sm"
          >
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.display_name} (월 {p.monthly_price.toLocaleString()}원 / 연간 월 {p.annual_price_per_month.toLocaleString()}원)
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            결제 주기
          </label>
          <select
            value={newCycle}
            onChange={(e) => setNewCycle(e.target.value as BillingCycle)}
            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2 text-sm"
          >
            <option value="monthly">{BILLING_CYCLE_LABELS.monthly}</option>
            <option value="annual">{BILLING_CYCLE_LABELS.annual} (할인)</option>
          </select>
        </div>
        {error && (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        )}
        <button
          type="submit"
          disabled={(isActive && isSame) || loading}
          className="px-4 py-2 rounded-lg bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-sm font-medium hover:bg-gray-800 dark:hover:bg-gray-200 disabled:opacity-50"
        >
          {loading ? '처리 중…' : isFirstSubscribe ? '이 플랜으로 결제하기' : '플랜 변경'}
        </button>
      </form>
    </section>
  );
}
