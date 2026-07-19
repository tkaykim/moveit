/**
 * 예약 정책(booking_policy) 해석 — 단일 정본 (T2)
 *
 * 저장 위치: academies.booking_policy (학원 기본값) / classes.booking_policy (수업 오버라이드)
 * 병합은 **필드 단위**. 수업이 open 만 정의하면 close/cancelUntil 은 학원값을 그대로 쓴다.
 *
 * 모든 값은 데이터다. 특정 학원용 상수를 코드에 박지 않는다.
 */
import { kstDateString, kstDateTimeToUtc, addDays, type DateString } from '@/lib/date/kst';

export interface BookingOpenRule {
  /** 수업일 기준 며칠 전에 열리는가 (0 = 당일) */
  daysBefore: number;
  /** 그 날 몇 시에 열리는가 (KST, "HH:mm") */
  time: string;
}

export interface BookingCloseRule {
  /** 수업 시작 몇 분 전에 닫히는가 (0 = 시작 시각까지) */
  minutesBefore: number;
}

export interface BookingCancelRule {
  /** 수업 시작 몇 분 전까지 취소 가능한가 (0 = 시작 시각까지) */
  minutesBefore: number;
}

export interface BookingPolicy {
  /** null = 항상 열림 */
  open: BookingOpenRule | null;
  close: BookingCloseRule;
  cancelUntil: BookingCancelRule;
}

/** 정책이 전혀 없을 때의 기본값: 항상 열림 / 시작시각에 마감 / 시작시각까지 취소 가능 */
export const DEFAULT_BOOKING_POLICY: BookingPolicy = {
  open: null,
  close: { minutesBefore: 0 },
  cancelUntil: { minutesBefore: 0 },
};

function parseOpen(raw: any): BookingOpenRule | null | undefined {
  if (raw === undefined) return undefined; // 미정의 = 상위값 유지
  if (raw === null) return null; // 명시적 null = 항상 열림
  const daysBefore = Number(raw.daysBefore);
  const time = typeof raw.time === 'string' ? raw.time : null;
  if (!Number.isFinite(daysBefore) || !time) return null;
  return { daysBefore, time };
}

function parseMinutesBefore(raw: any): number | undefined {
  if (raw === undefined || raw === null) return undefined;
  const v = Number(raw.minutesBefore);
  return Number.isFinite(v) ? v : undefined;
}

/**
 * 학원 기본값 → 수업 오버라이드를 필드 단위로 병합.
 */
export function resolveBookingPolicy(
  academyPolicy: unknown,
  classPolicy: unknown
): BookingPolicy {
  const layers = [academyPolicy, classPolicy];
  const result: BookingPolicy = { ...DEFAULT_BOOKING_POLICY };

  for (const layer of layers) {
    if (!layer || typeof layer !== 'object') continue;
    const raw = layer as Record<string, unknown>;

    const open = parseOpen(raw.open);
    if (open !== undefined) result.open = open;

    const close = parseMinutesBefore(raw.close);
    if (close !== undefined) result.close = { minutesBefore: close };

    const cancel = parseMinutesBefore(raw.cancelUntil);
    if (cancel !== undefined) result.cancelUntil = { minutesBefore: cancel };
  }

  return result;
}

/** 예약 오픈 시각. null = 항상 열려 있음. */
export function bookingOpenAt(
  scheduleStart: Date | string,
  policy: BookingPolicy
): Date | null {
  if (!policy.open) return null;
  const classDate: DateString = kstDateString(scheduleStart);
  const openDate = addDays(classDate, -policy.open.daysBefore);
  return kstDateTimeToUtc(openDate, policy.open.time);
}

/** 예약 마감 시각 */
export function bookingCloseAt(
  scheduleStart: Date | string,
  policy: BookingPolicy
): Date {
  const start = scheduleStart instanceof Date ? scheduleStart : new Date(scheduleStart);
  return new Date(start.getTime() - policy.close.minutesBefore * 60000);
}

/** 취소 마감 시각 */
export function cancelDeadlineAt(
  scheduleStart: Date | string,
  policy: BookingPolicy
): Date {
  const start = scheduleStart instanceof Date ? scheduleStart : new Date(scheduleStart);
  return new Date(start.getTime() - policy.cancelUntil.minutesBefore * 60000);
}

export type BookingWindowState = 'OPEN' | 'NOT_YET_OPEN' | 'CLOSED';

/** 지금이 예약 가능한 창(window) 안인지 */
export function evaluateBookingWindow(
  scheduleStart: Date | string,
  policy: BookingPolicy,
  now: Date = new Date()
): BookingWindowState {
  const openAt = bookingOpenAt(scheduleStart, policy);
  if (openAt && now.getTime() < openAt.getTime()) return 'NOT_YET_OPEN';
  const closeAt = bookingCloseAt(scheduleStart, policy);
  if (now.getTime() >= closeAt.getTime()) return 'CLOSED';
  return 'OPEN';
}

// ---------------------------------------------------------------------------
// 저장 전 형태 검증 (T8)
//
// resolveBookingPolicy 는 **읽기**용이라 관대하다 — 이상한 값은 조용히 기본값으로
// 흡수한다. 그 관대함이 쓰기 경로에까지 적용되면, 운영자가 오타를 낸 정책이
// 아무 경고 없이 저장되고 학생 예약 시점에야 엉뚱하게 동작한다.
// 그래서 **쓰기 경로에서만** 아래 엄격 검증을 통과해야 저장할 수 있게 한다.
// ---------------------------------------------------------------------------

const POLICY_KEYS = new Set(['open', 'close', 'cancelUntil']);
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

export interface PolicyValidation {
  ok: boolean;
  errors: string[];
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function checkMinutesBefore(raw: unknown, field: string, errors: string[]): void {
  if (raw === undefined) return;
  if (!isPlainObject(raw)) {
    errors.push(`${field} 는 { minutesBefore } 객체여야 합니다.`);
    return;
  }
  for (const k of Object.keys(raw)) {
    if (k !== 'minutesBefore') errors.push(`${field}.${k} 는 허용되지 않는 항목입니다.`);
  }
  const v = raw.minutesBefore;
  if (typeof v !== 'number' || !Number.isFinite(v) || !Number.isInteger(v) || v < 0) {
    errors.push(`${field}.minutesBefore 는 0 이상의 정수여야 합니다.`);
  }
}

/**
 * classes.booking_policy / academies.booking_policy 에 저장해도 되는 형태인지.
 * null 과 {} 는 허용한다(= 상위값을 그대로 쓴다는 뜻).
 */
export function validateBookingPolicyShape(raw: unknown): PolicyValidation {
  const errors: string[] = [];

  if (raw === null || raw === undefined) return { ok: true, errors };
  if (!isPlainObject(raw)) {
    return { ok: false, errors: ['booking_policy 는 객체이거나 null 이어야 합니다.'] };
  }

  for (const k of Object.keys(raw)) {
    if (!POLICY_KEYS.has(k)) errors.push(`${k} 는 허용되지 않는 항목입니다.`);
  }

  if ('open' in raw) {
    const open = raw.open;
    if (open !== null) {
      if (!isPlainObject(open)) {
        errors.push('open 은 { daysBefore, time } 객체이거나 null 이어야 합니다.');
      } else {
        for (const k of Object.keys(open)) {
          if (k !== 'daysBefore' && k !== 'time') {
            errors.push(`open.${k} 는 허용되지 않는 항목입니다.`);
          }
        }
        const d = open.daysBefore;
        if (typeof d !== 'number' || !Number.isInteger(d) || d < 0) {
          errors.push('open.daysBefore 는 0 이상의 정수여야 합니다.');
        }
        if (typeof open.time !== 'string' || !HHMM.test(open.time)) {
          errors.push('open.time 은 "HH:mm" 형식이어야 합니다.');
        }
      }
    }
  }

  checkMinutesBefore(raw.close, 'close', errors);
  checkMinutesBefore(raw.cancelUntil, 'cancelUntil', errors);

  return { ok: errors.length === 0, errors };
}

/** 지금 취소하면 횟수를 복구해줄 수 있는 시점인지 (서버 판정 전용) */
export function isWithinCancelDeadline(
  scheduleStart: Date | string,
  policy: BookingPolicy,
  now: Date = new Date()
): boolean {
  return now.getTime() < cancelDeadlineAt(scheduleStart, policy).getTime();
}
