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
  Smartphone,
  Sparkles,
  ChevronDown,
  type LucideIcon,
} from 'lucide-react';
import { getSupabaseClient } from '@/lib/utils/supabase-client';
import { useAuth } from '@/contexts/AuthContext';
import { useAcademy } from '../contexts/academy-context';
import { getPreset } from '@/lib/presets/academy-presets';

interface SidebarItemProps {
  icon: LucideIcon;
  label: string;
  href: string;
  active: boolean;
  onClick?: () => void;
  dataOnboarding?: string;
  external?: boolean;
}

const SidebarItem = ({ icon: Icon, label, href, active, onClick, dataOnboarding, external }: SidebarItemProps) => (
  <Link
    href={href}
    onClick={onClick}
    {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
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

interface MenuItem {
  icon: LucideIcon;
  label: string;
  /** 라우트 마지막 세그먼트. ''=대시보드 루트 */
  seg: string;
  hidden?: boolean;
}

interface MenuGroup {
  title: string;
  items: MenuItem[];
}

/**
 * 원장 눈높이 4그룹 IA — 오늘 / 수업 / 회원 / 우리 학원 (+더보기).
 * 라우트·페이지는 그대로 두고 네비 레이어만 재편.
 * 운영방식 프리셋(academies.preset_type)의 hiddenMenus에 있는 세그먼트는 숨긴다.
 */
const MENU_GROUPS: MenuGroup[] = [
  {
    title: '오늘',
    items: [
      { icon: LayoutDashboard, label: '오늘 현황', seg: '' },
      { icon: QrCode, label: 'QR 출석 체크', seg: 'qr-reader' },
    ],
  },
  {
    title: '수업',
    items: [
      { icon: CalendarDays, label: '시간표', seg: 'schedule' },
      { icon: BookOpen, label: '수업(반) 관리', seg: 'class-masters' },
      { icon: Sparkles, label: '워크샵·팝업', seg: 'classes' },
      { icon: Replace, label: '대강/취소 신청', seg: 'schedule-change-requests', hidden: true },
    ],
  },
  {
    title: '회원',
    items: [
      { icon: Users, label: '학원생 관리', seg: 'students' },
      { icon: UserCog, label: '신청·출석 확인', seg: 'enrollments' },
      { icon: Pause, label: '연장·일시정지 요청', seg: 'extension-requests' },
      { icon: MessageSquare, label: '상담 문의', seg: 'consultations' },
      { icon: Bell, label: '학원생 알림 보내기', seg: 'push' },
    ],
  },
  {
    title: '우리 학원',
    items: [
      { icon: Ticket, label: '수강권 가격표', seg: 'products' },
      { icon: Settings, label: '학원 앱 꾸미기', seg: 'settings' },
    ],
  },
];

const MORE_GROUP: MenuGroup = {
  title: '더보기',
  items: [
    { icon: Landmark, label: '입금 확인', seg: 'deposit-confirm' },
    { icon: CreditCard, label: '매출', seg: 'revenue' },
    { icon: UserCheck, label: '강사·급여', seg: 'instructors' },
    { icon: ClipboardList, label: '수업 일지', seg: 'logs' },
    { icon: Calendar, label: '무빗 구독 관리', seg: 'billing' },
  ],
};

export function AcademyAdminSidebar({ academyId, isOpen, onClose }: AcademyAdminSidebarProps) {
  const pathname = usePathname();
  const [academyName, setAcademyName] = useState<string | null>(null);
  const [presetType, setPresetType] = useState<string | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);

  const { academySlug } = useAcademy();
  const slug = academySlug;
  const baseHref = `/academy-admin/${slug}`;

  // AuthContext에서 직접 프로필/역할 정보를 가져옴 (별도 Supabase 쿼리 불필요)
  const { profile, loading: authLoading } = useAuth();

  // 최고관리자(SUPER_ADMIN)는 어떤 학원이든 무조건 모든 메뉴를 볼 수 있음
  const isSuperAdmin = profile?.role === 'SUPER_ADMIN';
  const canAccessSettings = isSuperAdmin || authLoading || profile?.role === 'ACADEMY_OWNER';

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

  // 학원 이름·운영방식 프리셋 가져오기
  useEffect(() => {
    async function loadAcademy() {
      try {
        const supabase = getSupabaseClient();
        if (!supabase) return;

        const { data, error } = await supabase
          .from('academies')
          .select('name_kr, name_en, preset_type')
          .eq('id', academyId)
          .single();

        if (error) throw error;

        if (data) {
          setAcademyName((data as { name_kr?: string; name_en?: string }).name_kr || (data as { name_en?: string }).name_en || null);
          setPresetType((data as { preset_type?: string | null }).preset_type ?? null);
        }
      } catch (error) {
        console.error('Error loading academy:', error);
      }
    }

    if (academyId) {
      loadAcademy();
    }
  }, [academyId]);

  const preset = getPreset(presetType);
  const presetHidden = new Set(preset?.hiddenMenus ?? []);

  const isActive = (href: string) => {
    if (href === baseHref) {
      return pathname === href;
    }
    return pathname?.startsWith(href);
  };

  const handleLinkClick = () => {
    if (window.innerWidth < 1024) {
      onClose();
    }
  };

  const renderItems = (items: MenuItem[]) =>
    items
      .filter((item) => !item.hidden && !presetHidden.has(item.seg))
      .filter((item) => (item.seg === 'settings' || item.seg === 'billing' ? canAccessSettings : true))
      .map((item) => {
        const href = item.seg ? `${baseHref}/${item.seg}` : baseHref;
        return (
          <SidebarItem
            key={href}
            icon={item.icon}
            label={item.label}
            href={href}
            active={isActive(href)}
            onClick={handleLinkClick}
            dataOnboarding={sidebarOnboardingKey(href, baseHref)}
          />
        );
      });

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
          <Link href={baseHref} className="flex flex-col gap-1.5 lg:gap-2" onClick={handleLinkClick}>
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

        <nav className="flex-1 overflow-y-auto py-2 lg:py-3 space-y-0.5 min-h-0">
          {/* 내 학원 앱 바로가기 — 화이트라벨 1급 동선 */}
          <SidebarItem
            icon={Smartphone}
            label="내 학원 앱 보기"
            href={`/s/${slug}`}
            active={false}
            onClick={handleLinkClick}
            dataOnboarding="sidebar-miniapp"
            external
          />

          {MENU_GROUPS.map((group) => {
            const items = renderItems(group.items);
            if (items.length === 0) return null;
            return (
              <div key={group.title}>
                <div className="px-6 pt-3 lg:pt-5 pb-1.5 lg:pb-2 text-xs font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">
                  {group.title}
                </div>
                {items}
              </div>
            );
          })}

          {/* 더보기 (매출·정산·구독 등 저빈도 메뉴) */}
          <div>
            <button
              onClick={() => setMoreOpen((v) => !v)}
              className="w-full flex items-center justify-between px-6 pt-3 lg:pt-5 pb-1.5 lg:pb-2 text-xs font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider"
            >
              더보기
              <ChevronDown size={14} className={`transition-transform ${moreOpen ? 'rotate-180' : ''}`} />
            </button>
            {(moreOpen || MORE_GROUP.items.some((i) => isActive(`${baseHref}/${i.seg}`))) && renderItems(MORE_GROUP.items)}
          </div>

          <div className="px-6 pt-3 lg:pt-5 pb-1.5 lg:pb-2 text-xs font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">
            기타
          </div>
          <SidebarItem
            icon={HelpCircle}
            label="사용 가이드"
            href={`${baseHref}/guide`}
            active={isActive(`${baseHref}/guide`)}
            onClick={handleLinkClick}
            dataOnboarding="sidebar-guide"
          />
          <SidebarItem
            icon={AlertTriangle}
            label="고장신고/개발요청"
            href={`${baseHref}/support`}
            active={isActive(`${baseHref}/support`)}
            onClick={handleLinkClick}
          />

          {/* 모바일에서 마지막 항목이 스크롤 영역 밖으로 잘리지 않도록 하단 여백 */}
          <div className="h-8 lg:h-4 flex-shrink-0" />
        </nav>

      </aside>
    </>
  );
}
