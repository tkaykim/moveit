"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Building2,
  User,
  BookOpen,
  ChevronRight,
  Users,
  LogIn,
  LogOut,
  Menu,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth/auth-context';

interface MenuItem {
  title: string;
  icon: LucideIcon;
  href?: string;
  children?: MenuItem[];
}

const menuItems: MenuItem[] = [
  {
    title: '학원 관리',
    icon: Building2,
    href: '/admin/academies',
  },
  {
    title: '강사 관리',
    icon: User,
    href: '/admin/instructors',
  },
  {
    title: '클래스 관리',
    icon: BookOpen,
    href: '/admin/classes',
  },
  {
    title: '사용자 관리',
    icon: Users,
    href: '/admin/users',
  },
];

interface AdminSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AdminSidebar({ isOpen, onClose }: AdminSidebarProps) {
  const pathname = usePathname();
  const [expandedMenus, setExpandedMenus] = useState<string[]>([]);
  const { user, profile, signOut } = useAuth();

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

  const toggleMenu = (title: string) => {
    setExpandedMenus((prev) =>
      prev.includes(title)
        ? prev.filter((item) => item !== title)
        : [...prev, title]
    );
  };

  const isActive = (href?: string) => {
    if (!href) return false;
    return pathname === href;
  };

  const isParentActive = (children?: MenuItem[]) => {
    if (!children) return false;
    return children.some((child) => isActive(child.href));
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
      <div
        className={`fixed lg:sticky top-0 left-0 h-screen w-64 bg-white dark:bg-neutral-900 border-r border-neutral-200 dark:border-neutral-800 overflow-y-auto flex flex-col z-50 transform transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
      <div className="p-6 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
        <Link href="/admin" className="flex items-center gap-2" onClick={handleLinkClick}>
          <div className="w-8 h-8 bg-primary dark:bg-[#CCFF00] rounded-lg flex items-center justify-center">
            <Building2 className="text-black w-5 h-5" />
          </div>
          <span className="text-lg font-bold text-black dark:text-white">
            관리자
          </span>
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

      <nav className="p-4 space-y-1 flex-1">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const hasChildren = item.children && item.children.length > 0;
          const isExpanded = expandedMenus.includes(item.title);
          const isParentActiveState = isParentActive(item.children);

          if (hasChildren) {
            return (
              <div key={item.title}>
                <button
                  onClick={() => toggleMenu(item.title)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-lg transition-colors ${
                    isParentActiveState
                      ? 'bg-primary/10 dark:bg-[#CCFF00]/10 text-primary dark:text-[#CCFF00]'
                      : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon size={20} />
                    <span className="font-medium">{item.title}</span>
                  </div>
                  <ChevronRight
                    size={16}
                    className={`transition-transform ${
                      isExpanded ? 'rotate-90' : ''
                    }`}
                  />
                </button>
                {isExpanded && (
                  <div className="ml-4 mt-1 space-y-1">
                    {item.children!.map((child) => {
                      const ChildIcon = child.icon;
                      const active = isActive(child.href);
                      return (
                        <Link
                          key={child.title}
                          href={child.href!}
                          onClick={handleLinkClick}
                          className={`flex items-center gap-3 px-4 py-2 rounded-lg transition-colors ${
                            active
                              ? 'bg-primary dark:bg-[#CCFF00] text-black font-medium'
                              : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                          }`}
                        >
                          <ChildIcon size={18} />
                          <span>{child.title}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }

          const active = isActive(item.href);
          return (
            <Link
              key={item.title}
              href={item.href!}
              onClick={handleLinkClick}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                active
                  ? 'bg-primary dark:bg-[#CCFF00] text-black font-medium'
                  : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800'
              }`}
            >
              <Icon size={20} />
              <span className="font-medium">{item.title}</span>
            </Link>
          );
        })}
      </nav>

      {/* 좌측 하단: 로그인 상태 및 권한 표시 */}
      <div className="mt-auto p-4 border-t border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
        {user && profile ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span className="text-neutral-700 dark:text-neutral-300 font-medium">
                로그인됨
              </span>
            </div>
            <div className="text-xs text-neutral-600 dark:text-neutral-400">
              <div className="font-medium">{profile.name || profile.nickname || user.email}</div>
              <div className="mt-1">
                권한: <span className="font-semibold">{profile.role || '없음'}</span>
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
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <div className="w-2 h-2 bg-red-500 rounded-full"></div>
              <span className="text-neutral-700 dark:text-neutral-300 font-medium">
                로그인 안 됨
              </span>
            </div>
            <Link
              href="/auth/login"
              className="w-full flex items-center gap-2 px-3 py-2 text-sm bg-primary dark:bg-[#CCFF00] text-black rounded-lg transition-colors hover:bg-primary/90 dark:hover:bg-[#CCFF00]/90 font-medium"
            >
              <LogIn size={16} />
              <span>로그인</span>
            </Link>
          </div>
        )}
      </div>
    </div>
    </>
  );
}

