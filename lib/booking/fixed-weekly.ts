/**
 * 고정 주1회(fixed weekly) 자동예약 — 앱 쪽 단일 진입점 (T6)
 *
 * 규율:
 *   ① 자동예약 자격은 **DB 함수가 물리적으로 판정**한다
 *      (tickets.is_fixed_weekly = true AND user_tickets.fixed_class_id IS NOT NULL).
 *      여기서 다시 판정하지 않는다 — 조건이 두 곳에 있으면 반드시 갈라진다.
 *      ALL PASS / 일반 PERIOD 수강권이 들어와도 결과는 항상 placed = 0 이다.
 *   ② 배치는 **예약 오픈시각을 면제**받되 정원은 준수한다.
 *   ③ 자리를 못 잡으면 스킵하고 횟수는 남긴다. 실패는 절대 주문 확정을 막지 않는다.
 *      스킵/실패는 fixed_weekly_placement_issues(운영자 큐)에 남는다.
 *
 * 이 함수들이 호출하는 RPC 는 전부 service_role 전용이다.
 */

type AnyClient = {
  rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
};

export interface FixedWeeklyPlacementResult {
  ok: boolean;
  /** 고정 주1회 상품이 아니면 false — 이 경우 placed 는 항상 0 이다. */
  eligible: boolean;
  reason?: string;
  placed: number;
  skipped_full: number;
  skipped_duplicate: number;
  /** 회차가 없어서 쓰이지 못하고 학생에게 남은 횟수 */
  unspent: number;
}

export interface ScheduleEventProcessResult {
  ok: boolean;
  processed: number;
  failed: number;
  placed: number;
  skipped_full: number;
}

export interface MakeupResult {
  ok: boolean;
  makeup_grant_id: string;
  month_key: string;
  from_booking_id: string;
  booking_id: string;
  schedule_id: string;
}

/** 보강 거절 사유 → 사용자 문구 */
export const MAKEUP_ERROR_MESSAGES: Record<string, string> = {
  BOOKING_NOT_FOUND: '예약을 찾을 수 없습니다.',
  SCHEDULE_NOT_FOUND: '수업 회차를 찾을 수 없습니다.',
  SCHEDULE_CANCELED: '취소된 회차로는 보강할 수 없습니다.',
  NOT_AUTHORIZED: '권한이 없습니다.',
  MAKEUP_NO_TICKET: '수강권이 연결되지 않은 예약입니다.',
  MAKEUP_NOT_FIXED_WEEKLY: '고정 주1회 수강권만 보강할 수 있습니다.',
  MAKEUP_NOT_ALLOWED_FOR_TERM: '3개월 상품은 보강이 제공되지 않습니다.',
  MAKEUP_ALREADY_USED: '이번 달 보강을 이미 사용했습니다.',
  MAKEUP_SAME_SCHEDULE: '같은 회차로는 보강할 수 없습니다.',
  FIXED_CLASS_MISMATCH: '고정 수업이 아닌 수업으로는 보강할 수 없습니다.',
  SCHEDULE_FULL: '정원이 마감되었습니다.',
  DUPLICATE_BOOKING: '이미 예약된 회차입니다.',
};

export interface MappedMakeupError {
  code: string;
  detail: string | null;
  message: string;
  status: number;
}

const MAKEUP_STATUS_BY_CODE: Record<string, number> = {
  BOOKING_NOT_FOUND: 404,
  SCHEDULE_NOT_FOUND: 404,
  NOT_AUTHORIZED: 403,
  MAKEUP_ALREADY_USED: 409,
  SCHEDULE_FULL: 409,
  DUPLICATE_BOOKING: 409,
};

export function parseMakeupError(raw: unknown): MappedMakeupError {
  const text =
    typeof raw === 'string' ? raw : (raw as { message?: string })?.message || String(raw ?? '');

  // 긴 코드가 짧은 코드의 접두사가 되는 경우가 있어(예: SCHEDULE_NOT_FOUND:target)
  // 길이 내림차순으로 먼저 맞춘다.
  const known = Object.keys(MAKEUP_ERROR_MESSAGES)
    .sort((a, b) => b.length - a.length)
    .find((k) => text.includes(k));

  if (known) {
    const m = text.match(new RegExp(`${known}:([^\\s"']+)`));
    return {
      code: known,
      detail: m ? m[1] : null,
      message: MAKEUP_ERROR_MESSAGES[known],
      status: MAKEUP_STATUS_BY_CODE[known] ?? 400,
    };
  }

  return {
    code: 'MAKEUP_FAILED',
    detail: null,
    message: '보강 처리 중 오류가 발생했습니다.',
    status: 500,
  };
}

function unwrap<T>(res: { data: unknown; error: unknown }): T {
  if (res.error) {
    const msg = (res.error as { message?: string })?.message || String(res.error);
    throw new Error(msg);
  }
  return res.data as T;
}

/**
 * 발급된 수강권에 대해 앞으로의 고정수업 회차를 남은 횟수만큼 배치한다.
 * 고정 주1회가 아니면 아무것도 하지 않고 eligible=false 로 돌아온다.
 */
export async function placeFixedWeeklyBookings(
  client: AnyClient,
  userTicketId: string
): Promise<FixedWeeklyPlacementResult> {
  return unwrap<FixedWeeklyPlacementResult>(
    await client.rpc('place_fixed_weekly_bookings', { p_user_ticket_id: userTicketId })
  );
}

/**
 * 여러 수강권을 배치한다. **한 건이 실패해도 나머지는 계속** 진행하고,
 * 실패는 삼켜서 호출자(주문 확정)를 절대 막지 않는다.
 */
export async function placeFixedWeeklyBookingsForTickets(
  client: AnyClient,
  userTicketIds: readonly string[]
): Promise<{ placed: number; attempted: number; errors: string[] }> {
  let placed = 0;
  const errors: string[] = [];

  for (const id of userTicketIds) {
    if (!id) continue;
    try {
      const res = await placeFixedWeeklyBookings(client, id);
      placed += res?.placed ?? 0;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('[fixed-weekly] 자동배치 실패 (주문 확정에는 영향 없음)', id, msg);
      errors.push(`${id}: ${msg}`);
    }
  }

  return { placed, attempted: userTicketIds.length, errors };
}

/** PENDING SCHEDULE_CREATED 이벤트를 소비해 신규 회차를 백필한다. 멱등. */
export async function processScheduleCreatedEvents(
  client: AnyClient,
  limit = 200
): Promise<ScheduleEventProcessResult> {
  return unwrap<ScheduleEventProcessResult>(
    await client.rpc('process_schedule_created_events', { p_limit: limit })
  );
}

/** 보강 — 결석 회차를 같은 고정수업의 다른 날짜로 옮긴다. 월 1회(월 상품 한정). */
export async function createMakeupBooking(
  client: AnyClient,
  params: { bookingId: string; targetScheduleId: string; actorId?: string | null }
): Promise<MakeupResult> {
  return unwrap<MakeupResult>(
    await client.rpc('create_makeup_booking', {
      p_booking_id: params.bookingId,
      p_target_schedule_id: params.targetScheduleId,
      p_actor: params.actorId ?? null,
    })
  );
}
