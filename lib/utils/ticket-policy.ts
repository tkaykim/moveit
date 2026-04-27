/**
 * 수강권 정책 헬퍼 — 단일 진실 소스
 *
 * B-4 (2026-04-27): 1회권 판별이 클라이언트(book/session)와 서버(payment-order /
 * bank-transfer-order) 5곳에 흩어져 기준이 어긋나 있던 문제를 해결.
 *
 * 정책(시스템 불변식):
 * - 1회권만 비회원 결제 허용 (단건 거래 → user_id 없이도 추적 부담 0)
 * - 횟수권/기간제는 회원 강제 (잔여·기간 조회는 user_id 기반)
 *
 * 업계 패턴(Eventbrite, Booking.com, ROLLER, paidmembershipspro):
 * "단건 거래는 게스트 OK, 다회·정기는 계정 필수" 일관.
 */

interface TicketPolicyInput {
  ticket_type: 'COUNT' | 'PERIOD' | string;
  total_count: number | null;
}

interface CountOptionInput {
  count?: number | null;
}

/**
 * 비회원 결제 허용 여부.
 *
 * count_options를 가진 ticket의 경우 선택된 옵션의 count로 판별.
 * 이로써 "1ticket × 4·8회 옵션" 묶음 상품에서 1회 옵션 결제만 비회원 OK,
 * 4·8회 옵션은 자동 차단.
 */
export function isGuestEligibleTicket(
  ticket: TicketPolicyInput,
  selectedOption?: CountOptionInput | null,
): boolean {
  if (ticket.ticket_type !== 'COUNT') return false;
  const effective = selectedOption?.count ?? ticket.total_count ?? 0;
  return effective === 1;
}

/**
 * 멤버십 ticket 식별 — 잔여/기간 조회가 필요해 회원만 구매 가능한 상품.
 *
 * UI 라벨/안내문에서 "회원가입 후 구매 가능"을 표시할 때 사용.
 */
export function isMembershipOnlyTicket(
  ticket: TicketPolicyInput,
  selectedOption?: CountOptionInput | null,
): boolean {
  return !isGuestEligibleTicket(ticket, selectedOption);
}
