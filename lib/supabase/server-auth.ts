/**
 * API Route에서 사용자 인증 - 쿠키 또는 Authorization Bearer 토큰 지원
 */
import { createClient } from '@/lib/supabase/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import type { User } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import type { SupabaseClient } from '@supabase/supabase-js';

export async function getAuthenticatedUser(request?: Request): Promise<User | null> {
  const authHeader = request?.headers?.get?.('Authorization');
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (bearerToken) {
    try {
      const supabase = createSupabaseClient<Database>(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
      const { data: { user }, error } = await supabase.auth.getUser(bearerToken);
      if (!error && user) return user;
    } catch (e) {
      console.warn('[server-auth] Bearer token verification failed:', e);
    }
  }

  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (!error && user) return user;
  return null;
}

/** 인증된 Supabase 클라이언트 반환 (RLS/쿼리용) */
export async function getAuthenticatedSupabase(request?: Request): Promise<SupabaseClient<Database>> {
  const authHeader = request?.headers?.get?.('Authorization');
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (bearerToken) {
    return createSupabaseClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${bearerToken}` } } }
    );
  }

  const client = await createClient();
  return client as unknown as SupabaseClient<Database>;
}
