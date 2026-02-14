/**
 * 인증된 fetch - 세션의 access_token을 Authorization 헤더로 전달
 * 쿠키가 서버에 전달되지 않는 환경에서도 API 인증이 동작하도록 함
 */
import { createClient } from '@/lib/supabase/client';

export async function getAuthHeaders(): Promise<Record<string, string>> {
  if (typeof window === 'undefined') return {};
  try {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      return { Authorization: `Bearer ${session.access_token}` };
    }
  } catch {
    // 클라이언트 미초기화 등
  }
  return {};
}

export async function fetchWithAuth(
  url: string | URL,
  options: RequestInit = {}
): Promise<Response> {
  const headers = new Headers(options.headers);
  const authHeaders = await getAuthHeaders();
  Object.entries(authHeaders).forEach(([k, v]) => headers.set(k, v));
  return fetch(url, { ...options, headers, credentials: 'include' });
}
