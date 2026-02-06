export type ExclusiveDisplayInput = {
  /**
   * 클래스에 연결된 수강권 이름들 (ticket_classes 기반).
   * 가능하면 DB 내부 코드(requiredGroup 등) 대신 이 값을 우선 사용합니다.
   */
  ticketNames?: Array<string | null | undefined>;
  /**
   * 레거시/보조 제한값: tickets.access_group 과 classes.access_config.requiredGroup 을 맞춰 쓰던 코드값.
   */
  requiredGroup?: string | null | undefined;
};

const ACCESS_GROUP_LABELS_KO: Record<string, string> = {
  // 많이 쓰는 값들(마이그레이션/시드 기준)
  general: '일반',
  regular: '정규',
  popup: '팝업',
  workshop: '워크샵',
  advanced: '심화',
  training: '트레이닝',
};

export function getAccessGroupLabelKo(group: string | null | undefined) {
  if (!group) return '';
  const key = String(group).trim();
  if (!key) return '';
  return ACCESS_GROUP_LABELS_KO[key] || key;
}

export function formatExclusiveClassText(input: ExclusiveDisplayInput) {
  const names = (input.ticketNames || [])
    .map((n) => (typeof n === 'string' ? n.trim() : ''))
    .filter(Boolean);

  if (names.length > 0) {
    // 너무 길어지면 앞 2개만 + N개 형태로 축약
    const max = 2;
    const visible = names.slice(0, max);
    const rest = names.length - visible.length;
    const label = rest > 0 ? `${visible.join(', ')} 외 ${rest}개` : visible.join(', ');
    return `수강권: ${label} 전용`;
  }

  if (input.requiredGroup) {
    const label = getAccessGroupLabelKo(input.requiredGroup);
    // 내부 코드(raw) 노출 최소화: label이 코드와 동일해도 "그룹"을 명시
    return `수강권 그룹: ${label} 전용`;
  }

  return null;
}

