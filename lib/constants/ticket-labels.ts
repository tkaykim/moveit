/**
 * 수강권 유형 기본 표기 (학원별 커스텀 미설정 시 사용)
 * DB ticket_category: regular | popup | workshop 는 변경 없음.
 */
export const DEFAULT_TICKET_LABELS = {
  regular: '기간제 수강권',
  popup: '쿠폰제(횟수제) 수강권',
  workshop: '워크샵(특강) 수강권',
} as const;

export type TicketCategoryKey = keyof typeof DEFAULT_TICKET_LABELS;

/** 표기 입력 최대 글자 수 (레이아웃·가독성) */
export const TICKET_LABEL_MAX_LENGTH = 20;

export function getTicketLabel(
  category: TicketCategoryKey,
  customLabels: { regular?: string | null; popup?: string | null; workshop?: string | null } | null | undefined
): string {
  const custom = customLabels?.[category];
  if (custom != null && String(custom).trim()) return String(custom).trim();
  return DEFAULT_TICKET_LABELS[category];
}
