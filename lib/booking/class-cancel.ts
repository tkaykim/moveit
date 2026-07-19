/**
 * 휴강(CLASS_CANCELED) 전파 — 앱 쪽 단일 진입점 (T7)
 *
 * 흐름:
 *   외부 일정툴이 service_role 로 schedules.is_canceled 를 false→true 로 뒤집는다
 *     → DB 트리거 trg_schedule_canceled_event 가 booking_events 에 이벤트 1건만 기록 (HTTP·무거운 작업 없음)
 *     → cron 이 processClassCanceledEvents() 로 소비 (횟수 복구 / 기간 연장 / 고정 주1회 재배치)
 *     → dispatchClassCancelNotifications() 가 기존 알림 경로로 학생에게 통지
 *
 * 멱등성이 어디서 보장되는가:
 *   · 이벤트 중복  → booking_events 의 partial UNIQUE(schedule_id) WHERE event_type='CLASS_CANCELED'
 *   · 복구 중복    → class_cancel_restorations.booking_id UNIQUE (예약당 정확히 1회)
 *   · 알림 중복    → claim_class_cancel_notifications 가 notified_at 스탬프와 payload 반환을 원자적으로 수행
 */

import { sendNotification } from '@/lib/notifications';

type AnyClient = {
  rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
};

export interface ClassCancelProcessResult {
  ok: boolean;
  processed: number;
  failed: number;
  restored: number;
  count_restored: number;
  period_extended: number;
  replacement_placed: number;
  /** 이미 복구된(=중복 처리된) 예약 수. 재처리 시 여기로 흡수된다. */
  already_restored: number;
}

export interface ClassCancelNotificationRow {
  restoration_id: string;
  academy_id: string;
  user_id: string;
  schedule_id: string;
  booking_id: string;
  restore_kind: string;
  detail: string | null;
  class_name: string | null;
  start_time: string | null;
}

function unwrap<T>(res: { data: unknown; error: unknown }): T {
  if (res.error) {
    const msg = (res.error as { message?: string })?.message || String(res.error);
    throw new Error(msg);
  }
  return res.data as T;
}

/** PENDING CLASS_CANCELED 이벤트를 소비해 예약·수강권을 복구한다. 멱등. */
export async function processClassCanceledEvents(
  client: AnyClient,
  limit = 200
): Promise<ClassCancelProcessResult> {
  return unwrap<ClassCancelProcessResult>(
    await client.rpc('process_class_canceled_events', { p_limit: limit })
  );
}

function formatOccurrence(row: ClassCancelNotificationRow): string {
  if (!row.start_time) return '';
  const d = new Date(row.start_time);
  // KST 표기
  const kst = new Date(d.getTime() + 9 * 3600 * 1000);
  const mm = String(kst.getUTCMonth() + 1);
  const dd = String(kst.getUTCDate());
  const hh = String(kst.getUTCHours()).padStart(2, '0');
  const mi = String(kst.getUTCMinutes()).padStart(2, '0');
  return `${mm}월 ${dd}일 ${hh}:${mi}`;
}

export function buildClassCancelMessage(row: ClassCancelNotificationRow): { title: string; body: string } {
  const when = formatOccurrence(row);
  const cls = row.class_name ?? '수업';
  const restore =
    row.restore_kind === 'COUNT_RESTORED'
      ? '차감된 횟수 1회를 돌려드렸습니다.'
      : row.restore_kind === 'PERIOD_EXTENDED'
        ? '수강권 유효기간을 연장해 드렸습니다.'
        : '예약이 취소 처리되었습니다.';

  return {
    title: '휴강 안내',
    body: `${when ? when + ' ' : ''}${cls} 수업이 휴강되었습니다.\n${restore}`,
  };
}

/**
 * 미발송 복구 건을 선점해 기존 알림 경로(sendNotification)로 통지한다.
 * 선점과 스탬프가 DB 안에서 원자적으로 끝나므로 두 번 돌려도 같은 학생에게 두 번 가지 않는다.
 */
export async function dispatchClassCancelNotifications(
  client: AnyClient,
  limit = 500
): Promise<{ sent: number; failed: number }> {
  const rows = unwrap<ClassCancelNotificationRow[] | null>(
    await client.rpc('claim_class_cancel_notifications', { p_limit: limit })
  );

  let sent = 0;
  let failed = 0;

  for (const row of rows ?? []) {
    const { title, body } = buildClassCancelMessage(row);
    try {
      await sendNotification({
        user_id: row.user_id,
        academy_id: row.academy_id,
        type: 'class_cancelled',
        title,
        body,
        data: {
          schedule_id: row.schedule_id,
          booking_id: row.booking_id,
          restore_kind: row.restore_kind,
          reason: 'CLASS_CANCELED',
        },
      });
      sent += 1;
    } catch (e) {
      // 알림 실패가 복구를 되돌리지는 않는다. 로그만 남기고 계속 진행한다.
      console.error('[class-cancel] 알림 발송 실패', row.restoration_id, e);
      failed += 1;
    }
  }

  return { sent, failed };
}
