/**
 * 미니앱 주간 계산 (T10) — 서버·클라이언트가 **같은 주**를 가리키게 하는 단일 정본.
 * 주는 KST 기준 일요일 00:00 에 시작한다.
 */
import { kstDateString, kstDateTimeToUtc, addDays } from '@/lib/date/kst';

/** 허용 범위를 넘는 오프셋은 잘라낸다(무한 과거·미래 조회 방지) */
export const MIN_WEEK_OFFSET = -4;
export const MAX_WEEK_OFFSET = 8;

export function clampWeekOffset(raw: number): number {
  if (!Number.isFinite(raw)) return 0;
  return Math.max(MIN_WEEK_OFFSET, Math.min(MAX_WEEK_OFFSET, Math.trunc(raw)));
}

/** KST 기준 "이번 주 일요일 00:00" 에서 offset 주만큼 이동한 시각(UTC Date) */
export function weekStartFromOffset(offset: number, now: Date = new Date()): Date {
  const clamped = clampWeekOffset(offset);
  const todayKst = kstDateString(now);
  // KST 요일: UTC+9 로 옮긴 뒤 UTC 요일을 읽는다.
  const kstDow = new Date(now.getTime() + 9 * 3600_000).getUTCDay();
  const sunday = addDays(todayKst, -kstDow + clamped * 7);
  return kstDateTimeToUtc(sunday, '00:00');
}
