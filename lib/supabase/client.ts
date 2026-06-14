'use client';

import { createBrowserClient } from '@supabase/ssr';
import { Database } from '@/types/database';
import { reportingFetch } from '@/lib/error-reporting/supabase-fetch';

export function createClient() {
  if (typeof window === 'undefined') {
    throw new Error('createClient should only be called from client components');
  }

  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      // 모든 supabase 데이터 호출의 권한/RLS/서버 오류를 자동 감지·리포트
      global: { fetch: reportingFetch },
    }
  );
}
