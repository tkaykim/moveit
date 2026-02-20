"use client";

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  BookOpen,
  CalendarDays,
  UserCog,
  Ticket,
  ChevronRight,
  CreditCard,
} from 'lucide-react';
import { authFetch } from '@/lib/supabase/auth-fetch';
import { SubscribeModal } from '../subscribe-modal';
import { TodayClassesSection } from './today-classes-section';
import type { AcademySubscription } from '@/types/billing';

interface DashboardViewProps {
  academyId: string;
  /** 학원 개설 직후 웰컴 배너 표시 (체험 유도) */
  showWelcomeBanner?: boolean;
  onDismissWelcomeBanner?: () => void;
}

const ACTIVE_SUBSCRIPTION_STATUSES = ['active'];

export function DashboardView({ academyId, showWelcomeBanner, onDismissWelcomeBanner }: DashboardViewProps) {
  const [subscription, setSubscription] = useState<AcademySubscription | null>(null);
  const [loadingSub, setLoadingSub] = useState(true);
  const [subscribeModalOpen, setSubscribeModalOpen] = useState(false);

  const loadSubscription = useCallback(async () => {
    setLoadingSub(true);
    try {
      const res = await authFetch(`/api/billing/subscription?academyId=${encodeURIComponent(academyId)}`);
      if (res.ok) {
        const data = await res.json();
        setSubscription(data ?? null);
      } else {
        setSubscription(null);
      }
    } catch {
      setSubscription(null);
    } finally {
      setLoadingSub(false);
    }
  }, [academyId]);

  useEffect(() => {
    loadSubscription();
  }, [loadSubscription]);

  const hasActiveSubscription =
    subscription &&
    ACTIVE_SUBSCRIPTION_STATUSES.includes((subscription as AcademySubscription).status);
  const showSubscribeCta =
    !loadingSub && (!subscription || !hasActiveSubscription);

  const mainButtons = [
    {
      label: '클래스 관리',
      icon: BookOpen,
      href: `/academy-admin/${academyId}/class-masters`,
      description: '클래스(반)를 생성하고 관리합니다',
      color: 'bg-blue-50 dark:bg-blue-900/20',
      iconColor: 'text-blue-600 dark:text-blue-400',
    },
    {
      label: '스케줄 관리',
      icon: CalendarDays,
      href: `/academy-admin/${academyId}/schedule`,
      description: '수업 일정을 등록하고 관리합니다',
      color: 'bg-purple-50 dark:bg-purple-900/20',
      iconColor: 'text-purple-600 dark:text-purple-400',
    },
    {
      label: '출석/신청 관리',
      icon: UserCog,
      href: `/academy-admin/${academyId}/enrollments`,
      description: '수업 신청 및 등록을 관리합니다',
      color: 'bg-green-50 dark:bg-green-900/20',
      iconColor: 'text-green-600 dark:text-green-400',
    },
    {
      label: '수강권 관리',
      icon: Ticket,
      href: `/academy-admin/${academyId}/products`,
      description: '수강권 및 상품을 관리합니다',
      color: 'bg-orange-50 dark:bg-orange-900/20',
      iconColor: 'text-orange-600 dark:text-orange-400',
    },
  ];

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* 학원 개설 직후 웰컴 배너: 체험 유도 (구독 모달 대신) */}
      {showWelcomeBanner && onDismissWelcomeBanner && (
        <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <p className="font-semibold text-emerald-900 dark:text-emerald-100">
              환영합니다!
            </p>
            <p className="text-sm text-emerald-800 dark:text-emerald-200/90 mt-0.5">
              학원이 개설되었습니다. 이제 아래 메뉴에서 스케줄, 출석, 수강권 등 기능을 체험해 보세요. 체험 후 구독 플랜을 선택하고 결제할 수 있습니다.
            </p>
          </div>
          <button
            type="button"
            onClick={onDismissWelcomeBanner}
            className="flex-shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-800/40"
          >
            알겠어요
          </button>
        </div>
      )}

      {/* 구독 유도 배너 (구독 없음/만료 시) */}
      {showSubscribeCta && (
        <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <p className="font-medium text-amber-900 dark:text-amber-100">
              체험 후 구독 플랜을 선택하고 결제하세요
            </p>
            <p className="text-sm text-amber-700 dark:text-amber-200/90 mt-0.5">
              기능을 체험해 보신 뒤, 구독 플랜을 결정하고 결제 모달에서 카드 등록 및 구독을 진행할 수 있습니다.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setSubscribeModalOpen(true)}
            className="flex-shrink-0 px-4 py-2.5 rounded-lg font-medium bg-amber-600 dark:bg-amber-500 text-white hover:bg-amber-700 dark:hover:bg-amber-400"
          >
            구독 플랜 선택 및 결제
          </button>
        </div>
      )}

      {/* 활성 구독 시 구독/결제 관리 링크 */}
      {!loadingSub && hasActiveSubscription && (
        <Link
          href={`/academy-admin/${academyId}/billing`}
          className="flex items-center gap-2 rounded-xl border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-4 text-gray-700 dark:text-gray-300 hover:border-primary dark:hover:border-[#CCFF00] transition-colors"
        >
          <CreditCard className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          <span className="font-medium">구독/결제 관리</span>
          <ChevronRight className="w-5 h-5 ml-auto text-gray-400" />
        </Link>
      )}

      <SubscribeModal
        academyId={academyId}
        isOpen={subscribeModalOpen}
        onClose={() => setSubscribeModalOpen(false)}
      />

      {/* 주요 관리 버튼 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6" data-onboarding="page-dashboard-1">
        {mainButtons.map((button, idx) => {
          const Icon = button.icon;
          return (
            <div key={button.href} data-onboarding={`page-dashboard-card-${idx}`}>
              <Link
                href={button.href}
                className="group block bg-white dark:bg-neutral-900 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-neutral-800 hover:shadow-lg hover:border-primary dark:hover:border-[#CCFF00] transition-all duration-200"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className={`p-3 rounded-lg ${button.color}`}>
                    <Icon className={`${button.iconColor} w-6 h-6`} />
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400 dark:text-gray-500 group-hover:text-primary dark:group-hover:text-[#CCFF00] transition-colors" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                  {button.label}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {button.description}
                </p>
              </Link>
            </div>
          );
        })}
      </div>

      {/* 오늘의 수업 일정 */}
      <div data-onboarding="page-dashboard-0">
        <TodayClassesSection academyId={academyId} />
      </div>
    </div>
  );
}
