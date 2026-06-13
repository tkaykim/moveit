import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Supabase OAuth callback (B-4, 2026-04-27)
 *
 * Google OAuth 로그인 후 이곳으로 redirect됨. URL의 `code`를 세션으로 교환하고,
 * 비회원 시절 예약·결제 흡수를 위해 link-guest-bookings를 fire-and-forget으로 호출.
 * 마지막으로 `next` 파라미터에 담긴 returnTo로 보낸다(없으면 /home).
 *
 * 외부 의존:
 * - Supabase Auth → Providers → Google 활성화
 * - Redirect URL `<origin>/auth/callback` 등록
 */
/** 오픈 리다이렉트 방지: 내부 경로만 허용. */
function safeNext(value: string | null | undefined): string | null {
  if (!value) return null;
  if (!value.startsWith('/')) return null;
  if (value.startsWith('//')) return null;
  if (value.startsWith('/auth')) return null;
  return value;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');

  // 1) ?next= 쿼리 우선. 2) Supabase 왕복 중 쿼리가 유실되면 쿠키(login_return_to)로 복원.
  //    (둘 다 없을 때만 /home) — "홈으로 튕김" 사고 방지.
  const cookieHeader = request.headers.get('cookie') || '';
  const cookieReturn = (() => {
    const m = cookieHeader.match(/(?:^|;\s*)login_return_to=([^;]+)/);
    if (!m) return null;
    try { return decodeURIComponent(m[1]); } catch { return null; }
  })();
  const next = safeNext(url.searchParams.get('next')) || safeNext(cookieReturn) || '/home';

  if (!code) {
    return NextResponse.redirect(new URL('/my?error=oauth_no_code', url.origin));
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      console.error('OAuth exchange failed:', error);
      return NextResponse.redirect(new URL('/my?error=oauth_exchange', url.origin));
    }

    // 비회원 시절 예약·결제 흡수: 서버 측에서 직접 RPC 호출 대신
    // 클라이언트가 다음 페이지에서 link-guest-bookings 호출하도록 둠
    // (AuthContext.signIn 경로와 동일한 방식 — 일관성 유지).
    // 단, 사용자 인지 못 한 사이 일어나는 백그라운드 호출이라 콜백에서 한 번 시도해도 무방.
    try {
      const origin = url.origin;
      const headers = new Headers();
      // 세션 쿠키는 exchangeCodeForSession에서 setAll로 응답에 붙음.
      // 여기서는 같은 요청의 cookies를 forward해 link-guest-bookings를 호출.
      const cookie = request.headers.get('cookie');
      if (cookie) headers.set('cookie', cookie);
      // fire-and-forget: 실패해도 사용자 흐름 막지 않음
      fetch(`${origin}/api/me/link-guest-bookings`, {
        method: 'POST',
        headers,
        cache: 'no-store',
      }).catch(() => {});
    } catch {
      // ignore
    }

    const res = NextResponse.redirect(new URL(next, url.origin));
    // 사용한 returnTo 쿠키 정리(다음 OAuth에 영향 주지 않게).
    res.cookies.set('login_return_to', '', { path: '/', maxAge: 0 });
    return res;
  } catch (err) {
    console.error('OAuth callback error:', err);
    return NextResponse.redirect(new URL('/my?error=oauth_unknown', url.origin));
  }
}
