/**
 * KST(UTC+9) 날짜/시각 단일 정본 (T2)
 *
 * 기존 코드 곳곳의 `new Date().toISOString().split('T')[0]` (= UTC 기준 날짜) 를
 * 대체한다. 신규 로직(예약 정책 / 만료 / 커버리지)은 반드시 이 모듈만 사용한다.
 *
 * ⚠ 만료 규칙이 두 가지 존재한다 — 혼동 금지.
 *   - inclusiveExpiry : start + valid_days - 1  (T2 명세의 신규 규칙, "당일 포함")
 *   - legacyExpiry    : start + valid_days      (운영 DB 에 이미 저장된 기존 규칙)
 * 기존 user_tickets 의 저장값 의미는 절대 바꾸지 않는다. 신규 발급(FIRST_BOOKING 등)에만
 * inclusiveExpiry 를 쓴다.
 */

export const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** YYYY-MM-DD 문자열 */
export type DateString = string;

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** 임의 시각을 KST 기준 벽시계 필드로 변환 */
export function kstParts(input: Date | string | number): {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
} {
  const d = input instanceof Date ? input : new Date(input);
  const shifted = new Date(d.getTime() + KST_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
  };
}

/** 임의 시각의 KST 달력 날짜 (YYYY-MM-DD) */
export function kstDateString(input: Date | string | number): DateString {
  const p = kstParts(input);
  return `${p.year}-${pad2(p.month)}-${pad2(p.day)}`;
}

/** KST 기준 "오늘" */
export function kstToday(now: Date = new Date()): DateString {
  return kstDateString(now);
}

/** 스케줄(schedules.start_time) 의 KST 수업일 */
export function scheduleKstDate(startTime: Date | string): DateString {
  return kstDateString(startTime);
}

/** KST 벽시계(날짜 + HH:mm) → 절대시각(UTC Date) */
export function kstDateTimeToUtc(date: DateString, time: string): Date {
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  return new Date(Date.UTC(y, m - 1, d, hh || 0, mm || 0, 0, 0) - KST_OFFSET_MS);
}

/** YYYY-MM-DD 에 일수 가감 (달력 기준, 시간대 무관) */
export function addDays(date: DateString, days: number): DateString {
  const [y, m, d] = date.split('-').map(Number);
  const t = Date.UTC(y, m - 1, d) + days * 86400000;
  const r = new Date(t);
  return `${r.getUTCFullYear()}-${pad2(r.getUTCMonth() + 1)}-${pad2(r.getUTCDate())}`;
}

/** 두 날짜의 일수 차 (a - b) */
export function diffDays(a: DateString, b: DateString): number {
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  return Math.round((Date.UTC(ay, am - 1, ad) - Date.UTC(by, bm - 1, bd)) / 86400000);
}

/**
 * 신규 규칙: 시작일 당일을 포함하는 만료일.
 * valid_days = 1 이면 만료일 = 시작일 (당일 하루만 유효).
 */
export function inclusiveExpiry(start: DateString, validDays: number): DateString {
  return addDays(start, validDays - 1);
}

/**
 * 레거시 규칙(운영 DB 기존 저장값): 만료일 = 시작일 + valid_days.
 * 기존 수강권 검증/회귀 테스트 전용. 신규 발급에는 쓰지 않는다.
 */
export function legacyExpiry(start: DateString, validDays: number): DateString {
  return addDays(start, validDays);
}

/**
 * 달력 개월 만료 (tickets.valid_months).
 * 시작일 + N개월 - 1일. 말일은 해당 월의 마지막 날로 clamp.
 * 예: 2026-01-31 + 1개월 → 2026-02-28 - 1일 → 2026-02-27
 */
export function monthsExpiry(start: DateString, validMonths: number): DateString {
  const [y, m, d] = start.split('-').map(Number);
  const targetMonthIndex = m - 1 + validMonths;
  const targetYear = y + Math.floor(targetMonthIndex / 12);
  const targetMonth = ((targetMonthIndex % 12) + 12) % 12;
  const lastDayOfTarget = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  const clampedDay = Math.min(d, lastDayOfTarget);
  const anchor = `${targetYear}-${pad2(targetMonth + 1)}-${pad2(clampedDay)}`;
  return addDays(anchor, -1);
}

/** 수업일(KST) 이 만료일 이내인지 — 만료일 당일은 유효 */
export function isWithinExpiry(classDate: DateString, expiry: DateString | null): boolean {
  if (!expiry) return true; // 무기한
  return diffDays(classDate, expiry) <= 0;
}

/** 수업일(KST) 이 시작일 이후인지 — 시작일 당일은 유효 */
export function isAfterStart(classDate: DateString, start: DateString | null): boolean {
  if (!start) return true;
  return diffDays(classDate, start) >= 0;
}
