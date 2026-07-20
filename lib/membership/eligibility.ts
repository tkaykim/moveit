/**
 * 멤버십 자격(audience) 판정 — 순수 규칙 (T3)
 *
 * SQL 쪽 정본은 public.has_active_membership() 이고,
 * create_booking_tx 도 그 함수를 호출한다(규칙 중복 없음).
 * 이 모듈은 동일한 규칙의 TS 표현이며, 이미 읽어온 행으로 판정할 때 쓴다.
 */
import type { DateString } from '@/lib/date/kst';
import type { MembershipStatus } from '@/lib/membership/discount';

export interface StudentMembershipRow {
  id: string;
  academy_id: string;
  user_id: string;
  membership_id: string;
  status: MembershipStatus;
  start_date: DateString;
  end_date: DateString | null;
}

/**
 * 그 날짜에 유효한 ACTIVE 멤버십인가.
 * SUSPENDED / EXPIRED 는 할인도 자격도 주지 않는다 — 유일한 판정 지점.
 */
export function isMembershipActiveOn(row: StudentMembershipRow, onDate: DateString): boolean {
  if (row.status !== 'ACTIVE') return false;
  if (row.start_date > onDate) return false;
  if (row.end_date && row.end_date < onDate) return false;
  return true;
}

/** 멤버십 전용 수업에 접근 가능한가 */
export function canAccessMembershipClass(
  memberships: StudentMembershipRow[],
  requiredMembershipId: string | null,
  onDate: DateString
): boolean {
  if (!requiredMembershipId) return true; // 제한 없는 수업
  return memberships.some(
    (m) => m.membership_id === requiredMembershipId && isMembershipActiveOn(m, onDate)
  );
}

/** 그 학원에서 현재 유효한 멤버십 1건 (부분 유니크 인덱스상 최대 1건) */
export function activeMembershipFor(
  memberships: StudentMembershipRow[],
  academyId: string,
  onDate: DateString
): StudentMembershipRow | null {
  return (
    memberships.find((m) => m.academy_id === academyId && isMembershipActiveOn(m, onDate)) ?? null
  );
}
