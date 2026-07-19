/**
 * 주문 조립 타입 · 사유 코드 단일 정본 (T4)
 *
 * ⚠ 금액은 **서버만** 계산한다. 클라이언트가 보낸 어떤 금액 필드도 읽지 않는다.
 *    아래 입력 타입에 price/amount 가 없는 것은 실수가 아니라 설계다.
 */

export type OrderMethod = 'BANK' | 'TOSS' | 'ONSITE';

export type OrderItemType = 'TICKET_PURCHASE' | 'SCHEDULE_BOOKING';

/** 수강권 구매 항목 */
export interface TicketPurchaseInput {
  item_type: 'TICKET_PURCHASE';
  ticket_id: string;
  /** tickets.count_options 배열의 인덱스. 없으면 상품 기본가/기본 횟수. */
  count_option_index?: number | null;
  /** tickets.is_fixed_weekly = true 인 상품에서 필수 */
  fixed_class_id?: string | null;
}

/** 스케줄 예약 항목 */
export interface ScheduleBookingInput {
  item_type: 'SCHEDULE_BOOKING';
  schedule_id: string;
  /**
   * "사서 바로 쓴다": 같은 장바구니의 몇 번째 구매 항목으로 이 예약을 결제할지.
   * 지정하면 order_items.source_purchase_item_id 로 연결되고,
   * T2 selection 모듈이 그 지정을 그대로 따른다.
   */
  use_purchase_index?: number | null;
}

export type OrderItemInput = TicketPurchaseInput | ScheduleBookingInput;

/** 항목별 거절 사유 — 기계가 읽는 코드 */
export type OrderItemCode =
  | 'OK'
  // 수강권 구매
  | 'TICKET_NOT_FOUND'
  | 'TICKET_WRONG_ACADEMY'
  | 'TICKET_NOT_ON_SALE'
  | 'INVALID_COUNT_OPTION'
  | 'FIXED_CLASS_REQUIRED'
  | 'FIXED_CLASS_INVALID'
  // 스케줄 예약
  | 'SCHEDULE_NOT_FOUND'
  | 'SCHEDULE_CANCELED'
  | 'SCHEDULE_WRONG_ACADEMY'
  | 'CLASS_GROUP_MISSING'
  | 'AUDIENCE_NOT_ELIGIBLE'
  | 'BOOKING_NOT_YET_OPEN'
  | 'BOOKING_CLOSED'
  | 'DUPLICATE_BOOKING'
  | 'DUPLICATE_IN_CART'
  | 'SCHEDULE_FULL'
  | 'NO_USABLE_TICKET'
  | 'SPECIAL_CLASS_NOT_COVERED'
  | 'TICKET_NOT_COVERED'
  | 'TICKET_EXPIRED'
  | 'INVALID_PURCHASE_LINK'
  // 공통
  | 'INVALID_ITEM_TYPE';

/** 항목 하나의 판정 결과 (= 그대로 order_items 스냅샷이 된다) */
export interface OrderItemVerdict {
  index: number;
  item_type: OrderItemType | string;
  ok: boolean;
  code: OrderItemCode;
  /** 사람이 읽는 문구 */
  message: string;

  ticket_id?: string | null;
  schedule_id?: string | null;
  class_id?: string | null;
  fixed_class_id?: string | null;
  count_option_index?: number | null;
  use_purchase_index?: number | null;

  ticket_name_snapshot?: string | null;
  ticket_type_snapshot?: string | null;
  grant_count_snapshot?: number | null;
  valid_days_snapshot?: number | null;
  start_mode_snapshot?: string | null;

  original_amount: number;
  discount_amount: number;
  final_amount: number;
  discount_membership_id: string | null;
  discount_percent: number | null;
}

/** 장바구니 전체 판정 (dry-run preflight 결과) */
export interface OrderPreflightResult {
  /** 전 항목이 OK 인가. false 여도 items 는 항상 전부 들어있다. */
  ok: boolean;
  items: OrderItemVerdict[];
  original_amount: number;
  discount_amount: number;
  total_amount: number;
}

export interface CreateOrderResult {
  ok: boolean;
  /** 같은 provider_order_id 로 이미 만들어진 주문을 돌려준 경우 true */
  idempotent: boolean;
  order_group_id: string;
  provider_order_id?: string;
  status: string;
  method?: OrderMethod;
  original_amount?: number;
  discount_amount?: number;
  total_amount: number;
  expires_at?: string | null;
  order_item_ids?: string[];
  hold_booking_ids?: string[];
}

/** 주문 단계 오류 → 사용자 메시지 (예약 엔진 BOOKING_ERROR_MESSAGES 와 같은 역할) */
export const ORDER_ERROR_MESSAGES: Record<string, string> = {
  ACADEMY_REQUIRED: '학원 정보가 필요합니다.',
  ITEMS_MUST_BE_ARRAY: '주문 항목 형식이 올바르지 않습니다.',
  EMPTY_ORDER: '주문할 항목이 없습니다.',
  INVALID_METHOD: '지원하지 않는 결제 수단입니다.',
  PROVIDER_ORDER_ID_REQUIRED: '주문 번호가 필요합니다.',
  NOT_AUTHORIZED: '권한이 없습니다.',
  AMOUNT_MISMATCH: '결제 금액이 변경되었습니다. 다시 확인해 주세요.',
  ORDER_ITEM_REJECTED: '주문할 수 없는 항목이 포함되어 있습니다.',
};

/**
 * create_order_group 이 던지는 'ORDER_ITEM_REJECTED:<index>:<code>' 를 해석한다.
 * 결제 전에 preflight 로 걸러졌어야 하는 항목이 락 아래 재검증에서 뒤집힌 경우
 * (예: 그 사이 마지막 좌석이 나감) 이 경로로 온다.
 */
export function parseOrderError(raw: unknown): {
  code: string;
  itemIndex: number | null;
  itemCode: OrderItemCode | null;
  message: string;
  status: number;
} {
  const text = typeof raw === 'string' ? raw : (raw as { message?: string })?.message || '';

  const rejected = text.match(/ORDER_ITEM_REJECTED:(\d+):([A-Z_]+)/);
  if (rejected) {
    return {
      code: 'ORDER_ITEM_REJECTED',
      itemIndex: Number(rejected[1]),
      itemCode: rejected[2] as OrderItemCode,
      message: ORDER_ERROR_MESSAGES.ORDER_ITEM_REJECTED,
      status: 409,
    };
  }

  const known = Object.keys(ORDER_ERROR_MESSAGES).find((k) => text.includes(k));
  if (known) {
    return {
      code: known,
      itemIndex: null,
      itemCode: null,
      message: ORDER_ERROR_MESSAGES[known],
      status: known === 'NOT_AUTHORIZED' ? 403 : known === 'AMOUNT_MISMATCH' ? 409 : 400,
    };
  }

  return {
    code: 'UNKNOWN',
    itemIndex: null,
    itemCode: null,
    message: '주문 생성에 실패했습니다.',
    status: 500,
  };
}
