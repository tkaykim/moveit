/**
 * 결제 확정 → 이행 (T5) — BANK / TOSS / ONSITE 공통 경로
 *
 * 규율:
 *   ① 승인 기록(record_order_payment_approval)은 **이행보다 먼저, 자기 트랜잭션에서** 커밋된다.
 *      그래야 이행이 실패해도 "결제됐다"는 사실이 사라지지 않는다.
 *   ② 이행(finalize_order_group)은 한 트랜잭션. 한 항목이라도 실패하면 전부 롤백된다.
 *   ③ 롤백 뒤 FULFILLMENT_FAILED 기록은 **별도 트랜잭션**이어야 한다
 *      (같은 트랜잭션이면 그 기록마저 롤백된다).
 *   ④ 재시도는 언제나 안전하다 — finalize 가 확정된 주문을 보면 아무것도 더 만들지 않는다.
 */

export type PaymentMethod = 'BANK' | 'TOSS' | 'ONSITE';

type AnyClient = {
  rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
};

export interface FinalizeResult {
  ok: boolean;
  idempotent: boolean;
  order_group_id: string;
  status: string;
  user_ticket_ids: string[];
  booking_ids: string[];
  issued_tickets: number;
  created_bookings: number;
  promoted_holds: number;
  confirmed_date_kst?: string;
  confirmed_at?: string | null;
}

/** 이행 단계 오류 → 사용자 문구 + HTTP 상태 */
export const FULFILMENT_ERROR_MESSAGES: Record<string, string> = {
  ORDER_NOT_FOUND: '주문을 찾을 수 없습니다.',
  NOT_AUTHORIZED: '권한이 없습니다.',
  ORDER_NOT_FULFILLABLE: '이 주문은 지금 확정할 수 없는 상태입니다.',
  ORDER_NOT_APPROVABLE: '이 주문은 결제 승인을 받을 수 없는 상태입니다. (만료·취소되었을 수 있습니다)',
  ORDER_AMOUNT_MISMATCH: '결제 금액이 주문 금액과 일치하지 않습니다.',
  ORDER_METHOD_MISMATCH: '주문의 결제 수단과 다릅니다.',
  GUEST_FULFILLMENT_UNSUPPORTED: '비회원 주문은 회원 연결 후에 확정할 수 있습니다.',
  PURCHASE_ITEM_NOT_ISSUED: '연결된 수강권이 아직 발급되지 않았습니다.',
  NO_USABLE_TICKET: '사용할 수 있는 수강권이 없습니다.',
  TICKET_NOT_COVERED: '이 수업에 사용할 수 없는 수강권입니다.',
  TICKET_EXPIRED: '수강권이 만료되었습니다.',
  TICKET_NOT_STARTED: '아직 시작되지 않은 수강권입니다.',
  TICKET_NOT_ACTIVE: '사용할 수 없는 상태의 수강권입니다.',
  FIXED_CLASS_MISMATCH: '고정 수업이 일치하지 않습니다.',
  INSUFFICIENT_TICKET_COUNT: '수강권 잔여 횟수가 부족합니다.',
  SCHEDULE_FULL: '정원이 마감되었습니다.',
  SCHEDULE_CANCELED: '취소된 수업입니다.',
  SCHEDULE_NOT_FOUND: '스케줄을 찾을 수 없습니다.',
  DUPLICATE_BOOKING: '이미 예약된 수업입니다.',
};

const STATUS_BY_CODE: Record<string, number> = {
  ORDER_NOT_FOUND: 404,
  SCHEDULE_NOT_FOUND: 404,
  NOT_AUTHORIZED: 403,
  ORDER_AMOUNT_MISMATCH: 409,
  ORDER_NOT_FULFILLABLE: 409,
  ORDER_NOT_APPROVABLE: 409,
  ORDER_METHOD_MISMATCH: 409,
  SCHEDULE_FULL: 409,
  DUPLICATE_BOOKING: 409,
};

export interface MappedFulfilmentError {
  code: string;
  detail: string | null;
  message: string;
  status: number;
}

/** DB 예외 문자열(`CODE:detail`)을 구조화한다. */
export function parseFulfilmentError(raw: unknown): MappedFulfilmentError {
  const text =
    typeof raw === 'string' ? raw : (raw as { message?: string })?.message || String(raw ?? '');

  const known = Object.keys(FULFILMENT_ERROR_MESSAGES).find((k) => text.includes(k));
  if (known) {
    const m = text.match(new RegExp(`${known}:([^\\s"']+)`));
    return {
      code: known,
      detail: m ? m[1] : null,
      message: FULFILMENT_ERROR_MESSAGES[known],
      status: STATUS_BY_CODE[known] ?? 400,
    };
  }

  return {
    code: 'FULFILLMENT_FAILED',
    detail: null,
    message: '주문 확정 중 오류가 발생했습니다. 관리자에게 문의해 주세요.',
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

/** 승인 기록 (이행 전, 자기 트랜잭션). 금액 불일치는 여기서 거절된다. */
export async function recordApproval(
  client: AnyClient,
  params: {
    orderGroupId: string;
    approvedAmount: number;
    paymentKey?: string | null;
    expectedMethod?: PaymentMethod | null;
  }
): Promise<{ ok: boolean; already_confirmed: boolean; status: string }> {
  return unwrap(
    await client.rpc('record_order_payment_approval', {
      p_order_group_id: params.orderGroupId,
      p_approved_amount: params.approvedAmount,
      p_payment_key: params.paymentKey ?? null,
      p_expected_method: params.expectedMethod ?? null,
    })
  );
}

/**
 * 이행 실행. 실패하면 **별도 트랜잭션**에서 FULFILLMENT_FAILED 를 남기고 다시 던진다.
 * 승인은 이미 커밋되어 있으므로 재시도로 언제든 복구할 수 있다.
 */
export async function finalizeOrder(
  client: AnyClient,
  orderGroupId: string,
  confirmedBy?: string | null
): Promise<FinalizeResult> {
  try {
    return unwrap<FinalizeResult>(
      await client.rpc('finalize_order_group', {
        p_order_group_id: orderGroupId,
        p_confirmed_by: confirmedBy ?? null,
      })
    );
  } catch (e) {
    const mapped = parseFulfilmentError(e);
    try {
      await client.rpc('mark_order_fulfillment_failed', {
        p_order_group_id: orderGroupId,
        p_error_code: mapped.code,
        p_error_message: (e as Error)?.message ?? String(e),
      });
    } catch (recordErr) {
      // 실패 기록마저 실패해도 원래 오류를 가리지 않는다.
      console.error('[fulfilment] mark_order_fulfillment_failed 실패', recordErr);
    }
    throw e;
  }
}

/**
 * 승인 기록 + 이행. 세 결제 수단이 모두 이 함수를 쓴다.
 * 승인은 먼저 커밋되고, 이행 실패는 FULFILLMENT_FAILED 로 남아 재시도 가능해진다.
 */
export async function approveAndFinalize(
  client: AnyClient,
  params: {
    orderGroupId: string;
    approvedAmount: number;
    method: PaymentMethod;
    paymentKey?: string | null;
    confirmedBy?: string | null;
  }
): Promise<FinalizeResult> {
  const approval = await recordApproval(client, {
    orderGroupId: params.orderGroupId,
    approvedAmount: params.approvedAmount,
    paymentKey: params.paymentKey ?? null,
    expectedMethod: params.method,
  });

  // 이미 확정된 주문에 대한 중복 승인 → 이행은 멱등하게 기존 결과를 돌려준다.
  void approval;

  return finalizeOrder(client, params.orderGroupId, params.confirmedBy ?? null);
}
