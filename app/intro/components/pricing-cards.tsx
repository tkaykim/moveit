'use client';

import React, { useState } from 'react';
import { Check } from 'lucide-react';

const PLANS = [
  {
    id: 'starter',
    name: 'Starter',
    description: '이제 막 성장하는 소규모 스튜디오를 위한 필수 기능',
    monthlyPrice: 59000,
    yearlyPrice: 47200,
    yearlyTotal: 566400,
    features: [
      '수강생 관리 (최대 100명)',
      '기본 캘린더 및 예약 시스템',
      'QR 코드 출석 체크',
      '수강권 만료 D-Day 알림',
      '월간 매출 리포트 (Basic)',
    ],
    isPopular: false,
  },
  {
    id: 'pro',
    name: 'Pro Growth',
    description: '재수강율을 높이고 운영을 자동화하고 싶은 학원',
    monthlyPrice: 129000,
    yearlyPrice: 103200,
    yearlyTotal: 1238400,
    features: [
      '수강생 무제한 관리',
      '캘린더 연동 원클릭 결제 시스템',
      '수업 영상 자동 업로드 및 알림',
      '미출석/장기 결석 자동 케어 알림',
      '강사 급여 정산 자동화',
    ],
    isPopular: true,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    description: '다중 지점 관리와 커스텀 기능이 필요한 프랜차이즈',
    monthlyPrice: 299000,
    yearlyPrice: 239200,
    yearlyTotal: 2870400,
    features: [
      '전 지점 데이터 통합 대시보드',
      '전용 서버 및 API 연동 지원',
      '커스텀 기능 개발 (ERP 연동 등)',
      '전담 매니저 배정',
      '본사-지점간 공지 및 정산 시스템',
      '최고 수준의 보안 서버',
    ],
    isPopular: false,
  },
];

export function PricingCards() {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');

  return (
    <div className="max-w-5xl mx-auto px-4">
      <div className="text-center mb-8">
        <h2 className="text-xl sm:text-2xl md:text-3xl font-bold mb-2 text-neutral-900 dark:text-white">
          학원 규모에 맞는 합리적인 요금제
        </h2>
        <p className="text-sm sm:text-base text-neutral-500 dark:text-neutral-400 mb-6">
          숨겨진 비용 없이, 필요한 기능만큼만 결제하세요.
        </p>
        <div className="flex items-center justify-center gap-3">
          <span className={`text-sm font-medium ${billingCycle === 'monthly' ? 'text-neutral-900 dark:text-white' : 'text-neutral-500 dark:text-neutral-400'}`}>
            월간 결제
          </span>
          <button
            type="button"
            onClick={() => setBillingCycle((c) => (c === 'monthly' ? 'yearly' : 'monthly'))}
            className="relative w-14 h-7 bg-neutral-200 dark:bg-neutral-700 rounded-full p-1 transition-colors focus:outline-none focus:ring-2 focus:ring-neutral-400"
            aria-pressed={billingCycle === 'yearly'}
          >
            <span
              className={`block w-5 h-5 bg-white dark:bg-neutral-200 rounded-full shadow transition-transform duration-300 ${billingCycle === 'yearly' ? 'translate-x-7' : 'translate-x-0'}`}
            />
          </button>
          <span className={`text-sm font-medium ${billingCycle === 'yearly' ? 'text-neutral-900 dark:text-white' : 'text-neutral-500 dark:text-neutral-400'}`}>
            연간 결제
            <span className="ml-1.5 text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded-full">
              20% 할인
            </span>
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
        {PLANS.map((plan) => {
          const price = billingCycle === 'monthly' ? plan.monthlyPrice : plan.yearlyPrice;
          return (
            <div
              key={plan.id}
              className={`relative rounded-2xl p-6 sm:p-8 transition-all ${
                plan.isPopular
                  ? 'bg-neutral-900 dark:bg-neutral-800 text-white shadow-xl scale-[1.02] z-10 border-2 border-neutral-900 dark:border-neutral-700'
                  : 'bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 shadow-sm hover:shadow-md'
              }`}
            >
              {plan.isPopular && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-gradient-to-r from-blue-600 to-violet-600 text-white text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap">
                  MOST POPULAR
                </div>
              )}
              <h3 className="text-lg font-bold mb-2">{plan.name}</h3>
              <p className={`text-sm mb-6 min-h-[40px] ${plan.isPopular ? 'text-neutral-300' : 'text-neutral-500 dark:text-neutral-400'}`}>
                {plan.description}
              </p>
              <div className="mb-6">
                <span className="text-3xl sm:text-4xl font-bold">{price.toLocaleString()}</span>
                <span className={`text-sm ${plan.isPopular ? 'text-neutral-400' : 'text-neutral-500 dark:text-neutral-400'}`}>
                  원/월
                </span>
                {billingCycle === 'yearly' && (
                  <p className="text-xs mt-1 text-neutral-500 dark:text-neutral-400">
                    연간 {plan.yearlyTotal.toLocaleString()}원 청구
                  </p>
                )}
              </div>
              <ul className="space-y-3 mb-8">
                {plan.features.map((feature, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-sm">
                    <Check size={18} className={`flex-shrink-0 mt-0.5 ${plan.isPopular ? 'text-blue-400' : 'text-blue-600 dark:text-blue-400'}`} />
                    <span className={plan.isPopular ? 'text-neutral-200' : 'text-neutral-700 dark:text-neutral-300'}>{feature}</span>
                  </li>
                ))}
              </ul>
              <a
                href="#contact"
                className={`block w-full py-3.5 rounded-xl font-bold text-center text-sm transition-all ${
                  plan.isPopular
                    ? 'bg-white text-neutral-900 hover:bg-neutral-100'
                    : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white hover:bg-neutral-200 dark:hover:bg-neutral-700 border border-neutral-200 dark:border-neutral-600'
                }`}
              >
                {plan.name} 시작하기
              </a>
            </div>
          );
        })}
      </div>
    </div>
  );
}
