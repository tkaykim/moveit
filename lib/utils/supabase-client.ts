import { createClient as createSupabaseClient } from '@/lib/supabase/client';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

/**
 * 안전하게 Supabase 클라이언트를 생성합니다.
 * 환경 변수가 없을 경우 null을 반환합니다.
 */
export function getSupabaseClient(): any {
  try {
    // 클라이언트 사이드에서 환경 변수 확인
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    // 더 자세한 디버깅 정보
    if (!url || !key) {
      const debugInfo = {
        hasUrl: !!url,
        hasKey: !!key,
        urlLength: url?.length || 0,
        keyLength: key?.length || 0,
        allEnvKeys: Object.keys(process.env).filter(k => k.includes('SUPABASE')),
      };
      
      console.error('Missing Supabase environment variables:', debugInfo);
      
      // 개발 환경에서만 상세한 안내 표시
      if (process.env.NODE_ENV === 'development') {
        console.error(`
⚠️ Supabase 환경 변수가 설정되지 않았습니다.

다음 단계를 확인하세요:
1. 프로젝트 루트에 .env.local 파일이 있는지 확인
2. .env.local 파일에 다음이 포함되어 있는지 확인:
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
3. 개발 서버를 재시작하세요 (npm run dev)
4. 변수명이 정확히 NEXT_PUBLIC_로 시작하는지 확인
        `);
      }
      
      return null;
    }

    return createSupabaseClient();
  } catch (error: any) {
    console.error('Supabase client creation error:', error);
    console.error('Error details:', {
      message: error?.message,
      stack: error?.stack,
    });
    return null;
  }
}
