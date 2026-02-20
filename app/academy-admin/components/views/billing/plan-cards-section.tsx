'use client';

import React from 'react';
import { Check, Zap } from 'lucide-react';
import { useTheme } from 'next-themes';
import { PLANS, PLAN_COLOR_MAP } from '@/app/intro/components/pricing-cards';
import type { BillingPlanId, BillingCycle, BillingPlan } from '@/types/billing';

interface PlanCardsSectionProps {
  apiPlans: BillingPlan[];
  billingCycle: BillingCycle;
  onBillingCycleChange: (cycle: BillingCycle) => void;
  onSelectPlan: (planId: BillingPlanId, cycle: BillingCycle) => void;
  loading?: boolean;
  error?: string | null;
  /** 현재 구독 중인 플랜(같으면 "플랜 변경" 버튼 비활성화 등) */
  currentPlanId?: BillingPlanId | null;
  currentCycle?: BillingCycle | null;
  /** 카드 버튼 문구: 'pay' = 이 플랜으로 결제하기, 'change' = 플랜 변경 */
  buttonMode?: 'pay' | 'change';
}

function getPrice(planId: string, cycle: BillingCycle, apiPlans: BillingPlan[]) {
  const api = apiPlans.find((p) => p.id === planId);
  const fallback = PLANS.find((p) => p.id === planId);
  if (cycle === 'annual' && api) return api.annual_price_per_month;
  if (cycle === 'monthly' && api) return api.monthly_price;
  if (cycle === 'annual' && fallback) return fallback.annualPricePerMonth;
  if (fallback) return fallback.monthlyPrice;
  return 0;
}

function getAnnualTotal(planId: string, apiPlans: BillingPlan[]) {
  const api = apiPlans.find((p) => p.id === planId);
  const fallback = PLANS.find((p) => p.id === planId);
  if (api) return api.annual_price_per_month * 12;
  if (fallback) return fallback.annualTotal;
  return 0;
}

export function PlanCardsSection({
  apiPlans,
  billingCycle,
  onBillingCycleChange,
  onSelectPlan,
  loading = false,
  error = null,
  currentPlanId = null,
  currentCycle = null,
  buttonMode = 'pay',
}: PlanCardsSectionProps) {
  const { resolvedTheme } = useTheme();
  const isLight = resolvedTheme === 'light';

  return (
    <div className="max-w-5xl">
      <div className="text-center mb-8">
        <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-1">
          플랜 선택 및 결제
        </h3>
        <p className="text-slate-600 dark:text-slate-400 text-sm mb-6">
          플랜을 선택한 뒤 결제하기를 누르면 카드 등록 또는 결제가 진행됩니다.
        </p>
        <div className="flex items-center justify-center gap-4 flex-wrap">
          <span
            className={`text-sm font-medium ${billingCycle === 'monthly' ? 'text-slate-900 dark:text-white' : 'text-slate-400 dark:text-slate-300'}`}
          >
            월간 결제
          </span>
          <button
            type="button"
            onClick={() => onBillingCycleChange(billingCycle === 'monthly' ? 'annual' : 'monthly')}
            className="relative w-14 h-7 bg-slate-200 dark:bg-slate-600 rounded-full p-1 transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-slate-300 dark:focus:ring-slate-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
            aria-pressed={billingCycle === 'annual'}
          >
            <span
              className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow transition-transform duration-300 ${billingCycle === 'annual' ? 'translate-x-8 left-1' : 'left-1 translate-x-0'}`}
            />
          </button>
          <span
            className={`text-sm font-medium flex items-center gap-2 ${billingCycle === 'annual' ? 'text-slate-900 dark:text-white' : 'text-slate-400 dark:text-slate-300'}`}
          >
            연간 결제
            <span className="bg-violet-500 text-white text-xs font-bold px-2 py-0.5 rounded-full whitespace-nowrap">
              20% 할인
            </span>
          </span>
        </div>
      </div>

      <div className="overflow-x-auto overflow-y-visible pb-2 -mx-4 px-4 md:mx-0 md:px-0 md:pb-0 scroll-smooth">
        <div className="flex gap-4 md:grid md:grid-cols-3 items-stretch w-max md:w-full min-w-0">
          {PLANS.map((plan) => {
            const price = getPrice(plan.id, billingCycle, apiPlans);
            const annualTotal = getAnnualTotal(plan.id, apiPlans);
            const colors = PLAN_COLOR_MAP[plan.id];
            const isGrowth = plan.id === 'growth';
            const borderClass = colors.border[isLight ? 'light' : 'dark'];
            const isCurrentPlan =
              currentPlanId === plan.id && currentCycle === billingCycle;
            const annualPricePerMonth =
              apiPlans.find((p) => p.id === plan.id)?.annual_price_per_month ??
              plan.annualPricePerMonth;

            return (
              <div
                key={plan.id}
                className={`relative rounded-2xl p-5 sm:p-6 flex-shrink-0 min-w-[260px] md:min-w-0 flex flex-col overflow-visible ${
                  isGrowth
                    ? 'bg-slate-800 text-white shadow-xl z-10 pt-8'
                    : `bg-white dark:bg-neutral-900 text-slate-900 dark:text-white border ${borderClass} shadow-sm`
                }`}
              >
                {plan.isPopular && (
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-emerald-500 text-white text-xs font-bold px-3 py-1.5 rounded-full whitespace-nowrap z-20 shadow-md ring-2 ring-white dark:ring-slate-800 flex items-center gap-1">
                    <Zap size={11} className="fill-white" />
                    인기 플랜
                  </div>
                )}

                <div className="mb-3">
                  <span
                    className={`inline-block text-xs font-bold px-2.5 py-1 rounded-full ${colors.badge} text-white`}
                  >
                    {plan.name}
                  </span>
                </div>

                <p
                  className={`text-sm mb-4 leading-snug min-w-0 break-words ${isGrowth ? 'text-slate-200' : 'text-slate-600 dark:text-slate-400'}`}
                >
                  {plan.description}
                </p>

                <div className="mb-1">
                  <span className="text-3xl font-bold">
                    {price.toLocaleString()}
                  </span>
                  <span
                    className={`text-sm ml-1 ${isGrowth ? 'text-slate-300' : 'text-slate-500 dark:text-slate-400'}`}
                  >
                    원 / 월
                  </span>
                </div>
                {billingCycle === 'annual' ? (
                  <p
                    className={`text-xs mb-4 ${isGrowth ? 'text-slate-400' : 'text-slate-500 dark:text-slate-500'}`}
                  >
                    연간 {annualTotal.toLocaleString()}원 청구 (월{' '}
                    {plan.monthlyPrice.toLocaleString()}원 대비 20% 할인)
                  </p>
                ) : (
                  <p
                    className={`text-xs mb-4 ${isGrowth ? 'text-slate-400' : 'text-slate-500 dark:text-slate-500'}`}
                  >
                    연간 결제 시 월 {annualPricePerMonth.toLocaleString()}원
                  </p>
                )}

                {plan.maxStudents && (
                  <p
                    className={`text-xs font-semibold mb-3 px-2 py-1 rounded-lg inline-block ${isGrowth ? 'bg-white/10 text-slate-200' : 'bg-neutral-100 dark:bg-neutral-800 text-slate-600 dark:text-slate-400'}`}
                  >
                    최대 {plan.maxStudents}명 수강생
                  </p>
                )}

                <ul className="space-y-2 mb-6 flex-1 min-w-0">
                  {plan.features.map((feature, idx) => (
                    <li
                      key={idx}
                      className="flex items-start gap-2 text-xs sm:text-sm min-w-0"
                    >
                      <Check
                        size={15}
                        className={`flex-shrink-0 mt-0.5 ${isGrowth ? 'text-emerald-400' : 'text-emerald-600'}`}
                      />
                      <span
                        className={`min-w-0 break-words ${isGrowth ? 'text-slate-100' : 'text-slate-700 dark:text-slate-300'}`}
                      >
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>

                <button
                  type="button"
                  onClick={() => onSelectPlan(plan.id, billingCycle)}
                  disabled={loading || isCurrentPlan}
                  className={`block w-full py-3.5 rounded-xl font-bold text-center text-sm transition-colors mt-auto disabled:opacity-50 disabled:cursor-not-allowed ${
                    isGrowth
                      ? 'bg-emerald-500 hover:bg-emerald-400 text-white'
                      : plan.id === 'pro'
                        ? 'bg-amber-500 hover:bg-amber-400 text-white'
                        : 'bg-violet-600 hover:bg-violet-500 text-white'
                  }`}
                >
                  {loading
                    ? '처리 중…'
                    : isCurrentPlan
                      ? '현재 플랜'
                      : buttonMode === 'change'
                        ? '플랜 변경'
                        : `${plan.name} 시작하기`}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {error && (
        <p className="mt-4 text-sm text-red-600 dark:text-red-400 text-center">
          {error}
        </p>
      )}

      <p className="text-center text-xs text-slate-500 dark:text-slate-400 mt-6">
        모든 플랜은 <strong>14일 무료 체험</strong>을 제공합니다. 체험 기간 중 언제든 취소 가능합니다.
        <br className="hidden sm:block" />
        <strong>체험 종료일</strong> 이후 자동으로 첫 결제가 시도되며, 결제가 완료되면 정기 구독이 시작됩니다.
        <br className="hidden sm:block" />
        월간 결제는 매월 자동 갱신, 연간 결제는 1년 단위로 청구됩니다.
      </p>
    </div>
  );
}
