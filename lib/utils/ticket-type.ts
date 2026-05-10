/**
 * tickets.ticket_type 컬럼이 운영 DB 에서 'count'(소문자) 와 'COUNT'(대문자) 가 혼재해
 * 들어가 있어 코드의 직접 비교(`=== 'COUNT'`)가 mismatch 를 일으키는 사고가 있었다.
 * 모든 비교는 이 헬퍼를 통해 case-insensitive 로 처리한다.
 */

export type TicketTypeNormalized = 'COUNT' | 'PERIOD' | null;

export function normalizeTicketType(value?: string | null): TicketTypeNormalized {
  if (!value) return null;
  const upper = String(value).toUpperCase();
  if (upper === 'COUNT' || upper === 'PERIOD') return upper;
  return null;
}

export function isCountTicket(value?: string | null): boolean {
  return normalizeTicketType(value) === 'COUNT';
}

export function isPeriodTicket(value?: string | null): boolean {
  return normalizeTicketType(value) === 'PERIOD';
}
