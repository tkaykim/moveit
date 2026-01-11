import { createClient as createSupabaseClient, SupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/types/database'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://vjxnollfggbufpqldxrb.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

// 싱글톤 인스턴스를 저장할 변수
let supabaseInstance: SupabaseClient<Database> | null = null

export function createClient() {
  // 이미 인스턴스가 존재하면 재사용
  if (supabaseInstance) {
    return supabaseInstance
  }

  // 첫 번째 호출 시에만 새 인스턴스 생성
  supabaseInstance = createSupabaseClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,      // 브라우저 localStorage에 세션 저장
      autoRefreshToken: true,    // Access Token 만료 전 자동 갱신
    },
  })

  return supabaseInstance
}




