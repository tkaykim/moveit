"use client";

import { ReactNode, useState, useEffect, useCallback, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { AcademyAdminSidebar } from './academy-admin-sidebar';
import { AcademyAdminHeader } from './academy-admin-header';
import { OnboardingProvider } from '../contexts/onboarding-context';
import { OnboardingOverlay } from './onboarding/onboarding-overlay';
import { useAuth } from '@/contexts/AuthContext';
import { AccessDenied } from '@/components/auth/AccessDenied';
import { createClient } from '@/lib/supabase/client';
import { RefreshCw } from 'lucide-react';

const LOADING_TIMEOUT_MS = 15_000;
const PROFILE_WAIT_MS = 10_000;
const ACADEMY_QUERY_TIMEOUT_MS = 10_000;

interface AcademyAdminLayoutWrapperProps {
  children: ReactNode;
  academyId: string;
}

type AuthState = 'loading' | 'authorized' | 'unauthorized' | 'unauthenticated' | 'timeout';

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), ms)
    ),
  ]);
}

export function AcademyAdminLayoutWrapper({ children, academyId }: AcademyAdminLayoutWrapperProps) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [authState, setAuthState] = useState<AuthState>('loading');
  const [authErrorMessage, setAuthErrorMessage] = useState<string | null>(null);
  const loadingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const profileWaitRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { user, profile, loading } = useAuth();
  const isQrReaderPage = pathname?.includes('/qr-reader') ?? false;

  const checkAccess = useCallback(async () => {
    if (loading) return;

    // 로그인되지 않은 경우
    if (!user) {
      setAuthState('unauthenticated');
      setAuthErrorMessage(null);
      return;
    }

    // 프로필 로딩 대기 (profile이 아직 없을 수 있음)
    if (!profile) {
      setAuthState('loading');
      setAuthErrorMessage(null);
      return;
    }

    // 최고관리자는 모든 학원 접근 가능
    if (profile.role === 'SUPER_ADMIN') {
      setAuthState('authorized');
      setAuthErrorMessage(null);
      return;
    }

    // 학원-유저 매핑 확인 (ACADEMY_OWNER, ACADEMY_MANAGER) — 타임아웃 적용
    try {
      const supabase = createClient();
      const queryPromise = supabase
        .from('academy_user_roles' as any)
        .select('id, role')
        .eq('user_id', user.id)
        .eq('academy_id', academyId)
        .maybeSingle();

      type QueryResult = { data: unknown; error: unknown };
      const result = await withTimeout<QueryResult>(
        Promise.resolve(queryPromise as PromiseLike<QueryResult>),
        ACADEMY_QUERY_TIMEOUT_MS
      );
      const { data, error } = result;

      if (error) {
        console.error('학원 권한 확인 오류:', error);
        setAuthState('unauthorized');
        setAuthErrorMessage(null);
        return;
      }

      if (data) {
        setAuthState('authorized');
        setAuthErrorMessage(null);
      } else {
        setAuthState('unauthorized');
        setAuthErrorMessage(null);
      }
    } catch (err) {
      console.error('학원 접근 권한 확인 실패:', err);
      setAuthState('unauthorized');
      setAuthErrorMessage(
        err instanceof Error && err.message === 'timeout'
          ? '권한 확인이 지연되고 있습니다. 새로고침 후 다시 시도해 주세요.'
          : null
      );
    }
  }, [user, profile, loading, academyId]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    checkAccess();
  }, [checkAccess]);

  // 전체 로딩 타임아웃: 권한 확인 중이 15초 넘으면 새로고침 유도
  useEffect(() => {
    if (authState !== 'loading' || !mounted) return;
    loadingTimeoutRef.current = setTimeout(() => {
      setAuthState('timeout');
    }, LOADING_TIMEOUT_MS);
    return () => {
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
        loadingTimeoutRef.current = null;
      }
    };
  }, [authState, mounted]);

  // 프로필 대기 타임아웃: user 있는데 profile이 안 오면 에러 메시지로 전환
  useEffect(() => {
    if (profileWaitRef.current) {
      clearTimeout(profileWaitRef.current);
      profileWaitRef.current = null;
    }
    if (user && !profile && !loading) {
      profileWaitRef.current = setTimeout(() => {
        setAuthState('unauthorized');
        setAuthErrorMessage('프로필을 불러오지 못했습니다. 네트워크를 확인하고 새로고침해 주세요.');
      }, PROFILE_WAIT_MS);
    }
    return () => {
      if (profileWaitRef.current) clearTimeout(profileWaitRef.current);
    };
  }, [user, profile, loading]);

  // 로그인 성공 후 권한 재검사
  const handleLoginSuccess = useCallback(() => {
    setAuthState('loading');
    setAuthErrorMessage(null);
  }, []);

  // 타임아웃 화면 (연결 지연)
  if (authState === 'timeout') {
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 px-4">
          <p className="text-sm text-neutral-600 dark:text-neutral-400 text-center">
            연결이 지연되고 있습니다. 새로고침 후 다시 시도해 주세요.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-black hover:opacity-90 transition-opacity text-sm font-medium"
          >
            <RefreshCw className="w-4 h-4" />
            새로고침
          </button>
        </div>
      </div>
    );
  }

  // SSR 시에는 로딩 표시
  if (!mounted || authState === 'loading') {
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-neutral-300 dark:border-neutral-600 border-t-primary dark:border-t-[#CCFF00] rounded-full animate-spin" />
          <p className="text-sm text-neutral-500 dark:text-neutral-400">권한 확인 중...</p>
        </div>
      </div>
    );
  }

  // 로그인되지 않은 경우
  if (authState === 'unauthenticated') {
    return (
      <AccessDenied
        isLoggedIn={false}
        onLoginSuccess={handleLoginSuccess}
        message="학원 관리 페이지에 접근하려면 로그인이 필요합니다."
      />
    );
  }

  // 로그인은 됐지만 권한이 없는 경우 (또는 프로필/권한 확인 실패)
  if (authState === 'unauthorized') {
    return (
      <AccessDenied
        isLoggedIn={!!user}
        onLoginSuccess={handleLoginSuccess}
        message={
          authErrorMessage ||
          '이 학원의 관리 페이지에 접근할 권한이 없습니다. 최고관리자에게 권한을 요청하세요.'
        }
      />
    );
  }

  // QR 출석 리더 페이지: 전체화면(사이드바/헤더 없음), 다른 메뉴 이동 시 비밀번호 재확인은 뷰 내부에서 처리
  if (isQrReaderPage) {
    return (
      <OnboardingProvider>
        <div className="fixed inset-0 flex flex-col bg-neutral-50 dark:bg-neutral-950 overflow-hidden z-0">
          {children}
        </div>
      </OnboardingProvider>
    );
  }

  return (
    <OnboardingProvider>
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 flex">
        <AcademyAdminSidebar
          academyId={academyId}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />
        <main className="flex-1 overflow-y-auto w-full">
          <AcademyAdminHeader
            academyId={academyId}
            onMenuClick={() => setSidebarOpen(true)}
          />
          <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8 lg:pt-8 sm:pt-20 pt-20">
            {children}
          </div>
        </main>
      </div>
      <OnboardingOverlay />
    </OnboardingProvider>
  );
}
