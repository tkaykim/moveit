import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  // "next" 파라미터가 있으면 리다이렉트 URL로 사용
  let next = searchParams.get('next') ?? '/';

  // 상대 경로가 아니면 기본 경로 사용
  if (!next.startsWith('/')) {
    next = '/';
  }

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    
    if (!error) {
      const forwardedHost = request.headers.get('x-forwarded-host'); // 로드 밸런서 이전의 원본 origin
      const isLocalEnv = process.env.NODE_ENV === 'development';
      
      if (isLocalEnv) {
        // 로컬 환경에서는 로드 밸런서가 없으므로 X-Forwarded-Host를 확인할 필요 없음
        return NextResponse.redirect(`${origin}${next}`);
      } else if (forwardedHost) {
        return NextResponse.redirect(`https://${forwardedHost}${next}`);
      } else {
        return NextResponse.redirect(`${origin}${next}`);
      }
    }
  }

  // 에러 페이지로 리다이렉트
  return NextResponse.redirect(`${origin}/auth/auth-code-error`);
}

