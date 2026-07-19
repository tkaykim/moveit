/**
 * T6 고정 주1회(fixed weekly) 자동예약 · 신규 회차 백필 · 보강(makeup) 검증
 *
 * 실행: npx playwright test tests/fixed-weekly.spec.ts
 *
 * 픽스처는 전용 테스트 학원(slug: t6-fw-*) 안에서만 만들고 끝나면 지운다.
 * 실제 MID 학원(slug: mid) 데이터는 절대 건드리지 않는다.
 *
 * 이 스펙의 1번 케이스(AC1)가 T6 전체의 존재 이유다:
 *   레거시 자동예약은 is_general PERIOD 권에 대해 학원의 **모든 regular 수업**을
 *   자동 예약했다. ALL PASS(무제한권)가 도입되면 구매자 한 명이 30일치 전 수업에
 *   등록된다. AC1 이 그 회귀를 막는 방어선이다.
 */
import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

import { composeOrder, newProviderOrderId } from '../lib/orders/composer';
import type { OrderItemInput } from '../lib/orders/types';
import { approveAndFinalize } from '../lib/payments/fulfilment';
import {
  createMakeupBooking,
  parseMakeupError,
  placeFixedWeeklyBookings,
  processScheduleCreatedEvents,
} from '../lib/booking/fixed-weekly';

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

/**
 * schedules 에는 (class, KST 날짜) 유니크 제약이 있다.
 * 수업마다 독립적인 날짜 커서를 두어 서로 다른 날짜를 쓰게 한다.
 */
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

/**
 * 연속 n일이 **같은 KST 달**에 들어가는 시작 오프셋을 찾는다.
 * 월말에 돌리면 결석 회차 2개가 서로 다른 달로 갈라져 "월 1회" 판정이
 * 통과해버린다 — 그러면 테스트가 잘못된 이유로 초록이 된다.
 */
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

/** 이 학원에서 해당 학생이 가진 살아있는 예약 */
async function activeBookings(userId: string, classId?: string) {
  let q = svc
    .from('bookings')
    .select('id, schedule_id, class_id, status, user_ticket_id')
    .eq('user_id', userId)
    .in('status', ['CONFIRMED', 'PENDING', 'COMPLETED']);
  if (classId) q = q.eq('class_id', classId);
  const { data } = await q;
  return data ?? [];
}

async function academyBookings(userId: string) {
  const { data: cls } = await svc.from('classes').select('id').in('academy_id', academyIds);
  const classIds = (cls ?? []).map((c: any) => c.id);
  if (classIds.length === 0) return [];
  const { data } = await svc
    .from('bookings')
    .select('id, schedule_id, class_id, status')
    .eq('user_id', userId)
    .in('class_id', classIds)
    .in('status', ['CONFIRMED', 'PENDING', 'COMPLETED']);
  return data ?? [];
}

async function getUserTicket(id: string) {
  const { data } = await svc.from('user_tickets').select('*').eq('id', id).single();
  return data;
}

async function issues(userTicketId: string) {
  const { data } = await svc
    .from('fixed_weekly_placement_issues')
    .select('*')
    .eq('user_ticket_id', userTicketId);
  return data ?? [];
}

async function pendingEvents(scheduleId: string) {
  const { data } = await svc.from('booking_events').select('*').eq('schedule_id', scheduleId);
  return data ?? [];
}

/** 수강권을 직접 발급한다 (주문 경로를 거치지 않는 단위 검증용) */
async function grantTicket(
  ticketId: string,
  opts: { count: number; fixedClassId: string | null; days?: number }
) {
  const today = new Date();
  const expiry = new Date(today.getTime() + (opts.days ?? 60) * 86400_000);
  return ins('user_tickets', {
    user_id: STUDENT_ID,
    ticket_id: ticketId,
    remaining_count: opts.count,
    start_date: today.toISOString().slice(0, 10),
    expiry_date: expiry.toISOString().slice(0, 10),
    status: 'ACTIVE',
    fixed_class_id: opts.fixedClassId,
  });
}

async function makeOrder(items: OrderItemInput[]) {
  return composeOrder(svc, {
    academyId: F.academy.id,
    method: 'ONSITE',
    items,
    userId: STUDENT_ID,
    providerOrderId: newProviderOrderId('T6'),
  });
}

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  F.academy = await ins('academies', {
    name_kr: `T6고정주1회-${stamp}`,
    slug: `t6-fw-${stamp}`,
    is_active: true,
    // 기본 정책은 열어둔다. "오픈 전" 케이스는 수업별 정책으로 따로 만든다.
    booking_policy: { open: null, close: { minutesBefore: 0 }, cancelUntil: { minutesBefore: 0 } },
  });
  academyIds.push(F.academy.id);

  F.group = await ins('class_groups', {
    academy_id: F.academy.id, key: 'normal', name: '정규', is_special: false,
  });

  // --- 수업 ---
  // 고정 수업 (월 상품·3개월 상품의 대상)
  F.cFixed = await ins('classes', {
    academy_id: F.academy.id, title: '고정수업(월)', class_group_id: F.group.id,
    max_students: 10, is_active: true, class_type: 'regular',
  });
  F.cTerm = await ins('classes', {
    academy_id: F.academy.id, title: '고정수업(3개월)', class_group_id: F.group.id,
    max_students: 20, is_active: true, class_type: 'regular',
  });
  // 자유 수업 — ALL PASS 가 여기에 자동 등록되면 회귀다
  F.cOther = await ins('classes', {
    academy_id: F.academy.id, title: '다른수업', class_group_id: F.group.id,
    max_students: 10, is_active: true, class_type: 'regular',
  });
  // 예약 오픈 전 수업 (수업일 당일 00:00 KST 오픈 → 미래 회차는 아직 오픈 전)
  F.cNotOpen = await ins('classes', {
    academy_id: F.academy.id, title: '오픈전고정수업', class_group_id: F.group.id,
    max_students: 10, is_active: true, class_type: 'regular',
    booking_policy: { open: { daysBefore: 0, time: '00:00' } },
  });
  // 회차가 아직 하나도 없는 고정 수업
  F.cEmpty = await ins('classes', {
    academy_id: F.academy.id, title: '회차없는고정수업', class_group_id: F.group.id,
    max_students: 10, is_active: true, class_type: 'regular',
  });
  // 백필 대상 수업 (beforeAll 에서는 회차를 만들지 않는다)
  F.cBackfill = await ins('classes', {
    academy_id: F.academy.id, title: '백필고정수업', class_group_id: F.group.id,
    max_students: 10, is_active: true, class_type: 'regular',
  });

  // --- 상품 ---
  // 월 고정 주1회: 4회 / 1개월 / 보강 월 1회
  F.tMonthly = await ins('tickets', {
    academy_id: F.academy.id, name: '고정 주1회 (월)', ticket_type: 'COUNT',
    price: 120000, total_count: 4, valid_months: 1,
    is_fixed_weekly: true, start_mode: 'IMMEDIATE',
    is_general: true, is_on_sale: true, is_public: true,
  });
  // 3개월 고정 주1회: 12회 / 3개월 / 보강 없음
  F.tTerm = await ins('tickets', {
    academy_id: F.academy.id, name: '고정 주1회 (3개월)', ticket_type: 'COUNT',
    price: 330000, total_count: 12, valid_months: 3,
    is_fixed_weekly: true, start_mode: 'IMMEDIATE',
    is_general: true, is_on_sale: true, is_public: true,
  });
  // ⚠ ALL PASS — 무제한 기간권. 자동예약 대상이 절대 아니다.
  F.tAllPass = await ins('tickets', {
    academy_id: F.academy.id, name: 'ALL PASS', ticket_type: 'PERIOD',
    price: 200000, valid_days: 30,
    is_fixed_weekly: false, start_mode: 'IMMEDIATE',
    is_general: true, is_on_sale: true, is_public: true,
  });

  // 고정 수업(월)에 4주치 회차를 만든다 — 7·14·21·28일 뒤
  F.fixedSchedules = [];
  for (const d of [7, 14, 21, 28]) {
    F.fixedSchedules.push(await newSchedule(F.cFixed.id, 10, d));
  }
  // 다른 수업에도 회차를 둔다 (ALL PASS 가 여기 잡히면 회귀)
  F.otherSchedules = [];
  for (const d of [7, 14, 21]) {
    F.otherSchedules.push(await newSchedule(F.cOther.id, 10, d));
  }
});

test.afterAll(async () => {
  if (academyIds.length === 0) return;

  const { data: ogs } = await svc.from('order_groups').select('id').in('academy_id', academyIds);
  const ogIds = (ogs ?? []).map((o: any) => o.id);
  const { data: cls } = await svc.from('classes').select('id').in('academy_id', academyIds);
  const classIds = (cls ?? []).map((c: any) => c.id);

  await svc.from('makeup_grants').delete().in('academy_id', academyIds);
  await svc.from('fixed_weekly_placement_issues').delete().in('academy_id', academyIds);
  await svc.from('booking_events').delete().in('academy_id', academyIds);
  await svc.from('revenue_transactions').delete().in('academy_id', academyIds);
  if (ogIds.length > 0) await svc.from('order_items').delete().in('order_group_id', ogIds);
  if (classIds.length > 0) await svc.from('bookings').delete().in('class_id', classIds);
  if (ogIds.length > 0) await svc.from('order_groups').delete().in('id', ogIds);

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
  await svc.from('academies').delete().in('id', academyIds);
});

// ===========================================================================
// AC1. 회귀 방어선 — ALL PASS / 일반 PERIOD 는 단 한 건도 자동 예약되지 않는다
// ===========================================================================

test('AC1-1 ALL PASS(일반 PERIOD) 구매 → 자동 예약 0건 (레거시 대량예약 회귀 방어)', async () => {
  const before = await academyBookings(STUDENT_ID);

  const order = await makeOrder([{ item_type: 'TICKET_PURCHASE', ticket_id: F.tAllPass.id }]);
  const res = await approveAndFinalize(svc, {
    orderGroupId: order.order_group_id,
    approvedAmount: order.total_amount,
    method: 'ONSITE',
    confirmedBy: OWNER_ID,
  });

  // 주문은 정상 확정된다
  expect(res.status).toBe('CONFIRMED');
  expect(res.user_ticket_ids.length).toBe(1);

  // 그런데 자동 예약은 **한 건도** 생기지 않는다
  const after = await academyBookings(STUDENT_ID);
  expect(after.length).toBe(before.length);

  const ut = await getUserTicket(res.user_ticket_ids[0]);
  expect(ut.fixed_class_id).toBeNull();

  // 배치 함수를 직접 불러도 결과는 같다 (자격 판정이 DB 정본)
  const placement = await placeFixedWeeklyBookings(svc, res.user_ticket_ids[0]);
  expect(placement.eligible).toBe(false);
  expect(placement.reason).toBe('NOT_FIXED_WEEKLY');
  expect(placement.placed).toBe(0);

  const stillAfter = await academyBookings(STUDENT_ID);
  expect(stillAfter.length).toBe(before.length);
});

// ===========================================================================
// AC2. 상품별 배치 횟수
// ===========================================================================

test('AC2-1 월 고정 상품 → 정확히 4회차 예약', async () => {
  const ut = await grantTicket(F.tMonthly.id, { count: 4, fixedClassId: F.cFixed.id, days: 31 });
  const res = await placeFixedWeeklyBookings(svc, ut.id);

  expect(res.eligible).toBe(true);
  expect(res.placed).toBe(4);

  const bookings = await activeBookings(STUDENT_ID, F.cFixed.id);
  expect(bookings.length).toBe(4);
  // 전부 이 수강권으로 잡혔다
  expect(bookings.every((b: any) => b.user_ticket_id === ut.id)).toBe(true);

  // 4회를 다 썼으므로 잔여 0 · USED
  const after = await getUserTicket(ut.id);
  expect(after.remaining_count).toBe(0);
  expect(after.status).toBe('USED');

  // 정리 (뒤 케이스와 좌석 충돌 방지)
  await svc.from('bookings').delete().eq('user_ticket_id', ut.id);
  await svc.from('user_tickets').delete().eq('id', ut.id);
});

test('AC2-2 3개월 고정 상품 → 정확히 12회차 예약', async () => {
  for (let i = 1; i <= 12; i++) {
    await newSchedule(F.cTerm.id, 20, i * 7);
  }

  const ut = await grantTicket(F.tTerm.id, { count: 12, fixedClassId: F.cTerm.id, days: 92 });
  const res = await placeFixedWeeklyBookings(svc, ut.id);

  expect(res.placed).toBe(12);
  const bookings = await activeBookings(STUDENT_ID, F.cTerm.id);
  expect(bookings.length).toBe(12);

  F.termTicketId = ut.id; // AC6 보강 거절 케이스에서 재사용
});

// ===========================================================================
// AC3. 예약창 면제 / 정원 준수 / 미생성 회차
// ===========================================================================

test('AC3-1 예약 오픈 전 회차도 자동 배치된다 (예약창 면제)', async () => {
  // 수업일 당일 00:00 KST 오픈 → 10일 뒤 회차는 일반 예약으로는 아직 열리지 않았다
  const s = await newSchedule(F.cNotOpen.id, 10, 10);
  const ut = await grantTicket(F.tMonthly.id, { count: 1, fixedClassId: F.cNotOpen.id, days: 31 });

  // 대조군: 일반 예약 경로는 같은 회차를 거절한다
  const { error: normalErr } = await svc.rpc('create_booking_tx', {
    p_schedule_id: s.id,
    p_user_ticket_id: ut.id,
    p_order_item_id: null,
    p_user_id: STUDENT_ID,
  });
  expect(String((normalErr as any)?.message ?? '')).toContain('BOOKING_NOT_YET_OPEN');

  // 자동 배치는 통과한다
  const res = await placeFixedWeeklyBookings(svc, ut.id);
  expect(res.placed).toBe(1);

  const bookings = await activeBookings(STUDENT_ID, F.cNotOpen.id);
  expect(bookings.length).toBe(1);
  expect(bookings[0].schedule_id).toBe(s.id);
});

test('AC3-2 회차가 아직 없으면 건너뛰고 횟수는 그대로 남는다', async () => {
  const ut = await grantTicket(F.tMonthly.id, { count: 4, fixedClassId: F.cEmpty.id, days: 31 });
  const res = await placeFixedWeeklyBookings(svc, ut.id);

  expect(res.placed).toBe(0);
  expect(res.unspent).toBe(4);

  // 횟수는 소진되지 않았다
  const after = await getUserTicket(ut.id);
  expect(after.remaining_count).toBe(4);
  expect(after.status).toBe('ACTIVE');

  // 운영자 큐에 남았다
  const rows = await issues(ut.id);
  const noOcc = rows.filter((r: any) => r.reason === 'NO_OCCURRENCE');
  expect(noOcc.length).toBe(1);
  expect(noOcc[0].shortfall).toBe(4);
});

test('AC3-3 정원이 찬 회차는 건너뛰고(초과예약 없음) 운영자 큐에 남는다', async () => {
  const cFull = await ins('classes', {
    academy_id: F.academy.id, title: '정원마감고정수업', class_group_id: F.group.id,
    max_students: 1, is_active: true, class_type: 'regular',
  });
  // 정원 1명짜리 회차를 다른 학생이 이미 채웠다
  const sFull = await newSchedule(cFull.id, 1, 6);
  await ins('bookings', {
    user_id: OWNER_ID, class_id: cFull.id, schedule_id: sFull.id,
    status: 'CONFIRMED', payment_status: 'PAID',
  });
  // 여유 있는 회차 하나
  const sOk = await newSchedule(cFull.id, 5, 13);

  const ut = await grantTicket(F.tMonthly.id, { count: 2, fixedClassId: cFull.id, days: 31 });
  const res = await placeFixedWeeklyBookings(svc, ut.id);

  // 마감 회차는 건너뛰고 여유 회차만 잡았다
  expect(res.skipped_full).toBe(1);
  expect(res.placed).toBe(1);

  const mine = await activeBookings(STUDENT_ID, cFull.id);
  expect(mine.length).toBe(1);
  expect(mine[0].schedule_id).toBe(sOk.id);

  // 초과예약 없음 — 마감 회차의 좌석 수는 그대로 1
  const { data: fullSeats } = await svc
    .from('bookings')
    .select('id')
    .eq('schedule_id', sFull.id)
    .in('status', ['CONFIRMED', 'PENDING', 'COMPLETED']);
  expect((fullSeats ?? []).length).toBe(1);

  // 마감으로 못 잡은 자리는 운영자 큐에 기록된다
  const rows = await issues(ut.id);
  const full = rows.filter((r: any) => r.reason === 'SCHEDULE_FULL');
  expect(full.length).toBe(1);
  expect(full[0].schedule_id).toBe(sFull.id);
  expect(full[0].source).toBe('FULFILMENT');

  // 못 쓴 1회는 학생에게 남아 있다
  const after = await getUserTicket(ut.id);
  expect(after.remaining_count).toBe(1);
  expect(after.status).toBe('ACTIVE');
});

test('AC3-4 배치가 일부 실패해도 주문 확정은 성공한다', async () => {
  // 정원 1명짜리 회차를 이미 채워, 4회 중 일부만 배치되게 만든다
  const cPartial = await ins('classes', {
    academy_id: F.academy.id, title: '부분실패고정수업', class_group_id: F.group.id,
    max_students: 1, is_active: true, class_type: 'regular',
  });
  const sTaken = await newSchedule(cPartial.id, 1, 5);
  await ins('bookings', {
    user_id: OWNER_ID, class_id: cPartial.id, schedule_id: sTaken.id,
    status: 'CONFIRMED', payment_status: 'PAID',
  });
  await newSchedule(cPartial.id, 5, 12); // 잡을 수 있는 회차 1개

  const order = await makeOrder([
    { item_type: 'TICKET_PURCHASE', ticket_id: F.tMonthly.id, fixed_class_id: cPartial.id },
  ]);
  const res = await approveAndFinalize(svc, {
    orderGroupId: order.order_group_id,
    approvedAmount: order.total_amount,
    method: 'ONSITE',
    confirmedBy: OWNER_ID,
  });

  // 배치가 완전하지 못해도 주문은 확정된다
  expect(res.ok).toBe(true);
  expect(res.status).toBe('CONFIRMED');

  const utId = res.user_ticket_ids[0];
  const ut = await getUserTicket(utId);
  // 4회 중 1회만 배치 → 남은 3회는 학생에게 그대로 있다
  expect(ut.remaining_count).toBe(3);
  expect(ut.status).toBe('ACTIVE');

  const mine = await activeBookings(STUDENT_ID, cPartial.id);
  expect(mine.length).toBe(1);

  // 못 잡은 자리는 운영자가 볼 수 있다
  const rows = await issues(utId);
  expect(rows.length).toBeGreaterThan(0);
});

test('AC3-5 고정수업 수강권은 다른 수업에 쓸 수 없다', async () => {
  const ut = await grantTicket(F.tMonthly.id, { count: 4, fixedClassId: F.cFixed.id, days: 31 });

  // 일반 예약 경로: 고정 수업이 아닌 회차 → FIXED_CLASS_MISMATCH
  const { error } = await svc.rpc('create_booking_tx', {
    p_schedule_id: F.otherSchedules[0].id,
    p_user_ticket_id: ut.id,
    p_order_item_id: null,
    p_user_id: STUDENT_ID,
  });
  expect(String((error as any)?.message ?? '')).toContain('FIXED_CLASS_MISMATCH');

  // 자동 배치도 고정 수업 밖으로는 절대 나가지 않는다
  const res = await placeFixedWeeklyBookings(svc, ut.id);
  const other = await activeBookings(STUDENT_ID, F.cOther.id);
  expect(other.length).toBe(0);
  expect(res.placed).toBeGreaterThanOrEqual(0);

  await svc.from('bookings').delete().eq('user_ticket_id', ut.id);
  await svc.from('user_tickets').delete().eq('id', ut.id);
});

// ===========================================================================
// AC4. 신규 회차 백필 (schedules INSERT → booking_events → 프로세서)
// ===========================================================================

test('AC4-1 신규 회차 INSERT → SCHEDULE_CREATED 이벤트가 기록된다', async () => {
  const s = await newSchedule(F.cBackfill.id, 10, 9);
  const evs = await pendingEvents(s.id);

  expect(evs.length).toBe(1);
  expect(evs[0].event_type).toBe('SCHEDULE_CREATED');
  expect(evs[0].status).toBe('PENDING');
  expect(evs[0].academy_id).toBe(F.academy.id);
  expect(evs[0].attempts).toBe(0);

  F.backfillSchedule = s;
});

test('AC4-2 프로세서가 자격 있는 학생을 신규 회차에 배치한다', async () => {
  const ut = await grantTicket(F.tMonthly.id, { count: 4, fixedClassId: F.cBackfill.id, days: 31 });
  F.backfillTicketId = ut.id;

  const res = await processScheduleCreatedEvents(svc, 500);
  expect(res.ok).toBe(true);
  expect(res.processed).toBeGreaterThan(0);

  const mine = await activeBookings(STUDENT_ID, F.cBackfill.id);
  expect(mine.length).toBe(1);
  expect(mine[0].schedule_id).toBe(F.backfillSchedule.id);

  // 이벤트는 PROCESSED 로 닫혔다
  const evs = await pendingEvents(F.backfillSchedule.id);
  expect(evs[0].status).toBe('PROCESSED');
  expect(evs[0].processed_at).not.toBeNull();
  expect(evs[0].attempts).toBe(1);
  expect(evs[0].last_error).toBeNull();

  // 배치된 만큼 차감됐다
  const after = await getUserTicket(ut.id);
  expect(after.remaining_count).toBe(3);
});

test('AC4-3 같은 이벤트를 두 번 처리해도 이중 예약되지 않는다 (멱등)', async () => {
  const beforeCount = (await activeBookings(STUDENT_ID, F.cBackfill.id)).length;
  const beforeTicket = await getUserTicket(F.backfillTicketId);

  // 이벤트를 PENDING 으로 되돌려 재처리를 강제한다
  await svc
    .from('booking_events')
    .update({ status: 'PENDING', processed_at: null })
    .eq('schedule_id', F.backfillSchedule.id);

  const res = await processScheduleCreatedEvents(svc, 500);
  expect(res.ok).toBe(true);

  // 예약도, 차감도 늘지 않는다
  const afterCount = (await activeBookings(STUDENT_ID, F.cBackfill.id)).length;
  expect(afterCount).toBe(beforeCount);

  const afterTicket = await getUserTicket(F.backfillTicketId);
  expect(afterTicket.remaining_count).toBe(beforeTicket.remaining_count);

  const evs = await pendingEvents(F.backfillSchedule.id);
  expect(evs[0].status).toBe('PROCESSED');
  expect(evs[0].attempts).toBe(2); // 시도 횟수는 늘지만 결과는 그대로
});

test('AC4-4 백필은 ALL PASS 보유자를 신규 회차에 넣지 않는다', async () => {
  const allPassUt = await ins('user_tickets', {
    user_id: OWNER_ID,
    ticket_id: F.tAllPass.id,
    remaining_count: 0,
    start_date: new Date().toISOString().slice(0, 10),
    expiry_date: new Date(Date.now() + 30 * 86400_000).toISOString().slice(0, 10),
    status: 'ACTIVE',
    fixed_class_id: null,
  });

  const s = await newSchedule(F.cBackfill.id, 10, 16);
  await processScheduleCreatedEvents(svc, 500);

  const { data: seats } = await svc
    .from('bookings')
    .select('id, user_id')
    .eq('schedule_id', s.id)
    .in('status', ['CONFIRMED', 'PENDING', 'COMPLETED']);

  // ALL PASS 보유자(OWNER)는 들어가지 않는다
  expect((seats ?? []).some((b: any) => b.user_id === OWNER_ID)).toBe(false);

  await svc.from('user_tickets').delete().eq('id', allPassUt.id);
});

// ===========================================================================
// AC5. 보강(makeup)
// ===========================================================================

test('AC5-1 월 상품: 보강 1회 허용 · 같은 달 두 번째는 거절', async () => {
  const cMakeup = await ins('classes', {
    academy_id: F.academy.id, title: '보강고정수업', class_group_id: F.group.id,
    max_students: 10, is_active: true, class_type: 'regular',
  });
  // 결석 회차 2개가 **반드시 같은 달**에 있어야 "월 1회" 판정을 진짜로 검증한다
  const base = sameMonthRun(4);
  const sMissed = await newSchedule(cMakeup.id, 10, base);
  const sTarget1 = await newSchedule(cMakeup.id, 10, base + 1);
  const sTarget2 = await newSchedule(cMakeup.id, 10, base + 2);
  const sMissed2 = await newSchedule(cMakeup.id, 10, base + 3);
  expect(kstMonthKey(base)).toBe(kstMonthKey(base + 3));

  const ut = await grantTicket(F.tMonthly.id, { count: 4, fixedClassId: cMakeup.id, days: 31 });

  const missed = await ins('bookings', {
    user_id: STUDENT_ID, class_id: cMakeup.id, schedule_id: sMissed.id,
    user_ticket_id: ut.id, status: 'CONFIRMED', payment_status: 'PAID',
  });

  // 1회차 보강 — 성공
  const ok = await createMakeupBooking(svc, {
    bookingId: missed.id,
    targetScheduleId: sTarget1.id,
    actorId: OWNER_ID,
  });
  expect(ok.ok).toBe(true);
  expect(ok.schedule_id).toBe(sTarget1.id);

  // 결석 자리는 반납되고 새 자리가 생겼다 (이동)
  const { data: movedFrom } = await svc.from('bookings').select('status').eq('id', missed.id).single();
  expect(movedFrom.status).toBe('CANCELLED');
  const { data: movedTo } = await svc.from('bookings').select('*').eq('id', ok.booking_id).single();
  expect(movedTo.schedule_id).toBe(sTarget1.id);
  expect(movedTo.status).toBe('CONFIRMED');

  // 원장에 1건 기록
  const { data: grants } = await svc.from('makeup_grants').select('*').eq('user_ticket_id', ut.id);
  expect((grants ?? []).length).toBe(1);

  // 2회차 보강 (같은 달) — 거절
  const missed2 = await ins('bookings', {
    user_id: STUDENT_ID, class_id: cMakeup.id, schedule_id: sMissed2.id,
    user_ticket_id: ut.id, status: 'CONFIRMED', payment_status: 'PAID',
  });

  let rejected: unknown = null;
  try {
    await createMakeupBooking(svc, {
      bookingId: missed2.id,
      targetScheduleId: sTarget2.id,
      actorId: OWNER_ID,
    });
  } catch (e) {
    rejected = e;
  }
  expect(rejected).not.toBeNull();
  expect(parseMakeupError(rejected).code).toBe('MAKEUP_ALREADY_USED');

  // 두 번째 시도는 아무것도 바꾸지 않았다
  const { data: after2 } = await svc.from('bookings').select('status').eq('id', missed2.id).single();
  expect(after2.status).toBe('CONFIRMED');
  const { data: grantsAfter } = await svc.from('makeup_grants').select('*').eq('user_ticket_id', ut.id);
  expect((grantsAfter ?? []).length).toBe(1);
});

test('AC5-2 3개월 상품: 보강 자체가 거절된다', async () => {
  const bookings = await activeBookings(STUDENT_ID, F.cTerm.id);
  expect(bookings.length).toBeGreaterThan(1);

  const missed = bookings[0];
  const target = bookings[bookings.length - 1];

  let rejected: unknown = null;
  try {
    await createMakeupBooking(svc, {
      bookingId: missed.id,
      targetScheduleId: target.schedule_id,
      actorId: OWNER_ID,
    });
  } catch (e) {
    rejected = e;
  }
  expect(rejected).not.toBeNull();
  expect(parseMakeupError(rejected).code).toBe('MAKEUP_NOT_ALLOWED_FOR_TERM');

  // 원장에도 남지 않는다
  const { data: grants } = await svc
    .from('makeup_grants')
    .select('id')
    .eq('user_ticket_id', F.termTicketId);
  expect((grants ?? []).length).toBe(0);
});

test('AC5-3 보강도 고정 수업 밖으로는 나갈 수 없다', async () => {
  const cMk = await ins('classes', {
    academy_id: F.academy.id, title: '보강수업밖', class_group_id: F.group.id,
    max_students: 10, is_active: true, class_type: 'regular',
  });
  const sMissed = await newSchedule(cMk.id, 10, 3);
  const ut = await grantTicket(F.tMonthly.id, { count: 4, fixedClassId: cMk.id, days: 31 });
  const missed = await ins('bookings', {
    user_id: STUDENT_ID, class_id: cMk.id, schedule_id: sMissed.id,
    user_ticket_id: ut.id, status: 'CONFIRMED', payment_status: 'PAID',
  });

  let rejected: unknown = null;
  try {
    await createMakeupBooking(svc, {
      bookingId: missed.id,
      targetScheduleId: F.otherSchedules[1].id, // 다른 수업
      actorId: OWNER_ID,
    });
  } catch (e) {
    rejected = e;
  }
  expect(rejected).not.toBeNull();
  expect(parseMakeupError(rejected).code).toBe('FIXED_CLASS_MISMATCH');
});

test('AC5-4 보강은 정원을 넘지 못한다', async () => {
  const cMk = await ins('classes', {
    academy_id: F.academy.id, title: '보강정원수업', class_group_id: F.group.id,
    max_students: 10, is_active: true, class_type: 'regular',
  });
  const sMissed = await newSchedule(cMk.id, 10, 3);
  const sFull = await newSchedule(cMk.id, 1, 4); // 정원 1명
  await ins('bookings', {
    user_id: OWNER_ID, class_id: cMk.id, schedule_id: sFull.id,
    status: 'CONFIRMED', payment_status: 'PAID',
  });

  const ut = await grantTicket(F.tMonthly.id, { count: 4, fixedClassId: cMk.id, days: 31 });
  const missed = await ins('bookings', {
    user_id: STUDENT_ID, class_id: cMk.id, schedule_id: sMissed.id,
    user_ticket_id: ut.id, status: 'CONFIRMED', payment_status: 'PAID',
  });

  let rejected: unknown = null;
  try {
    await createMakeupBooking(svc, {
      bookingId: missed.id, targetScheduleId: sFull.id, actorId: OWNER_ID,
    });
  } catch (e) {
    rejected = e;
  }
  expect(rejected).not.toBeNull();
  expect(parseMakeupError(rejected).code).toBe('SCHEDULE_FULL');

  // 결석 예약은 그대로, 보강 원장도 남지 않는다 (전부 롤백)
  const { data: still } = await svc.from('bookings').select('status').eq('id', missed.id).single();
  expect(still.status).toBe('CONFIRMED');
  const { data: grants } = await svc.from('makeup_grants').select('id').eq('user_ticket_id', ut.id);
  expect((grants ?? []).length).toBe(0);
});
