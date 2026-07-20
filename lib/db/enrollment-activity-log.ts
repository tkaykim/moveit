import { createServiceClient } from '@/lib/supabase/server';
import type { Database, Json } from '@/types/database';

type SupabaseClientAny = any;

export type EnrollmentActivityAction =
  | 'ENROLL'
  | 'CANCEL'
  | 'REFUND'
  | 'EXTENSION_APPROVED'
  | 'COUNT_DEDUCT'
  | 'COUNT_RESTORE'
  | 'TICKET_ISSUED'
  | 'EXTENSION_REQUESTED'
  | 'ADMIN_EXTEND'
  | 'ADMIN_ENROLL'
  | 'ATTENDANCE_CHECKED'
  | 'TICKET_EXHAUSTED'
  | 'TICKET_EXPIRED'
  | 'ABSENT_MARKED'
  | 'ABSENT_CLEARED'
  | 'GUEST_MERGED'
  | 'TICKET_DELETED'
  | 'MEMBER_CONFLICT_REJECTED'
  | 'PAYMENT_FAILED'
  | 'WEBHOOK_DUPLICATE'
  | 'MAKEUP'                 // 보강 배정 (T7)
  | 'CLASS_CANCELED_RESTORE' // 휴강 복구 (T7)
  | 'REFUND_PROPOSED'        // 환불 제안 생성 (T7, 집행 아님)
  | 'REFUND_CONFIRMED'            // 환불 제안 직원 확인 (T7)
  | 'CLASS_READINESS_TAGGED'      // 예약 준비 태깅 1건 (T8)
  | 'CLASS_READINESS_BULK_TAGGED';// 예약 준비 태깅 일괄 (T8)

export type LogTicketEventVia =
  | 'toss_payment'
  | 'bank_transfer'
  | 'admin_purchase'
  | 'admin_adjust'
  | 'booking'
  | 'cancel'
  | 'auto_expiry_cron'
  | 'consume_check'
  | 'qr'
  | 'manual'
  | 'guest_merge'
  | 'extension_approval'
  | 'period_pause'
  | 'period_pause_recreate'
  | 'period_auto_booking'
  | 'bank_transfer_revert'
  | 'webhook'
  | 'member_conflict';

export interface InsertEnrollmentActivityLogParams {
  academy_id: string;
  user_id?: string | null;
  user_ticket_id?: string | null;
  booking_id?: string | null;
  extension_request_id?: string | null;
  action: EnrollmentActivityAction;
  payload?: Record<string, unknown> | null;
  note?: string | null;
  actor_user_id?: string | null;
}

/**
 * 수강신청/취소/환불/연장/횟수 변동 등 활동 로그 기록 (활동로그 탭용)
 * 실패해도 비즈니스 로직에는 영향 주지 않도록 에러는 로깅만 함.
 * RLS 정책 우회를 위해 service client를 기본으로 사용.
 */
export async function insertEnrollmentActivityLog(
  params: InsertEnrollmentActivityLogParams,
  client?: SupabaseClientAny
): Promise<void> {
  const supabase = (client || createServiceClient()) as any;
  const row: Database['public']['Tables']['enrollment_activity_log']['Insert'] = {
    academy_id: params.academy_id,
    user_id: params.user_id ?? null,
    user_ticket_id: params.user_ticket_id ?? null,
    booking_id: params.booking_id ?? null,
    extension_request_id: params.extension_request_id ?? null,
    action: params.action,
    payload: (params.payload ?? null) as Json | null,
    note: params.note ?? null,
    actor_user_id: params.actor_user_id ?? null,
  };
  const { error } = await supabase.from('enrollment_activity_log').insert(row);
  if (error) {
    console.error('[enrollment_activity_log] insert failed:', error);
  }
}

interface BalanceSnapshot {
  remaining_count?: number | null;
  status?: string | null;
  expiry_date?: string | null;
}

export interface LogTicketEventParams {
  academy_id: string;
  user_id?: string | null;
  user_ticket_id?: string | null;
  booking_id?: string | null;
  extension_request_id?: string | null;
  action: EnrollmentActivityAction;
  before?: BalanceSnapshot;
  after?: BalanceSnapshot;
  via: LogTicketEventVia;
  reason?: string;
  context?: Record<string, unknown>;
  actor_user_id?: string | null;
  note?: string | null;
}

/**
 * 수강권 관련 이벤트의 표준화된 로그 기록 헬퍼.
 * before/after 스냅샷에서 previous_count/next_count/delta/previous_status/next_status/
 * previous_expiry/next_expiry 를 자동 계산해 payload 형식을 일관되게 유지한다.
 *
 * - before/after 가 모두 null/undefined 인 경우 해당 필드는 payload 에 포함하지 않는다.
 * - context 는 ticket_name, ticket_type, price, payment_method 등 이벤트별 부가 정보를 담는다.
 */
export async function logTicketEvent(
  params: LogTicketEventParams,
  client?: SupabaseClientAny
): Promise<void> {
  const { before, after } = params;
  const payload: Record<string, unknown> = {
    via: params.via,
  };
  if (params.reason !== undefined) payload.reason = params.reason;

  if (before?.remaining_count !== undefined || after?.remaining_count !== undefined) {
    const prev = before?.remaining_count ?? null;
    const next = after?.remaining_count ?? null;
    payload.previous_count = prev;
    payload.next_count = next;
    if (typeof prev === 'number' && typeof next === 'number') {
      payload.delta = next - prev;
    }
  }
  if (before?.status !== undefined || after?.status !== undefined) {
    payload.previous_status = before?.status ?? null;
    payload.next_status = after?.status ?? null;
  }
  if (before?.expiry_date !== undefined || after?.expiry_date !== undefined) {
    payload.previous_expiry = before?.expiry_date ?? null;
    payload.next_expiry = after?.expiry_date ?? null;
  }
  if (params.context) {
    for (const [k, v] of Object.entries(params.context)) {
      if (v !== undefined && payload[k] === undefined) payload[k] = v;
    }
  }

  await insertEnrollmentActivityLog(
    {
      academy_id: params.academy_id,
      user_id: params.user_id ?? null,
      user_ticket_id: params.user_ticket_id ?? null,
      booking_id: params.booking_id ?? null,
      extension_request_id: params.extension_request_id ?? null,
      action: params.action,
      payload,
      note: params.note ?? null,
      actor_user_id: params.actor_user_id ?? null,
    },
    client
  );
}
