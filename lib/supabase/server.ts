import { createServerClient } from '@supabase/ssr';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { Database } from '@/types/database';

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        // @supabase/ssr v0.1.0은 get/set/remove 개별 메서드를 사용
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options?: any) {
          try {
            cookieStore.set(name, value, options);
          } catch {
            // Server Component에서 호출된 경우 무시
          }
        },
        remove(name: string, options?: any) {
          try {
            cookieStore.set(name, '', { ...options, maxAge: 0 });
          } catch {
            // Server Component에서 호출된 경우 무시
          }
        },
      },
      // 서버 사이드 연결 최적화
      db: {
        schema: 'public',
      },
      auth: {
        detectSessionInUrl: false,
      },
      global: {
        // 타임아웃 설정 (30초)
        fetch: (url: RequestInfo | URL, options: RequestInit = {}) => {
          return fetch(url, {
            ...options,
            signal: AbortSignal.timeout(30000), // 30초 타임아웃
          });
        },
        headers: {
          'x-client-info': 'moveit-server',
        },
      },
    }
  );
}

/**
 * 관리자 전용 서비스 클라이언트 생성
 * - SUPABASE_SERVICE_ROLE_KEY가 있으면 서비스 역할 키를 사용 (RLS 우회)
 * - 없으면 anon 키로 대체
 * - 인증 없이 DB 작업에 사용 (인증은 별도로 수행해야 함)
 */
export function createServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  return createSupabaseClient<Database>(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
