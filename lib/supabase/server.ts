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
        detectSessionInUrl: false,
      },
      global: {
        // 타임아웃 설정 (30초)
        fetch: (url: RequestInfo | URL, options: RequestInit = {}) => {
          return fetch(url, {
            ...options,
            // Next 가 패치한 fetch 의 Data Cache 를 반드시 끈다.
            // route 의 dynamic='force-dynamic' 은 **라우트 캐시**만 끄고 Data Cache 는 그대로라,
            // 빼먹으면 DB 읽기가 무기한 캐시돼 삭제된 행이 계속 렌더된다.
            cache: 'no-store',
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
    global: {
      /**
       * Next 가 패치한 전역 fetch 는 GET 을 Data Cache 에 담는다.
       * DB 읽기는 절대 캐시하면 안 된다 — 캐시되면 학원이 새 워크샵/수업을 만들어도
       * 미니앱에 나타나지 않고, 삭제한 행이 계속 보인다 (실제로 그랬다).
       * 라우트의 dynamic='force-dynamic' 은 Data Cache 를 끄지 않으므로 여기서 끈다.
       */
      fetch: (url: RequestInfo | URL, options: RequestInit = {}) =>
        fetch(url, { ...options, cache: 'no-store' }),
    },
  });
}
