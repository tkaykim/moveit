'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Check, Zap } from 'lucide-react';

export type BillingPlanId = 'starter' | 'growth' | 'pro';

export const PLANS = [
  {
    id: 'starter' as BillingPlanId,
    name: '스타터',
    description: '소규모 스튜디오를 위한 핵심 운영 기능',
    monthlyPrice: 49000,
    annualPricePerMonth: 39200,
    annualTotal: 470400,
    maxStudents: 100,
    features: [
      '수강생 관리 (최대 100명)',
      '기본 스케줄 & 예약 시스템',
      'QR 코드 출석 체크',
      '수강권 & 상품 관리',
      '기본 매출 통계',
    ],
    notIncluded: [
      '푸시 알림 발송',
      '수강권 만기 자동 알림',
      '미출석 케어 알림',
      '강사 급여 정산',
    ],
    isPopular: false,
    color: 'violet',
  },
  {
    id: 'growth' as BillingPlanId,
    name: '그로스',
    description: '재수강율을 높이고 운영을 자동화하고 싶은 학원',
    monthlyPrice: 99000,
    annualPricePerMonth: 79200,
    annualTotal: 950400,
    maxStudents: null,
    features: [
      '수강생 무제한',
      '스케줄 & 예약 시스템',
      'QR 코드 출석 체크',
      '수강권 & 상품 관리',
      '고급 매출 통계',
      '푸시 알림 발송',
      '수강권 만기 자동 D-Day 알림',
      '미출석/장기결석 케어 알림',
      '강사 급여 정산',
    ],
    notIncluded: [
      '다중 지점 통합 관리',
      '커스텀 API 연동',
    ],
    isPopular: true,
    color: 'emerald',
  },
  {
    id: 'pro' as BillingPlanId,
    name: '프로',
    description: '다중 지점 관리와 고급 기능이 필요한 프랜차이즈',
    monthlyPrice: 199000,
    annualPricePerMonth: 159200,
    annualTotal: 1910400,
    maxStudents: null,
    features: [
      '수강생 무제한',
      '스케줄 & 예약 시스템',
      'QR 코드 출석 체크',
      '수강권 & 상품 관리',
      '고급 매출 통계 & 리포트',
      '푸시 알림 발송',
      '수강권 만기 자동 D-Day 알림',
      '미출석/장기결석 케어 알림',
      '강사 급여 정산',
      '다중 지점 통합 관리',
      '커스텀 API 연동',
      '전담 매니저 배정',
    ],
    notIncluded: [],
    isPopular: false,
    color: 'amber',
  },
];

export const PLAN_COLOR_MAP: Record<BillingPlanId, { bg: string; text: string; border: string; badge: string }> = {
  starter: {
    bg: 'bg-violet-50 dark:bg-violet-950/20',
    text: 'text-violet-700 dark:text-violet-300',
    border: 'border-violet-200 dark:border-violet-800',
    badge: 'bg-violet-600',
  },
  growth: {
    bg: 'bg-slate-800',
    text: 'text-emerald-400',
    border: 'border-emerald-500',
    badge: 'bg-emerald-500',
  },
  pro: {
    bg: 'bg-amber-50 dark:bg-amber-950/20',
    text: 'text-amber-700 dark:text-amber-300',
    border: 'border-amber-200 dark:border-amber-700',
    badge: 'bg-amber-500',
  },
};

export function PricingCards() {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');

  return (
    <div className="max-w-5xl mx-auto px-4">
      <div className="text-center mb-10">
        <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white mb-2">
          학원 규모에 맞는 합리적인 요금제
        </h2>
        <p className="text-slate-600 dark:text-slate-200 text-sm sm:text-base mb-8">
          숨겨진 비용 없이, 필요한 기능만큼만 결제하세요.
        </p>
        <div className="flex items-center justify-center gap-4 flex-wrap">
          <span className={`text-sm font-medium ${billingCycle === 'monthly' ? 'text-slate-900 dark:text-white' : 'text-slate-400 dark:text-slate-300'}`}>
            월간 결제
          </span>
          <button
            type="button"
            onClick={() => setBillingCycle((c) => (c === 'monthly' ? 'annual' : 'monthly'))}
            className="relative w-14 h-7 bg-slate-200 dark:bg-slate-600 rounded-full p-1 transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-slate-300 dark:focus:ring-slate-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
            aria-pressed={billingCycle === 'annual'}
          >
            <span
              className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow transition-transform duration-300 ${billingCycle === 'annual' ? 'translate-x-8 left-1' : 'left-1 translate-x-0'}`}
            />
          </button>
          <span className={`text-sm font-medium flex items-center gap-2 ${billingCycle === 'annual' ? 'text-slate-900 dark:text-white' : 'text-slate-400 dark:text-slate-300'}`}>
            연간 결제
            <span className="bg-violet-500 text-white text-xs font-bold px-2 py-0.5 rounded-full whitespace-nowrap">
              20% 할인
            </span>
          </span>
        </div>
      </div>

      <div className="overflow-x-auto overflow-y-visible pb-2 -mx-4 px-4 md:mx-0 md:px-0 md:pb-0 scroll-smooth pt-6">
        <div className="flex gap-4 md:grid md:grid-cols-3 items-stretch w-max md:w-full min-w-0">
          {PLANS.map((plan) => {
            const price = billingCycle === 'monthly' ? plan.monthlyPrice : plan.annualPricePerMonth;
            const colors = PLAN_COLOR_MAP[plan.id];
            const isGrowth = plan.id === 'growth';

            return (
              <div
                key={plan.id}
                className={`relative rounded-2xl p-5 sm:p-6 flex-shrink-0 min-w-[260px] md:min-w-0 flex flex-col overflow-visible ${
                  isGrowth
                    ? 'bg-slate-800 text-white shadow-xl z-10 pt-8'
                    : `bg-white dark:bg-neutral-900 text-slate-900 dark:text-white border ${colors.border} shadow-sm`
                }`}
              >
                {plan.isPopular && (
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-emerald-500 text-white text-xs font-bold px-3 py-1.5 rounded-full whitespace-nowrap z-20 shadow-md ring-2 ring-white dark:ring-slate-800 flex items-center gap-1">
                    <Zap size={11} className="fill-white" />
                    인기 플랜
                  </div>
                )}

                {/* Plan badge */}
                <div className="mb-3">
                  <span className={`inline-block text-xs font-bold px-2.5 py-1 rounded-full ${colors.badge} text-white`}>
                    {plan.name}
                  </span>
                </div>

                <p className={`text-sm mb-4 leading-snug min-w-0 break-words ${isGrowth ? 'text-slate-200' : 'text-slate-600 dark:text-slate-400'}`}>
                  {plan.description}
                </p>

                <div className="mb-1">
                  <span className="text-3xl font-bold">{price.toLocaleString()}</span>
                  <span className={`text-sm ml-1 ${isGrowth ? 'text-slate-300' : 'text-slate-500 dark:text-slate-400'}`}>
                    원 / 월
                  </span>
                </div>
                {billingCycle === 'annual' ? (
                  <p className={`text-xs mb-4 ${isGrowth ? 'text-slate-400' : 'text-slate-500 dark:text-slate-500'}`}>
                    연간 {plan.annualTotal.toLocaleString()}원 청구 (월 {plan.monthlyPrice.toLocaleString()}원 대비 20% 할인)
                  </p>
                ) : (
                  <p className={`text-xs mb-4 ${isGrowth ? 'text-slate-400' : 'text-slate-500 dark:text-slate-500'}`}>
                    연간 결제 시 월 {plan.annualPricePerMonth.toLocaleString()}원
                  </p>
                )}

                {plan.maxStudents && (
                  <p className={`text-xs font-semibold mb-3 px-2 py-1 rounded-lg inline-block ${isGrowth ? 'bg-white/10 text-slate-200' : 'bg-neutral-100 dark:bg-neutral-800 text-slate-600 dark:text-slate-400'}`}>
                    최대 {plan.maxStudents}명 수강생
                  </p>
                )}

                <ul className="space-y-2 mb-6 flex-1 min-w-0">
                  {plan.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-xs sm:text-sm min-w-0">
                      <Check
                        size={15}
                        className={`flex-shrink-0 mt-0.5 ${isGrowth ? 'text-emerald-400' : 'text-emerald-600'}`}
                      />
                      <span className={`min-w-0 break-words ${isGrowth ? 'text-slate-100' : 'text-slate-700 dark:text-slate-300'}`}>
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>

                <Link
                  href={`/intro/start?planId=${plan.id}&cycle=${billingCycle}`}
                  className={`block w-full py-3.5 rounded-xl font-bold text-center text-sm transition-colors mt-auto ${
                    isGrowth
                      ? 'bg-emerald-500 hover:bg-emerald-400 text-white'
                      : plan.id === 'pro'
                      ? 'bg-amber-500 hover:bg-amber-400 text-white'
                      : 'bg-violet-600 hover:bg-violet-500 text-white'
                  }`}
                >
                  {plan.name} 시작하기
                </Link>
              </div>
            );
          })}
        </div>
      </div>

      {/* 하단 안내 */}
      <p className="text-center text-xs text-slate-500 dark:text-slate-400 mt-6">
        모든 플랜은 <strong>14일 무료 체험</strong>을 제공합니다. 체험 기간 중 언제든 취소 가능합니다.
        <br className="hidden sm:block" />
        월간 결제는 매월 자동 갱신, 연간 결제는 1년 단위로 청구됩니다. 토스페이먼츠를 통한 안전한 자동결제.
      </p>
    </div>
  );
}
