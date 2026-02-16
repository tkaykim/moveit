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
      '전용 모바일 앱 (브랜딩 지원)',
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
      <div className="text-center mb-10">
        <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-2">
          학원 규모에 맞는 합리적인 요금제
        </h2>
        <p className="text-slate-600 mb-8">
          숨겨진 비용 없이, 필요한 기능만큼만 결제하세요.
        </p>
        <div className="flex items-center justify-center gap-4">
          <span className={`text-sm font-medium ${billingCycle === 'monthly' ? 'text-slate-900' : 'text-slate-400'}`}>
            월간 결제
          </span>
          <button
            type="button"
            onClick={() => setBillingCycle((c) => (c === 'monthly' ? 'yearly' : 'monthly'))}
            className="relative w-16 h-8 bg-slate-200 rounded-full p-1 transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2"
            aria-pressed={billingCycle === 'yearly'}
          >
            <span
              className={`block w-6 h-6 bg-white rounded-full shadow-md transition-transform duration-300 ${billingCycle === 'yearly' ? 'translate-x-8' : 'translate-x-0'}`}
            />
          </button>
          <span className={`text-sm font-medium flex items-center gap-2 ${billingCycle === 'yearly' ? 'text-slate-900' : 'text-slate-400'}`}>
            연간 결제
            <span className="bg-violet-600 text-white text-xs font-bold px-2.5 py-1 rounded-full whitespace-nowrap">
              20% 할인
            </span>
          </span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 sm:gap-6 md:gap-8 items-stretch min-w-0">
        {PLANS.map((plan) => {
          const price = billingCycle === 'monthly' ? plan.monthlyPrice : plan.yearlyPrice;
          return (
            <div
              key={plan.id}
              className={`relative rounded-2xl p-6 sm:p-8 transition-all min-w-0 ${
                plan.isPopular
                  ? 'bg-slate-900 text-white shadow-2xl scale-[1.02] z-10'
                  : 'bg-white text-slate-900 border border-slate-200 shadow-sm hover:shadow-md'
              }`}
            >
              {plan.isPopular && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-xs font-bold px-4 py-1.5 rounded-full whitespace-nowrap shadow-lg">
                  MOST POPULAR
                </div>
              )}
              <h3 className="text-xl font-bold mb-2">{plan.name}</h3>
              <p className={`text-sm mb-6 min-h-[40px] leading-snug ${plan.isPopular ? 'text-slate-300' : 'text-slate-500'}`}>
                {plan.description}
              </p>
              <div className="mb-8">
                <span className="text-4xl font-bold">{price.toLocaleString()}</span>
                <span className={`text-sm ml-1 ${plan.isPopular ? 'text-slate-400' : 'text-slate-500'}`}>
                  원 / 월
                </span>
                {billingCycle === 'yearly' && (
                  <p className="text-sm mt-1 text-slate-500">
                    연간 {plan.yearlyTotal.toLocaleString()}원 청구
                  </p>
                )}
              </div>
              <ul className="space-y-4 mb-8">
                {plan.features.map((feature, idx) => (
                  <li key={idx} className="flex items-start gap-3 text-sm">
                    <Check size={18} className={`flex-shrink-0 mt-0.5 ${plan.isPopular ? 'text-indigo-400' : 'text-indigo-600'}`} />
                    <span className={plan.isPopular ? 'text-slate-200' : 'text-slate-600'}>{feature}</span>
                  </li>
                ))}
              </ul>
              <a
                href="#contact"
                className={`block w-full py-4 rounded-xl font-bold text-center text-sm transition-all ${
                  plan.isPopular
                    ? 'bg-violet-600 hover:bg-violet-500 text-white shadow-lg'
                    : 'bg-white hover:bg-slate-50 text-slate-900 border border-slate-200'
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
