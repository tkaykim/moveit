"use client";

import { ReactNode, useState, useEffect, useCallback } from 'react';
import { AcademyAdminSidebar } from './academy-admin-sidebar';
import { AcademyAdminHeader } from './academy-admin-header';
import { OnboardingProvider } from '../contexts/onboarding-context';
import { OnboardingOverlay } from './onboarding/onboarding-overlay';
import { useAuth } from '@/contexts/AuthContext';
import { AccessDenied } from '@/components/auth/AccessDenied';
import { createClient } from '@/lib/supabase/client';

interface AcademyAdminLayoutWrapperProps {
  children: ReactNode;
  academyId: string;
}

type AuthState = 'loading' | 'authorized' | 'unauthorized' | 'unauthenticated';

export function AcademyAdminLayoutWrapper({ children, academyId }: AcademyAdminLayoutWrapperProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [authState, setAuthState] = useState<AuthState>('loading');
  const { user, profile, loading } = useAuth();

  const checkAccess = useCallback(async () => {
    if (loading) return;

    // 로그인되지 않은 경우
    if (!user) {
      setAuthState('unauthenticated');
      return;
    }

    // 프로필 로딩 대기 (profile이 아직 없을 수 있음)
    if (!profile) {
      // user는 있지만 profile이 아직 없으면 잠시 대기
      setAuthState('loading');
      return;
    }

    // 최고관리자는 모든 학원 접근 가능
    if (profile.role === 'SUPER_ADMIN') {
      setAuthState('authorized');
      return;
    }

    // 학원-유저 매핑 확인 (ACADEMY_OWNER, ACADEMY_MANAGER)
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('academy_user_roles' as any)
        .select('id, role')
        .eq('user_id', user.id)
        .eq('academy_id', academyId)
        .maybeSingle();

      if (error) {
        console.error('학원 권한 확인 오류:', error);
        setAuthState('unauthorized');
        return;
      }

      if (data) {
        setAuthState('authorized');
      } else {
        setAuthState('unauthorized');
      }
    } catch (err) {
      console.error('학원 접근 권한 확인 실패:', err);
      setAuthState('unauthorized');
    }
  }, [user, profile, loading, academyId]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    checkAccess();
  }, [checkAccess]);

  // 로그인 성공 후 권한 재검사
  const handleLoginSuccess = useCallback(() => {
    setAuthState('loading');
    // auth context가 업데이트되면 checkAccess가 다시 실행됨
  }, []);

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

  // 로그인은 됐지만 권한이 없는 경우
  if (authState === 'unauthorized') {
    return (
      <AccessDenied
        isLoggedIn={true}
        onLoginSuccess={handleLoginSuccess}
        message="이 학원의 관리 페이지에 접근할 권한이 없습니다. 최고관리자에게 권한을 요청하세요."
      />
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
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8 lg:pt-8 sm:pt-20 pt-20">
            {children}
          </div>
        </main>
      </div>
      <OnboardingOverlay />
    </OnboardingProvider>
  );
}
