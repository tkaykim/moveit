import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

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
            request.cookies.set(name, value)
          );
          response = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // 세션 및 사용자 확인
  // 먼저 세션을 새로고침한 후 사용자 정보 가져오기
  const {
    data: { session },
  } = await supabase.auth.getSession();

  // 세션이 있으면 사용자 정보 가져오기
  let user = null;
  if (session) {
    const {
      data: { user: sessionUser },
      error: userError,
    } = await supabase.auth.getUser();
    
    if (!userError && sessionUser) {
      user = sessionUser;
    }
  }

  // 보호된 라우트 체크 (예: /admin)
  if (request.nextUrl.pathname.startsWith('/admin')) {
    // 세션이 있거나 사용자가 있으면 인증된 것으로 간주
    // 세션이 있지만 사용자가 없는 경우는 세션이 만료되었거나 유효하지 않은 경우
    if (!user && !session) {
      // 로그인하지 않은 경우 로그인 페이지로 리다이렉트
      const url = request.nextUrl.clone();
      url.pathname = '/auth/login';
      url.searchParams.set('redirect', request.nextUrl.pathname);
      return NextResponse.redirect(url);
    }

    // 세션이 있지만 사용자가 없는 경우 (세션 만료 등)
    // 이 경우도 로그인 페이지로 리다이렉트
    if (session && !user) {
      const url = request.nextUrl.clone();
      url.pathname = '/auth/login';
      url.searchParams.set('redirect', request.nextUrl.pathname);
      return NextResponse.redirect(url);
    }

    // 사용자가 있으면 역할 확인
    if (user) {
      let profile: { role: string } | null = null;
      
      try {
        // 사용자 프로필에서 역할 확인 (에러가 발생해도 계속 진행)
        const { data, error: profileError } = await supabase
          .from('users')
          .select('role')
          .eq('id', user.id)
          .single();

        if (!profileError && data) {
          profile = data;
        }
      } catch (error) {
        // 프로필 조회 실패 시 에러 무시 (role이 없을 수 있음)
        console.warn('Middleware: Could not fetch user profile:', error);
      }

      // /admin/users는 SUPER_ADMIN만 접근 가능
      if (request.nextUrl.pathname.startsWith('/admin/users')) {
        if (profile && profile.role !== 'SUPER_ADMIN') {
          const url = request.nextUrl.clone();
          url.pathname = '/admin';
          return NextResponse.redirect(url);
        }
        // profile이 없거나 role이 없으면 일단 통과 (페이지에서 재확인)
      }

      // 일반 admin 페이지는 SUPER_ADMIN, ACADEMY_OWNER, ACADEMY_MANAGER만 접근 가능
      if (
        request.nextUrl.pathname === '/admin' ||
        request.nextUrl.pathname.startsWith('/admin/academies') ||
        request.nextUrl.pathname.startsWith('/admin/instructors') ||
        request.nextUrl.pathname.startsWith('/admin/classes') ||
        request.nextUrl.pathname.startsWith('/admin/schedules') ||
        request.nextUrl.pathname.startsWith('/admin/bookings') ||
        request.nextUrl.pathname.startsWith('/admin/branches') ||
        request.nextUrl.pathname.startsWith('/admin/halls')
      ) {
        const allowedRoles = ['SUPER_ADMIN', 'ACADEMY_OWNER', 'ACADEMY_MANAGER'];
        // profile이 있고, role이 명확히 허용되지 않은 경우만 차단
        if (profile && profile.role && !allowedRoles.includes(profile.role)) {
          const url = request.nextUrl.clone();
          url.pathname = '/';
          return NextResponse.redirect(url);
        }
        // profile이 없거나 role이 없으면 일단 통과 (페이지에서 재확인)
      }
    }
  }

  // 로그인/회원가입 페이지 접근 시 이미 로그인되어 있으면 홈으로 리다이렉트
  if (request.nextUrl.pathname.startsWith('/auth')) {
    if (user) {
      const url = request.nextUrl.clone();
      url.pathname = '/';
      return NextResponse.redirect(url);
    }
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};

