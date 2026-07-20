/**
 * T7 검증 — 환불 프리셋 · 보강 스태프 API · 휴강(CLASS_CANCELED) 전파
 *
 * 실행: npx playwright test tests/refund-closure.spec.ts --workers=1
 *
 * 픽스처는 전용 테스트 학원(slug: t7-rc-*) 안에서만 만들고 끝나면 지운다.
 * 실제 MID 학원(slug: mid) 데이터는 절대 건드리지 않는다.
 *
 * 이 스펙의 핵심 방어선은 B 그룹(하위호환)이다:
 *   환불 계산은 돈이 오가는 경로다. 프리셋을 얹으면서 **기존 수강권의 산출값이
 *   1원이라도 달라지면** 이미 고지된 조건과 어긋난다. B 그룹은 T7 이전 엔진의
 *   사본(tests/fixtures/refund-calc-legacy.ts)을 실제로 실행해 현재 엔진과
 *   출력을 통째로 대조한다. 손으로 적은 기대값이 아니라 옛 코드 그 자체가 기준이다.
 */
import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

import { computeRefund, type RefundCalcInput } from '../lib/refund/calc';
import { computeRefund as legacyComputeRefund } from './fixtures/refund-calc-legacy';
import { resolveRefundPreset, statutoryPresetForCategory } from '../lib/refund/presets';
import { processClassCanceledEvents, buildClassCancelMessage } from '../lib/booking/class-cancel';

// --- env ---
const env = Object.fromEntries(
  readFileSync(path.join(process.cwd(), '.env.local'), 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=');
      let v = l.slice(i + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      return [l.slice(0, i).trim(), v];
    })
);
for (const [k, v] of Object.entries(env)) {
  if (process.env[k] === undefined) process.env[k] = v as string;
}

const svc = createClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
}) as any;

const STUDENT_ID = 'fd2fd033-2f2c-4cad-890b-f2c9c75a0f23'; // e2e-moveit-student@modoogoods.com
const OWNER_ID = '6e33f238-14c6-41d7-9715-d131067b6885'; // e2e-moveit-owner@modoogoods.com
const STUDENT_EMAIL = 'e2e-moveit-student@modoogoods.com';
const OWNER_EMAIL = 'e2e-moveit-owner@modoogoods.com';
const E2E_PASSWORD = 'Test1234!e2e';

const F: Record<string, any> = {};
const academyIds: string[] = [];
const stamp = randomUUID().slice(0, 8);

async function ins(table: string, row: Record<string, any>) {
  const { data, error } = await svc.from(table).insert(row).select().single();
  if (error) throw new Error(`${table} insert 실패: ${error.message}`);
  return data;
}

function isoInHours(h: number) {
  return new Date(Date.now() + h * 3600_000).toISOString();
}

const dayCursors: Record<string, number> = {};
async function newSchedule(classId: string, maxStudents = 10, dayOffset?: number) {
  const d = dayOffset ?? (dayCursors[classId] = (dayCursors[classId] ?? 1) + 1);
  const h = 24 * d;
  return ins('schedules', {
    class_id: classId,
    start_time: isoInHours(h),
    end_time: isoInHours(h + 1),
    max_students: maxStudents,
    is_canceled: false,
  });
}

/** KST 기준 '월' 키 (YYYY-MM) — 보강 월 1회 판정과 같은 기준 */
function kstMonthKey(dayOffset: number) {
  const t = new Date(Date.now() + dayOffset * 86400_000 + 9 * 3600_000);
  return t.toISOString().slice(0, 7);
}

/** 연속 n일이 같은 KST 달에 들어가는 시작 오프셋 (월말 경계에서 "월 1회"가 헛통과하는 것을 막는다) */
function sameMonthRun(length: number, minOffset = 3) {
  for (let base = minOffset; base < minOffset + 40; base++) {
    const m = kstMonthKey(base);
    let ok = true;
    for (let i = 1; i < length; i++) {
      if (kstMonthKey(base + i) !== m) { ok = false; break; }
    }
    if (ok) return base;
  }
  throw new Error('같은 달에 들어가는 연속 구간을 찾지 못했다');
}

async function getUserTicket(id: string) {
  const { data } = await svc.from('user_tickets').select('*').eq('id', id).single();
  return data;
}

async function classCanceledEvents(scheduleId: string) {
  const { data } = await svc
    .from('booking_events')
    .select('*')
    .eq('schedule_id', scheduleId)
    .eq('event_type', 'CLASS_CANCELED');
  return data ?? [];
}

async function restorations(scheduleId: string) {
  const { data } = await svc
    .from('class_cancel_restorations')
    .select('*')
    .eq('schedule_id', scheduleId);
  return data ?? [];
}

async function notificationsFor(userId: string, since: string) {
  const { data } = await svc
    .from('notifications')
    .select('id, type, title, body, created_at')
    .eq('user_id', userId)
    .eq('type', 'class_cancelled')
    .gte('created_at', since);
  return data ?? [];
}

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  F.startedAt = new Date(Date.now() - 5000).toISOString();

  F.academy = await ins('academies', {
    name_kr: `T7환불마감-${stamp}`,
    slug: `t7-rc-${stamp}`,
    is_active: true,
    booking_policy: { open: null, close: { minutesBefore: 0 }, cancelUntil: { minutesBefore: 0 } },
  });
  academyIds.push(F.academy.id);

  F.group = await ins('class_groups', {
    academy_id: F.academy.id, key: 'normal', name: '정규', is_special: false,
  });

  // 휴강 전파 검증용 수업 3종
  F.cCount = await ins('classes', {
    academy_id: F.academy.id, title: '횟수제수업', class_group_id: F.group.id,
    max_students: 10, is_active: true, class_type: 'regular',
  });
  F.cPeriod = await ins('classes', {
    academy_id: F.academy.id, title: '고정주1회수업', class_group_id: F.group.id,
    max_students: 10, is_active: true, class_type: 'regular',
  });
  F.cEmpty = await ins('classes', {
    academy_id: F.academy.id, title: '예약없는수업', class_group_id: F.group.id,
    max_students: 10, is_active: true, class_type: 'regular',
  });
  // 보강 검증용 (T6 규칙 재사용)
  F.cMakeup = await ins('classes', {
    academy_id: F.academy.id, title: '보강고정수업', class_group_id: F.group.id,
    max_students: 10, is_active: true, class_type: 'regular',
  });
  F.cTerm = await ins('classes', {
    academy_id: F.academy.id, title: '3개월고정수업', class_group_id: F.group.id,
    max_students: 10, is_active: true, class_type: 'regular',
  });

  // 상품
  F.tCount = await ins('tickets', {
    academy_id: F.academy.id, name: '10회권', ticket_type: 'COUNT',
    price: 250000, total_count: 10, valid_days: 60,
    is_general: true, is_on_sale: true, is_public: true,
  });
  F.tFixedWeekly = await ins('tickets', {
    academy_id: F.academy.id, name: '고정 주1회(기간제)', ticket_type: 'PERIOD',
    price: 120000, valid_days: 30,
    is_fixed_weekly: true, start_mode: 'IMMEDIATE',
    is_general: true, is_on_sale: true, is_public: true,
  });
  F.tMakeupMonthly = await ins('tickets', {
    academy_id: F.academy.id, name: '고정 주1회 (월)', ticket_type: 'COUNT',
    price: 120000, total_count: 4, valid_months: 1,
    is_fixed_weekly: true, start_mode: 'IMMEDIATE',
    is_general: true, is_on_sale: true, is_public: true,
  });
  F.tMakeupTerm = await ins('tickets', {
    academy_id: F.academy.id, name: '고정 주1회 (3개월)', ticket_type: 'COUNT',
    price: 330000, total_count: 12, valid_months: 3,
    is_fixed_weekly: true, start_mode: 'IMMEDIATE',
    is_general: true, is_on_sale: true, is_public: true,
  });

  // 로그인 토큰 (관리자 API HTTP 검증용)
  const anonClient = () =>
    createClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    }) as any;

  const stu = anonClient();
  const sAuth = await stu.auth.signInWithPassword({ email: STUDENT_EMAIL, password: E2E_PASSWORD });
  expect(sAuth.error).toBeNull();
  F.studentToken = sAuth.data.session.access_token;

  const own = anonClient();
  const oAuth = await own.auth.signInWithPassword({ email: OWNER_EMAIL, password: E2E_PASSWORD });
  expect(oAuth.error).toBeNull();
  F.ownerToken = oAuth.data.session.access_token;

  // 소유자를 이 테스트 학원의 관리자로 등록
  await svc.from('academy_user_roles').insert({
    academy_id: F.academy.id, user_id: OWNER_ID, role: 'ACADEMY_OWNER',
  });
});

test.afterAll(async () => {
  if (academyIds.length === 0) return;

  const { data: cls } = await svc.from('classes').select('id').in('academy_id', academyIds);
  const classIds = (cls ?? []).map((c: any) => c.id);

  await svc.from('class_cancel_restorations').delete().in('academy_id', academyIds);
  await svc.from('refund_proposals').delete().in('academy_id', academyIds);
  await svc.from('makeup_grants').delete().in('academy_id', academyIds);
  await svc.from('fixed_weekly_placement_issues').delete().in('academy_id', academyIds);
  await svc.from('booking_events').delete().in('academy_id', academyIds);
  await svc.from('enrollment_activity_log').delete().in('academy_id', academyIds);
  await svc.from('revenue_transactions').delete().in('academy_id', academyIds);
  if (classIds.length > 0) await svc.from('bookings').delete().in('class_id', classIds);

  const { data: tks } = await svc.from('tickets').select('id').in('academy_id', academyIds);
  const ticketIds = (tks ?? []).map((t: any) => t.id);
  if (ticketIds.length > 0) {
    await svc.from('user_tickets').delete().in('ticket_id', ticketIds);
    await svc.from('ticket_coverage').delete().in('ticket_id', ticketIds);
    await svc.from('ticket_classes').delete().in('ticket_id', ticketIds);
  }

  if (classIds.length > 0) await svc.from('schedules').delete().in('class_id', classIds);
  await svc.from('classes').delete().in('academy_id', academyIds);
  await svc.from('tickets').delete().in('academy_id', academyIds);
  await svc.from('class_groups').delete().in('academy_id', academyIds);
  await svc.from('academy_user_roles').delete().in('academy_id', academyIds);
  // 테스트가 만든 알림만 정리
  await svc
    .from('notifications')
    .delete()
    .eq('user_id', STUDENT_ID)
    .eq('type', 'class_cancelled')
    .gte('created_at', F.startedAt);
  await svc.from('academies').delete().in('id', academyIds);
});

// ===========================================================================
// A. 프리셋별 계산 — 산식을 테스트 안에 명시한다
// ===========================================================================

const NOW = '2026-03-11T00:00:00.000Z';

test('A1 ACADEMY_STATUTORY 기간제 · 총 30일 중 5일 경과 → 1/3 경과 전 구간 2/3', () => {
  // 산식: 진행률 5/30 = 0.1667 < 1/3 → 반환율 2/3
  //       100,000 × 2/3 = 66,666.67 → 반올림 66,667
  const r = computeRefund({
    ticketTypeSnapshot: 'PERIOD',
    validDays: 30,
    startDate: '2026-03-06',
    expiryDate: '2026-04-05',
    finalPrice: 100000,
    originalPrice: 100000,
    nowISO: NOW,
    preset: 'ACADEMY_STATUTORY',
  });
  expect(r.presetKey).toBe('ACADEMY_STATUTORY');
  expect(r.paidAmount).toBe(100000);
  expect(r.suggestedRefund).toBe(66667);
});

test('A2 ACADEMY_STATUTORY 기간제 · 교습 시작 전 → 전액', () => {
  // 산식: 경과일 ≤ 0 → 전액 100,000
  const r = computeRefund({
    ticketTypeSnapshot: 'PERIOD',
    validDays: 30,
    startDate: '2026-03-20',
    expiryDate: '2026-04-19',
    finalPrice: 100000,
    nowISO: NOW,
    preset: 'ACADEMY_STATUTORY',
  });
  expect(r.suggestedRefund).toBe(100000);
});

test('A3 ACADEMY_STATUTORY 기간제 · 총 30일 중 20일 경과 → 1/2 경과 후 반환 없음', () => {
  // 산식: 진행률 20/30 = 0.667 ≥ 1/2 → 반환율 0 → 0원
  const r = computeRefund({
    ticketTypeSnapshot: 'PERIOD',
    validDays: 30,
    startDate: '2026-02-19',
    expiryDate: '2026-03-21',
    finalPrice: 100000,
    nowISO: NOW,
    preset: 'ACADEMY_STATUTORY',
  });
  expect(r.suggestedRefund).toBe(0);
});

test('A4 사용분은 정가가 아니라 실결제액에서 나온다 (프리셋 공통 규칙)', () => {
  // 정가 300,000 / 실결제 200,000 / 총 10회 / 출석 3회
  //   프리셋 경로 : 1회 단가 = 결제액 200,000 ÷ 10 = 20,000
  //                환불 = 200,000 − (3 × 20,000) = 140,000
  //   레거시 경로 : 1회 단가 = 정가 300,000 ÷ 10 = 30,000
  //                환불 = 200,000 − (3 × 30,000) = 110,000
  const base: RefundCalcInput = {
    ticketTypeSnapshot: 'COUNT',
    quantity: 10,
    remainingCount: 7,
    attendedCount: 3,
    originalPrice: 300000,
    finalPrice: 200000,
    nowISO: NOW,
  };

  const preset = computeRefund({ ...base, preset: 'ACADEMY_STATUTORY' });
  expect(preset.suggestedRefund).toBe(140000);

  const legacy = computeRefund(base);
  expect(legacy.suggestedRefund).toBe(110000);

  // 정가 기준이 더 많이 깎는다는 사실 자체를 고정해 둔다 (규칙이 뒤집히면 여기서 깨진다)
  expect(preset.suggestedRefund).toBeGreaterThan(legacy.suggestedRefund);
});

test('A5 SPORTS_FACILITY_CONTINUOUS 횟수제 · 이용분 + 위약금 10%', () => {
  // 결제 200,000 / 총 10회 / 출석 3회
  //   이용분  = 200,000 ÷ 10 × 3 = 60,000
  //   위약금  = 200,000 × 10%    = 20,000  (총액의 10% 상한)
  //   환불    = 200,000 − 60,000 − 20,000 = 120,000
  const r = computeRefund({
    ticketTypeSnapshot: 'COUNT',
    quantity: 10,
    remainingCount: 7,
    attendedCount: 3,
    originalPrice: 300000, // 무시돼야 한다 — 이용분은 실결제액 기준
    finalPrice: 200000,
    nowISO: NOW,
    preset: 'SPORTS_FACILITY_CONTINUOUS',
  });
  expect(r.presetKey).toBe('SPORTS_FACILITY_CONTINUOUS');
  expect(r.suggestedRefund).toBe(120000);
});

test('A6 SPORTS_FACILITY_CONTINUOUS 기간제 · 30일 중 6일 경과', () => {
  // 이용비율 6/30 = 0.2 → 이용분 100,000 × 0.2 = 20,000
  // 위약금 100,000 × 10% = 10,000
  // 환불 = 100,000 − 20,000 − 10,000 = 70,000
  const r = computeRefund({
    ticketTypeSnapshot: 'PERIOD',
    validDays: 30,
    startDate: '2026-03-05',
    expiryDate: '2026-04-04',
    finalPrice: 100000,
    nowISO: NOW,
    preset: 'SPORTS_FACILITY_CONTINUOUS',
  });
  expect(r.suggestedRefund).toBe(70000);
});

test('A7 SPORTS_FACILITY_CONTINUOUS · 이용 개시 전이면 위약금 10% 만 공제', () => {
  // 이용분 0 / 위약금 100,000 × 10% = 10,000 → 환불 90,000
  const r = computeRefund({
    ticketTypeSnapshot: 'PERIOD',
    validDays: 30,
    startDate: '2026-03-20',
    expiryDate: '2026-04-19',
    finalPrice: 100000,
    nowISO: NOW,
    preset: 'SPORTS_FACILITY_CONTINUOUS',
  });
  expect(r.suggestedRefund).toBe(90000);
});

test('A8 CUSTOM_STEP · 학원 자체 단계표 (10일 2/3 → 15일 1/2 → 이후 0)', () => {
  // 개시 후 12일 경과 → 12 ≤ 15 구간 적중 → 반환율 0.5
  // 120,000 × 0.5 = 60,000
  const r = computeRefund({
    ticketTypeSnapshot: 'PERIOD',
    startDate: '2026-02-27',
    expiryDate: '2026-03-29',
    validDays: 30,
    finalPrice: 120000,
    nowISO: NOW,
    customPolicy: {
      mode: 'step',
      steps: [
        { until_days: 10, rate: 2 / 3 },
        { until_days: 15, rate: 0.5 },
        { until_days: 99999, rate: 0 },
      ],
    },
    preset: 'CUSTOM_STEP',
  });
  expect(r.presetKey).toBe('CUSTOM_STEP');
  expect(r.suggestedRefund).toBe(60000);
});

test('A9 NON_REFUNDABLE_WHERE_LAWFUL · 당일 소진 1일권 → 0원', () => {
  const r = computeRefund({
    ticketTypeSnapshot: 'COUNT',
    ticketCategory: 'popup',
    quantity: 1,
    remainingCount: 0,
    attendedCount: 1,
    finalPrice: 30000,
    nowISO: NOW,
    preset: 'NON_REFUNDABLE_WHERE_LAWFUL',
  });
  expect(r.presetKey).toBe('NON_REFUNDABLE_WHERE_LAWFUL');
  expect(r.suggestedRefund).toBe(0);
});

test('A10 어떤 프리셋도 카드 수수료를 소비자에게 전가하지 않는다', () => {
  const presets = [
    'ACADEMY_STATUTORY',
    'SPORTS_FACILITY_CONTINUOUS',
    'CUSTOM_STEP',
    'NON_REFUNDABLE_WHERE_LAWFUL',
  ] as const;

  for (const p of presets) {
    const r = computeRefund({
      ticketTypeSnapshot: 'COUNT',
      quantity: 10,
      remainingCount: 10,
      attendedCount: 0,
      originalPrice: 300000,
      finalPrice: 200000,
      nowISO: NOW,
      preset: p,
    });
    // 산정 근거 어디에도 수수료 공제 항목이 없어야 한다
    const labels = r.breakdown.map((b) => b.label).join(' ');
    expect(labels, `${p} 에 수수료 공제 항목이 생겼다`).not.toMatch(/수수료|fee/i);
    // 미사용 상태에서 환불액이 결제액을 밑돌 이유는 위약금(체육시설업)뿐이다
    if (p === 'ACADEMY_STATUTORY') expect(r.suggestedRefund).toBe(200000);
    if (p === 'SPORTS_FACILITY_CONTINUOUS') expect(r.suggestedRefund).toBe(180000); // 10% 위약금만
  }
});

test('A11 법적 우선순위 — 강행법규가 학원 설정을 이긴다', () => {
  // 학원 등록 사업자(우리 대상 학원) → 학원이 뭘 설정했든 학원법 기준
  expect(statutoryPresetForCategory('ACADEMY')).toBe('ACADEMY_STATUTORY');

  const r1 = resolveRefundPreset({
    businessCategory: 'ACADEMY',
    publishedTerms: 'NON_REFUNDABLE_WHERE_LAWFUL',
    configuredPreset: 'CUSTOM_STEP',
  });
  expect(r1.preset).toBe('ACADEMY_STATUTORY');
  expect(r1.source).toBe('STATUTE');

  // 체육시설업 등록이면 그쪽 강행법규
  expect(
    resolveRefundPreset({ businessCategory: 'SPORTS_FACILITY', configuredPreset: 'CUSTOM_STEP' }).preset
  ).toBe('SPORTS_FACILITY_CONTINUOUS');

  // 강행법규가 없는 업종에서만 고지약관 → 학원설정 순으로 내려간다
  const r2 = resolveRefundPreset({ businessCategory: 'OTHER', publishedTerms: 'CUSTOM_STEP', configuredPreset: 'NON_REFUNDABLE_WHERE_LAWFUL' });
  expect(r2.preset).toBe('CUSTOM_STEP');
  expect(r2.source).toBe('PUBLISHED_TERMS');

  const r3 = resolveRefundPreset({ businessCategory: 'OTHER', configuredPreset: 'NON_REFUNDABLE_WHERE_LAWFUL' });
  expect(r3.preset).toBe('NON_REFUNDABLE_WHERE_LAWFUL');
  expect(r3.source).toBe('ACADEMY_PRESET');

  const r4 = resolveRefundPreset({ businessCategory: 'OTHER' });
  expect(r4.preset).toBe('ACADEMY_STATUTORY');
  expect(r4.source).toBe('FALLBACK');
});

// ===========================================================================
// B. 하위호환 — 기존 설정의 산출값은 T7 이전과 완전히 동일해야 한다
// ===========================================================================

/** 실제로 존재하는 상품 형태를 망라한 기존 설정 표본 */
const LEGACY_SAMPLES: { name: string; input: RefundCalcInput }[] = [
  {
    name: '기간제 30일 · 미개시',
    input: { ticketTypeSnapshot: 'PERIOD', validDays: 30, startDate: '2026-03-20', expiryDate: '2026-04-19', finalPrice: 200000, originalPrice: 200000, nowISO: NOW },
  },
  {
    name: '기간제 30일 · 5일 경과',
    input: { ticketTypeSnapshot: 'PERIOD', validDays: 30, startDate: '2026-03-06', expiryDate: '2026-04-05', finalPrice: 200000, originalPrice: 200000, nowISO: NOW },
  },
  {
    name: '기간제 30일 · 12일 경과',
    input: { ticketTypeSnapshot: 'PERIOD', validDays: 30, startDate: '2026-02-27', expiryDate: '2026-03-29', finalPrice: 200000, originalPrice: 200000, nowISO: NOW },
  },
  {
    name: '기간제 30일 · 25일 경과',
    input: { ticketTypeSnapshot: 'PERIOD', validDays: 30, startDate: '2026-02-14', expiryDate: '2026-03-16', finalPrice: 200000, originalPrice: 200000, nowISO: NOW },
  },
  {
    name: '기간제 90일 장기(월할) · 40일 경과',
    input: { ticketTypeSnapshot: 'PERIOD', validDays: 90, startDate: '2026-01-30', expiryDate: '2026-04-30', finalPrice: 330000, originalPrice: 360000, nowISO: NOW },
  },
  {
    name: '기간제 · 유효기간 정보 없음',
    input: { ticketTypeSnapshot: 'PERIOD', startDate: '2026-03-01', finalPrice: 150000, nowISO: NOW },
  },
  {
    name: '횟수제 10회 · 3회 출석 · 정가 할인 있음',
    input: { ticketTypeSnapshot: 'COUNT', quantity: 10, remainingCount: 7, attendedCount: 3, originalPrice: 300000, finalPrice: 250000, expiryDate: '2026-05-01', nowISO: NOW },
  },
  {
    name: '횟수제 10회 · 출석 0 · 정가=결제액',
    input: { ticketTypeSnapshot: 'COUNT', quantity: 10, remainingCount: 10, attendedCount: 0, originalPrice: 250000, finalPrice: 250000, nowISO: NOW },
  },
  {
    name: '횟수제 · attendedCount 미제공(총−잔여 fallback)',
    input: { ticketTypeSnapshot: 'COUNT', quantity: 5, remainingCount: 2, originalPrice: 130000, finalPrice: 130000, nowISO: NOW },
  },
  {
    name: '워크샵(popup) 1회 · 미참석',
    input: { ticketTypeSnapshot: 'COUNT', ticketCategory: 'popup', quantity: 1, remainingCount: 1, attendedCount: 0, originalPrice: 30000, finalPrice: 30000, nowISO: NOW },
  },
  {
    name: '워크샵(popup) 1회 · 참석 완료',
    input: { ticketTypeSnapshot: 'COUNT', ticketCategory: 'popup', quantity: 1, remainingCount: 0, attendedCount: 1, originalPrice: 30000, finalPrice: 30000, nowISO: NOW },
  },
  {
    name: '만료(EXPIRED) 수강권',
    input: { ticketTypeSnapshot: 'COUNT', quantity: 10, remainingCount: 4, ticketStatus: 'EXPIRED', originalPrice: 250000, finalPrice: 250000, expiryDate: '2026-02-01', nowISO: NOW },
  },
  {
    name: '커스텀 step 정책 · 개시 후 5일 (1MILLION식)',
    input: { ticketTypeSnapshot: 'PERIOD', startDate: '2026-03-06', expiryDate: '2026-04-05', validDays: 30, finalPrice: 190000, originalPrice: 190000, nowISO: NOW, customPolicy: { mode: 'step', steps: [{ until_days: 10, rate: 2 / 3 }, { until_days: 15, rate: 0.5 }, { until_days: 99999, rate: 0 }] } },
  },
  {
    name: '커스텀 step 정책 · 개시 전',
    input: { ticketTypeSnapshot: 'PERIOD', startDate: '2026-03-25', expiryDate: '2026-04-24', validDays: 30, finalPrice: 190000, nowISO: NOW, customPolicy: { mode: 'step', steps: [{ until_days: 10, rate: 2 / 3 }, { until_days: 15, rate: 0.5 }] } },
  },
  {
    name: '커스텀 step 정책 · 마지막 구간 초과',
    input: { ticketTypeSnapshot: 'PERIOD', startDate: '2026-01-05', expiryDate: '2026-04-05', validDays: 90, finalPrice: 190000, nowISO: NOW, customPolicy: { mode: 'step', steps: [{ until_days: 10, rate: 2 / 3 }, { until_days: 15, rate: 0.5 }] } },
  },
  {
    name: '커스텀 none 정책 (환불 불가 상품)',
    input: { ticketTypeSnapshot: 'COUNT', quantity: 1, remainingCount: 1, finalPrice: 35000, nowISO: NOW, customPolicy: { mode: 'none' } },
  },
  {
    name: '커스텀 prorata 정책 (기본 로직으로 흐름)',
    input: { ticketTypeSnapshot: 'PERIOD', validDays: 30, startDate: '2026-03-06', expiryDate: '2026-04-05', finalPrice: 200000, nowISO: NOW, customPolicy: { mode: 'prorata' } },
  },
  {
    name: '결제액 0원 (수기 발급)',
    input: { ticketTypeSnapshot: 'COUNT', quantity: 4, remainingCount: 4, finalPrice: 0, nowISO: NOW },
  },
];

test('B1 기존 설정(프리셋 미지정)의 산출값이 T7 이전 엔진과 완전히 동일하다', () => {
  // 기대값을 손으로 적지 않는다. T7 이전 엔진 사본을 실제로 실행해 결과 객체를 통째로 대조한다.
  expect(LEGACY_SAMPLES.length).toBeGreaterThanOrEqual(18);

  for (const { name, input } of LEGACY_SAMPLES) {
    const before = legacyComputeRefund(input as any);
    const after = computeRefund(input);
    expect(JSON.stringify(after), `[${name}] 기존 수강권의 환불 산출이 달라졌다`)
      .toBe(JSON.stringify(before));
  }
});

test('B2 preset:null / undefined 도 레거시 경로로 흐른다', () => {
  const input: RefundCalcInput = {
    ticketTypeSnapshot: 'COUNT', quantity: 10, remainingCount: 7, attendedCount: 3,
    originalPrice: 300000, finalPrice: 250000, nowISO: NOW,
  };
  const legacy = JSON.stringify(legacyComputeRefund(input as any));
  expect(JSON.stringify(computeRefund({ ...input, preset: null }))).toBe(legacy);
  expect(JSON.stringify(computeRefund({ ...input, preset: undefined }))).toBe(legacy);
});

// ===========================================================================
// C. 환불은 "제안"일 뿐 — 자동 집행 없음 + 직원 확인 감사기록
// ===========================================================================

test('C1 제안 생성은 돈을 움직이지 않고 감사 행만 남긴다', async ({ request }) => {
  F.userTicket = await ins('user_tickets', {
    user_id: STUDENT_ID,
    ticket_id: F.tCount.id,
    remaining_count: 7,
    start_date: new Date(Date.now() - 5 * 86400_000).toISOString().slice(0, 10),
    expiry_date: new Date(Date.now() + 55 * 86400_000).toISOString().slice(0, 10),
    status: 'ACTIVE',
  });

  F.rev = await ins('revenue_transactions', {
    academy_id: F.academy.id,
    user_id: STUDENT_ID,
    user_ticket_id: F.userTicket.id,
    ticket_id: F.tCount.id,
    ticket_name: '10회권',
    ticket_type_snapshot: 'COUNT',
    quantity: 10,
    valid_days: 60,
    original_price: 300000,
    final_price: 250000,
    payment_method: 'ONSITE',
    payment_status: 'COMPLETED',
  });

  const res = await request.post(`/api/academy-admin/${F.academy.id}/refund-proposals`, {
    headers: { Authorization: `Bearer ${F.ownerToken}` },
    data: { revenueTransactionId: F.rev.id },
  });
  expect(res.status()).toBe(200);
  const body = await res.json();

  // 집행되지 않았다
  expect(body.executed).toBe(false);
  // 대상 학원은 학원 등록 사업자 → 강행법규 프리셋
  expect(body.proposal.preset_key).toBe('ACADEMY_STATUTORY');
  expect(body.proposal.preset_source).toBe('STATUTE');
  expect(body.proposal.status).toBe('PROPOSED');
  expect(body.proposal.adjusted_amount).toBeNull();

  // 결제·수강권 상태는 그대로다 (금전 이동 없음)
  const { data: rev } = await svc.from('revenue_transactions').select('*').eq('id', F.rev.id).single();
  expect(rev.payment_status).toBe('COMPLETED');
  expect(rev.refunded_amount ?? 0).toBe(0);
  const ut = await getUserTicket(F.userTicket.id);
  expect(ut.status).toBe('ACTIVE');
  expect(ut.remaining_count).toBe(7);

  // 산출액: 프리셋 공통 규칙(실결제액 기준). 출석 0회이므로 전액 250,000.
  expect(body.proposal.computed_amount).toBe(250000);
  F.proposalId = body.proposal.id;
});

test('C2 직원 확인은 산출값 vs 조정값 vs 사유를 감사기록에 남긴다', async ({ request }) => {
  const res = await request.post(
    `/api/academy-admin/${F.academy.id}/refund-proposals/${F.proposalId}/confirm`,
    {
      headers: { Authorization: `Bearer ${F.ownerToken}` },
      data: { adjustedAmount: 200000, reason: '수업 1회 현장 참여분 반영 — 원장 재량 조정' },
    }
  );
  expect(res.status()).toBe(200);
  const body = await res.json();

  expect(body.executed).toBe(false);
  expect(body.computedAmount).toBe(250000);
  expect(body.adjustedAmount).toBe(200000);
  expect(body.adjustmentDelta).toBe(-50000);

  const { data: row } = await svc.from('refund_proposals').select('*').eq('id', F.proposalId).single();
  expect(row.status).toBe('CONFIRMED');
  expect(row.computed_amount).toBe(250000);   // 엔진 산출값 보존
  expect(row.adjusted_amount).toBe(200000);   // 직원 최종값
  expect(row.confirmed_by).toBe(OWNER_ID);    // 누가
  expect(row.confirmed_at).not.toBeNull();    // 언제
  expect(row.reason).toContain('원장 재량 조정'); // 왜

  // 확인해도 여전히 돈은 안 움직였다
  const { data: rev } = await svc.from('revenue_transactions').select('*').eq('id', F.rev.id).single();
  expect(rev.payment_status).toBe('COMPLETED');
});

test('C3 사유 없는 확인 · 이중 확인 · 비직원은 거절된다', async ({ request }) => {
  // 사유 누락
  const noReason = await request.post(
    `/api/academy-admin/${F.academy.id}/refund-proposals/${F.proposalId}/confirm`,
    { headers: { Authorization: `Bearer ${F.ownerToken}` }, data: { adjustedAmount: 100 } }
  );
  expect(noReason.status()).toBe(400);

  // 이미 확인된 제안 재확인
  const dup = await request.post(
    `/api/academy-admin/${F.academy.id}/refund-proposals/${F.proposalId}/confirm`,
    { headers: { Authorization: `Bearer ${F.ownerToken}` }, data: { adjustedAmount: 100, reason: '재시도' } }
  );
  expect(dup.status()).toBe(409);

  // 학생 토큰
  const student = await request.post(`/api/academy-admin/${F.academy.id}/refund-proposals`, {
    headers: { Authorization: `Bearer ${F.studentToken}` },
    data: { revenueTransactionId: F.rev.id },
  });
  expect(student.status()).toBe(403);

  // 무인증
  const anon = await request.post(`/api/academy-admin/${F.academy.id}/refund-proposals`, {
    data: { revenueTransactionId: F.rev.id },
  });
  expect([401, 403]).toContain(anon.status());
});

// ===========================================================================
// D. 보강(補講) 스태프 API — 규칙 판정은 T6 RPC 가 단일 소스
// ===========================================================================

test('D1 월 상품 보강은 달에 1회만 허용되고 2번째는 거절된다', async ({ request }) => {
  const base = sameMonthRun(4, 4);
  const s1 = await newSchedule(F.cMakeup.id, 10, base);
  const s2 = await newSchedule(F.cMakeup.id, 10, base + 1);
  const s3 = await newSchedule(F.cMakeup.id, 10, base + 2);
  const s4 = await newSchedule(F.cMakeup.id, 10, base + 3);

  const ut = await ins('user_tickets', {
    user_id: STUDENT_ID, ticket_id: F.tMakeupMonthly.id, remaining_count: 4,
    start_date: new Date().toISOString().slice(0, 10),
    expiry_date: new Date(Date.now() + 60 * 86400_000).toISOString().slice(0, 10),
    status: 'ACTIVE', fixed_class_id: F.cMakeup.id,
  });

  const b1 = await ins('bookings', {
    user_id: STUDENT_ID, class_id: F.cMakeup.id, schedule_id: s1.id,
    user_ticket_id: ut.id, status: 'CONFIRMED',
  });
  const b2 = await ins('bookings', {
    user_id: STUDENT_ID, class_id: F.cMakeup.id, schedule_id: s2.id,
    user_ticket_id: ut.id, status: 'CONFIRMED',
  });

  const first = await request.post(`/api/academy-admin/${F.academy.id}/makeup`, {
    headers: { Authorization: `Bearer ${F.ownerToken}` },
    data: { bookingId: b1.id, targetScheduleId: s3.id },
  });
  expect(first.status()).toBe(200);
  const firstBody = await first.json();
  expect(firstBody.success).toBe(true);
  expect(firstBody.schedule_id).toBe(s3.id);

  // 같은 달 두 번째 → RPC 가 거절 (라우트가 별도 판정하지 않는다)
  const second = await request.post(`/api/academy-admin/${F.academy.id}/makeup`, {
    headers: { Authorization: `Bearer ${F.ownerToken}` },
    data: { bookingId: b2.id, targetScheduleId: s4.id },
  });
  expect(second.status()).toBe(409);
  const secondBody = await second.json();
  expect(secondBody.code).toBe('MAKEUP_ALREADY_USED');

  // 감사 기록이 남았다
  const { data: logs } = await svc
    .from('enrollment_activity_log')
    .select('*')
    .eq('academy_id', F.academy.id)
    .eq('action', 'MAKEUP');
  expect((logs ?? []).length).toBe(1);
});

test('D2 3개월 상품은 보강이 거절된다', async ({ request }) => {
  const base = sameMonthRun(2, 12);
  const s1 = await newSchedule(F.cTerm.id, 10, base);
  const s2 = await newSchedule(F.cTerm.id, 10, base + 1);

  const ut = await ins('user_tickets', {
    user_id: STUDENT_ID, ticket_id: F.tMakeupTerm.id, remaining_count: 12,
    start_date: new Date().toISOString().slice(0, 10),
    expiry_date: new Date(Date.now() + 100 * 86400_000).toISOString().slice(0, 10),
    status: 'ACTIVE', fixed_class_id: F.cTerm.id,
  });
  const b = await ins('bookings', {
    user_id: STUDENT_ID, class_id: F.cTerm.id, schedule_id: s1.id,
    user_ticket_id: ut.id, status: 'CONFIRMED',
  });

  const res = await request.post(`/api/academy-admin/${F.academy.id}/makeup`, {
    headers: { Authorization: `Bearer ${F.ownerToken}` },
    data: { bookingId: b.id, targetScheduleId: s2.id },
  });
  expect(res.status()).toBe(400);
  expect((await res.json()).code).toBe('MAKEUP_NOT_ALLOWED_FOR_TERM');
});

test('D3 비직원은 보강 API 를 쓸 수 없다', async ({ request }) => {
  const student = await request.post(`/api/academy-admin/${F.academy.id}/makeup`, {
    headers: { Authorization: `Bearer ${F.studentToken}` },
    data: { bookingId: randomUUID(), targetScheduleId: randomUUID() },
  });
  expect(student.status()).toBe(403);

  const anon = await request.post(`/api/academy-admin/${F.academy.id}/makeup`, {
    data: { bookingId: randomUUID(), targetScheduleId: randomUUID() },
  });
  expect([401, 403]).toContain(anon.status());
});

// ===========================================================================
// E. 휴강(CLASS_CANCELED) 전파 — 트리거 · 프로세서 · 멱등성
// ===========================================================================

test('E1 is_canceled false→true 는 정확히 1건의 CLASS_CANCELED 이벤트를 만든다', async () => {
  const s = await newSchedule(F.cCount.id, 10, 20);
  F.countSchedule = s;

  expect(await classCanceledEvents(s.id)).toHaveLength(0);

  // 외부 일정툴과 동일하게 service_role 로 직접 뒤집는다
  await svc.from('schedules').update({ is_canceled: true }).eq('id', s.id);
  const evs = await classCanceledEvents(s.id);
  expect(evs).toHaveLength(1);
  expect(evs[0].status).toBe('PENDING');

  // 다시 켰다가 또 끄더라도 이벤트는 늘어나지 않는다 (partial UNIQUE)
  await svc.from('schedules').update({ is_canceled: false }).eq('id', s.id);
  await svc.from('schedules').update({ is_canceled: true }).eq('id', s.id);
  expect(await classCanceledEvents(s.id)).toHaveLength(1);
});

test('E2 COUNT 수강권은 정확히 1회만 복구된다 (두 번 처리해도 한 번)', async () => {
  // 앞 케이스의 이벤트는 잠시 미뤄두고, 이 케이스 전용 회차로 검증한다.
  const s = await newSchedule(F.cCount.id, 10, 21);
  const ut = await ins('user_tickets', {
    user_id: STUDENT_ID, ticket_id: F.tCount.id, remaining_count: 5,
    start_date: new Date().toISOString().slice(0, 10),
    expiry_date: new Date(Date.now() + 55 * 86400_000).toISOString().slice(0, 10),
    status: 'ACTIVE',
  });
  const bk = await ins('bookings', {
    user_id: STUDENT_ID, class_id: F.cCount.id, schedule_id: s.id,
    user_ticket_id: ut.id, status: 'CONFIRMED',
  });

  await svc.from('schedules').update({ is_canceled: true }).eq('id', s.id);

  const r1 = await processClassCanceledEvents(svc, 500);
  expect(r1.ok).toBe(true);
  expect(r1.processed).toBeGreaterThan(0);

  const after1 = await getUserTicket(ut.id);
  expect(after1.remaining_count).toBe(6); // 5 → 6, 정확히 1회 복구

  const { data: bk1 } = await svc.from('bookings').select('status').eq('id', bk.id).single();
  expect(bk1.status).toBe('CANCELLED');

  expect(await restorations(s.id)).toHaveLength(1);

  // 이벤트를 PENDING 으로 되돌려 강제로 재처리 — 중복 복구가 없어야 한다
  await svc
    .from('booking_events')
    .update({ status: 'PENDING', processed_at: null })
    .eq('schedule_id', s.id)
    .eq('event_type', 'CLASS_CANCELED');

  const r2 = await processClassCanceledEvents(svc, 500);
  expect(r2.ok).toBe(true);

  const after2 = await getUserTicket(ut.id);
  expect(after2.remaining_count, '재처리로 횟수가 두 번 복구됐다').toBe(6);
  expect(await restorations(s.id)).toHaveLength(1);
});

test('E3 기간제/고정 주1회는 유효기간이 연장되고 대체 회차를 다시 잡는다', async () => {
  // 고정 수업에 넉넉히 회차를 깔아 둔다 (대체 배치 대상)
  for (const d of [7, 14, 21, 28]) {
    await newSchedule(F.cPeriod.id, 10, d);
  }
  const target = await newSchedule(F.cPeriod.id, 10, 35);

  const expiry = new Date(Date.now() + 30 * 86400_000).toISOString().slice(0, 10);
  const ut = await ins('user_tickets', {
    user_id: STUDENT_ID, ticket_id: F.tFixedWeekly.id, remaining_count: null,
    start_date: new Date().toISOString().slice(0, 10),
    expiry_date: expiry,
    status: 'ACTIVE', fixed_class_id: F.cPeriod.id,
  });
  const bk = await ins('bookings', {
    user_id: STUDENT_ID, class_id: F.cPeriod.id, schedule_id: target.id,
    user_ticket_id: ut.id, status: 'CONFIRMED',
  });

  await svc.from('schedules').update({ is_canceled: true }).eq('id', target.id);
  const res = await processClassCanceledEvents(svc, 500);
  expect(res.ok).toBe(true);
  expect(res.period_extended).toBeGreaterThan(0);

  const after = await getUserTicket(ut.id);
  // 고정 주1회는 주 단위 편성 → +7일이라야 회차 1개를 다시 얻는다
  const expected = new Date(new Date(expiry).getTime() + 7 * 86400_000).toISOString().slice(0, 10);
  expect(after.expiry_date).toBe(expected);

  const { data: b } = await svc.from('bookings').select('status').eq('id', bk.id).single();
  expect(b.status).toBe('CANCELLED');

  const rest = await restorations(target.id);
  expect(rest).toHaveLength(1);
  expect(rest[0].restore_kind).toBe('PERIOD_EXTENDED');

  // 재처리해도 유효기간이 또 늘지 않는다
  await svc
    .from('booking_events')
    .update({ status: 'PENDING', processed_at: null })
    .eq('schedule_id', target.id)
    .eq('event_type', 'CLASS_CANCELED');
  await processClassCanceledEvents(svc, 500);
  const after2 = await getUserTicket(ut.id);
  expect(after2.expiry_date, '재처리로 유효기간이 두 번 연장됐다').toBe(expected);
});

test('E4 예약이 하나도 없는 회차의 휴강도 깨끗하게 처리된다', async () => {
  const s = await newSchedule(F.cEmpty.id, 10, 9);
  await svc.from('schedules').update({ is_canceled: true }).eq('id', s.id);

  const res = await processClassCanceledEvents(svc, 500);
  expect(res.ok).toBe(true);

  const evs = await classCanceledEvents(s.id);
  expect(evs).toHaveLength(1);
  expect(evs[0].status).toBe('PROCESSED');
  expect(evs[0].last_error).toBeNull();
  expect(await restorations(s.id)).toHaveLength(0);
});

test('E5 알림은 학생당 정확히 1회만 나간다 (두 번 돌려도 한 번)', async () => {
  // 앞 케이스들에서 쌓인 미발송 복구 건을 소비한다
  const { dispatchClassCancelNotifications } = await import('../lib/booking/class-cancel');

  const first = await dispatchClassCancelNotifications(svc, 500);
  expect(first.sent).toBeGreaterThan(0);

  const sentAfterFirst = (await notificationsFor(STUDENT_ID, F.startedAt)).length;
  expect(sentAfterFirst).toBeGreaterThan(0);

  // 두 번째 호출은 선점할 게 없어야 한다
  const second = await dispatchClassCancelNotifications(svc, 500);
  expect(second.sent).toBe(0);

  const sentAfterSecond = (await notificationsFor(STUDENT_ID, F.startedAt)).length;
  expect(sentAfterSecond, '같은 휴강으로 알림이 두 번 나갔다').toBe(sentAfterFirst);

  // 모든 복구 건에 발송 스탬프가 찍혔다
  const { data: pending } = await svc
    .from('class_cancel_restorations')
    .select('id')
    .in('academy_id', academyIds)
    .is('notified_at', null);
  expect(pending ?? []).toHaveLength(0);
});

test('E6 휴강 알림 문구는 복구 종류를 학생에게 알려준다', () => {
  const countMsg = buildClassCancelMessage({
    restoration_id: 'x', academy_id: 'a', user_id: 'u', schedule_id: 's', booking_id: 'b',
    restore_kind: 'COUNT_RESTORED', detail: null, class_name: '초급 힙합',
    start_time: '2026-03-12T02:00:00.000Z', // KST 11:00
  });
  expect(countMsg.title).toBe('휴강 안내');
  expect(countMsg.body).toContain('초급 힙합');
  expect(countMsg.body).toContain('3월 12일 11:00');
  expect(countMsg.body).toContain('횟수 1회를 돌려드렸습니다');

  const periodMsg = buildClassCancelMessage({
    restoration_id: 'x', academy_id: 'a', user_id: 'u', schedule_id: 's', booking_id: 'b',
    restore_kind: 'PERIOD_EXTENDED', detail: null, class_name: '중급 재즈',
    start_time: '2026-03-12T02:00:00.000Z',
  });
  expect(periodMsg.body).toContain('유효기간을 연장');
});

test('E7 프로세서 RPC 는 service_role 전용이다', async () => {
  const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  }) as any;

  for (const fn of ['process_class_canceled_events', 'claim_class_cancel_notifications']) {
    const res = await anon.rpc(fn, { p_limit: 10 });
    expect(res.error, `${fn} 이 anon 에게 열려 있으면 안 된다`).not.toBeNull();
  }
});
