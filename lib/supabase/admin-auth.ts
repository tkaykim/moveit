import { createClient, createServiceClient } from '@/lib/supabase/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import type { NextRequest } from 'next/server';

/**
 * 관리자(SUPER_ADMIN) 인증을 확인하는 공통 헬퍼
 *
 * 1차: Authorization Bearer 토큰으로 인증 (가장 안정적)
 * 2차: 쿠키 기반 getUser()로 인증
 * 3차: 세션 복구/리프레시 후 재시도
 *
 * @param request - NextRequest 객체 (Authorization 헤더 읽기용)
 * @returns 인증된 사용자 정보 또는 에러
 */
export async function requireSuperAdmin(request?: NextRequest | Request): Promise<{
  user: { id: string; email?: string } | null;
  error: string | null;
  status: number;
}> {
  let user: { id: string; email?: string } | null = null;

  // 1차: Authorization Bearer 토큰으로 인증
  const authHeader = request?.headers?.get?.('Authorization');
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (bearerToken) {
    try {
      const supabase = createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
      const { data, error } = await supabase.auth.getUser(bearerToken);
      if (!error && data?.user) {
        user = data.user;
      }
    } catch (e) {
      console.warn('[admin-auth] Bearer token verification failed:', e);
    }
  }

  // 2차: 쿠키 기반 인증 (Bearer 토큰이 없거나 실패한 경우)
  if (!user) {
    try {
      const supabase = await createClient();
      const { data: userData, error: authError } = await supabase.auth.getUser();
      if (!authError && userData?.user) {
        user = userData.user;
      } else {
        // 3차: 세션 복구 시도
        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData?.session) {
          const { data: refreshData } = await supabase.auth.refreshSession();
          if (refreshData?.user) {
            user = refreshData.user;
          }
        }
      }
    } catch (e) {
      console.warn('[admin-auth] Cookie-based auth failed:', e);
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
