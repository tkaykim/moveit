/**
 * 멤버십 할인 해석 — 단일 정본 (T3)
 *
 * 규칙 (모두 불변):
 *   1. ACTIVE 멤버십만 할인을 준다. SUSPENDED / EXPIRED 는 아무것도 주지 않는다.
 *   2. membership_discounts 중 is_active = true 이고 대상(class_group / ticket)이 일치하는 행만 후보.
 *   3. 멤버십 할인은 **최대 1개만** 적용된다 — percent 가 가장 높은 하나.
 *   4. 기존 `discounts` 테이블과 **중첩되지 않는다**. 둘 다 적용 가능하면 더 큰 쪽 하나만.
 *
 * 반환값에는 "왜 이 값인지"(어느 멤버십 / 어느 percent)가 함께 담긴다.
 * 호출부가 order_items.discount_membership_id / discount_percent 로 스냅샷할 수 있어야 하기 때문.
 */
import type { DateString } from '@/lib/date/kst';

export type MembershipStatus = 'ACTIVE' | 'SUSPENDED' | 'EXPIRED';

/** 할인 대상: 수업 그룹 또는 수강권 */
export type DiscountTarget =
  | { kind: 'class_group'; classGroupId: string }
  | { kind: 'ticket'; ticketId: string };

export interface MembershipDiscountRow {
  id: string;
  membership_id: string;
  class_group_id: string | null;
  ticket_id: string | null;
  percent: number;
  is_active: boolean;
}

/** 프로젝트 기존 discounts 테이블 (멤버십과 무관한 레거시 할인) */
export interface LegacyDiscountRow {
  id: string;
  name: string;
  /** 'PERCENT' | 'PERCENTAGE' | 'AMOUNT' | 'FIXED' (대소문자 무관) */
  discount_type: string;
  discount_value: number;
  is_active: boolean | null;
  valid_from: DateString | null;
  valid_until: DateString | null;
}

export type DiscountSource = 'MEMBERSHIP' | 'LEGACY' | 'NONE';

export interface ResolvedDiscount {
  source: DiscountSource;
  /** 할인 금액(원). basePrice 기준으로 계산됨. */
  amount: number;
  /** 유효 할인율(%) — 스냅샷용. LEGACY 정액 할인도 basePrice 기준 환산값이 들어간다. */
  percent: number;
  /** order_items.discount_membership_id 로 스냅샷할 값 */
  membershipId: string | null;
  membershipDiscountId: string | null;
  legacyDiscountId: string | null;
  /** 사람이 읽는 근거 */
  reason: string;
}

export const NO_DISCOUNT: ResolvedDiscount = {
  source: 'NONE',
  amount: 0,
  percent: 0,
  membershipId: null,
  membershipDiscountId: null,
  legacyDiscountId: null,
  reason: '적용 가능한 할인 없음',
};

function matchesTarget(row: MembershipDiscountRow, target: DiscountTarget): boolean {
  if (target.kind === 'class_group') return row.class_group_id === target.classGroupId;
  return row.ticket_id === target.ticketId;
}

function legacyIsInWindow(row: LegacyDiscountRow, today: DateString): boolean {
  if (row.valid_from && today < row.valid_from) return false;
  if (row.valid_until && today > row.valid_until) return false;
  return true;
}

/** 레거시 할인 1건의 실제 할인 금액 */
export function legacyDiscountAmount(row: LegacyDiscountRow, basePrice: number): number {
  const t = (row.discount_type || '').toUpperCase();
  if (t === 'PERCENT' || t === 'PERCENTAGE') {
    return Math.floor((basePrice * row.discount_value) / 100);
  }
  // AMOUNT / FIXED / 그 외 → 정액으로 취급
  return Math.min(row.discount_value, basePrice);
}

export interface ResolveDiscountInput {
  /** 학생이 가진 멤버십의 상태. 멤버십이 없으면 null. */
  membershipStatus: MembershipStatus | null;
  /** 그 멤버십의 정의 id (student_memberships.membership_id) */
  membershipId: string | null;
  membershipDiscounts: MembershipDiscountRow[];
  legacyDiscounts: LegacyDiscountRow[];
  target: DiscountTarget;
  basePrice: number;
  today: DateString;
}

/**
 * 최종 할인 1건을 결정한다. 절대 합산하지 않는다.
 * 동률이면 멤버십 혜택을 우선한다(고객에게 "멤버십 덕분"이 보이는 편이 낫다는 운영 판단).
 */
export function resolveDiscount(input: ResolveDiscountInput): ResolvedDiscount {
  const { membershipStatus, membershipId, target, basePrice, today } = input;

  // --- 멤버십 후보 (ACTIVE 일 때만) ---
  let bestMembership: MembershipDiscountRow | null = null;
  if (membershipStatus === 'ACTIVE' && membershipId) {
    for (const row of input.membershipDiscounts) {
      if (!row.is_active) continue;
      if (row.membership_id !== membershipId) continue;
      if (!matchesTarget(row, target)) continue;
      if (!bestMembership || row.percent > bestMembership.percent) bestMembership = row;
    }
  }

  // --- 레거시 후보 ---
  let bestLegacy: { row: LegacyDiscountRow; amount: number } | null = null;
  for (const row of input.legacyDiscounts) {
    if (row.is_active === false) continue;
    if (!legacyIsInWindow(row, today)) continue;
    const amount = legacyDiscountAmount(row, basePrice);
    if (amount <= 0) continue;
    if (!bestLegacy || amount > bestLegacy.amount) bestLegacy = { row, amount };
  }

  const membershipAmount = bestMembership
    ? Math.floor((basePrice * bestMembership.percent) / 100)
    : 0;

  if (!bestMembership && !bestLegacy) return NO_DISCOUNT;

  // 중첩 금지 — 더 큰 하나만. 동률은 멤버십 우선.
  if (bestMembership && (!bestLegacy || membershipAmount >= bestLegacy.amount)) {
    return {
      source: 'MEMBERSHIP',
      amount: membershipAmount,
      percent: bestMembership.percent,
      membershipId,
      membershipDiscountId: bestMembership.id,
      legacyDiscountId: null,
      reason: `멤버십 할인 ${bestMembership.percent}% 적용 (membership_discount=${bestMembership.id})`,
    };
  }

  const legacy = bestLegacy!;
  return {
    source: 'LEGACY',
    amount: legacy.amount,
    percent: basePrice > 0 ? Math.round((legacy.amount / basePrice) * 100) : 0,
    membershipId: null,
    membershipDiscountId: null,
    legacyDiscountId: legacy.row.id,
    reason: `일반 할인 "${legacy.row.name}" 적용 (${legacy.amount}원)`,
  };
}
