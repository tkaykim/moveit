import { type NextRequest, NextResponse } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function tryRedirectUuidToSlug(
  request: NextRequest,
  prefix: string,
): Promise<NextResponse | null> {
  const pathname = request.nextUrl.pathname;
  if (!pathname.startsWith(prefix)) return null;

  const rest = pathname.slice(prefix.length);
  const segments = rest.split('/');
  const idSegment = segments[0];
  if (!idSegment || !UUID_RE.test(idSegment)) return null;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) return null;

  try {
    const res = await fetch(
      `${supabaseUrl}/rest/v1/academies?select=slug&id=eq.${idSegment}`,
      {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
          Accept: 'application/vnd.pgrst.object+json',
        },
      },
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (!data?.slug) return null;

    segments[0] = data.slug;
    const newPath = prefix + segments.join('/');
    const url = request.nextUrl.clone();
    url.pathname = newPath;
    return NextResponse.redirect(url, 308);
  } catch {
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const { supabaseResponse, user, supabase } = await updateSession(request);

  const pathname = request.nextUrl.pathname;

  // UUID → slug 리다이렉트 (academy-admin, academy 라우트)
  const slugRedirect =
    (await tryRedirectUuidToSlug(request, '/academy-admin/')) ||
    (await tryRedirectUuidToSlug(request, '/academy/'));
  if (slugRedirect) return slugRedirect;

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
