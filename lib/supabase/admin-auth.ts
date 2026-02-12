import { createClient, createServiceClient } from '@/lib/supabase/server';

/**
 * 관리자(SUPER_ADMIN) 인증을 확인하는 공통 헬퍼
 *
 * 1차: getUser()로 JWT 토큰 검증 시도
 * 2차: 실패 시 세션 복구/리프레시 후 재시도
 * 3차: 서비스 클라이언트로 역할 확인 (RLS 우회)
 *
 * @returns 인증된 사용자 정보 또는 에러
 */
export async function requireSuperAdmin(): Promise<{
  user: { id: string; email?: string } | null;
  error: string | null;
  status: number;
}> {
  const supabase = await createClient();

  // 1차: getUser()로 인증 확인
  let user: { id: string; email?: string } | null = null;
  const { data: userData, error: authError } = await supabase.auth.getUser();

  if (!authError && userData?.user) {
    user = userData.user;
  } else {
    // 2차: 세션에서 복구 시도 (토큰 만료 시 자동 갱신)
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData?.session) {
        // 세션이 있으면 리프레시 시도
        const { data: refreshData } = await supabase.auth.refreshSession();
        if (refreshData?.user) {
          user = refreshData.user;
        }
      }
    } catch (refreshError) {
      console.error('Session refresh failed:', refreshError);
    }
  }

  if (!user) {
    return { user: null, error: '인증이 필요합니다.', status: 401 };
  }

  // SUPER_ADMIN 권한 확인 (서비스 클라이언트로 RLS 우회)
  const serviceClient = createServiceClient();
  const { data: currentProfile } = await serviceClient
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!currentProfile || (currentProfile as any).role !== 'SUPER_ADMIN') {
    return { user: null, error: '관리자 권한이 필요합니다.', status: 403 };
  }

  return { user, error: null, status: 200 };
}
