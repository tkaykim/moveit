import { createClient } from '@/lib/supabase/server';
import type { Database, Json } from '@/types/database';

type SupabaseClientAny = any;

export type EnrollmentActivityAction =
  | 'ENROLL'
  | 'CANCEL'
  | 'REFUND'
  | 'EXTENSION_APPROVED'
  | 'COUNT_DEDUCT'
  | 'COUNT_RESTORE';

export interface InsertEnrollmentActivityLogParams {
  academy_id: string;
  user_id?: string | null;
  user_ticket_id?: string | null;
  booking_id?: string | null;
  extension_request_id?: string | null;
  action: EnrollmentActivityAction;
  payload?: Record<string, unknown> | null;
  actor_user_id?: string | null;
}

/**
 * 수강신청/취소/환불/연장/횟수 변동 등 활동 로그 기록 (활동로그 탭용)
 * 실패해도 비즈니스 로직에는 영향 주지 않도록 에러는 로깅만 함.
 */
export async function insertEnrollmentActivityLog(
  params: InsertEnrollmentActivityLogParams,
  client?: SupabaseClientAny
): Promise<void> {
  const supabase = (client || (await createClient())) as any;
  const row: Database['public']['Tables']['enrollment_activity_log']['Insert'] = {
    academy_id: params.academy_id,
    user_id: params.user_id ?? null,
    user_ticket_id: params.user_ticket_id ?? null,
    booking_id: params.booking_id ?? null,
    extension_request_id: params.extension_request_id ?? null,
    action: params.action,
    payload: (params.payload ?? null) as Json | null,
    actor_user_id: params.actor_user_id ?? null,
  };
  const { error } = await supabase.from('enrollment_activity_log').insert(row);
  if (error) {
    console.error('[enrollment_activity_log] insert failed:', error);
  }
}
