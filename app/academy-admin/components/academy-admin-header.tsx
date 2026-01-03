"use client";

import { Search, Bell, Moon, Sun, Menu, CreditCard, Plus, MessageSquare, ChevronDown } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { useEffect, useState, useRef } from 'react';

interface AcademyAdminHeaderProps {
  academyId: string;
  onMenuClick: () => void;
}

const getTitle = (pathname: string | null, academyId: string): string => {
  if (!pathname) return 'MOVE IT Admin';
  
  const titles: Record<string, string> = {
    [`/academy-admin/${academyId}`]: '대시보드',
    [`/academy-admin/${academyId}/students`]: '학생(회원) 관리',
    [`/academy-admin/${academyId}/classes`]: '클래스/시간표',
    [`/academy-admin/${academyId}/logs`]: '업무/수업 일지',
    [`/academy-admin/${academyId}/instructors`]: '강사 관리',
    [`/academy-admin/${academyId}/consultations`]: '상담 및 문의',
    [`/academy-admin/${academyId}/products`]: '수강권 및 상품 설정',
    [`/academy-admin/${academyId}/revenue`]: '매출 및 정산',
    [`/academy-admin/${academyId}/settings`]: '환경설정',
  };

  return titles[pathname] || 'MOVE IT Admin';
};

export function AcademyAdminHeader({ academyId, onMenuClick }: AcademyAdminHeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const title = getTitle(pathname, academyId);
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [quickActionsOpen, setQuickActionsOpen] = useState(false);
  const quickActionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (quickActionsRef.current && !quickActionsRef.current.contains(event.target as Node)) {
        setQuickActionsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleTicketSale = () => {
    router.push(`/academy-admin/${academyId}/revenue?tab=sales`);
  };

  return (
    <>
      {/* 모바일 헤더 */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-30 bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800">
        <div className="flex items-center justify-between px-4 py-3 gap-2">
          <button
            onClick={onMenuClick}
            className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
            aria-label="메뉴 열기"
          >
            <Menu className="w-6 h-6 text-neutral-700 dark:text-neutral-300" />
          </button>
          <h2 className="text-lg font-bold text-black dark:text-white flex-1 text-center">
            {title}
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={handleTicketSale}
              className="p-2 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-lg hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors"
              aria-label="수강권 판매"
            >
              <CreditCard size={18} />
            </button>
            <div className="relative" ref={quickActionsRef}>
              <button
                onClick={() => setQuickActionsOpen(!quickActionsOpen)}
                className="p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
                aria-label="빠른 작업"
              >
                <Plus size={18} />
              </button>
              {quickActionsOpen && (
                <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-neutral-900 rounded-lg shadow-lg border border-neutral-200 dark:border-neutral-800 py-2 z-50">
                  <a
                    href={`/academy-admin/${academyId}/students?action=register`}
                    className="flex items-center gap-3 px-4 py-2 hover:bg-blue-50 dark:hover:bg-blue-900/20 text-sm"
                    onClick={() => setQuickActionsOpen(false)}
                  >
                    <Plus size={16} className="text-blue-600 dark:text-blue-400" />
                    <span className="text-gray-800 dark:text-white">신규 회원 등록</span>
                  </a>
                  <a
                    href={`/academy-admin/${academyId}/consultations?action=add`}
                    className="flex items-center gap-3 px-4 py-2 hover:bg-purple-50 dark:hover:bg-purple-900/20 text-sm"
                    onClick={() => setQuickActionsOpen(false)}
                  >
                    <MessageSquare size={16} className="text-purple-600 dark:text-purple-400" />
                    <span className="text-gray-800 dark:text-white">상담 일지 작성</span>
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 데스크톱 헤더 */}
      <header className="hidden lg:flex h-16 bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 items-center justify-between px-8 shadow-sm z-10 sticky top-0">
        <h2 className="text-lg font-bold text-neutral-800 dark:text-white flex items-center gap-2">
          {title}
        </h2>

        <div className="flex items-center gap-4">
          {/* 수강권 판매 버튼 */}
          <button
            onClick={handleTicketSale}
            className="flex items-center gap-2 px-4 py-2 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-lg hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors font-medium text-sm"
          >
            <CreditCard size={18} />
            <span>수강권 간편결제</span>
          </button>

          {/* 빠른 작업 드롭다운 */}
          <div className="relative" ref={quickActionsRef}>
            <button
              onClick={() => setQuickActionsOpen(!quickActionsOpen)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors font-medium text-sm"
            >
              <Plus size={18} />
              <span>빠른 작업</span>
              <ChevronDown size={16} className={`transition-transform ${quickActionsOpen ? 'rotate-180' : ''}`} />
            </button>
            {quickActionsOpen && (
              <div className="absolute right-0 top-full mt-2 w-56 bg-white dark:bg-neutral-900 rounded-lg shadow-lg border border-neutral-200 dark:border-neutral-800 py-2 z-50">
                <a
                  href={`/academy-admin/${academyId}/students?action=register`}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                  onClick={() => setQuickActionsOpen(false)}
                >
                  <div className="bg-blue-100 dark:bg-blue-900/30 p-2 rounded-full">
                    <Plus size={16} className="text-blue-700 dark:text-blue-400" />
                  </div>
                  <div className="text-left">
                    <div className="font-bold text-gray-800 dark:text-white text-sm">신규 회원 등록</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">상담 후 바로 등록하기</div>
                  </div>
                </a>
                <a
                  href={`/academy-admin/${academyId}/consultations?action=add`}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors"
                  onClick={() => setQuickActionsOpen(false)}
                >
                  <div className="bg-purple-100 dark:bg-purple-900/30 p-2 rounded-full">
                    <MessageSquare size={16} className="text-purple-700 dark:text-purple-400" />
                  </div>
                  <div className="text-left">
                    <div className="font-bold text-gray-800 dark:text-white text-sm">상담 일지 작성</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">문의 내용 및 스케줄 기록</div>
                  </div>
                </a>
              </div>
            )}
          </div>

          <div className="relative group">
            <input
              type="text"
              placeholder="학생, 강사 검색..."
              className="pl-10 pr-4 py-2 bg-neutral-100 dark:bg-neutral-800 border-none rounded-full text-sm focus:ring-2 focus:ring-primary dark:focus:ring-[#CCFF00] w-64 transition-all focus:w-80 text-neutral-900 dark:text-white placeholder-neutral-500 dark:placeholder-neutral-400"
            />
            <Search
              size={18}
              className="absolute left-3.5 top-2.5 text-neutral-400 dark:text-neutral-500 group-focus-within:text-primary dark:group-focus-within:text-[#CCFF00] transition-colors"
            />
          </div>
          {mounted && (
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="p-2 text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-full transition-colors"
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            </button>
          )}
          <button className="relative p-2 text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-full transition-colors">
            <Bell size={20} />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border border-white dark:border-neutral-900"></span>
          </button>
        </div>
      </header>
    </>
  );
}

