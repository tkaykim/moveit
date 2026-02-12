import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        // @supabase/ssr v0.1.0은 get/set/remove 개별 메서드를 사용
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options?: any) {
          // 요청 쿠키에도 설정 (다음 핸들러에서 읽을 수 있도록)
          request.cookies.set(name, value);
          // 응답 쿠키에도 설정 (브라우저에 전달되도록)
          supabaseResponse = NextResponse.next({
            request,
          });
          supabaseResponse.cookies.set(name, value, options);
        },
        remove(name: string, options?: any) {
          request.cookies.set(name, '');
          supabaseResponse = NextResponse.next({
            request,
          });
          supabaseResponse.cookies.set(name, '', { ...options, maxAge: 0 });
        },
      },
    }
  );

  // 세션 새로고침 (토큰 만료 시 자동 갱신)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { supabaseResponse, user, supabase };
}
