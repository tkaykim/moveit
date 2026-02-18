"use client";

import { ReactNode, useState, useCallback, useEffect, useRef } from 'react';
import { AdminSidebar } from './components/admin-sidebar';
import { Menu, LogOut, User, RefreshCw } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { AdminLoginModal } from '@/components/auth/AdminLoginModal';
import { AccessDenied } from '@/components/auth/AccessDenied';

const LOADING_TIMEOUT_MS = 12_000;
const PROFILE_TIMEOUT_MS = 10_000;

function LoadingOrTimeout({
  message,
  timedOutMessage,
  timedOut,
  onRetry,
  retryLabel = '새로고침',
}: {
  message: string;
  timedOutMessage: string;
  timedOut: boolean;
  onRetry?: () => void;
  retryLabel?: string;
}) {
  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3 px-4">
        {timedOut ? (
          <>
            <p className="text-sm text-neutral-600 dark:text-neutral-400 text-center">
              {timedOutMessage}
            </p>
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-black hover:opacity-90 transition-opacity text-sm font-medium"
              >
                <RefreshCw className="w-4 h-4" />
                {retryLabel}
              </button>
            )}
          </>
        ) : (
          <>
            <div className="w-8 h-8 border-2 border-neutral-300 dark:border-neutral-600 border-t-primary dark:border-t-[#CCFF00] rounded-full animate-spin" />
            <p className="text-sm text-neutral-500 dark:text-neutral-400">{message}</p>
          </>
        )}
      </div>
    </div>
  );
}

export default function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [loadingTimedOut, setLoadingTimedOut] = useState(false);
  const [profileTimedOut, setProfileTimedOut] = useState(false);
  const profileTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { user, profile, loading, signOut, refreshProfile } = useAuth();

  const handleLoginSuccess = useCallback(() => {
    setLoadingTimedOut(false);
    setProfileTimedOut(false);
  }, []);

  // 권한 확인 중(loading) 타임아웃: 오래 걸리면 새로고침 유도
  useEffect(() => {
    if (!loading) {
      setLoadingTimedOut(false);
      return;
    }
    const t = setTimeout(() => setLoadingTimedOut(true), LOADING_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [loading]);

  // 프로필 로딩 타임아웃: user는 있는데 profile이 안 오면 재시도 유도
  useEffect(() => {
    if (profileTimeoutRef.current) {
      clearTimeout(profileTimeoutRef.current);
      profileTimeoutRef.current = null;
    }
    if (user && !profile && !loading) {
      profileTimeoutRef.current = setTimeout(() => setProfileTimedOut(true), PROFILE_TIMEOUT_MS);
    } else {
      setProfileTimedOut(false);
    }
    return () => {
      if (profileTimeoutRef.current) clearTimeout(profileTimeoutRef.current);
    };
  }, [user, profile, loading]);

  const handleRetryProfile = useCallback(() => {
    setProfileTimedOut(false);
    refreshProfile();
  }, [refreshProfile]);

  const displayName = profile?.nickname || profile?.name || user?.email?.split('@')[0] || '';

  // 로딩 중 (타임아웃 시 새로고침 안내)
  if (loading) {
    return (
      <LoadingOrTimeout
        message="권한 확인 중..."
        timedOutMessage="연결이 지연되고 있습니다. 새로고침 후 다시 시도해 주세요."
        timedOut={loadingTimedOut}
        onRetry={loadingTimedOut ? () => window.location.reload() : undefined}
        retryLabel="새로고침"
      />
    );
  }

  // 로그인되지 않은 경우
  if (!user) {
    return (
      <AccessDenied
        isLoggedIn={false}
        onLoginSuccess={handleLoginSuccess}
        message="관리자 페이지에 접근하려면 최고관리자 계정으로 로그인해주세요."
      />
    );
  }

  // 프로필 로딩 중 (타임아웃 시 재시도 안내)
  if (!profile) {
    return (
      <LoadingOrTimeout
        message="프로필 로딩 중..."
        timedOutMessage="프로필을 불러오지 못했습니다. 아래 버튼으로 다시 시도해 주세요."
        timedOut={profileTimedOut}
        onRetry={profileTimedOut ? handleRetryProfile : undefined}
        retryLabel="다시 시도"
      />
    );
  }

  // 최고관리자가 아닌 경우
  if (profile.role !== 'SUPER_ADMIN') {
    return (
      <AccessDenied
        isLoggedIn={true}
        onLoginSuccess={handleLoginSuccess}
        message="최고관리자(SUPER_ADMIN)만 접근할 수 있는 페이지입니다."
      />
    );
  }

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
            <button
              onClick={signOut}
              className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
              aria-label="로그아웃"
            >
              <LogOut className="w-5 h-5 text-neutral-700 dark:text-neutral-300" />
            </button>
          </div>
        </div>

        {/* 데스크톱 상단 헤더 */}
        <header className="hidden lg:flex h-14 bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 items-center justify-end px-8 shadow-sm z-10 sticky top-0">
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
              <span className="text-xs px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400">
                최고관리자
              </span>
            </div>
            <button
              onClick={signOut}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
            >
              <LogOut size={16} />
              로그아웃
            </button>
          </div>
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
