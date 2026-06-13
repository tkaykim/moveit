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
  Replace,
  AlertTriangle,
  QrCode,
  Bell,
  Landmark,
  HelpCircle,
  type LucideIcon,
} from 'lucide-react';
import { getSupabaseClient } from '@/lib/utils/supabase-client';
import { useAuth } from '@/contexts/AuthContext';
import { useAcademy } from '../contexts/academy-context';

interface SidebarItemProps {
  icon: LucideIcon;
  label: string;
  href: string;
  active: boolean;
  onClick?: () => void;
  dataOnboarding?: string;
}

const SidebarItem = ({ icon: Icon, label, href, active, onClick, dataOnboarding }: SidebarItemProps) => (
  <Link
    href={href}
    onClick={onClick}
    {...(dataOnboarding ? { 'data-onboarding': dataOnboarding } : {})}
    className={`flex items-center gap-3 px-4 py-2.5 lg:py-3 cursor-pointer transition-all duration-200 rounded-lg mx-2 mb-0.5 ${
      active
        ? 'bg-neutral-200/10 text-neutral-900 font-semibold shadow-sm'
        : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800'
    }`}
  >
    <Icon
      size={20}
      className={active ? 'text-neutral-900' : 'text-neutral-400 dark:text-neutral-500'}
    />
    <span className="text-sm">{label}</span>
  </Link>
);

interface AcademyAdminSidebarProps {
  academyId: string;
  isOpen: boolean;
  onClose: () => void;
}

/**
 * 온보딩 하이라이트용 안정적 타겟 키.
 * 사이드바 항목 순서가 바뀌어도 라우트 기준으로 매칭되도록 href의 마지막 세그먼트를 사용한다.
 * 대시보드(루트)는 'sidebar-dashboard'.
 */
function sidebarOnboardingKey(href: string, baseHref: string): string {
  if (href === baseHref) return 'sidebar-dashboard';
  const seg = href.slice(baseHref.length).replace(/^\//, '').split(/[/?#]/)[0];
  return `sidebar-${seg || 'dashboard'}`;
}

export function AcademyAdminSidebar({ academyId, isOpen, onClose }: AcademyAdminSidebarProps) {
  const pathname = usePathname();
  const [academyName, setAcademyName] = useState<string | null>(null);
  
  const { academySlug } = useAcademy();
  const slug = academySlug;
  
  // AuthContext에서 직접 프로필/역할 정보를 가져옴 (별도 Supabase 쿼리 불필요)
  const { profile, loading: authLoading } = useAuth();

  // 최고관리자(SUPER_ADMIN)는 어떤 학원이든 무조건 모든 메뉴를 볼 수 있음
  const isSuperAdmin = profile?.role === 'SUPER_ADMIN';
  
  // SUPER_ADMIN이면 무조건 true, 그 외에는 ACADEMY_OWNER만 설정 접근 가능
  const canAccessSettings = isSuperAdmin || profile?.role === 'ACADEMY_OWNER';

  // hidden:true 항목은 라우트·코드는 유지하되 사이드바 노출만 막는다.
  // 그룹 슬라이스(0..6 / 6..10 / 10..) 의 인덱스 정합을 보존하기 위해 배열에서 제거하지 않고 플래그만 부여.
  const menuItems: { icon: LucideIcon; label: string; href: string; hidden?: boolean }[] = [
    { icon: LayoutDashboard, label: '대시보드', href: `/academy-admin/${slug}` },
    { icon: Users, label: '학생 관리', href: `/academy-admin/${slug}/students` },
    { icon: BookOpen, label: '클래스(반) 관리', href: `/academy-admin/${slug}/class-masters` },
    { icon: CalendarDays, label: '스케줄 관리', href: `/academy-admin/${slug}/schedule` },
    { icon: UserCog, label: '출석/신청 관리', href: `/academy-admin/${slug}/enrollments` },
    { icon: Landmark, label: '수동 입금확인', href: `/academy-admin/${slug}/deposit-confirm` },
    { icon: QrCode, label: 'QR 출석 리더', href: `/academy-admin/${slug}/qr-reader` },
    { icon: Pause, label: '연장/일시정지 관리', href: `/academy-admin/${slug}/extension-requests` },
    { icon: Replace, label: '대강/취소 신청 관리', href: `/academy-admin/${slug}/schedule-change-requests`, hidden: true },
    { icon: Ticket, label: '수강권/상품', href: `/academy-admin/${slug}/products` },
    { icon: ClipboardList, label: '업무/수업 일지', href: `/academy-admin/${slug}/logs` },
    { icon: UserCheck, label: '강사 관리', href: `/academy-admin/${slug}/instructors` },
    { icon: MessageSquare, label: '상담 관리', href: `/academy-admin/${slug}/consultations` },
    { icon: Bell, label: '알림 발송', href: `/academy-admin/${slug}/push` },
    { icon: CreditCard, label: '매출/정산', href: `/academy-admin/${slug}/revenue` },
    { icon: Calendar, label: '구독/결제 관리', href: `/academy-admin/${slug}/billing`, hidden: true },
  ];

  // 설정 메뉴: SUPER_ADMIN이면 무조건 표시, auth 로딩 중이면 일단 표시, 그 외 ACADEMY_OWNER만 표시
  if (isSuperAdmin || authLoading || canAccessSettings) {
    menuItems.push({ icon: Settings, label: '설정', href: `/academy-admin/${slug}/settings` });
  }
  
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

  // 학원 이름 가져오기
  useEffect(() => {
    async function loadAcademyName() {
      try {
        const supabase = getSupabaseClient();
        if (!supabase) return;

        const { data, error } = await supabase
          .from('academies')
          .select('name_kr, name_en')
          .eq('id', academyId)
          .single();

        if (error) throw error;

        if (data) {
          const name = data.name_kr || data.name_en || null;
          setAcademyName(name);
        }
      } catch (error) {
        console.error('Error loading academy name:', error);
      }
    }

    if (academyId) {
      loadAcademyName();
    }
  }, [academyId]);

  const isActive = (href: string) => {
    if (href === `/academy-admin/${slug}`) {
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
        className={`fixed lg:sticky top-0 left-0 h-[100dvh] w-64 bg-white dark:bg-neutral-900 border-r border-neutral-200 dark:border-neutral-800 flex flex-col shadow-lg z-50 transform transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="px-6 py-3 lg:py-4 border-b border-neutral-200 dark:border-neutral-800 relative flex-shrink-0">
          <Link href={`/academy-admin/${slug}`} className="flex flex-col gap-1.5 lg:gap-2" onClick={handleLinkClick}>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-black font-bold italic">
                M
              </div>
              <h1 className="text-xl font-extrabold tracking-tight text-black dark:text-white italic">
                MOVE <span className="text-primary">IT</span>
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
            className="lg:hidden absolute top-3 right-3 p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
            aria-label="메뉴 닫기"
          >
            <X className="w-5 h-5 text-neutral-700 dark:text-neutral-300" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-2 lg:py-4 space-y-0.5 min-h-0">
          <div className="px-6 pt-3 lg:pt-6 pb-1.5 lg:pb-2 text-xs font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">
            수업 관리
          </div>
          {menuItems.slice(0, 6).filter((item) => !item.hidden).map((item, idx) => (
            <SidebarItem
              key={item.href}
              icon={item.icon}
              label={item.label}
              href={item.href}
              active={isActive(item.href)}
              onClick={handleLinkClick}
              dataOnboarding={sidebarOnboardingKey(item.href, `/academy-admin/${slug}`)}
            />
          ))}

          <div className="px-6 pt-3 lg:pt-6 pb-1.5 lg:pb-2 text-xs font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">
            운영 관리
          </div>
          {menuItems.slice(6, 10).filter((item) => !item.hidden).map((item, idx) => (
            <SidebarItem
              key={item.href}
              icon={item.icon}
              label={item.label}
              href={item.href}
              active={isActive(item.href)}
              onClick={handleLinkClick}
              dataOnboarding={sidebarOnboardingKey(item.href, `/academy-admin/${slug}`)}
            />
          ))}

          <div className="px-6 pt-3 lg:pt-6 pb-1.5 lg:pb-2 text-xs font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">
            매출 및 설정
          </div>
          {menuItems.slice(10).filter((item) => !item.hidden).map((item, idx) => (
            <SidebarItem
              key={item.href}
              icon={item.icon}
              label={item.label}
              href={item.href}
              active={isActive(item.href)}
              onClick={handleLinkClick}
              dataOnboarding={sidebarOnboardingKey(item.href, `/academy-admin/${slug}`)}
            />
          ))}

          <div className="px-6 pt-3 lg:pt-6 pb-1.5 lg:pb-2 text-xs font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">
            기타
          </div>
          <SidebarItem
            icon={HelpCircle}
            label="사용 가이드"
            href={`/academy-admin/${slug}/guide`}
            active={isActive(`/academy-admin/${slug}/guide`)}
            onClick={handleLinkClick}
            dataOnboarding="sidebar-guide"
          />
          <SidebarItem
            icon={AlertTriangle}
            label="고장신고/개발요청"
            href={`/academy-admin/${slug}/support`}
            active={isActive(`/academy-admin/${slug}/support`)}
            onClick={handleLinkClick}
          />

          {/* 모바일에서 마지막 항목이 스크롤 영역 밖으로 잘리지 않도록 하단 여백 */}
          <div className="h-8 lg:h-4 flex-shrink-0" />
        </nav>

      </aside>
    </>
  );
}

