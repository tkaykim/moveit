/**
 * 커버리지(수강권이 이 수업을 커버하는가) — 단일 정본 (T2)
 *
 * 우선순위 체인 (앞이 이기면 뒤는 보지 않는다):
 *   ① ticket_classes  : 해당 ticket 에 매핑 row 가 "하나라도" 있으면 이 계층이 결론을 낸다.
 *   ② ticket_coverage : class_group 단위 (is_active = true)
 *   ③ 레거시          : tickets.is_general 기반 (하위 호환)
 *
 * 불변 규칙:
 *   - classes.class_group_id IS NULL → 애초에 예약 불가 (어떤 수강권으로도).
 *   - class_groups.is_special = true → ③ 레거시(일반권/올패스)로는 절대 커버되지 않는다.
 *     오직 ①(수업 명시 매핑) 또는 ②(그 그룹을 명시적으로 커버) 로만 가능.
 */

export type CoverageTier = 'TICKET_CLASSES' | 'TICKET_COVERAGE' | 'LEGACY';

export interface CoverageClassContext {
  id: string;
  academyId: string;
  classGroupId: string | null;
  /** 그 class_group 의 is_special */
  groupIsSpecial: boolean;
}

export interface CoverageTicketContext {
  id: string;
  academyId: string | null;
  isGeneral: boolean;
  /** tickets.class_id (레거시 단일 수업 전용권) */
  classId: string | null;
  /** 이 ticket 에 매핑된 ticket_classes.class_id 목록 (없으면 빈 배열) */
  mappedClassIds: string[];
  /** 이 ticket 의 활성 ticket_coverage.class_group_id 목록 (없으면 빈 배열) */
  coveredClassGroupIds: string[];
}

export type CoverageDenyReason =
  | 'CLASS_NOT_BOOKABLE' // class_group_id 없음
  | 'ACADEMY_MISMATCH'
  | 'NOT_MAPPED_TO_CLASS' // ① 계층에서 탈락
  | 'GROUP_NOT_COVERED' // ② 계층에서 탈락
  | 'SPECIAL_CLASS_REQUIRES_EXPLICIT_COVERAGE'
  | 'LEGACY_NOT_COVERED';

export interface CoverageResult {
  covered: boolean;
  tier: CoverageTier | null;
  reason: CoverageDenyReason | null;
}

export function evaluateCoverage(
  ticket: CoverageTicketContext,
  klass: CoverageClassContext
): CoverageResult {
  // 불변 규칙 0: 그룹 미지정 수업은 예약 대상이 아니다.
  if (!klass.classGroupId) {
    return { covered: false, tier: null, reason: 'CLASS_NOT_BOOKABLE' };
  }

  // 학원 불일치 (수강권이 특정 학원 소속인 경우에만 검사)
  if (ticket.academyId && ticket.academyId !== klass.academyId) {
    return { covered: false, tier: null, reason: 'ACADEMY_MISMATCH' };
  }

  // ① ticket_classes — row 가 하나라도 있으면 이 계층이 결론
  if (ticket.mappedClassIds.length > 0) {
    const covered = ticket.mappedClassIds.includes(klass.id);
    return {
      covered,
      tier: 'TICKET_CLASSES',
      reason: covered ? null : 'NOT_MAPPED_TO_CLASS',
    };
  }

  // ② ticket_coverage — 활성 row 가 하나라도 있으면 이 계층이 결론
  if (ticket.coveredClassGroupIds.length > 0) {
    const covered = ticket.coveredClassGroupIds.includes(klass.classGroupId);
    return {
      covered,
      tier: 'TICKET_COVERAGE',
      reason: covered ? null : 'GROUP_NOT_COVERED',
    };
  }

  // ③ 레거시 — 스페셜 그룹은 여기서 절대 통과 불가
  if (klass.groupIsSpecial) {
    return {
      covered: false,
      tier: 'LEGACY',
      reason: 'SPECIAL_CLASS_REQUIRES_EXPLICIT_COVERAGE',
    };
  }
  if (ticket.isGeneral) {
    return { covered: true, tier: 'LEGACY', reason: null };
  }
  if (ticket.classId && ticket.classId === klass.id) {
    return { covered: true, tier: 'LEGACY', reason: null };
  }
  return { covered: false, tier: 'LEGACY', reason: 'LEGACY_NOT_COVERED' };
}

export function isCovered(
  ticket: CoverageTicketContext,
  klass: CoverageClassContext
): boolean {
  return evaluateCoverage(ticket, klass).covered;
}
