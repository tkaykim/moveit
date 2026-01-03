"use client";

import { Search, Bell, Moon, Sun } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

interface AcademyAdminHeaderProps {
  academyId: string;
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

export function AcademyAdminHeader({ academyId }: AcademyAdminHeaderProps) {
  const pathname = usePathname();
  const title = getTitle(pathname, academyId);
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <header className="h-16 bg-white dark:bg-neutral-900 border-b border-gray-200 dark:border-neutral-800 flex items-center justify-between px-8 shadow-sm z-10 sticky top-0">
      <h2 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
        {title}
      </h2>

      <div className="flex items-center gap-4">
        <div className="relative group">
          <input
            type="text"
            placeholder="학생, 강사 검색..."
            className="pl-10 pr-4 py-2 bg-gray-100 dark:bg-neutral-800 border-none rounded-full text-sm focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 w-64 transition-all focus:w-80 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
          />
          <Search
            size={18}
            className="absolute left-3.5 top-2.5 text-gray-400 dark:text-gray-500 group-focus-within:text-blue-500 dark:group-focus-within:text-blue-400 transition-colors"
          />
        </div>
        {mounted && (
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-neutral-800 rounded-full transition-colors"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
          </button>
        )}
        <button className="relative p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-neutral-800 rounded-full transition-colors">
          <Bell size={20} />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border border-white dark:border-neutral-900"></span>
        </button>
      </div>
    </header>
  );
}

