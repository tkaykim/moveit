'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { AccessDenied } from '@/components/auth/AccessDenied';
import { createClient } from '@/lib/supabase/client';
import { LiteAdminProvider, type LiteAcademy } from './context';
import { BottomNav } from './bottom-nav';

type AuthState = 'loading' | 'authorized' | 'unauthorized' | 'unauthenticated';

/**
 * 라이트 어드민 셸 — 모바일 퍼스트(390px 기준), 데스크톱은 가운데 한 컬럼.
 * 학원 이름·브랜드 색을 데이터로 입고, 직원만 통과시킨다.
 * 권한 게이팅은 기존 academy-admin 과 동일한 검증(academy_user_roles + SUPER_ADMIN)을 재사용한다.
 * (실제 보안 경계는 각 API 의 assertAcademyAdmin 이며, 이 화면 게이팅은 UX 다.)
 */
export function LiteAdminShell({ academy, children }: { academy: LiteAcademy; children: React.ReactNode }) {
  const { user, profile, loading } = useAuth();
  const [authState, setAuthState] = useState<AuthState>('loading');

  const checkAccess = useCallback(async () => {
    if (loading) return;
    if (!user) {
      setAuthState('unauthenticated');
      return;
    }
    if (!profile) {
      setAuthState('loading');
      return;
    }
    if (profile.role === 'SUPER_ADMIN') {
      setAuthState('authorized');
      return;
    }
    try {
      const supabase = createClient();
      const { data } = await supabase
        .from('academy_user_roles' as any)
        .select('role')
        .eq('user_id', user.id)
        .eq('academy_id', academy.id)
        .maybeSingle();
      setAuthState(data ? 'authorized' : 'unauthorized');
    } catch {
      setAuthState('unauthorized');
    }
  }, [user, profile, loading, academy.id]);

  useEffect(() => {
    checkAccess();
  }, [checkAccess]);

  if (authState === 'loading') {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-white dark:bg-neutral-950">
        <div
          className="w-8 h-8 rounded-full border-2 border-neutral-200 dark:border-neutral-700 animate-spin"
          style={{ borderTopColor: academy.brand }}
        />
      </div>
    );
  }

  if (authState === 'unauthenticated') {
    return (
      <AccessDenied
        isLoggedIn={false}
        onLoginSuccess={() => setAuthState('loading')}
        message={`${academy.name} 관리에 들어가려면 로그인이 필요해요.`}
      />
    );
  }

  if (authState === 'unauthorized') {
    return (
      <AccessDenied
        isLoggedIn={!!user}
        onLoginSuccess={() => setAuthState('loading')}
        message={`${academy.name} 스태프만 들어올 수 있어요. 원장님께 권한을 요청해 주세요.`}
      />
    );
  }

  return (
    <LiteAdminProvider value={academy}>
      <div
        data-testid="lite-admin-shell"
        className="min-h-[100dvh] bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100"
        style={{ ['--primary' as string]: academy.brand }}
      >
        <div className="mx-auto max-w-lg min-h-[100dvh] flex flex-col bg-neutral-50 dark:bg-neutral-950">
          <header
            className="sticky top-0 z-20 flex items-center gap-2 px-4 h-14 border-b border-neutral-200 dark:border-neutral-800 bg-white/95 dark:bg-neutral-950/95 backdrop-blur"
            style={{ paddingTop: 'env(safe-area-inset-top)' }}
          >
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: academy.brand }} />
            <h1 className="text-[15px] font-extrabold truncate">{academy.name}</h1>
            <span className="ml-auto text-[11px] font-semibold text-neutral-400">관리</span>
          </header>

          <main className="flex-1 pb-24">{children}</main>

          <BottomNav slug={academy.slug} brand={academy.brand} />
        </div>
      </div>
    </LiteAdminProvider>
  );
}
