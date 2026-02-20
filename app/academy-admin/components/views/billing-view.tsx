'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { SectionHeader } from '../common/section-header';
import { CurrentPlanCard } from './billing/current-plan-card';
import { PaymentMethodCard } from './billing/payment-method-card';
import { PlanCardsSection } from './billing/plan-cards-section';
import { CancelSubscriptionSection } from './billing/cancel-subscription-section';
import { PaymentHistoryTable } from './billing/payment-history-table';
import { authFetch } from '@/lib/supabase/auth-fetch';
import { useTossBillingAuth } from '@/lib/billing/use-toss-billing-auth';
import type { AcademySubscription, BillingPlan, BillingPlanId, BillingCycle } from '@/types/billing';

interface BillingViewProps {
  academyId: string;
}

export function BillingView({ academyId }: BillingViewProps) {
  const searchParams = useSearchParams();
  const [subscription, setSubscription] = useState<AcademySubscription | null>(null);
  const [plans, setPlans] = useState<BillingPlan[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [loadingSub, setLoadingSub] = useState(true);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [loadingPayments, setLoadingPayments] = useState(true);
  const [billingFail, setBillingFail] = useState(false);

  const loadSubscription = useCallback(async () => {
    setLoadingSub(true);
    try {
      const res = await authFetch(`/api/billing/subscription?academyId=${encodeURIComponent(academyId)}`);
      if (res.ok) {
        const data = await res.json();
        setSubscription(data);
      } else {
        setSubscription(null);
      }
    } catch {
      setSubscription(null);
    } finally {
      setLoadingSub(false);
    }
  }, [academyId]);

  const loadPlans = useCallback(async () => {
    setLoadingPlans(true);
    try {
      const res = await authFetch('/api/billing/plans');
      if (res.ok) {
        const data = await res.json();
        setPlans(Array.isArray(data) ? data : []);
      } else {
        setPlans([]);
      }
    } catch {
      setPlans([]);
    } finally {
      setLoadingPlans(false);
    }
  }, []);

  const loadPayments = useCallback(async () => {
    setLoadingPayments(true);
    try {
      const res = await authFetch(
        `/api/billing/payments?academyId=${encodeURIComponent(academyId)}&page=1&limit=20`
      );
      if (res.ok) {
        const data = await res.json();
        setPayments(data?.data ?? []);
      } else {
        setPayments([]);
      }
    } catch {
      setPayments([]);
    } finally {
      setLoadingPayments(false);
    }
  }, [academyId]);

  useEffect(() => {
    loadSubscription();
    loadPlans();
    loadPayments();
  }, [loadSubscription, loadPlans, loadPayments]);

  useEffect(() => {
    if (searchParams?.get('billing') === 'fail') {
      setBillingFail(true);
    }
  }, [searchParams]);

  // 카드 등록 성공 후 리다이렉트(card=ok) 시, 잠시 뒤 구독/카드 정보 재로드 후 URL 정리 (DB 반영·초기 로드와의 경쟁 방지)
  useEffect(() => {
    if (searchParams?.get('card') !== 'ok') return;
    const t = setTimeout(() => {
      loadSubscription();
      loadPayments();
      if (typeof window !== 'undefined') {
        const url = new URL(window.location.href);
        url.searchParams.delete('card');
        window.history.replaceState({}, '', url.pathname + url.search);
      }
    }, 600);
    return () => clearTimeout(t);
  }, [searchParams, loadSubscription, loadPayments]);

  const refresh = useCallback(() => {
    loadSubscription();
    loadPayments();
  }, [loadSubscription, loadPayments]);

  const plan = subscription?.billing_plans
    ? (subscription.billing_plans as BillingPlan)
    : plans.find((p) => p.id === subscription?.plan_id) ?? null;

  const noSubscription = !subscription;
  const isCardOnly = subscription?.status === 'card_only';
  const isTrial = subscription?.status === 'trial';
  const isActive = subscription?.status === 'active';
  const showPlanCards = noSubscription || isCardOnly || isTrial || isActive;

  const { openCardRegistration, loading: tossLoading, error: tossError } = useTossBillingAuth(academyId);
  const [planSubmitLoading, setPlanSubmitLoading] = useState(false);
  const [planSubmitError, setPlanSubmitError] = useState<string | null>(null);
  const [billingCycle, setBillingCycle] = useState<BillingCycle>(
    (searchParams?.get('cycle') as BillingCycle) === 'annual' ? 'annual' : 'monthly'
  );

  const handleSelectPlan = useCallback(
    async (planId: BillingPlanId, cycle: BillingCycle) => {
      setPlanSubmitError(null);
      if (noSubscription) {
        openCardRegistration({ planId, cycle, returnTo: 'billing' });
        return;
      }
      if (!subscription) return;
      const isFirstSubscribe = isCardOnly || isTrial;
      setPlanSubmitLoading(true);
      try {
        if (isFirstSubscribe) {
          const res = await authFetch('/api/billing/subscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ academyId, planId, billingCycle: cycle }),
          });
          const data = await res.json();
          if (!res.ok) {
            setPlanSubmitError(data?.error ?? '구독 시작에 실패했습니다.');
            return;
          }
          refresh();
        } else {
          const res = await authFetch('/api/billing/change-plan', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              academyId,
              newPlanId: planId,
              newBillingCycle: cycle,
            }),
          });
          const data = await res.json();
          if (!res.ok) {
            setPlanSubmitError(data?.error ?? '플랜 변경에 실패했습니다.');
            return;
          }
          refresh();
        }
      } catch {
        setPlanSubmitError(isFirstSubscribe ? '구독 시작 처리 중 오류가 발생했습니다.' : '플랜 변경 처리 중 오류가 발생했습니다.');
      } finally {
        setPlanSubmitLoading(false);
      }
    },
    [noSubscription, subscription, isCardOnly, isTrial, academyId, openCardRegistration, refresh]
  );

  return (
    <div className="space-y-8">
      <SectionHeader title="구독/결제 관리" />

      {billingFail && (
        <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 text-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-medium text-red-700 dark:text-red-300">카드 등록이 실패했습니다.</p>
              <p className="mt-1 text-red-600 dark:text-red-400/90">
                가상의 카드 번호를 입력한 경우 등록이 실패할 수 있습니다. 테스트 시에는 실제 본인 명의 카드를 사용해 주세요. (테스트 환경에서는 출금되지 않습니다.)
              </p>
            </div>
            <button
              type="button"
              onClick={() => setBillingFail(false)}
              className="text-red-600 dark:text-red-400 underline flex-shrink-0"
            >
              닫기
            </button>
          </div>
        </div>
      )}

      {/* 1. 플랜 카드 (intro와 동일한 카드 디자인) */}
      {showPlanCards && plans.length > 0 && (
        <section className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
          <PlanCardsSection
            apiPlans={plans}
            billingCycle={billingCycle}
            onBillingCycleChange={setBillingCycle}
            onSelectPlan={handleSelectPlan}
            loading={tossLoading || planSubmitLoading}
            error={tossError ?? planSubmitError}
            currentPlanId={subscription?.plan_id as BillingPlanId ?? null}
            currentCycle={(subscription?.billing_cycle as BillingCycle) ?? null}
            buttonMode={isActive ? 'change' : 'pay'}
          />
        </section>
      )}

      {/* 2. 현재 구독 (또는 card_only일 때 플랜 선택 유도) */}
      <CurrentPlanCard
        subscription={subscription}
        plan={plan}
        loading={loadingSub}
      />

      {/* 3. 결제 수단 */}
      <PaymentMethodCard
        academyId={academyId}
        cardCompany={subscription?.card_company ?? null}
        cardNumberMasked={subscription?.card_number_masked ?? null}
        hasBillingKey={!!subscription?.toss_billing_key}
        onSuccess={refresh}
      />

      {subscription && (
        <CancelSubscriptionSection
          academyId={academyId}
          status={subscription.status}
          cancelAtPeriodEnd={subscription.cancel_at_period_end}
          onSuccess={refresh}
        />
      )}

      <PaymentHistoryTable payments={payments} loading={loadingPayments} />
    </div>
  );
}
