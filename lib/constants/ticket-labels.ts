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

/** 카테고리별 기본 설명 (학원별 커스텀 미설정 시 사용) */
export const DEFAULT_TICKET_DESCRIPTIONS: Record<TicketCategoryKey, string> = {
  regular: '구매 시 시작일 선택, 기간 내 무제한 수강',
  popup: '유효기간 내 미소진 시 잔여 수량 소멸',
  workshop: '해당 워크샵에서만 사용 가능',
};

export function getTicketLabel(
  category: TicketCategoryKey,
  customLabels: { regular?: string | null; popup?: string | null; workshop?: string | null } | null | undefined
): string {
  const custom = customLabels?.[category];
  if (custom != null && String(custom).trim()) return String(custom).trim();
  return DEFAULT_TICKET_LABELS[category];
}

export function getTicketDescription(
  category: TicketCategoryKey,
  customDescriptions: { regular?: string | null; popup?: string | null; workshop?: string | null } | null | undefined
): string {
  const custom = customDescriptions?.[category];
  if (custom != null && String(custom).trim()) return String(custom).trim();
  return DEFAULT_TICKET_DESCRIPTIONS[category];
}
