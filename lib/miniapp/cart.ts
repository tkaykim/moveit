/**
 * 미니앱 장바구니 (T10) — 학원별로 분리된 로컬 저장소.
 *
 * 장바구니에는 **금액이 없다**. 서버(order_preflight)가 가격의 유일한 권위자이고
 * 화면은 서버가 돌려준 판정만 그린다 — T4 와 같은 규율.
 */
import type { OrderItemInput } from '@/lib/orders/types';

export interface CartEntry {
  /** 화면 표시용 라벨 (금액 아님) */
  label: string;
  sublabel?: string | null;
  item: OrderItemInput;
}

const KEY_PREFIX = 'miniapp-cart:';

function key(academyId: string): string {
  return `${KEY_PREFIX}${academyId}`;
}

export function readCart(academyId: string): CartEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(key(academyId));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as CartEntry[]) : [];
  } catch {
    return [];
  }
}

export function writeCart(academyId: string, entries: CartEntry[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key(academyId), JSON.stringify(entries));
    window.dispatchEvent(new CustomEvent('miniapp-cart-changed', { detail: { academyId } }));
  } catch {
    /* 저장 실패는 흐름을 막지 않는다 */
  }
}

function sameItem(a: OrderItemInput, b: OrderItemInput): boolean {
  if (a.item_type !== b.item_type) return false;
  if (a.item_type === 'SCHEDULE_BOOKING' && b.item_type === 'SCHEDULE_BOOKING') {
    return a.schedule_id === b.schedule_id;
  }
  if (a.item_type === 'TICKET_PURCHASE' && b.item_type === 'TICKET_PURCHASE') {
    return (
      a.ticket_id === b.ticket_id &&
      (a.count_option_index ?? null) === (b.count_option_index ?? null)
    );
  }
  return false;
}

/** 이미 담긴 항목은 다시 담지 않는다 (DUPLICATE_IN_CART 를 화면에서 미리 막는다) */
export function addToCart(academyId: string, entry: CartEntry): CartEntry[] {
  const cur = readCart(academyId);
  if (cur.some((e) => sameItem(e.item, entry.item))) return cur;
  const next = [...cur, entry];
  writeCart(academyId, next);
  return next;
}

export function removeAt(academyId: string, index: number): CartEntry[] {
  const next = readCart(academyId).filter((_, i) => i !== index);
  writeCart(academyId, next);
  return next;
}

/**
 * 거절된 인덱스들을 한 번에 뺀다 ("불가 항목 빼고 계속").
 * use_purchase_index 는 남는 항목 기준으로 다시 매핑한다 —
 * 재매핑을 빠뜨리면 엉뚱한 구매 항목에 예약이 붙는다.
 */
export function dropIndexes(academyId: string, indexes: number[]): CartEntry[] {
  const bad = new Set(indexes);
  const cur = readCart(academyId);

  const remap = new Map<number, number>();
  let next = 0;
  cur.forEach((_, i) => {
    if (!bad.has(i)) remap.set(i, next++);
  });

  const kept: CartEntry[] = [];
  for (let i = 0; i < cur.length; i++) {
    if (bad.has(i)) continue;
    const e = cur[i];
    if (e.item.item_type === 'SCHEDULE_BOOKING' && e.item.use_purchase_index != null) {
      kept.push({
        ...e,
        item: { ...e.item, use_purchase_index: remap.get(e.item.use_purchase_index) ?? null },
      });
    } else {
      kept.push(e);
    }
  }

  writeCart(academyId, kept);
  return kept;
}

export function clearCart(academyId: string): void {
  writeCart(academyId, []);
}

export function toOrderItems(entries: CartEntry[]): OrderItemInput[] {
  return entries.map((e) => e.item);
}
