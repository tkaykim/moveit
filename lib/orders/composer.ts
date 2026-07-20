/**
 * 주문 조립기 (T4) — 서버가 가격의 유일한 권위자.
 *
 * 흐름:
 *   ① previewOrder()      : dry-run. 항목별 판정을 **결제 전에** 전부 돌려준다.
 *                           → 사용자는 불가 항목을 빼고 계속 진행할 수 있다.
 *                             "일단 결제하고 나중에 취소"는 절대 하지 않는다.
 *   ② composeOrder()      : 실제 생성. DB 함수가 락 아래에서 전부 재검증한다.
 *
 * preflight 는 UX 용 사전검사일 뿐이다. 통과했다고 주문이 보장되지 않는다
 * (마지막 좌석은 락 아래에서만 결판난다) — T2 preflightBooking 과 같은 규율.
 */
import { randomUUID } from 'crypto';
import type {
  CreateOrderResult,
  OrderItemInput,
  OrderItemVerdict,
  OrderMethod,
  OrderPreflightResult,
} from '@/lib/orders/types';

type AnyClient = {
  rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
};

/**
 * 클라이언트가 보낸 항목에서 **서버가 인정하는 필드만** 추린다.
 * price / amount / total 같은 금액 필드는 여기서 통째로 사라진다 — 신뢰하지 않기 때문.
 */
export function sanitizeItems(raw: unknown): OrderItemInput[] {
  if (!Array.isArray(raw)) return [];
  const out: OrderItemInput[] = [];

  for (const r of raw) {
    if (!r || typeof r !== 'object') continue;
    const o = r as Record<string, unknown>;

    if (o.item_type === 'TICKET_PURCHASE') {
      out.push({
        item_type: 'TICKET_PURCHASE',
        ticket_id: String(o.ticket_id ?? ''),
        count_option_index:
          o.count_option_index === null || o.count_option_index === undefined
            ? null
            : Number(o.count_option_index),
        fixed_class_id: o.fixed_class_id ? String(o.fixed_class_id) : null,
      });
    } else if (o.item_type === 'SCHEDULE_BOOKING') {
      out.push({
        item_type: 'SCHEDULE_BOOKING',
        schedule_id: String(o.schedule_id ?? ''),
        use_purchase_index:
          o.use_purchase_index === null || o.use_purchase_index === undefined
            ? null
            : Number(o.use_purchase_index),
      });
    } else {
      // 알 수 없는 유형도 그대로 넘겨 DB 가 INVALID_ITEM_TYPE 으로 판정하게 한다
      // (조용히 삭제하면 사용자는 왜 빠졌는지 알 수 없다).
      out.push({ item_type: String(o.item_type ?? '') } as unknown as OrderItemInput);
    }
  }
  return out;
}

function unwrap<T>(res: { data: unknown; error: unknown }): T {
  if (res.error) {
    const msg = (res.error as { message?: string })?.message || String(res.error);
    throw new Error(msg);
  }
  return res.data as T;
}

/** ① dry-run 사전판정 — 아무것도 쓰지 않는다 */
export async function previewOrder(
  client: AnyClient,
  params: { academyId: string; items: OrderItemInput[]; userId?: string | null }
): Promise<OrderPreflightResult> {
  const res = await client.rpc('order_preflight', {
    p_academy_id: params.academyId,
    p_items: params.items,
    p_user_id: params.userId ?? null,
  });
  return unwrap<OrderPreflightResult>(res);
}

/** 판정 결과에서 주문 가능한 항목만 남긴다 (장바구니 "불가 항목 빼고 계속") */
export function keepOrderableItems(
  items: OrderItemInput[],
  verdicts: OrderItemVerdict[]
): { items: OrderItemInput[]; dropped: OrderItemVerdict[] } {
  const badIdx = new Set(verdicts.filter((v) => !v.ok).map((v) => v.index));
  if (badIdx.size === 0) return { items, dropped: [] };

  // 남는 항목 기준으로 인덱스가 밀리므로 use_purchase_index 를 다시 매핑한다.
  const remap = new Map<number, number>();
  let next = 0;
  items.forEach((_, i) => {
    if (!badIdx.has(i)) remap.set(i, next++);
  });

  const kept: OrderItemInput[] = [];
  for (let i = 0; i < items.length; i++) {
    if (badIdx.has(i)) continue;
    const it = items[i];
    if (it.item_type === 'SCHEDULE_BOOKING' && it.use_purchase_index != null) {
      const mapped = remap.get(it.use_purchase_index);
      kept.push({ ...it, use_purchase_index: mapped ?? null });
    } else {
      kept.push(it);
    }
  }

  return { items: kept, dropped: verdicts.filter((v) => !v.ok) };
}

/**
 * 결제 요청 **전에** 만들어지는 주문번호. 유니크하며 멱등 키로 쓰인다.
 * 같은 값으로 두 번 제출해도 주문은 하나만 생긴다.
 */
export function newProviderOrderId(prefix = 'MV'): string {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}-${randomUUID().slice(0, 8).toUpperCase()}`;
}

export interface ComposeOrderParams {
  academyId: string;
  method: OrderMethod;
  items: OrderItemInput[];
  userId?: string | null;
  providerOrderId?: string;
  orderer?: { name?: string | null; phone?: string | null; email?: string | null } | null;
  /**
   * 클라이언트가 "이 금액인 줄 알았다"고 주장하는 값(선택).
   * 계산에는 **절대 쓰이지 않는다**. 서버 계산액과 다르면 결제를 진행하지 않고 거절한다.
   */
  expectedTotalAmount?: number | null;
}

/** ② 실제 주문 생성 — 재검증 · 스냅샷 · (BANK) 좌석 홀드가 한 트랜잭션 */
export async function composeOrder(
  client: AnyClient,
  params: ComposeOrderParams
): Promise<CreateOrderResult> {
  const providerOrderId = params.providerOrderId || newProviderOrderId();

  if (params.expectedTotalAmount != null) {
    const preview = await previewOrder(client, {
      academyId: params.academyId,
      items: params.items,
      userId: params.userId ?? null,
    });
    if (preview.total_amount !== params.expectedTotalAmount) {
      throw new Error(
        `AMOUNT_MISMATCH: expected=${params.expectedTotalAmount} actual=${preview.total_amount}`
      );
    }
  }

  const res = await client.rpc('create_order_group', {
    p_academy_id: params.academyId,
    p_method: params.method,
    p_provider_order_id: providerOrderId,
    p_items: params.items,
    p_user_id: params.userId ?? null,
    p_orderer: params.orderer ?? null,
  });

  return unwrap<CreateOrderResult>(res);
}
