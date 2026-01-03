import { type NextRequest, NextResponse } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

export async function middleware(request: NextRequest) {
  const { supabaseResponse, user, supabase } = await updateSession(request);

  const pathname = request.nextUrl.pathname;

  // Admin 페이지 보호 제거 - 로그인 강제하지 않음

  // 로그인 페이지 접근 시 이미 로그인되어 있으면 홈으로
  if (pathname.startsWith('/auth') && user) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
