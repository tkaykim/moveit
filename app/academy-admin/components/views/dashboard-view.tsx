"use client";

import Link from 'next/link';
import {
  BookOpen,
  CalendarDays,
  UserCog,
  Ticket,
  ChevronRight,
} from 'lucide-react';
import { TodayClassesSection } from './today-classes-section';

interface DashboardViewProps {
  academyId: string;
}

export function DashboardView({ academyId }: DashboardViewProps) {
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
      label: '신청인원 관리',
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
      {/* 주요 관리 버튼 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {mainButtons.map((button, idx) => {
          const Icon = button.icon;
          return (
            <Link
              key={idx}
              href={button.href}
              className="group bg-white dark:bg-neutral-900 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-neutral-800 hover:shadow-lg hover:border-primary dark:hover:border-[#CCFF00] transition-all duration-200"
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
          );
        })}
      </div>

      {/* 오늘의 수업 일정 */}
      <TodayClassesSection academyId={academyId} />
    </div>
  );
}
