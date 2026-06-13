import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Supabase OAuth callback
 *
 * Google OAuth 후 이곳으로 redirect. URL의 `code`를 세션으로 교환하고 returnTo로 보낸다.
 *
 * 핵심(모두 modoo_app 검증 패턴):
 * 1) 세션 쿠키가 redirect 응답에 직접 실리도록 NextResponse를 먼저 만들고,
 *    createServerClient의 setAll이 그 response에 쿠키를 쓰게 한다.
 *    (next/headers cookies()로 쓰면 NextResponse.redirect에 병합 안 돼 로그인 유지 실패)
 * 2) cross-host 307 점프 중 GoTrue가 transient 5xx/취소를 던지면 1회 재시도.
 * 3) 교환 실패해도 (중복 콜백 레이스로) 이미 세션이 있으면 성공 처리.
 * 4) next: ?next= 쿼리 우선, 없으면 login_return_to 쿠키 폴백.
 *
 * 외부 의존: Supabase Auth → Providers → Google 활성화, URL Configuration의
 * Site URL/Redirect 허용목록에 이 origin이 포함되어 있어야 함.
 */
function safeNext(value: string | null | undefined): string | null {
  if (!value) return null;
  if (!value.startsWith('/')) return null;
  if (value.startsWith('//')) return null;
  if (value.startsWith('/auth')) return null;
  return value;
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const origin = url.origin;
  const code = url.searchParams.get('code');

  // returnTo: 쿼리 우선, 없으면 쿠키(Supabase 왕복 중 쿼리 유실 대비) 폴백
  let next = safeNext(url.searchParams.get('next'));
  if (!next) {
    const cookieVal = request.cookies.get('login_return_to')?.value;
    if (cookieVal) {
      try { next = safeNext(decodeURIComponent(cookieVal)); } catch { /* keep */ }
    }
  }
  next = next || '/home';
  const redirectUrl = `${origin}${next}`;

  if (!code) {
    return NextResponse.redirect(new URL('/my?error=oauth_no_code', origin));
  }

  // (1) redirect 응답을 먼저 만들어 세션 쿠키를 직접 부착
  const response = NextResponse.redirect(redirectUrl);
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: any }>) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // (2) 교환 + transient 재시도
  let lastError: { message?: string } | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data?.user) {
      // 비회원 시절 예약·결제 흡수 (fire-and-forget). handle_new_user 트리거가
      // 게스트 병합을 하지만, 추가 안전망으로 link-guest-bookings 도 한 번 호출.
      try {
        const headers = new Headers();
        const cookie = request.headers.get('cookie');
        if (cookie) headers.set('cookie', cookie);
        fetch(`${origin}/api/me/link-guest-bookings`, { method: 'POST', headers, cache: 'no-store' }).catch(() => {});
      } catch { /* ignore */ }
      response.cookies.set('login_return_to', '', { path: '/', maxAge: 0 });
      return response;
    }
    lastError = error;
    const transient = !!error && /cancel|timeout|fetch|network|502|503|504|500/i.test(error.message || '');
    if (attempt === 0 && transient) {
      await new Promise((r) => setTimeout(r, 300));
      continue;
    }
    break;
  }

  // (3) 교환 실패했지만 이미 세션이 잡혀 있으면(중복 콜백 레이스) 성공 처리
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    response.cookies.set('login_return_to', '', { path: '/', maxAge: 0 });
    return response;
  }

  console.error('OAuth exchange failed:', lastError?.message);
  const err = NextResponse.redirect(new URL('/my?error=oauth_exchange', origin));
  err.cookies.set('login_return_to', '', { path: '/', maxAge: 0 });
  return err;
}
