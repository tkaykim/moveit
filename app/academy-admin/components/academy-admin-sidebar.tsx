"use client";

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  LayoutDashboard,
  Users,
  Calendar,
  ClipboardList,
  UserCheck,
  MessageSquare,
  Ticket,
  CreditCard,
  Settings,
  LogOut,
  type LucideIcon,
} from 'lucide-react';

interface SidebarItemProps {
  icon: LucideIcon;
  label: string;
  href: string;
  active: boolean;
}

const SidebarItem = ({ icon: Icon, label, href, active }: SidebarItemProps) => (
  <Link
    href={href}
    className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-all duration-200 rounded-lg mx-2 mb-1 ${
      active
        ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 font-bold shadow-sm'
        : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-neutral-800 hover:text-gray-900 dark:hover:text-gray-100'
    }`}
  >
    <Icon
      size={20}
      className={active ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500'}
    />
    <span className="text-sm">{label}</span>
  </Link>
);

interface AcademyAdminSidebarProps {
  academyId: string;
}

export function AcademyAdminSidebar({ academyId }: AcademyAdminSidebarProps) {
  const pathname = usePathname();

  const menuItems = [
    { icon: LayoutDashboard, label: '대시보드', href: `/academy-admin/${academyId}` },
    { icon: Users, label: '학생 관리', href: `/academy-admin/${academyId}/students` },
    { icon: Calendar, label: '클래스/시간표', href: `/academy-admin/${academyId}/classes` },
    { icon: ClipboardList, label: '업무/수업 일지', href: `/academy-admin/${academyId}/logs` },
    { icon: UserCheck, label: '강사 관리', href: `/academy-admin/${academyId}/instructors` },
    { icon: MessageSquare, label: '상담 관리', href: `/academy-admin/${academyId}/consultations` },
    { icon: Ticket, label: '수강권/상품', href: `/academy-admin/${academyId}/products` },
    { icon: CreditCard, label: '매출/정산', href: `/academy-admin/${academyId}/revenue` },
    { icon: Settings, label: '설정', href: `/academy-admin/${academyId}/settings` },
  ];
  
  // 매출/정산 페이지에 판매 시스템 링크 추가를 위한 서브메뉴는 별도로 처리

  const isActive = (href: string) => {
    if (href === `/academy-admin/${academyId}`) {
      return pathname === href;
    }
    return pathname?.startsWith(href);
  };

  return (
    <aside className="w-64 bg-white dark:bg-neutral-900 border-r border-gray-200 dark:border-neutral-800 flex flex-col shadow-lg z-20">
      <div className="h-16 flex items-center px-6 border-b border-gray-100 dark:border-neutral-800">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 dark:bg-blue-500 rounded-lg flex items-center justify-center text-white font-bold italic">
            M
          </div>
          <h1 className="text-xl font-extrabold tracking-tight text-gray-900 dark:text-white italic">
            MOVE <span className="text-blue-600 dark:text-blue-400">IT</span>
          </h1>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-6 space-y-1">
        <div className="px-6 pt-6 pb-2 text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
          운영 관리
        </div>
        {menuItems.slice(0, 5).map((item) => (
          <SidebarItem
            key={item.href}
            icon={item.icon}
            label={item.label}
            href={item.href}
            active={isActive(item.href)}
          />
        ))}

        <div className="px-6 pt-6 pb-2 text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
          매출 및 설정
        </div>
        {menuItems.slice(5).map((item) => (
          <SidebarItem
            key={item.href}
            icon={item.icon}
            label={item.label}
            href={item.href}
            active={isActive(item.href)}
          />
        ))}
      </nav>

      <div className="p-4 border-t border-gray-100 dark:border-neutral-800">
        <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-neutral-800 cursor-pointer transition-colors">
          <div className="w-9 h-9 rounded-full bg-slate-800 dark:bg-slate-700 text-white flex items-center justify-center font-bold text-sm">
            OD
          </div>
          <div className="flex-1 overflow-hidden">
            <p className="text-sm font-bold truncate text-gray-900 dark:text-white">오동현</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">총괄 관리자</p>
          </div>
          <LogOut size={16} className="text-gray-400 dark:text-gray-500 hover:text-red-500" />
        </div>
      </div>
    </aside>
  );
}

