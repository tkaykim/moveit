"use client";

import { ReactNode, useState } from 'react';
import { AdminSidebar } from './components/admin-sidebar';
import { Menu, LogIn, LogOut, User } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { AdminLoginModal } from '@/components/auth/AdminLoginModal';

export default function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const { user, profile, signOut } = useAuth();

  const displayName = profile?.nickname || profile?.name || user?.email?.split('@')[0] || '';

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 flex">
      <AdminSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <main className="flex-1 overflow-y-auto w-full">
        {/* 모바일 햄버거 버튼 */}
        <div className="lg:hidden fixed top-0 left-0 right-0 z-30 bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800">
          <div className="flex items-center justify-between px-4 py-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
              aria-label="메뉴 열기"
            >
              <Menu className="w-6 h-6 text-neutral-700 dark:text-neutral-300" />
            </button>
            <h1 className="text-lg font-bold text-black dark:text-white">
              관리자
            </h1>
            {/* 모바일 로그인/로그아웃 버튼 */}
            {user ? (
              <button
                onClick={signOut}
                className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
                aria-label="로그아웃"
              >
                <LogOut className="w-5 h-5 text-neutral-700 dark:text-neutral-300" />
              </button>
            ) : (
              <button
                onClick={() => setLoginModalOpen(true)}
                className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
                aria-label="로그인"
              >
                <LogIn className="w-5 h-5 text-neutral-700 dark:text-neutral-300" />
              </button>
            )}
          </div>
        </div>

        {/* 데스크톱 상단 헤더 */}
        <header className="hidden lg:flex h-14 bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 items-center justify-end px-8 shadow-sm z-10 sticky top-0">
          {user ? (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-primary dark:from-[#CCFF00] to-green-500 p-[2px]">
                  <div className="w-full h-full rounded-full bg-white dark:bg-black flex items-center justify-center overflow-hidden">
                    {profile?.profile_image ? (
                      <img
                        src={profile.profile_image}
                        alt={displayName}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <User className="text-black dark:text-white" size={14} />
                    )}
                  </div>
                </div>
                <span className="text-sm font-medium text-black dark:text-white">
                  {displayName}
                </span>
                {profile?.role && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400">
                    {profile.role === 'SUPER_ADMIN' ? '최고관리자' : profile.role}
                  </span>
                )}
              </div>
              <button
                onClick={signOut}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
              >
                <LogOut size={16} />
                로그아웃
              </button>
            </div>
          ) : (
            <button
              onClick={() => setLoginModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-neutral-900 dark:bg-neutral-100 text-white dark:text-black rounded-lg font-medium text-sm hover:bg-neutral-800 dark:hover:bg-neutral-200 transition-colors"
            >
              <LogIn size={16} />
              로그인
            </button>
          )}
        </header>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8 lg:pt-4 sm:pt-4 pt-16">
          {children}
        </div>
      </main>

      {/* 관리자 로그인 모달 */}
      <AdminLoginModal
        isOpen={loginModalOpen}
        onClose={() => setLoginModalOpen(false)}
      />
    </div>
  );
}
