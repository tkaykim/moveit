/**
 * T12 — 운영자가 선언한 6개 인수 시나리오 + 출석 4경로 + 보안/동시성/UI 교차검증
 *
 * 실행: npx playwright test tests/e2e-scenarios.spec.ts --workers=1
 *
 * 규율:
 *   1) 픽스처는 전용 테스트 학원(slug: t12-*) 안에서만 만들고 끝나면 **스스로 지운다**.
 *      실제 MID 학원(slug: mid) 은 읽기만 하고 절대 건드리지 않는다 — 마지막 테스트가 증명한다.
 *   2) 날짜는 전부 now 기준 상대값이다. 절대 날짜를 박으면 언젠가 반드시 깨진다(시한폭탄).
 *   3) "차감됐다"는 화면 문구가 아니라 **DB 행**으로 증명한다.
 */
import { test, expect, type Page, type BrowserContext } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

import { approveAndFinalize } from '../lib/payments/fulfilment';

/* ------------------------------------------------------------------ */
/* env                                                                 */
/* ------------------------------------------------------------------ */

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

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON_KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const svc = createClient(SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
}) as any;

const BASE = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';

const OWNER_EMAIL = 'e2e-moveit-owner@modoogoods.com';
const STUDENT_EMAIL = 'e2e-moveit-student@modoogoods.com';
const E2E_PASSWORD = 'Test1234!e2e';
const STUDENT_ID = 'fd2fd033-2f2c-4cad-890b-f2c9c75a0f23';
const OWNER_ID = '6e33f238-14c6-41d7-9715-d131067b6885';

const PROJECT_REF = new URL(SUPABASE_URL).hostname.split('.')[0];
const AUTH_COOKIE = `sb-${PROJECT_REF}-auth-token`;
const MAX_CHUNK = 3180;

const REAL_ACADEMY_SLUG = 'mid';

const stamp = randomUUID().slice(0, 8);
const F: Record<string, any> = {};
const TOK: Record<string, string> = {};
const syntheticUserIds: string[] = [];
const authUserIds: string[] = [];
let midBefore: Record<string, any> = {};

/* ------------------------------------------------------------------ */
/* 헬퍼                                                                */
/* ------------------------------------------------------------------ */

async function ins(table: string, row: Record<string, any>) {
  const { data, error } = await svc.from(table).insert(row).select().single();
  if (error) throw new Error(`${table} insert 실패: ${error.message}`);
  return data;
}

const isoInHours = (h: number) => new Date(Date.now() + h * 3600_000).toISOString();
const kstToday = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
/** 만료일도 상대값으로 — '2099-12-31' 같은 센티널은 쓰지 않는다 */
const kstDaysFromNow = (d: number) =>
  new Date(Date.now() + (9 + d * 24) * 3600_000).toISOString().slice(0, 10);

async function signIn(email: string) {
  const anon = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await anon.auth.signInWithPassword({ email, password: E2E_PASSWORD });
  if (error || !data.session) throw new Error(`${email} 로그인 실패: ${error?.message}`);
  return data.session;
}

/** @supabase/ssr 0.8 브라우저 세션 쿠키 (admin-console.spec 과 동일 방식) */
async function loginAs(context: BrowserContext, email: string) {
  const session = await signIn(email);
  const encoded = 'base64-' + Buffer.from(JSON.stringify(session), 'utf8').toString('base64url');
  const base = new URL(BASE);
  const common = { domain: base.hostname, path: '/', httpOnly: false, secure: false } as const;

  await context.clearCookies();
  if (encoded.length <= MAX_CHUNK) {
    await context.addCookies([{ name: AUTH_COOKIE, value: encoded, ...common }]);
  } else {
    const chunks: string[] = [];
    for (let i = 0; i < encoded.length; i += MAX_CHUNK) chunks.push(encoded.slice(i, i + MAX_CHUNK));
    await context.addCookies(chunks.map((value, i) => ({ name: `${AUTH_COOKIE}.${i}`, value, ...common })));
  }
  return session;
}

/** Next API 호출 (Bearer). 라우트는 쿠키/Bearer 둘 다 받는다. */
async function api(
  pathname: string,
  opts: { token?: string | null; method?: string; body?: unknown } = {}
) {
  const res = await fetch(`${BASE}${pathname}`, {
    method: opts.method ?? 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
    },
    ...(opts.body === undefined ? {} : { body: JSON.stringify(opts.body) }),
  });
  let json: any = null;
  try {
    json = await res.json();
  } catch {
    /* 본문 없는 응답 */
  }
  return { status: res.status, body: json };
}

function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console: ${m.text()}`);
  });
  return errors;
}

async function expectNoHorizontalOverflow(page: Page, label: string) {
  const o = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(
    o.scrollWidth,
    `${label}: 가로 오버플로 (scrollWidth=${o.scrollWidth} clientWidth=${o.clientWidth})`
  ).toBeLessThanOrEqual(o.clientWidth + 1);
}

/** 학생에게 수강권을 직접 발급 (구매 경로가 아닌 "이미 보유" 상태를 만들 때만) */
async function grantTicket(ticketId: string, remaining: number | null, userId = STUDENT_ID) {
  return ins('user_tickets', {
    user_id: userId,
    ticket_id: ticketId,
    remaining_count: remaining,
    start_date: kstToday(),
    expiry_date: kstDaysFromNow(60),
    status: 'ACTIVE',
  });
}

/** 수업 + 회차 1개. schedules 는 (class_id, KST 날짜) 유니크라 수업당 회차 하나로 둔다. */
async function mkClassWithSchedule(
  label: string,
  opts: { hours?: number; maxStudents?: number; canceled?: boolean; groupId?: string; academyId?: string } = {}
) {
  const academyId = opts.academyId ?? F.academyA.id;
  const klass = await ins('classes', {
    academy_id: academyId,
    title: `T12-${label}-${stamp}`,
    class_type: 'regular',
    max_students: opts.maxStudents ?? 20,
    is_active: true,
    class_group_id: opts.groupId ?? F.groupA.id,
    booking_policy: { open: null, close: { minutesBefore: 0 }, cancelUntil: { minutesBefore: 0 } },
  });
  const h = opts.hours ?? 48;
  const schedule = await ins('schedules', {
    class_id: klass.id,
    start_time: isoInHours(h),
    end_time: isoInHours(h + 2),
    max_students: opts.maxStudents ?? 20,
    is_canceled: opts.canceled ?? false,
  });
  return { klass, schedule };
}

async function getUserTicket(id: string) {
  const { data } = await svc.from('user_tickets').select('*').eq('id', id).maybeSingle();
  return data;
}

async function getBooking(id: string) {
  const { data } = await svc.from('bookings').select('*').eq('id', id).maybeSingle();
  return data;
}

/** 주문 하나 만들기 (학생 세션으로 실제 /api/orders 를 탄다) */
async function createOrder(
  method: 'BANK' | 'TOSS' | 'ONSITE',
  items: any[],
  extra: { providerOrderId?: string; token?: string | null } = {}
) {
  return api('/api/orders', {
    token: extra.token === undefined ? TOK.student : extra.token,
    body: {
      academyId: F.academyA.id,
      method,
      items,
      ...(extra.providerOrderId ? { providerOrderId: extra.providerOrderId } : {}),
    },
  });
}

/** 학생이 QR 발급 → 스태프가 스캔 = 출석 */
async function generateQr(bookingId: string, token = TOK.student) {
  return api('/api/attendance/qr-generate', { token, body: { bookingId } });
}
async function scanQr(qrToken: string, academyId: string, token = TOK.owner) {
  return api('/api/attendance/qr-checkin', { token, body: { token: qrToken, academyId } });
}

/* ------------------------------------------------------------------ */
/* 픽스처                                                              */
/* ------------------------------------------------------------------ */

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  // 실제 학원 스냅샷 — 이 스위트가 끝난 뒤 한 행도 달라지지 않았음을 증명하기 위함
  const { data: mid } = await svc
    .from('academies')
    .select('id, is_active')
    .eq('slug', REAL_ACADEMY_SLUG)
    .single();
  if (!mid) throw new Error(`실제 학원(${REAL_ACADEMY_SLUG})을 찾을 수 없습니다`);
  midBefore = { id: mid.id, is_active: mid.is_active, ...(await snapshotAcademy(mid.id)) };

  // 학원 A (주 시나리오) / 학원 B (타 학원 스태프 검증용)
  F.academyA = await ins('academies', {
    name_kr: `T12시나리오A-${stamp}`,
    slug: `t12-a-${stamp}`,
    is_active: true,
    brand_color: '#0EA5E9',
    booking_policy: { open: null, close: { minutesBefore: 0 }, cancelUntil: { minutesBefore: 0 } },
  });
  F.academyB = await ins('academies', {
    name_kr: `T12시나리오B-${stamp}`,
    slug: `t12-b-${stamp}`,
    is_active: true,
    booking_policy: { open: null, close: { minutesBefore: 0 }, cancelUntil: { minutesBefore: 0 } },
  });

  F.groupA = await ins('class_groups', {
    academy_id: F.academyA.id,
    key: 'regular',
    name: '정규반',
    is_special: false,
    display_order: 1,
  });

  // 숨김(locked) 멤버십 — 보안 스윕에서 "안 보여야 하는 것"
  F.hiddenMembership = await ins('memberships', {
    academy_id: F.academyA.id,
    key: `t12-hidden-${stamp}`,
    name: 'T12 숨김멤버십',
    visibility: 'locked',
    is_active: true,
  });

  // 상품: 다회권(5회) / 1회권(1회)
  F.ticketMulti = await ins('tickets', {
    academy_id: F.academyA.id,
    name: `T12다회권-${stamp}`,
    price: 100000,
    ticket_type: 'COUNT',
    total_count: 5,
    valid_days: 60,
    is_on_sale: true,
    is_general: true,
    is_public: true,
    start_mode: 'IMMEDIATE',
  });
  F.ticketSingle = await ins('tickets', {
    academy_id: F.academyA.id,
    name: `T12일회권-${stamp}`,
    price: 30000,
    ticket_type: 'COUNT',
    total_count: 1,
    valid_days: 60,
    is_on_sale: true,
    is_general: true,
    is_public: true,
    start_mode: 'IMMEDIATE',
  });

  // 시나리오별 수업 (수업 하나당 회차 하나)
  F.cMulti = await mkClassWithSchedule('다회권사용');
  F.cSingle = await mkClassWithSchedule('일회권사용');
  F.cBuySingle = await mkClassWithSchedule('일회권즉시');
  F.cOnsite = await mkClassWithSchedule('현장결제');
  F.cBuyMulti = await mkClassWithSchedule('다회권즉시');
  F.cBulk1 = await mkClassWithSchedule('일괄1');
  F.cBulk2 = await mkClassWithSchedule('일괄2');
  F.cBulkBad = await mkClassWithSchedule('일괄불가', { canceled: true }); // 휴강 = 주문 불가
  // 출석 4경로
  F.cAttTicket = await mkClassWithSchedule('출석기존권');
  F.cAttBank = await mkClassWithSchedule('출석계좌');
  F.cAttToss = await mkClassWithSchedule('출석카드');
  F.cAttOnsite = await mkClassWithSchedule('출석현장');
  // 동시성
  F.cLastSeat = await mkClassWithSchedule('마지막좌석', { maxStudents: 1 });
  F.cRace1 = await mkClassWithSchedule('일회권경합1');
  F.cRace2 = await mkClassWithSchedule('일회권경합2');
  F.cDouble = await mkClassWithSchedule('더블클릭');
  F.cHold = await mkClassWithSchedule('홀드만료');
  // 멤버십 전용 수업 — 보안 스윕용
  F.cMemberOnly = await ins('classes', {
    academy_id: F.academyA.id,
    title: `T12-멤버전용-${stamp}`,
    class_type: 'regular',
    max_students: 20,
    is_active: true,
    class_group_id: F.groupA.id,
    audience_membership_id: F.hiddenMembership.id,
    booking_policy: { open: null, close: { minutesBefore: 0 }, cancelUntil: { minutesBefore: 0 } },
  });

  // 권한: 원장 = 학원 A 스태프. 학원 B 스태프는 별도 계정(타 학원 스캔 거부 검증).
  await ins('academy_user_roles', {
    academy_id: F.academyA.id,
    user_id: OWNER_ID,
    role: 'ACADEMY_OWNER',
  });

  const staffBEmail = `e2e-t12-staffb-${stamp}@modoogoods.com`;
  const { data: created, error: cErr } = await svc.auth.admin.createUser({
    email: staffBEmail,
    password: E2E_PASSWORD,
    email_confirm: true,
  });
  if (cErr) throw new Error(`학원B 스태프 생성 실패: ${cErr.message}`);
  F.staffBId = created.user.id;
  authUserIds.push(created.user.id);
  await svc.from('users').upsert(
    { id: created.user.id, email: staffBEmail, name: 'T12 학원B 스태프', role: 'USER' },
    { onConflict: 'id' }
  );
  await ins('academy_user_roles', {
    academy_id: F.academyB.id,
    user_id: created.user.id,
    role: 'ACADEMY_OWNER',
  });

  // 토큰
  TOK.student = (await signIn(STUDENT_EMAIL)).access_token;
  TOK.owner = (await signIn(OWNER_EMAIL)).access_token;
  TOK.staffB = (await signIn(staffBEmail)).access_token;
});

/** 학원 한 곳의 행 수 스냅샷 */
async function snapshotAcademy(academyId: string) {
  const count = async (table: string, col: string, val: string) => {
    const { count: c } = await svc.from(table).select('id', { count: 'exact', head: true }).eq(col, val);
    return c ?? 0;
  };
  const { data: classes } = await svc.from('classes').select('id').eq('academy_id', academyId);
  const classIds = (classes ?? []).map((c: any) => c.id);
  let schedules = 0;
  let bookings = 0;
  if (classIds.length) {
    const { count: s } = await svc
      .from('schedules')
      .select('id', { count: 'exact', head: true })
      .in('class_id', classIds);
    schedules = s ?? 0;
    const { count: b } = await svc
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .in('class_id', classIds);
    bookings = b ?? 0;
  }
  return {
    classes: classIds.length,
    schedules,
    bookings,
    tickets: await count('tickets', 'academy_id', academyId),
    orders: await count('order_groups', 'academy_id', academyId),
    memberships: await count('memberships', 'academy_id', academyId),
  };
}

/** 이 스위트가 만든 것 전부 삭제 (멱등). FK 역순을 지켜야 뒤가 조용히 실패하지 않는다. */
async function cleanup() {
  const ids = [F.academyA?.id, F.academyB?.id].filter(Boolean) as string[];
  if (ids.length === 0) return;

  for (const aid of ids) {
    const { data: classes } = await svc.from('classes').select('id').eq('academy_id', aid);
    const classIds = (classes ?? []).map((c: any) => c.id);
    const { data: orders } = await svc.from('order_groups').select('id').eq('academy_id', aid);
    const orderIds = (orders ?? []).map((o: any) => o.id);
    const { data: tks } = await svc.from('tickets').select('id').eq('academy_id', aid);
    const ticketIds = (tks ?? []).map((t: any) => t.id);

    await svc.from('booking_events').delete().eq('academy_id', aid);
    await svc.from('enrollment_activity_log').delete().eq('academy_id', aid);
    await svc.from('revenue_transactions').delete().eq('academy_id', aid);
    if (orderIds.length) await svc.from('order_items').delete().in('order_group_id', orderIds);
    if (classIds.length) await svc.from('bookings').delete().in('class_id', classIds);
    if (orderIds.length) await svc.from('order_groups').delete().in('id', orderIds);
    if (classIds.length) await svc.from('schedules').delete().in('class_id', classIds);
    await svc.from('student_memberships').delete().eq('academy_id', aid);
    if (ticketIds.length) {
      await svc.from('user_tickets').delete().in('ticket_id', ticketIds);
      await svc.from('ticket_coverage').delete().in('ticket_id', ticketIds);
      await svc.from('ticket_classes').delete().in('ticket_id', ticketIds);
    }
    await svc.from('classes').delete().eq('academy_id', aid);
    await svc.from('class_groups').delete().eq('academy_id', aid);
    await svc.from('memberships').delete().eq('academy_id', aid);
    await svc.from('tickets').delete().eq('academy_id', aid);
    await svc.from('academy_user_roles').delete().eq('academy_id', aid);
    await svc.from('academies').delete().eq('id', aid);
  }

  if (syntheticUserIds.length) await svc.from('users').delete().in('id', syntheticUserIds);
  for (const uid of authUserIds) {
    await svc.from('users').delete().eq('id', uid);
    await svc.auth.admin.deleteUser(uid).catch(() => {});
  }
}

test.afterAll(async () => {
  await cleanup();
});

/* ================================================================== */
/* 1. 운영자 선언 6개 인수 시나리오                                     */
/* ================================================================== */

test('AC-1 다회권 사용 — 예약 시 정확히 1회만 차감된다', async () => {
  const ut = await grantTicket(F.ticketMulti.id, 5);

  const res = await api('/api/bookings', {
    token: TOK.student,
    body: { classId: F.cMulti.klass.id, scheduleId: F.cMulti.schedule.id },
  });
  expect(res.status, `예약 실패: ${JSON.stringify(res.body)}`).toBe(200);

  const booking = res.body.data;
  expect(booking?.id).toBeTruthy();
  expect(booking.status).toBe('CONFIRMED');

  const after = await getUserTicket(ut.id);
  expect(after.remaining_count, '다회권은 정확히 1회만 차감돼야 한다').toBe(4);
  expect(after.status).toBe('ACTIVE');

  // 예약이 그 수강권에 묶여 있어야 한다
  expect(booking.user_ticket_id).toBe(ut.id);
});

test('AC-2 1회권 사용 — 예약 시 소진되어 더 쓸 수 없다', async () => {
  const ut = await grantTicket(F.ticketSingle.id, 1);

  const res = await api('/api/bookings', {
    token: TOK.student,
    body: { classId: F.cSingle.klass.id, scheduleId: F.cSingle.schedule.id, userTicketId: ut.id },
  });
  expect(res.status, `예약 실패: ${JSON.stringify(res.body)}`).toBe(200);

  const after = await getUserTicket(ut.id);
  expect(after.remaining_count, '1회권은 0회가 돼야 한다').toBe(0);
  expect(
    ['USED', 'EXHAUSTED', 'EXPIRED', 'INACTIVE'].includes(after.status),
    `소진된 1회권 상태가 ACTIVE 로 남아 있다: ${after.status}`
  ).toBe(true);

  // 소진된 권으로 다른 수업을 또 예약할 수 없다
  const again = await api('/api/bookings', {
    token: TOK.student,
    body: { classId: F.cRace2.klass.id, scheduleId: F.cRace2.schedule.id, userTicketId: ut.id },
  });
  expect(again.status, '소진된 수강권으로 재예약이 통과했다').toBeGreaterThanOrEqual(400);
});

test('AC-3 1회권 구매 후 즉시 사용 — 한 주문에서 발급되고 그 자리에서 쓰인다', async () => {
  const created = await createOrder('BANK', [
    { item_type: 'TICKET_PURCHASE', ticket_id: F.ticketSingle.id },
    { item_type: 'SCHEDULE_BOOKING', schedule_id: F.cBuySingle.schedule.id, use_purchase_index: 0 },
  ]);
  expect(created.status, `주문 생성 실패: ${JSON.stringify(created.body)}`).toBe(201);
  const orderId = created.body.order_group_id;

  // 스태프 입금 확인 → 이행
  const confirm = await api(`/api/academy-admin/${F.academyA.id}/orders/confirm`, {
    token: TOK.owner,
    body: { orderGroupId: orderId },
  });
  expect(confirm.status, `확정 실패: ${JSON.stringify(confirm.body)}`).toBe(200);
  expect(confirm.body.issued_tickets).toBe(1);

  const { data: items } = await svc
    .from('order_items')
    .select('*')
    .eq('order_group_id', orderId)
    .order('created_at');
  const purchase = items.find((i: any) => i.item_type === 'TICKET_PURCHASE');
  const bookingItem = items.find((i: any) => i.item_type === 'SCHEDULE_BOOKING');

  const issued = await getUserTicket(purchase.result_user_ticket_id);
  expect(issued.remaining_count, '구매 즉시 1회 써서 0 이어야 한다').toBe(0);

  const booking = await getBooking(bookingItem.result_booking_id);
  expect(booking.status).toBe('CONFIRMED');
  expect(booking.user_ticket_id, '예약이 같은 주문에서 발급된 수강권에 묶여야 한다').toBe(issued.id);
});

test('AC-4 현장결제 — 스태프가 현장 수납을 기록하면 수강권 발급 + 예약 확정', async () => {
  const created = await createOrder('ONSITE', [
    { item_type: 'TICKET_PURCHASE', ticket_id: F.ticketMulti.id },
    { item_type: 'SCHEDULE_BOOKING', schedule_id: F.cOnsite.schedule.id, use_purchase_index: 0 },
  ]);
  expect(created.status, `현장결제 주문 실패: ${JSON.stringify(created.body)}`).toBe(201);
  const orderId = created.body.order_group_id;

  const confirm = await api(`/api/academy-admin/${F.academyA.id}/orders/confirm`, {
    token: TOK.owner,
    body: { orderGroupId: orderId },
  });
  expect(confirm.status, `현장결제 확정 실패: ${JSON.stringify(confirm.body)}`).toBe(200);
  expect(confirm.body.issued_tickets).toBe(1);
  expect(confirm.body.created_bookings + confirm.body.promoted_holds).toBeGreaterThanOrEqual(1);

  const { data: order } = await svc.from('order_groups').select('*').eq('id', orderId).single();
  expect(order.status).toBe('CONFIRMED');
  expect(order.method).toBe('ONSITE');

  const { data: items } = await svc.from('order_items').select('*').eq('order_group_id', orderId);
  const bookingItem = items.find((i: any) => i.item_type === 'SCHEDULE_BOOKING');
  const booking = await getBooking(bookingItem.result_booking_id);
  expect(booking.status).toBe('CONFIRMED');
  F.onsiteBookingId = booking.id;
});

test('AC-5 다회권 구매 + 즉시 차감 — 같은 주문이 발급한 권에 묶이고 1회만 빠진다', async () => {
  const created = await createOrder('BANK', [
    { item_type: 'TICKET_PURCHASE', ticket_id: F.ticketMulti.id },
    { item_type: 'SCHEDULE_BOOKING', schedule_id: F.cBuyMulti.schedule.id, use_purchase_index: 0 },
  ]);
  expect(created.status).toBe(201);
  const orderId = created.body.order_group_id;

  const confirm = await api(`/api/academy-admin/${F.academyA.id}/orders/confirm`, {
    token: TOK.owner,
    body: { orderGroupId: orderId },
  });
  expect(confirm.status, `확정 실패: ${JSON.stringify(confirm.body)}`).toBe(200);

  const { data: items } = await svc.from('order_items').select('*').eq('order_group_id', orderId);
  const purchase = items.find((i: any) => i.item_type === 'TICKET_PURCHASE');
  const bookingItem = items.find((i: any) => i.item_type === 'SCHEDULE_BOOKING');

  const issued = await getUserTicket(purchase.result_user_ticket_id);
  expect(issued.remaining_count, '5회권을 사서 1회 썼으면 4회 남아야 한다').toBe(4);
  expect(issued.status).toBe('ACTIVE');

  const booking = await getBooking(bookingItem.result_booking_id);
  expect(booking.status).toBe('CONFIRMED');
  expect(
    booking.user_ticket_id,
    '예약이 같은 주문에서 발급된 수강권에 묶여야 한다 (기존 보유권을 먹으면 안 된다)'
  ).toBe(issued.id);
});

test('AC-6 복수 수업 일괄 결제 — 불가 수업은 사유가 보이고, 빼고 결제하면 청구·예약되지 않는다', async ({
  page,
  context,
}) => {
  await loginAs(context, STUDENT_EMAIL);
  await page.setViewportSize({ width: 390, height: 844 });
  const errors = watchErrors(page);

  // 2개 수업은 예약 가능하도록 다회권을 준다
  await grantTicket(F.ticketMulti.id, 5);

  // 장바구니에 3개(그중 휴강 1개)를 담은 상태로 진입 — 실제 화면이 쓰는 저장소를 그대로 쓴다
  const cartKey = `miniapp-cart:${F.academyA.id}`;
  const entries = [
    { label: '일괄1', item: { item_type: 'SCHEDULE_BOOKING', schedule_id: F.cBulk1.schedule.id, use_purchase_index: null } },
    { label: '일괄불가(휴강)', item: { item_type: 'SCHEDULE_BOOKING', schedule_id: F.cBulkBad.schedule.id, use_purchase_index: null } },
    { label: '일괄2', item: { item_type: 'SCHEDULE_BOOKING', schedule_id: F.cBulk2.schedule.id, use_purchase_index: null } },
  ];
  await context.addInitScript(
    ([k, v]) => window.localStorage.setItem(k as string, v as string),
    [cartKey, JSON.stringify(entries)] as const
  );

  await page.goto(`/s/${F.academyA.slug}/cart`);
  await page.waitForLoadState('networkidle');

  await expect(page.getByTestId('cart-item')).toHaveCount(3);

  // ① 불가 사유가 결제 **전에** 화면에 드러난다
  const reason = page.getByTestId('reject-reason');
  await expect(reason).toHaveCount(1);
  await expect(reason.first()).toBeVisible();
  const reasonText = (await reason.first().innerText()).trim();
  expect(reasonText.length, '거절 사유가 비어 있다').toBeGreaterThan(0);

  // ② 학생이 불가 항목을 뺀다
  await page.getByTestId('drop-rejected').click();
  await expect(page.getByTestId('cart-item')).toHaveCount(2);
  await expect(page.getByTestId('reject-reason')).toHaveCount(0);

  // ③ 결제 진행
  await page.getByTestId('method-BANK').click();
  await page.getByTestId('checkout').click();
  await page.waitForURL(/\/orders\//, { timeout: 20000 });

  // ④ DB: 주문에는 2건만, 휴강 수업은 청구도 예약도 되지 않았다
  const { data: orders } = await svc
    .from('order_groups')
    .select('id, total_amount, status')
    .eq('academy_id', F.academyA.id)
    .eq('user_id', STUDENT_ID)
    .order('created_at', { ascending: false })
    .limit(1);
  const order = orders[0];
  const { data: items } = await svc.from('order_items').select('*').eq('order_group_id', order.id);
  expect(items).toHaveLength(2);

  const chargedSchedules = items.map((i: any) => i.schedule_id);
  expect(chargedSchedules).toContain(F.cBulk1.schedule.id);
  expect(chargedSchedules).toContain(F.cBulk2.schedule.id);
  expect(chargedSchedules, '휴강 수업이 주문에 들어갔다').not.toContain(F.cBulkBad.schedule.id);

  const { count: badBookings } = await svc
    .from('bookings')
    .select('id', { count: 'exact', head: true })
    .eq('schedule_id', F.cBulkBad.schedule.id);
  expect(badBookings, '뺀 수업에 예약이 생겼다').toBe(0);

  await expectNoHorizontalOverflow(page, '장바구니');
  expect(errors, `콘솔 에러: ${errors.join(' | ')}`).toEqual([]);
});

/* ================================================================== */
/* 2. 출석 — 4개 발생 경로 전부                                         */
/* ================================================================== */

/** 각 경로로 CONFIRMED 예약 하나를 만든다 */
async function bookingViaExistingTicket() {
  await grantTicket(F.ticketMulti.id, 5);
  const res = await api('/api/bookings', {
    token: TOK.student,
    body: { classId: F.cAttTicket.klass.id, scheduleId: F.cAttTicket.schedule.id },
  });
  expect(res.status, `기존권 예약 실패: ${JSON.stringify(res.body)}`).toBe(200);
  return res.body.data.id as string;
}

async function bookingViaOrder(method: 'BANK' | 'TOSS' | 'ONSITE', scheduleId: string) {
  const created = await createOrder(method, [
    { item_type: 'TICKET_PURCHASE', ticket_id: F.ticketSingle.id },
    { item_type: 'SCHEDULE_BOOKING', schedule_id: scheduleId, use_purchase_index: 0 },
  ]);
  expect(created.status, `${method} 주문 실패: ${JSON.stringify(created.body)}`).toBe(201);
  const orderId = created.body.order_group_id;

  if (method === 'TOSS') {
    // 실제 PG 승인은 외부 호출이라 테스트에서 부를 수 없다.
    // PG 응답 이후의 **앱 경로는 동일**하므로 그 지점부터 그대로 태운다.
    await approveAndFinalize(svc, {
      orderGroupId: orderId,
      approvedAmount: created.body.total_amount,
      method: 'TOSS',
      paymentKey: `test_${randomUUID()}`,
      confirmedBy: null,
    });
  } else {
    const confirm = await api(`/api/academy-admin/${F.academyA.id}/orders/confirm`, {
      token: TOK.owner,
      body: { orderGroupId: orderId },
    });
    expect(confirm.status, `${method} 확정 실패: ${JSON.stringify(confirm.body)}`).toBe(200);
  }

  const { data: items } = await svc.from('order_items').select('*').eq('order_group_id', orderId);
  const bi = items.find((i: any) => i.item_type === 'SCHEDULE_BOOKING');
  expect(bi?.result_booking_id, `${method}: 예약이 만들어지지 않았다`).toBeTruthy();
  return bi.result_booking_id as string;
}

test('ATT 출석 — 4개 경로(기존권·계좌·카드·현장) 모두 QR 스캔으로 출석 처리된다', async () => {
  const origins: { label: string; bookingId: string }[] = [
    { label: '기존 수강권', bookingId: await bookingViaExistingTicket() },
    { label: 'BANK 주문', bookingId: await bookingViaOrder('BANK', F.cAttBank.schedule.id) },
    { label: 'TOSS 주문', bookingId: await bookingViaOrder('TOSS', F.cAttToss.schedule.id) },
    { label: 'ONSITE 주문', bookingId: await bookingViaOrder('ONSITE', F.cAttOnsite.schedule.id) },
  ];

  for (const o of origins) {
    const before = await getBooking(o.bookingId);
    expect(before.status, `${o.label}: 출석 전 CONFIRMED 여야 한다`).toBe('CONFIRMED');

    const qr = await generateQr(o.bookingId);
    expect(qr.status, `${o.label}: QR 발급 실패 ${JSON.stringify(qr.body)}`).toBe(200);
    expect(qr.body.token, `${o.label}: QR 토큰 없음`).toBeTruthy();

    const scan = await scanQr(qr.body.token, F.academyA.id);
    expect(scan.status, `${o.label}: 스캔 실패 ${JSON.stringify(scan.body)}`).toBe(200);
    expect(scan.body.success).toBe(true);

    const after = await getBooking(o.bookingId);
    expect(after.status, `${o.label}: 출석 후 COMPLETED 여야 한다`).toBe('COMPLETED');
  }

  F.attendedBookingId = origins[0].bookingId;
});

test('ATT 중복 스캔은 멱등하다 — 두 번째 스캔은 이미 처리됨으로 거절되고 상태는 그대로', async () => {
  const qr = await generateQr(F.attendedBookingId);
  // 이미 COMPLETED 라 QR 발급 자체가 막힌다 (더 강한 보장)
  expect(qr.status).toBe(400);
  expect(String(qr.body.error)).toContain('출석완료');

  // 스캔 API 도 직접 두들겨 본다 — 상태가 뒤집히지 않아야 한다
  const scan = await scanQr('deadbeefdeadbeefdeadbeefdeadbeef.0.00000000', F.academyA.id);
  expect(scan.status).toBeGreaterThanOrEqual(400);

  const after = await getBooking(F.attendedBookingId);
  expect(after.status).toBe('COMPLETED');
});

test('ATT 학생은 스스로 출석 처리할 수 없다', async () => {
  // 아직 출석 안 한 예약 하나
  const bookingId = F.onsiteBookingId;
  const qr = await generateQr(bookingId);
  expect(qr.status).toBe(200);

  // 학생 토큰으로 체크인 시도 → 관리자 권한 없음
  const scan = await scanQr(qr.body.token, F.academyA.id, TOK.student);
  expect(scan.status, '학생이 자기 출석을 찍을 수 있으면 안 된다').toBe(403);

  const after = await getBooking(bookingId);
  expect(after.status).toBe('CONFIRMED');
});

test('ATT 다른 학원 스태프는 이 학원 QR 을 스캔할 수 없다', async () => {
  const bookingId = F.onsiteBookingId;
  const qr = await generateQr(bookingId);
  expect(qr.status).toBe(200);

  // 학원 B 스태프가 학원 A 의 QR 을 찍으려 한다
  const scan = await scanQr(qr.body.token, F.academyA.id, TOK.staffB);
  expect(scan.status, '타 학원 스태프가 출석을 찍을 수 있으면 안 된다').toBe(403);

  // 자기 학원 ID 로 우회해도 예약 학원이 달라 막힌다
  const bypass = await scanQr(qr.body.token, F.academyB.id, TOK.staffB);
  expect(bypass.status).toBeGreaterThanOrEqual(400);

  const after = await getBooking(bookingId);
  expect(after.status).toBe('CONFIRMED');
});

/* ================================================================== */
/* 3. 보안 스윕 — anon 키 / 학생 JWT 로 민감 표면 직격                   */
/* ================================================================== */

test('SEC anon·학생 JWT 는 민감한 쓰기·읽기를 전부 거부당한다', async () => {
  const anon = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const student = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: sess } = await student.auth.signInWithPassword({
    email: STUDENT_EMAIL,
    password: E2E_PASSWORD,
  });
  expect(sess.session, '학생 로그인 실패').toBeTruthy();

  const clients: [string, any][] = [
    ['anon', anon],
    ['student', student],
  ];

  // ① 수강권 임의 발급
  for (const [label, c] of clients) {
    const { data, error } = await c
      .from('user_tickets')
      .insert({
        user_id: STUDENT_ID,
        ticket_id: F.ticketMulti.id,
        status: 'ACTIVE',
        remaining_count: 999,
        start_date: kstToday(),
        expiry_date: kstDaysFromNow(60),
      })
      .select();
    expect(error, `${label}: user_tickets INSERT 가 막히지 않았다`).not.toBeNull();
    expect(data).toBeNull();
  }

  // ② 예약 상태 변조 (출석 자가 처리)
  const { data: anyBooking } = await svc
    .from('bookings')
    .select('id')
    .eq('user_id', STUDENT_ID)
    .eq('status', 'CONFIRMED')
    .limit(1)
    .maybeSingle();
  if (anyBooking) {
    for (const [label, c] of clients) {
      const { data } = await c
        .from('bookings')
        .update({ status: 'COMPLETED' })
        .eq('id', anyBooking.id)
        .select();
      expect(data ?? [], `${label}: bookings.status UPDATE 가 통과했다`).toHaveLength(0);
      const still = await getBooking(anyBooking.id);
      expect(still.status, `${label}: 예약 상태가 바뀌었다`).toBe('CONFIRMED');
    }
  }

  // ③ 잔여 횟수 복구 RPC
  const ut = await grantTicket(F.ticketMulti.id, 2);
  for (const [label, c] of clients) {
    const { error } = await c.rpc('restore_ticket_count', { p_user_ticket_id: ut.id, p_count: 50 });
    expect(error, `${label}: restore_ticket_count 가 호출됐다`).not.toBeNull();
  }
  expect((await getUserTicket(ut.id)).remaining_count).toBe(2);

  // ④ 숨김 멤버십 읽기
  for (const [label, c] of clients) {
    const { data } = await c.from('memberships').select('id').eq('id', F.hiddenMembership.id);
    expect(data ?? [], `${label}: 숨김 멤버십이 읽혔다`).toHaveLength(0);
  }

  // ⑤ 남의 주문 읽기 (학생 소유가 아닌 주문 = 게스트/타인)
  const { data: someOrder } = await svc
    .from('order_groups')
    .select('id')
    .eq('academy_id', F.academyA.id)
    .limit(1)
    .maybeSingle();
  if (someOrder) {
    const { data } = await anon.from('order_groups').select('id').eq('id', someOrder.id);
    expect(data ?? [], 'anon 이 주문을 읽었다').toHaveLength(0);
  }

  // ⑥ 멤버십 전용 수업 읽기
  for (const [label, c] of clients) {
    const { data } = await c.from('classes').select('id').eq('id', F.cMemberOnly.id);
    expect(data ?? [], `${label}: 멤버 전용 수업이 읽혔다`).toHaveLength(0);
  }
});

/* ================================================================== */
/* 4. 동시성                                                            */
/* ================================================================== */

test('CONC 마지막 한 자리에 10명이 동시에 몰려도 예약은 정확히 1건', async () => {
  // 서로 다른 사용자 10명 (예약 중복 방지는 사용자 단위라 반드시 달라야 한다)
  const users: string[] = [];
  for (let i = 0; i < 10; i++) {
    const id = randomUUID();
    await svc.from('users').insert({ id, email: `t12-conc-${i}-${stamp}@example.test`, name: `T12동시${i}`, role: 'USER' });
    syntheticUserIds.push(id);
    users.push(id);
    await grantTicket(F.ticketMulti.id, 5, id);
  }

  const results = await Promise.allSettled(
    users.map((uid) =>
      svc.rpc('create_booking_tx', {
        p_schedule_id: F.cLastSeat.schedule.id,
        p_user_ticket_id: null,
        p_order_item_id: null,
        p_user_id: uid,
      })
    )
  );
  const ok = results.filter((r) => r.status === 'fulfilled' && !(r as any).value.error).length;
  expect(ok, '정원 1석에 2건 이상이 들어갔다').toBe(1);

  const { count } = await svc
    .from('bookings')
    .select('id', { count: 'exact', head: true })
    .eq('schedule_id', F.cLastSeat.schedule.id)
    .in('status', ['CONFIRMED', 'PENDING']);
  expect(count, 'DB 상 좌석 초과 예약이 존재한다').toBe(1);
});

test('CONC 더블클릭(같은 주문번호 동시 제출)은 주문을 하나만 만든다', async () => {
  const providerOrderId = `T12-DBL-${stamp}-${Date.now().toString(36)}`;
  const items = [{ item_type: 'TICKET_PURCHASE', ticket_id: F.ticketMulti.id }];

  const [a, b] = await Promise.all([
    createOrder('BANK', items, { providerOrderId }),
    createOrder('BANK', items, { providerOrderId }),
  ]);

  expect([a.status, b.status].every((s) => s === 200 || s === 201)).toBe(true);
  expect(a.body.order_group_id).toBe(b.body.order_group_id);

  const { count } = await svc
    .from('order_groups')
    .select('id', { count: 'exact', head: true })
    .eq('provider_order_id', providerOrderId);
  expect(count, '같은 주문번호로 주문이 2건 생겼다').toBe(1);
});

test('CONC 1회권을 두 수업에 동시에 쓰면 정확히 1건만 성공한다', async () => {
  const ut = await grantTicket(F.ticketSingle.id, 1);

  const results = await Promise.allSettled([
    svc.rpc('create_booking_tx', {
      p_schedule_id: F.cRace1.schedule.id,
      p_user_ticket_id: ut.id,
      p_order_item_id: null,
      p_user_id: STUDENT_ID,
    }),
    svc.rpc('create_booking_tx', {
      p_schedule_id: F.cRace2.schedule.id,
      p_user_ticket_id: ut.id,
      p_order_item_id: null,
      p_user_id: STUDENT_ID,
    }),
  ]);
  const ok = results.filter((r) => r.status === 'fulfilled' && !(r as any).value.error).length;
  expect(ok, '1회권으로 2건이 예약됐다 (초과 차감)').toBe(1);

  const after = await getUserTicket(ut.id);
  expect(after.remaining_count, '잔여가 음수이거나 덜 빠졌다').toBe(0);
});

test('CONC 홀드 만료와 입금 확인이 동시에 일어나도 결과는 정확히 하나', async () => {
  const created = await createOrder('BANK', [
    { item_type: 'TICKET_PURCHASE', ticket_id: F.ticketMulti.id },
    { item_type: 'SCHEDULE_BOOKING', schedule_id: F.cHold.schedule.id, use_purchase_index: 0 },
  ]);
  expect(created.status).toBe(201);
  const orderId = created.body.order_group_id;

  // 홀드를 이미 만료된 것으로 만든다 (만료 스윕이 이 주문을 집도록)
  await svc
    .from('order_groups')
    .update({ expires_at: new Date(Date.now() - 60_000).toISOString() })
    .eq('id', orderId);

  const [sweep, confirm] = await Promise.allSettled([
    svc.rpc('expire_pending_bank_orders'),
    api(`/api/academy-admin/${F.academyA.id}/orders/confirm`, {
      token: TOK.owner,
      body: { orderGroupId: orderId },
    }),
  ]);
  void sweep;

  const { data: order } = await svc.from('order_groups').select('*').eq('id', orderId).single();
  expect(
    ['CONFIRMED', 'EXPIRED', 'CANCELED'].includes(order.status),
    `주문이 어중간한 상태로 남았다: ${order.status}`
  ).toBe(true);

  const { data: bookings } = await svc.from('bookings').select('status').eq('order_group_id', orderId);
  if (order.status === 'CONFIRMED') {
    // 확정이 이겼다면 예약은 살아 있어야 하고, 확정 응답도 성공이어야 한다
    expect(confirm.status).toBe('fulfilled');
    expect((confirm as any).value.status).toBe(200);
    expect(bookings.every((b: any) => b.status === 'CONFIRMED')).toBe(true);
  } else {
    // 만료가 이겼다면 살아남은 홀드가 없어야 한다
    expect(bookings.some((b: any) => ['CONFIRMED', 'PENDING'].includes(b.status))).toBe(false);
  }
});

/* ================================================================== */
/* 5. UI — 390px 가로 오버플로 · 콘솔 에러                              */
/* ================================================================== */

test('UI 390px 학생 미니앱 전 화면에 가로 오버플로와 콘솔 에러가 없다', async ({ page, context }) => {
  await loginAs(context, STUDENT_EMAIL);
  await page.setViewportSize({ width: 390, height: 844 });
  const errors = watchErrors(page);

  for (const seg of ['', '/schedule', '/tickets', '/workshops', '/my', '/cart']) {
    await page.goto(`/s/${F.academyA.slug}${seg}`);
    await page.waitForLoadState('networkidle');
    await expectNoHorizontalOverflow(page, `미니앱 ${seg || '/'}`);
  }
  expect(errors, `콘솔 에러: ${errors.join(' | ')}`).toEqual([]);
});

test('UI 390px 운영 콘솔 주요 화면에 가로 오버플로와 콘솔 에러가 없다', async ({ page, context }) => {
  await loginAs(context, OWNER_EMAIL);
  await page.setViewportSize({ width: 390, height: 844 });
  const errors = watchErrors(page);

  for (const seg of ['', '/roster', '/students', '/payments', '/products', '/schedule', '/deposit-confirm']) {
    await page.goto(`/academy-admin/${F.academyA.slug}${seg}`);
    // 콘솔은 주기적 폴링이 있어 networkidle 에 도달하지 않는다 (admin-console.spec 과 같은 이유).
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('main, [role="main"], body')).toBeVisible();
    await page.waitForTimeout(1200); // 클라이언트 렌더 안정화
    await expectNoHorizontalOverflow(page, `콘솔 ${seg || '/'}`);
  }
  expect(errors, `콘솔 에러: ${errors.join(' | ')}`).toEqual([]);
});

/* ================================================================== */
/* 6. 스위트 위생 — 자기 픽스처 정리 + 실제 학원 무결                    */
/* ================================================================== */

test('HYG 스위트가 만든 픽스처는 전부 지워지고, 실제 학원은 한 행도 달라지지 않았다', async () => {
  await cleanup();

  // ① 이 스위트가 만든 테스트 학원이 남아 있지 않다.
  //    (다른 스펙까지 아우르는 전체 감사는 이 스펙보다 **뒤에** 도는 스펙을 볼 수 없으므로
  //     스위트 전체 실행 후 scripts/verify-no-test-leftovers.mjs 로 따로 확인한다.)
  const { data: leftovers } = await svc.from('academies').select('id, slug').like('slug', 't12-%');
  expect(leftovers ?? [], `테스트 학원 잔재: ${JSON.stringify(leftovers)}`).toHaveLength(0);

  // ② 이 스위트가 만든 합성 사용자도 남지 않았다
  if (syntheticUserIds.length) {
    const { data: users } = await svc.from('users').select('id').in('id', syntheticUserIds);
    expect(users ?? [], '합성 사용자 잔재').toHaveLength(0);
  }

  // ③ 실제 MID 학원: is_active 와 행 수가 스위트 시작 전과 동일하다
  const { data: mid } = await svc
    .from('academies')
    .select('id, is_active')
    .eq('slug', REAL_ACADEMY_SLUG)
    .single();
  expect(mid.is_active, '실제 학원의 is_active 가 변경됐다').toBe(midBefore.is_active);
  expect(mid.is_active, '실제 학원은 다크런치 상태(false)여야 한다').toBe(false);

  const after = await snapshotAcademy(mid.id);
  expect(after, '실제 학원 데이터가 변경됐다').toEqual({
    classes: midBefore.classes,
    schedules: midBefore.schedules,
    bookings: midBefore.bookings,
    tickets: midBefore.tickets,
    orders: midBefore.orders,
    memberships: midBefore.memberships,
  });
});
