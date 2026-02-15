/**
 * 인증된 fetch - 세션의 access_token을 Authorization 헤더로 전달
 * 쿠키가 서버에 전달되지 않는 환경에서도 API 인증이 동작하도록 함
 *
 * 개선사항:
 * - 만료된 토큰 자동 갱신 (getSession → 만료 시 refreshSession)
 * - 401 응답 시 토큰 갱신 후 자동 재시도
 * - 요청 타임아웃 (15초)
 */
import { createClient } from '@/lib/supabase/client';

const FETCH_TIMEOUT_MS = 15000; // 15초

export async function getAuthHeaders(): Promise<Record<string, string>> {
  if (typeof window === 'undefined') return {};
  try {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (session?.access_token) {
      // 토큰 만료 여부 확인 (만료 60초 전이면 갱신)
      const expiresAt = session.expires_at; // unix timestamp (seconds)
      const now = Math.floor(Date.now() / 1000);
      if (expiresAt && now >= expiresAt - 60) {
        // 토큰이 만료되었거나 곧 만료될 예정 → 갱신 시도
        const { data: refreshed } = await supabase.auth.refreshSession();
        if (refreshed?.session?.access_token) {
          return { Authorization: `Bearer ${refreshed.session.access_token}` };
        }
      }
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

  // 타임아웃 설정: 기존 signal과 병합
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  // 기존 signal이 있으면 함께 처리
  if (options.signal) {
    options.signal.addEventListener('abort', () => controller.abort());
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers,
      credentials: 'include',
      signal: controller.signal,
    });

    // 401 응답 시 토큰 갱신 후 1회 재시도
    if (response.status === 401) {
      try {
        const supabase = createClient();
        const { data: refreshed } = await supabase.auth.refreshSession();
        if (refreshed?.session?.access_token) {
          headers.set('Authorization', `Bearer ${refreshed.session.access_token}`);
          const retryController = new AbortController();
          const retryTimeoutId = setTimeout(() => retryController.abort(), FETCH_TIMEOUT_MS);
          try {
            const retryResponse = await fetch(url, {
              ...options,
              headers,
              credentials: 'include',
              signal: retryController.signal,
            });
            return retryResponse;
          } finally {
            clearTimeout(retryTimeoutId);
          }
        }
      } catch {
        // 갱신 실패 시 원래 401 응답 반환
      }
    }

    return response;
  } catch (error: any) {
    // AbortError (타임아웃)를 보다 명확한 에러로 변환
    if (error?.name === 'AbortError') {
      throw new Error(`Request timeout after ${FETCH_TIMEOUT_MS}ms: ${url}`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}
