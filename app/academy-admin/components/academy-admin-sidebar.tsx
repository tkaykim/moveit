"use client";

import { useEffect } from 'react';
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
  X,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '@/lib/auth/auth-context';

interface SidebarItemProps {
  icon: LucideIcon;
  label: string;
  href: string;
  active: boolean;
  onClick?: () => void;
}

const SidebarItem = ({ icon: Icon, label, href, active, onClick }: SidebarItemProps) => (
  <Link
    href={href}
    onClick={onClick}
    className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-all duration-200 rounded-lg mx-2 mb-1 ${
      active
        ? 'bg-primary/10 dark:bg-[#CCFF00]/10 text-primary dark:text-[#CCFF00] font-bold shadow-sm'
        : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800'
    }`}
  >
    <Icon
      size={20}
      className={active ? 'text-primary dark:text-[#CCFF00]' : 'text-neutral-400 dark:text-neutral-500'}
    />
    <span className="text-sm">{label}</span>
  </Link>
);

interface AcademyAdminSidebarProps {
  academyId: string;
  isOpen: boolean;
  onClose: () => void;
}

export function AcademyAdminSidebar({ academyId, isOpen, onClose }: AcademyAdminSidebarProps) {
  const pathname = usePathname();
  const { user, profile, signOut } = useAuth();

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
  
  // 모바일에서 메뉴 클릭 시 드로어 닫기
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const isActive = (href: string) => {
    if (href === `/academy-admin/${academyId}`) {
      return pathname === href;
    }
    return pathname?.startsWith(href);
  };

  const handleLinkClick = () => {
    // 모바일에서 링크 클릭 시 드로어 닫기
    if (window.innerWidth < 1024) {
      onClose();
    }
  };

  return (
    <>
      {/* 모바일 오버레이 */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* 사이드바 */}
      <aside
        className={`fixed lg:sticky top-0 left-0 h-screen w-64 bg-white dark:bg-neutral-900 border-r border-neutral-200 dark:border-neutral-800 flex flex-col shadow-lg z-50 transform transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="h-16 flex items-center justify-between px-6 border-b border-neutral-200 dark:border-neutral-800">
          <Link href={`/academy-admin/${academyId}`} className="flex items-center gap-2" onClick={handleLinkClick}>
            <div className="w-8 h-8 bg-primary dark:bg-[#CCFF00] rounded-lg flex items-center justify-center text-black font-bold italic">
              M
            </div>
            <h1 className="text-xl font-extrabold tracking-tight text-black dark:text-white italic">
              MOVE <span className="text-primary dark:text-[#CCFF00]">IT</span>
            </h1>
          </Link>
          {/* 모바일 닫기 버튼 */}
          <button
            onClick={onClose}
            className="lg:hidden p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
            aria-label="메뉴 닫기"
          >
            <X className="w-5 h-5 text-neutral-700 dark:text-neutral-300" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-6 space-y-1">
          <div className="px-6 pt-6 pb-2 text-xs font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">
            운영 관리
          </div>
          {menuItems.slice(0, 5).map((item) => (
            <SidebarItem
              key={item.href}
              icon={item.icon}
              label={item.label}
              href={item.href}
              active={isActive(item.href)}
              onClick={handleLinkClick}
            />
          ))}

          <div className="px-6 pt-6 pb-2 text-xs font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">
            매출 및 설정
          </div>
          {menuItems.slice(5).map((item) => (
            <SidebarItem
              key={item.href}
              icon={item.icon}
              label={item.label}
              href={item.href}
              active={isActive(item.href)}
              onClick={handleLinkClick}
            />
          ))}
        </nav>

        <div className="p-4 border-t border-neutral-200 dark:border-neutral-800">
          {user && profile ? (
            <div className="space-y-2">
              <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors">
                <div className="w-9 h-9 rounded-full bg-slate-800 dark:bg-slate-700 text-white flex items-center justify-center font-bold text-sm">
                  {(() => {
                    const displayName = profile.name || profile.nickname || user.email || 'U';
                    // 한국어인 경우 첫 글자만, 영어인 경우 첫 두 글자
                    const firstChar = displayName.charAt(0);
                    const secondChar = /[a-zA-Z]/.test(firstChar) ? displayName.charAt(1)?.toUpperCase() || '' : '';
                    return firstChar.toUpperCase() + secondChar;
                  })()}
                </div>
                <div className="flex-1 overflow-hidden">
                  <p className="text-sm font-bold truncate text-neutral-900 dark:text-white">
                    {profile.name || profile.nickname || user.email || '사용자'}
                  </p>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">
                    {profile.role || '사용자'}
                  </p>
                </div>
              </div>
              <button
                onClick={async () => {
                  await signOut();
                  window.location.href = '/';
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
              >
                <LogOut size={16} />
                <span>로그아웃</span>
              </button>
            </div>
          ) : (
            <div className="text-center py-2">
              <p className="text-xs text-neutral-500 dark:text-neutral-400">로그인이 필요합니다</p>
              <Link
                href="/auth/login"
                className="mt-2 inline-block text-xs text-primary dark:text-[#CCFF00] hover:underline"
              >
                로그인하기
              </Link>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}

