import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { Database } from '@/types/database';

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: any }>) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
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
        persistSession: false, // 서버에서는 세션을 쿠키로만 관리
        autoRefreshToken: false,
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
