"use client";

import { createClient } from '@/lib/supabase/client';

/**
 * 인증 토큰을 자동으로 포함하는 fetch 래퍼
 * 쿠키 기반 인증이 실패하는 경우에도 Authorization 헤더로 인증 가능
 */
export async function authFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();

  const headers = new Headers(options.headers);

  if (session?.access_token) {
    headers.set('Authorization', `Bearer ${session.access_token}`);
  }

  return fetch(url, {
    ...options,
    headers,
  });
}
