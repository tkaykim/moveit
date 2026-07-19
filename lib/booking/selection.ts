/**
 * 차감 대상 수강권 선택 — 단일 정본 (T2)
 *
 * 순서:
 *   ① order_items.source_purchase_item_id 로 지정된 수강권이 있으면 **정확히 그것만** 쓴다.
 *   ② 그 외에는 커버하는 PERIOD(기간권) 우선 — 무제한권이 커버하는데 횟수를 태우지 않는다.
 *   ③ 그 다음 커버하는 COUNT(횟수권), 만료 임박 순.
 *   ④ user_tickets.fixed_class_id 가 있는 권은 **그 수업에서만** 사용 가능.
 *
 * 유효기간은 "예약한 날"이 아니라 **수업일(KST)** 기준으로 판정한다.
 * start_date/expiry_date 가 둘 다 NULL 인 FIRST_BOOKING 권은 "아직 시작 안 함" 이며 유효로 본다.
 */
import { normalizeTicketType } from '@/lib/utils/ticket-type';
import { isAfterStart, isWithinExpiry, type DateString } from '@/lib/date/kst';
import {
  evaluateCoverage,
  type CoverageClassContext,
  type CoverageTicketContext,
} from '@/lib/booking/coverage';

export interface SelectableUserTicket {
  /** user_tickets.id */
  id: string;
  status: string | null;
  remainingCount: number | null;
  startDate: DateString | null;
  expiryDate: DateString | null;
  /** user_tickets.fixed_class_id */
  fixedClassId: string | null;
  /** tickets.start_mode */
  startMode: string | null;
  /** tickets.ticket_type (대소문자 혼재 → normalize 필수) */
  ticketType: string | null;
  /** 커버리지 판정용 ticket 컨텍스트 */
  ticket: CoverageTicketContext;
}

export type SelectionRejectReason =
  | 'NOT_ACTIVE'
  | 'NO_REMAINING_COUNT'
  | 'FIXED_CLASS_MISMATCH'
  | 'NOT_STARTED_YET'
  | 'EXPIRED'
  | 'NOT_COVERED';

export interface SelectionCandidate {
  ticket: SelectableUserTicket;
  eligible: boolean;
  reason: SelectionRejectReason | null;
}

/** 이 수강권이 이 수업에 쓸 수 있는가 (단건 판정) */
export function evaluateCandidate(
  ut: SelectableUserTicket,
  klass: CoverageClassContext,
  classDate: DateString
): SelectionCandidate {
  const type = normalizeTicketType(ut.ticketType);

  if (ut.status && ut.status !== 'ACTIVE') {
    return { ticket: ut, eligible: false, reason: 'NOT_ACTIVE' };
  }

  // ④ 고정 수업권은 그 수업에서만
  if (ut.fixedClassId && ut.fixedClassId !== klass.id) {
    return { ticket: ut, eligible: false, reason: 'FIXED_CLASS_MISMATCH' };
  }

  if (type === 'COUNT' && (ut.remainingCount ?? 0) <= 0) {
    return { ticket: ut, eligible: false, reason: 'NO_REMAINING_COUNT' };
  }

  // FIRST_BOOKING 미개시(둘 다 NULL)는 유효. 그 외에는 수업일 기준으로 판정.
  const notStarted = ut.startDate === null && ut.expiryDate === null;
  if (!notStarted) {
    if (!isAfterStart(classDate, ut.startDate)) {
      return { ticket: ut, eligible: false, reason: 'NOT_STARTED_YET' };
    }
    if (!isWithinExpiry(classDate, ut.expiryDate)) {
      return { ticket: ut, eligible: false, reason: 'EXPIRED' };
    }
  }

  if (!evaluateCoverage(ut.ticket, klass).covered) {
    return { ticket: ut, eligible: false, reason: 'NOT_COVERED' };
  }

  return { ticket: ut, eligible: true, reason: null };
}

/** 만료 임박 순 정렬. NULL(무기한)은 가장 뒤. 동률은 id 로 안정 정렬. */
function byExpiryThenId(a: SelectableUserTicket, b: SelectableUserTicket): number {
  const ax = a.expiryDate ?? '9999-12-31';
  const bx = b.expiryDate ?? '9999-12-31';
  if (ax !== bx) return ax < bx ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export interface SelectionInput {
  candidates: SelectableUserTicket[];
  klass: CoverageClassContext;
  classDate: DateString;
  /**
   * ① order_items 링크로 지정된 user_ticket id.
   * 지정되면 오직 이것만 후보가 된다 (다른 권으로 대체하지 않는다).
   */
  designatedUserTicketId?: string | null;
}

export interface SelectionResult {
  selected: SelectableUserTicket | null;
  /** 선택 근거 */
  via: 'DESIGNATED' | 'PERIOD' | 'COUNT' | null;
  reason: SelectionRejectReason | 'DESIGNATED_NOT_FOUND' | 'NO_USABLE_TICKET' | null;
}

export function selectUserTicket(input: SelectionInput): SelectionResult {
  const { candidates, klass, classDate, designatedUserTicketId } = input;

  // ① 지정권: 정확히 그것만. 자격 미달이면 대체하지 않고 실패시킨다.
  if (designatedUserTicketId) {
    const target = candidates.find((c) => c.id === designatedUserTicketId);
    if (!target) {
      return { selected: null, via: null, reason: 'DESIGNATED_NOT_FOUND' };
    }
    const verdict = evaluateCandidate(target, klass, classDate);
    return verdict.eligible
      ? { selected: target, via: 'DESIGNATED', reason: null }
      : { selected: null, via: null, reason: verdict.reason };
  }

  const eligible = candidates
    .map((c) => evaluateCandidate(c, klass, classDate))
    .filter((v) => v.eligible)
    .map((v) => v.ticket);

  // ② 커버하는 PERIOD 우선
  const periods = eligible
    .filter((t) => normalizeTicketType(t.ticketType) === 'PERIOD')
    .sort(byExpiryThenId);
  if (periods.length > 0) {
    return { selected: periods[0], via: 'PERIOD', reason: null };
  }

  // ③ COUNT — 만료 임박 순
  const counts = eligible
    .filter((t) => normalizeTicketType(t.ticketType) === 'COUNT')
    .sort(byExpiryThenId);
  if (counts.length > 0) {
    return { selected: counts[0], via: 'COUNT', reason: null };
  }

  return { selected: null, via: null, reason: 'NO_USABLE_TICKET' };
}
