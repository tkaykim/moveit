/**
 * Toss Payments 승인 호출 (T5)
 *
 * 요청 조립을 **순수 함수로 분리**한 이유: 멱등키가 실제로 전송되는지를
 * 네트워크 없이 검증할 수 있어야 하기 때문이다(테스트에서 stub 해도 헤더는 증명된다).
 *
 * ⚠ 실제 결제사 호출은 프로젝트의 테스트 키(.env.local `TOSS_SECRET_KEY`)로만 한다.
 */

export const TOSS_CONFIRM_URL = 'https://api.tosspayments.com/v1/payments/confirm';

export interface TossConfirmParams {
  paymentKey: string;
  /** Toss 의 orderId = 우리 order_groups.provider_order_id */
  orderId: string;
  amount: number;
  secretKey: string;
  /**
   * 주문당 유일한 멱등 키. 같은 주문에 대한 두 번째 승인 요청이
   * 두 번 결제되지 않도록 Toss 에 보장을 요구한다.
   * 기본값은 provider_order_id — 주문당 유일하며 재시도해도 같은 값이다.
   */
  idempotencyKey?: string;
}

export interface TossConfirmRequest {
  url: string;
  headers: Record<string, string>;
  body: string;
}

/** 승인 요청 조립. 네트워크를 타지 않는다. */
export function buildTossConfirmRequest(params: TossConfirmParams): TossConfirmRequest {
  const idempotencyKey = params.idempotencyKey || params.orderId;
  if (!idempotencyKey) {
    throw new Error('TOSS_IDEMPOTENCY_KEY_REQUIRED');
  }

  return {
    url: TOSS_CONFIRM_URL,
    headers: {
      Authorization: `Basic ${Buffer.from(`${params.secretKey}:`).toString('base64')}`,
      'Content-Type': 'application/json',
      // 주문당 유일 — 중복 승인 시도가 이중 결제가 되지 않게 한다.
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify({
      paymentKey: params.paymentKey,
      orderId: params.orderId,
      amount: params.amount,
    }),
  };
}

export interface TossApproval {
  ok: boolean;
  status: number;
  /** Toss 가 실제로 승인한 금액. 주문 총액과 대조해야 한다. */
  approvedAmount: number | null;
  paymentKey: string | null;
  orderId: string | null;
  approvedAt: string | null;
  raw: unknown;
  errorCode?: string;
  errorMessage?: string;
}

type FetchLike = (url: string, init: { method: string; headers: Record<string, string>; body: string }) => Promise<{
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
}>;

/** 승인 호출. fetchImpl 을 주입할 수 있어 테스트에서 stub 가능하다. */
export async function confirmTossPayment(
  params: TossConfirmParams,
  fetchImpl?: FetchLike
): Promise<TossApproval> {
  const req = buildTossConfirmRequest(params);
  const doFetch = (fetchImpl ?? (globalThis.fetch as unknown as FetchLike));

  const res = await doFetch(req.url, {
    method: 'POST',
    headers: req.headers,
    body: req.body,
  });

  const raw = (await res.json().catch(() => ({}))) as Record<string, unknown>;

  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      approvedAmount: null,
      paymentKey: null,
      orderId: null,
      approvedAt: null,
      raw,
      errorCode: typeof raw?.code === 'string' ? raw.code : 'TOSS_CONFIRM_FAILED',
      errorMessage: typeof raw?.message === 'string' ? raw.message : '결제 승인에 실패했습니다.',
    };
  }

  return {
    ok: true,
    status: res.status,
    approvedAmount: typeof raw?.totalAmount === 'number' ? raw.totalAmount : null,
    paymentKey: typeof raw?.paymentKey === 'string' ? raw.paymentKey : null,
    orderId: typeof raw?.orderId === 'string' ? raw.orderId : null,
    approvedAt: typeof raw?.approvedAt === 'string' ? raw.approvedAt : null,
    raw,
  };
}
