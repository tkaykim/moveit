import { normalizeTicketType } from '@/lib/utils/ticket-type';

/**
 * 수강권 표기는 **ticket_type 기준**이다 (COUNT / PERIOD).
 * 레거시 category 기반 DEFAULT_TICKET_LABELS(regular/popup/workshop)는 오분류가 알려져 있어 쓰지 않는다.
 */
export function ticketTypeLabel(ticketType?: string | null): string {
  const t = normalizeTicketType(ticketType);
  if (t === 'COUNT') return '횟수제';
  if (t === 'PERIOD') return '기간제';
  return '수강권';
}

export function isCountType(ticketType?: string | null): boolean {
  return normalizeTicketType(ticketType) === 'COUNT';
}
