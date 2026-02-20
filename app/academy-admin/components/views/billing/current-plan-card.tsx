'use client';

import {
  SUBSCRIPTION_STATUS_LABELS,
  BILLING_CYCLE_LABELS,
  type AcademySubscription,
  type BillingPlan,
  type SubscriptionStatus,
} from '@/types/billing';

interface CurrentPlanCardProps {
  subscription: AcademySubscription | null;
  plan: BillingPlan | null;
  loading: boolean;
}

function formatDate(s: string | null): string {
  if (!s) return '-';
  const d = new Date(s);
  return d.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
}

export function CurrentPlanCard({ subscription, plan, loading }: CurrentPlanCardProps) {
  if (loading) {
    return (
      <section className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 animate-pulse">
        <div className="h-6 bg-gray-200 dark:bg-gray-600 rounded w-1/3 mb-4" />
        <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded w-2/3 mb-2" />
        <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded w-1/2" />
      </section>
    );
  }

  if (!subscription) {
    return (
      <section className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-2">현재 구독</h3>
        <p className="text-gray-600 dark:text-gray-300 text-sm">
          아직 구독 정보가 없습니다. 결제 수단을 등록하고 플랜을 선택해 주세요.
        </p>
      </section>
    );
  }

  const status = subscription.status as SubscriptionStatus;

  // 카드만 등록된 상태: 구독 중이 아님 → 플랜 선택 유도
  if (status === 'card_only') {
    return (
      <section className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-2">현재 구독</h3>
        <p className="text-gray-600 dark:text-gray-300 text-sm">
          플랜을 선택한 뒤 결제하면 구독이 시작됩니다. 아래에서 플랜을 선택해 주세요.
        </p>
      </section>
    );
  }

  const statusLabel = SUBSCRIPTION_STATUS_LABELS[status] ?? status;
  const cycleLabel = BILLING_CYCLE_LABELS[subscription.billing_cycle];
  const planName = plan?.display_name ?? subscription.plan_id;
  const periodEnd = subscription.current_period_end;
  const cancelAtEnd = subscription.cancel_at_period_end;
  const trialEndsAt = subscription.trial_ends_at;

  return (
    <section className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
      <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">현재 구독</h3>
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-gray-500 dark:text-gray-400">플랜</dt>
          <dd className="font-medium text-gray-900 dark:text-white">{planName}</dd>
        </div>
        <div>
          <dt className="text-gray-500 dark:text-gray-400">결제 주기</dt>
          <dd className="font-medium text-gray-900 dark:text-white">{cycleLabel}</dd>
        </div>
        <div>
          <dt className="text-gray-500 dark:text-gray-400">상태</dt>
          <dd>
            <span
              className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                status === 'active'
                  ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                  : status === 'trial'
                    ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
                    : status === 'past_due'
                      ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400'
                      : status === 'canceled' || status === 'expired'
                        ? 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                        : 'bg-gray-100 text-gray-700 dark:bg-gray-600 dark:text-gray-300'
              }`}
            >
              {statusLabel}
            </span>
          </dd>
        </div>
        {periodEnd && (
          <div>
            <dt className="text-gray-500 dark:text-gray-400">현재 기간 종료일</dt>
            <dd className="font-medium text-gray-900 dark:text-white">{formatDate(periodEnd)}</dd>
          </div>
        )}
        {trialEndsAt && status === 'trial' && (
          <div>
            <dt className="text-gray-500 dark:text-gray-400">체험 종료일</dt>
            <dd className="font-medium text-gray-900 dark:text-white">{formatDate(trialEndsAt)}</dd>
          </div>
        )}
        {cancelAtEnd && (
          <div className="sm:col-span-2">
            <dt className="text-gray-500 dark:text-gray-400">취소 예정</dt>
            <dd className="text-amber-600 dark:text-amber-400 font-medium">
              현재 기간 종료 시 구독이 취소됩니다.
            </dd>
          </div>
        )}
      </dl>
      {status === 'trial' && trialEndsAt && (
        <div className="mt-4 p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-sm text-blue-800 dark:text-blue-200">
          <p className="font-medium mb-1">무료 체험 안내</p>
          <ul className="list-disc list-inside space-y-0.5 text-blue-700 dark:text-blue-300">
            <li>지금 <strong>14일 무료 체험</strong> 중입니다.</li>
            <li><strong>체험 종료일</strong>: {formatDate(trialEndsAt)}</li>
            <li><strong>결제 시작</strong>: 체험 종료일 이후 자동으로 첫 결제가 시도됩니다. 결제가 완료되면 정기 구독이 시작됩니다.</li>
          </ul>
        </div>
      )}
    </section>
  );
}
