"use client";

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  LayoutDashboard,
  Users,
  Calendar,
  CalendarDays,
  ClipboardList,
  UserCheck,
  MessageSquare,
  Ticket,
  CreditCard,
  Settings,
  X,
  BookOpen,
  UserCog,
  Pause,
  type LucideIcon,
} from 'lucide-react';
import { getSupabaseClient } from '@/lib/utils/supabase-client';

interface SidebarItemProps {
  icon: LucideIcon;
  label: string;
  href: string;
  active: boolean;
  onClick?: () => void;
  dataOnboarding?: string;
}

const SidebarItem = ({ icon: Icon, label, href, active, onClick }: SidebarItemProps) => (
  <Link
    href={href}
    onClick={onClick}
    className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-all duration-200 rounded-lg mx-2 mb-1 ${
      active
        ? 'bg-neutral-200 dark:bg-[#CCFF00]/10 text-neutral-900 dark:text-[#CCFF00] font-semibold shadow-sm'
        : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800'
    }`}
  >
    <Icon
      size={20}
      className={active ? 'text-neutral-900 dark:text-[#CCFF00]' : 'text-neutral-400 dark:text-neutral-500'}
    />
    <span className="text-sm">{label}</span>
  </Link>
);

// 설정 메뉴에 접근 가능한 역할 (글로벌 역할)
type UserRole = 'SUPER_ADMIN' | 'ACADEMY_OWNER' | 'ACADEMY_MANAGER' | 'INSTRUCTOR' | 'USER';
// 학원별 역할
type AcademyRole = 'ACADEMY_OWNER' | 'ACADEMY_MANAGER';

interface AcademyAdminSidebarProps {
  academyId: string;
  isOpen: boolean;
  onClose: () => void;
}

export function AcademyAdminSidebar({ academyId, isOpen, onClose }: AcademyAdminSidebarProps) {
  const pathname = usePathname();
  const [academyName, setAcademyName] = useState<string | null>(null);
  const [userGlobalRole, setUserGlobalRole] = useState<UserRole | null>(null);
  const [userAcademyRole, setUserAcademyRole] = useState<AcademyRole | null>(null);
  const [roleLoaded, setRoleLoaded] = useState(false);

  // 설정 메뉴를 볼 수 있는 권한 체크
  // SUPER_ADMIN: 항상 모든 권한
  // ACADEMY_OWNER: 해당 학원의 설정 가능
  // ACADEMY_MANAGER: 설정 불가
  const canAccessSettings = userGlobalRole === 'SUPER_ADMIN' || 
                           userGlobalRole === 'ACADEMY_OWNER' || 
                           userAcademyRole === 'ACADEMY_OWNER';

  const allMenuItems = [
    { icon: LayoutDashboard, label: '대시보드', href: `/academy-admin/${academyId}`, requiresOwner: false },
    { icon: Users, label: '학생 관리', href: `/academy-admin/${academyId}/students`, requiresOwner: false },
    { icon: BookOpen, label: '클래스(반) 관리', href: `/academy-admin/${academyId}/class-masters`, requiresOwner: false },
    { icon: CalendarDays, label: '스케줄 관리', href: `/academy-admin/${academyId}/schedule`, requiresOwner: false },
    { icon: UserCog, label: '출석/신청 관리', href: `/academy-admin/${academyId}/enrollments`, requiresOwner: false },
    { icon: Pause, label: '연장/일시정지 관리', href: `/academy-admin/${academyId}/extension-requests`, requiresOwner: false },
    { icon: Ticket, label: '수강권/상품', href: `/academy-admin/${academyId}/products`, requiresOwner: false },
    { icon: ClipboardList, label: '업무/수업 일지', href: `/academy-admin/${academyId}/logs`, requiresOwner: false },
    { icon: UserCheck, label: '강사 관리', href: `/academy-admin/${academyId}/instructors`, requiresOwner: false },
    { icon: MessageSquare, label: '상담 관리', href: `/academy-admin/${academyId}/consultations`, requiresOwner: false },
    { icon: CreditCard, label: '매출/정산', href: `/academy-admin/${academyId}/revenue`, requiresOwner: false },
    { icon: Settings, label: '설정', href: `/academy-admin/${academyId}/settings`, requiresOwner: true },
  ];

  // 역할에 따라 메뉴 필터링
  const menuItems = allMenuItems.filter(item => {
    if (!item.requiresOwner) return true;
    // 역할 로딩 전에는 설정 메뉴 숨기지 않음 (깜빡임 방지를 위해 로딩 완료 후 필터링)
    if (!roleLoaded) return true;
    return canAccessSettings;
  });
  
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

  // 사용자 역할 및 학원 이름 가져오기
  useEffect(() => {
    async function loadUserRoleAndAcademyName() {
      try {
        const supabase = getSupabaseClient();
        if (!supabase) return;

        // 현재 로그인한 사용자 가져오기
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // 1. 사용자의 글로벌 역할 가져오기
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('role')
          .eq('id', user.id)
          .single();

        if (!userError && userData) {
          setUserGlobalRole((userData as any).role as UserRole);
        }

        // 2. 해당 학원에서의 역할 가져오기 (academy_user_roles 테이블)
        const { data: roleData, error: roleError } = await (supabase as any)
          .from('academy_user_roles')
          .select('role')
          .eq('user_id', user.id)
          .eq('academy_id', academyId)
          .maybeSingle();

        if (!roleError && roleData) {
          setUserAcademyRole(roleData.role as AcademyRole);
        }

        // 3. 학원 이름 가져오기
        const { data: academyData, error: academyError } = await supabase
          .from('academies')
          .select('name_kr, name_en')
          .eq('id', academyId)
          .single();

        if (!academyError && academyData) {
          const name = academyData.name_kr || academyData.name_en || null;
          setAcademyName(name);
        }
      } catch (error) {
        console.error('Error loading user role and academy name:', error);
      } finally {
        setRoleLoaded(true);
      }
    }

    if (academyId) {
      loadUserRoleAndAcademyName();
    }
  }, [academyId]);

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
        <div className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-800 relative">
          <Link href={`/academy-admin/${academyId}`} className="flex flex-col gap-2" onClick={handleLinkClick}>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary dark:bg-[#CCFF00] rounded-lg flex items-center justify-center text-black font-bold italic">
                M
              </div>
              <h1 className="text-xl font-extrabold tracking-tight text-black dark:text-white italic">
                MOVE <span className="text-primary dark:text-[#CCFF00]">IT</span>
              </h1>
            </div>
            {academyName && (
              <p className="text-sm font-medium text-neutral-600 dark:text-neutral-400 ml-10 truncate">
                {academyName}
              </p>
            )}
          </Link>
          {/* 모바일 닫기 버튼 */}
          <button
            onClick={onClose}
            className="lg:hidden absolute top-4 right-4 p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
            aria-label="메뉴 닫기"
          >
            <X className="w-5 h-5 text-neutral-700 dark:text-neutral-300" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-6 space-y-1">
          <div className="px-6 pt-6 pb-2 text-xs font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">
            수업 관리
          </div>
          {menuItems.slice(0, 5).map((item, idx) => (
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
            운영 관리
          </div>
          {menuItems.slice(5, 8).map((item, idx) => (
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
          {menuItems.slice(8).map((item, idx) => (
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

      </aside>
    </>
  );
}

