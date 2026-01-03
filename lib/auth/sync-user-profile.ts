/**
 * Supabase Auth 사용자와 users 테이블 동기화
 * 
 * 이 함수는 Supabase Auth에서 사용자가 생성될 때
 * 자동으로 users 테이블에 프로필을 생성하는 데 사용됩니다.
 * 
 * Supabase Dashboard에서 Database Trigger로 설정하는 것을 권장합니다.
 * 또는 Edge Function으로 구현할 수 있습니다.
 */

import { createClient } from '@/lib/supabase/server';

/**
 * 사용자 프로필 동기화
 * Auth 사용자가 생성되었을 때 users 테이블에 프로필 생성
 */
export async function syncUserProfile(userId: string, email: string, metadata?: {
  name?: string;
  nickname?: string;
  phone?: string;
}) {
  const supabase = await createClient();

  const { error } = await (supabase
    .from('users') as any)
    .insert({
      id: userId,
      email: email,
      name: metadata?.name || null,
      nickname: metadata?.nickname || null,
      phone: metadata?.phone || null,
    })
    .select()
    .single();

  if (error) {
    // 이미 존재하는 경우 무시 (ON CONFLICT 처리)
    if (error.code === '23505') {
      return { success: true, message: '프로필이 이미 존재합니다.' };
    }
    throw error;
  }

  return { success: true, message: '프로필이 생성되었습니다.' };
}

