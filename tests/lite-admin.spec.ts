/**
 * 라이트 어드민(/a/[slug]) Phase 1 — 셸 + 오늘 + 수업 E2E
 *
 * 실행: npx playwright test tests/lite-admin.spec.ts --workers=1
 *
 * 전용 테스트 학원(slug: a-lite-*, is_active=true) 위에서만 동작한다.
 * 실제 MID 학원(slug='mid')은 읽지도 쓰지도 않는다. 정리(afterAll)는 FK 역순으로 전부 되돌린다.
 *
 * 검증하는 것 (VERIFICATION FLOOR):
 *  - 비스태프(학생 JWT)는 /a 페이지 · /a API 양쪽에서 차단된다
 *  - 오늘: 회차가 정확한 신청 수로 뜨고, 명단에 실제 예약이 보이며, 원탭 출석→COMPLETED / 결석→ABSENT,
 *          중복 탭이 이중기록하지 않는다
 *  - 입금대기 배지: BANK 홀드 예약이 있으면 표시된다
 *  - 수업 추가(수업군 지정) → 학생이 곧바로 예약 가능(RPC 로 증명)
 *  - 수업 수정(시간) 반영 / 휴강 → is_canceled=true + CLASS_CANCELED booking_event
 *  - 미태깅 수업은 "예약 준비 필요" 배지 + 인라인 지정으로 예약 가능해진다
 *  - 390px 가로 오버플로 없음 · 콘솔 에러 0
 */
import { test, expect, type Page, type BrowserContext } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

import { applySeed } from '../scripts/mid-seed-config.mjs';
import { kstToday, kstDateString, diffDays } from '../lib/date/kst';

// --- env ---
const env = Object.fromEntries(
  readFileSync(path.join(process.cwd(), '.env.local'), 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=');
      let v = l.slice(i + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      return [l.slice(0, i).trim(), v];
    })
);
for (const [k, v] of Object.entries(env)) if (process.env[k] === undefined) process.env[k] = v as string;

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON_KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const svc = createClient(SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
}) as any;

const OWNER_EMAIL = 'e2e-moveit-owner@modoogoods.com';
const STUDENT_EMAIL = 'e2e-moveit-student@modoogoods.com';
const E2E_PASSWORD = 'Test1234!e2e';
const OWNER_ID = '6e33f238-14c6-41d7-9715-d131067b6885';
const STUDENT_ID = 'fd2fd033-2f2c-4cad-890b-f2c9c75a0f23';

const PROJECT_REF = new URL(SUPABASE_URL).hostname.split('.')[0];
const AUTH_COOKIE = `sb-${PROJECT_REF}-auth-token`;
const MAX_CHUNK = 3180;
const BASE = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';

const stamp = randomUUID().slice(0, 8);
const F: Record<string, any> = {};

// 예약창은 항상 열리게 (관심사는 라이트 어드민 화면이지 예약창 판정이 아님)
const ALWAYS_OPEN = { open: null, close: { minutesBefore: 0 }, cancelUntil: { minutesBefore: 0 } };
// 회차는 지금부터 3시간 뒤 = 거의 항상 KST 오늘 (예약창 OPEN 보장)
const BOOK_AT = new Date(Date.now() + 3 * 60 * 60 * 1000);
const TARGET_DATE = kstDateString(BOOK_AT); // 오늘 탭이 보여줄 KST 날짜
const END_AT = new Date(BOOK_AT.getTime() + 90 * 60 * 1000);

async function ins(table: string, row: Record<string, any>) {
  const { data, error } = await svc.from(table).insert(row).select().single();
  if (error) throw new Error(`${table} insert 실패: ${error.message}`);
  return data;
}

async function loginAs(context: BrowserContext, email: string) {
  const anon = createClient(SUPABASE_URL, ANON_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data, error } = await anon.auth.signInWithPassword({ email, password: E2E_PASSWORD });
  if (error || !data.session) throw new Error(`${email} 로그인 실패: ${error?.message}`);
  const encoded = 'base64-' + Buffer.from(JSON.stringify(data.session), 'utf8').toString('base64url');
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
}

async function token(email: string): Promise<string> {
  const anon = createClient(SUPABASE_URL, ANON_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data, error } = await anon.auth.signInWithPassword({ email, password: E2E_PASSWORD });
  if (error || !data.session) throw new Error(`${email} 토큰 발급 실패: ${error?.message}`);
  return data.session.access_token;
}

function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console: ${m.text()}`);
  });
  return errors;
}

function book(scheduleId: string, userTicketId: string | null, userId = STUDENT_ID) {
  return svc.rpc('create_booking_tx', {
    p_schedule_id: scheduleId,
    p_user_ticket_id: userTicketId,
    p_order_item_id: null,
    p_user_id: userId,
  });
}

/** 오늘 탭에서 TARGET_DATE 로 날짜 스위처를 이동 (BOOK_AT 이 자정 넘겨 내일이 되는 경우 대비) */
async function gotoTargetDate(page: Page) {
  const steps = diffDays(TARGET_DATE, kstToday());
  for (let i = 0; i < steps; i++) await page.getByTestId('date-next').click();
}

/* ------------------------------------------------------------------ */
test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  F.academy = await ins('academies', {
    name_kr: `라이트어드민-${stamp}`,
    slug: `a-lite-${stamp}`,
    is_active: true,
    brand_color: '#7C3AED',
    booking_policy: ALWAYS_OPEN,
  });
  await ins('academy_user_roles', { academy_id: F.academy.id, user_id: OWNER_ID, role: 'ACADEMY_OWNER' });

  // 그룹·수강권·커버리지·멤버십 시드 (수업 태깅은 직접 한다)
  F.report = await applySeed(svc, F.academy.id, { tagClasses: false });
  await svc.from('academies').update({ booking_policy: ALWAYS_OPEN }).eq('id', F.academy.id);
  F.regularGroup = F.report.groups.byKey['regular'];
  F.allPass = F.report.tickets.byName['ALL PASS'];

  const mkClass = (title: string, groupId: string | null) =>
    ins('classes', {
      academy_id: F.academy.id,
      title,
      class_type: 'regular',
      status: '정상',
      is_active: true,
      max_students: 20,
      instructor_name: `강사-${stamp}`,
      class_group_id: groupId,
      booking_policy: ALWAYS_OPEN,
    });
  const mkSched = (classId: string) =>
    ins('schedules', {
      class_id: classId,
      start_time: BOOK_AT.toISOString(),
      end_time: END_AT.toISOString(),
      max_students: 20,
      is_canceled: false,
    });

  // DB 제약: (class_id, KST 날짜) 당 회차 1개 → 같은 날 회차는 각기 다른 수업에 둔다.
  F.classToday = await mkClass(`오늘수업-${stamp}`, F.regularGroup);
  F.schToday = await mkSched(F.classToday.id); // 출석(UI)
  F.classAbsent = await mkClass(`결석수업-${stamp}`, F.regularGroup);
  F.schAbsent = await mkSched(F.classAbsent.id); // 결석(API)
  F.classEdit = await mkClass(`수정수업-${stamp}`, F.regularGroup);
  F.schEdit = await mkSched(F.classEdit.id); // 수정 + 휴강(API)

  F.classHold = await mkClass(`홀드수업-${stamp}`, F.regularGroup);
  F.schHold = await mkSched(F.classHold.id); // 입금대기 배지

  F.classUntagged = await mkClass(`미태깅수업-${stamp}`, null);
  F.schUntagged = await mkSched(F.classUntagged.id); // 예약 준비 필요

  // 학생에게 ALL PASS 지급 (무제한 PERIOD)
  F.allPassUt = await ins('user_tickets', {
    user_id: STUDENT_ID,
    ticket_id: F.allPass,
    remaining_count: null,
    start_date: kstToday(),
    expiry_date: '2099-12-31',
    status: 'ACTIVE',
  });

  // 확정 예약 2건 (출석용 · 결석용)
  const b1 = await book(F.schToday.id, F.allPassUt.id);
  if (b1.error) throw new Error(`schToday 예약 실패: ${b1.error.message}`);
  F.bookingAttend = b1.data.booking_id;
  const b2 = await book(F.schAbsent.id, F.allPassUt.id);
  if (b2.error) throw new Error(`schAbsent 예약 실패: ${b2.error.message}`);
  F.bookingAbsent = b2.data.booking_id;

  // 입금대기(BANK 홀드) 예약: PENDING_PAYMENT 주문 + PENDING 홀드 예약
  F.heldOrder = await ins('order_groups', {
    academy_id: F.academy.id,
    user_id: STUDENT_ID,
    method: 'BANK',
    status: 'PENDING_PAYMENT',
    original_amount: 10000,
    discount_amount: 0,
    total_amount: 10000,
    provider_order_id: `lite-hold-${stamp}`,
    expires_at: new Date(Date.now() + 24 * 3600_000).toISOString(),
  });
  F.heldBooking = await ins('bookings', {
    schedule_id: F.schHold.id,
    class_id: F.classHold.id,
    user_id: STUDENT_ID,
    status: 'PENDING',
    order_group_id: F.heldOrder.id,
    hold_expires_at: new Date(Date.now() + 24 * 3600_000).toISOString(),
  });
});

test.afterAll(async () => {
  const aid = F.academy?.id ?? '';
  if (!aid) return;
  const fail = (label: string, error: any) => {
    if (error) console.error(`[lite cleanup] ${label} 실패: ${error.message}`);
  };
  const { data: classes } = await svc.from('classes').select('id').eq('academy_id', aid);
  const classIds = (classes ?? []).map((c: any) => c.id);
  const { data: orders } = await svc.from('order_groups').select('id').eq('academy_id', aid);
  const orderIds = (orders ?? []).map((o: any) => o.id);
  const { data: tks } = await svc.from('tickets').select('id').eq('academy_id', aid);
  const ticketIds = (tks ?? []).map((t: any) => t.id);
  const { data: mss } = await svc.from('memberships').select('id').eq('academy_id', aid);
  const membershipIds = (mss ?? []).map((m: any) => m.id);

  fail('booking_events', (await svc.from('booking_events').delete().eq('academy_id', aid)).error);
  fail('enrollment_activity_log', (await svc.from('enrollment_activity_log').delete().eq('academy_id', aid)).error);
  if (orderIds.length) fail('order_items', (await svc.from('order_items').delete().in('order_group_id', orderIds)).error);
  if (classIds.length) fail('bookings', (await svc.from('bookings').delete().in('class_id', classIds)).error);
  if (orderIds.length) fail('order_groups', (await svc.from('order_groups').delete().in('id', orderIds)).error);
  if (classIds.length) fail('schedules', (await svc.from('schedules').delete().in('class_id', classIds)).error);
  fail('student_memberships', (await svc.from('student_memberships').delete().eq('academy_id', aid)).error);
  if (ticketIds.length) {
    fail('user_tickets', (await svc.from('user_tickets').delete().in('ticket_id', ticketIds)).error);
    fail('ticket_coverage', (await svc.from('ticket_coverage').delete().in('ticket_id', ticketIds)).error);
    fail('ticket_classes', (await svc.from('ticket_classes').delete().in('ticket_id', ticketIds)).error);
  }
  if (membershipIds.length) fail('membership_discounts', (await svc.from('membership_discounts').delete().in('membership_id', membershipIds)).error);
  fail('classes', (await svc.from('classes').delete().eq('academy_id', aid)).error);
  fail('class_groups', (await svc.from('class_groups').delete().eq('academy_id', aid)).error);
  fail('memberships', (await svc.from('memberships').delete().eq('academy_id', aid)).error);
  fail('tickets', (await svc.from('tickets').delete().eq('academy_id', aid)).error);
  fail('academy_user_roles', (await svc.from('academy_user_roles').delete().eq('academy_id', aid)).error);
  fail('academies', (await svc.from('academies').delete().eq('id', aid)).error);

  const { count } = await svc.from('academies').select('id', { count: 'exact', head: true }).eq('id', aid);
  if (count) console.error(`[lite cleanup] 테스트 학원 ${aid} 가 남아 있다 — FK 역순을 다시 확인하라`);
});

/* ================================================================== */
test('보안: 학생 JWT 는 /a API 와 페이지에서 차단된다', async ({ page, context }) => {
  const st = await token(STUDENT_EMAIL);
  const auth = { Authorization: `Bearer ${st}` };
  const aid = F.academy.id;

  const occ = await fetch(`${BASE}/api/a/${aid}/occurrences?from=${TARGET_DATE}&to=${TARGET_DATE}`, { headers: auth });
  expect(occ.status, 'occurrences 는 학생에게 403').toBe(403);
  const refs = await fetch(`${BASE}/api/a/${aid}/refs`, { headers: auth });
  expect(refs.status, 'refs 는 학생에게 403').toBe(403);
  const roster = await fetch(`${BASE}/api/academy-admin/${aid}/console/roster?date=${TARGET_DATE}`, { headers: auth });
  expect(roster.status, 'roster 는 학생에게 403').toBe(403);
  const patch = await fetch(`${BASE}/api/a/${aid}/schedules/${F.schEdit.id}`, {
    method: 'PATCH',
    headers: { ...auth, 'content-type': 'application/json' },
    body: JSON.stringify({ capacity: 5 }),
  });
  expect(patch.status, 'schedule PATCH 는 학생에게 403').toBe(403);
  const create = await fetch(`${BASE}/api/a/${aid}/classes`, {
    method: 'POST',
    headers: { ...auth, 'content-type': 'application/json' },
    body: JSON.stringify({ title: 'x', classGroupId: F.regularGroup, date: TARGET_DATE, startTime: '10:00', endTime: '11:00' }),
  });
  expect(create.status, 'class POST 는 학생에게 403').toBe(403);

  // 페이지: 학생 로그인 → 접근 거부
  await loginAs(context, STUDENT_EMAIL);
  await page.goto(`/a/${F.academy.slug}`);
  await expect(page.getByText('접근 권한 없음')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId('today-list')).toHaveCount(0);
});

test('오늘: 회차 렌더 + 명단 + 원탭 출석→COMPLETED, 결석→ABSENT, 중복탭 무해', async ({ page, context }) => {
  await loginAs(context, OWNER_EMAIL);
  const errors = watchErrors(page);
  await page.setViewportSize({ width: 390, height: 844 });

  await page.goto(`/a/${F.academy.slug}`);
  await expect(page.getByTestId('lite-admin-shell')).toBeVisible({ timeout: 25_000 });
  await gotoTargetDate(page);

  // schToday 회차가 신청 1/20 로 뜬다
  const card = page.locator(`[data-testid="today-occurrence"][data-schedule-id="${F.schToday.id}"]`);
  await expect(card).toBeVisible({ timeout: 20_000 });
  await expect(card).toContainText('신청 1/20');

  // 명단 열기 → 예약자 보이고 원탭 출석
  await card.click();
  await expect(page.getByTestId('roster-sheet')).toBeVisible();
  const row = page.locator(`[data-testid="roster-row"][data-booking-id="${F.bookingAttend}"]`);
  await expect(row).toBeVisible();
  await row.getByTestId('act-attend').click();
  await expect(row).toHaveAttribute('data-state', 'ATTENDED', { timeout: 15_000 });

  const { data: bkA } = await svc.from('bookings').select('status').eq('id', F.bookingAttend).single();
  expect(bkA.status, '출석 원탭이 COMPLETED 로 반영돼야 한다').toBe('COMPLETED');

  // 중복탭 무해: COMPLETED 로 한 번 더 PATCH 해도 상태 유지 (이중기록 없음)
  const ownerTok = await token(OWNER_EMAIL);
  const dup = await fetch(`${BASE}/api/bookings/${F.bookingAttend}/status`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${ownerTok}`, 'content-type': 'application/json' },
    body: JSON.stringify({ status: 'COMPLETED' }),
  });
  expect(dup.ok).toBeTruthy();
  const { data: bkA2 } = await svc.from('bookings').select('status').eq('id', F.bookingAttend).single();
  expect(bkA2.status).toBe('COMPLETED');

  // 결석: 같은 API 로 ABSENT (UI 버튼이 부르는 그 경로)
  const abs = await fetch(`${BASE}/api/bookings/${F.bookingAbsent}/status`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${ownerTok}`, 'content-type': 'application/json' },
    body: JSON.stringify({ status: 'ABSENT' }),
  });
  expect(abs.ok).toBeTruthy();
  const { data: bkB } = await svc.from('bookings').select('status').eq('id', F.bookingAbsent).single();
  expect(bkB.status, '결석이 ABSENT 로 반영돼야 한다').toBe('ABSENT');

  // 입금대기 배지 (schHold)
  const holdCard = page.locator(`[data-testid="today-occurrence"][data-schedule-id="${F.schHold.id}"]`);
  await expect(holdCard).toBeVisible();
  await expect(holdCard.getByTestId('badge-deposit-pending')).toBeVisible();

  // 390px 가로 오버플로 없음 + 콘솔 에러 0
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, `오늘 탭 가로 오버플로 ${overflow}px`).toBeLessThanOrEqual(1);
  expect(errors, `콘솔 에러: ${errors.join(' | ')}`).toEqual([]);
});

test('수업: 추가(수업군 지정)하면 학생이 곧바로 예약 가능', async ({ page, context }) => {
  await loginAs(context, OWNER_EMAIL);
  const errors = watchErrors(page);
  await page.setViewportSize({ width: 390, height: 844 });

  await page.goto(`/a/${F.academy.slug}/classes`);
  await expect(page.getByTestId('week-grid')).toBeVisible({ timeout: 25_000 });

  const title = `추가수업-${stamp}`;
  const addDate = kstDateString(new Date(BOOK_AT.getTime() + 7 * 86400_000)); // 다음 주(미래, 예약창 OPEN)
  await page.getByTestId('add-class').click();
  await expect(page.getByTestId('class-form-sheet')).toBeVisible();
  await page.getByTestId('field-title').fill(title);
  await page.getByTestId('field-group').selectOption(F.regularGroup);
  await page.getByTestId('field-instructor').fill(`추가강사-${stamp}`);
  await page.getByTestId('field-date').fill(addDate);
  await page.getByTestId('field-start').fill('19:00');
  await page.getByTestId('field-end').fill('20:30');
  await page.getByTestId('field-capacity').fill('10');
  await page.getByTestId('class-form-save').click();
  await expect(page.getByTestId('class-form-sheet')).toHaveCount(0, { timeout: 15_000 });

  // DB: 수업 + 회차 생성, 수업군 지정됨(=예약 가능 상태)
  const { data: cls } = await svc.from('classes').select('id, class_group_id').eq('academy_id', F.academy.id).eq('title', title).single();
  expect(cls.class_group_id, '새 수업에 수업군이 지정돼야 한다').toBe(F.regularGroup);
  const { data: scheds } = await svc.from('schedules').select('id').eq('class_id', cls.id);
  expect((scheds ?? []).length).toBe(1);
  F.addedScheduleId = scheds![0].id;

  // 학생이 곧바로 예약 가능 (엔진 경로로 증명)
  const booked = await book(F.addedScheduleId, F.allPassUt.id);
  expect(booked.error, `새 수업 예약 실패: ${booked.error?.message}`).toBeNull();
  expect(booked.data.ok).toBe(true);

  expect(errors, `콘솔 에러: ${errors.join(' | ')}`).toEqual([]);
});

test('수업: 미태깅 수업은 "예약 준비 필요" 배지 + 인라인 지정으로 예약 가능', async ({ page, context }) => {
  await loginAs(context, OWNER_EMAIL);
  await page.setViewportSize({ width: 390, height: 844 });

  await page.goto(`/a/${F.academy.slug}/classes`);
  await expect(page.getByTestId('week-grid')).toBeVisible({ timeout: 25_000 });
  // TARGET_DATE 로 이동
  await page.locator(`[data-testid="week-day"][data-date="${TARGET_DATE}"]`).click();

  const occ = page.locator(`[data-testid="class-occurrence"][data-schedule-id="${F.schUntagged.id}"]`);
  await expect(occ).toBeVisible({ timeout: 20_000 });
  await expect(occ.getByTestId('readiness-inline')).toBeVisible();

  // 인라인 수업군 지정
  await occ.getByTestId('readiness-group-select').selectOption(F.regularGroup);

  // DB: 수업군이 붙었다 → 예약 가능
  await expect.poll(async () => {
    const { data } = await svc.from('classes').select('class_group_id').eq('id', F.classUntagged.id).single();
    return data?.class_group_id;
  }, { timeout: 15_000 }).toBe(F.regularGroup);

  const booked = await book(F.schUntagged.id, F.allPassUt.id);
  expect(booked.error, `태깅 후 예약 실패: ${booked.error?.message}`).toBeNull();
  expect(booked.data.ok).toBe(true);
});

test('수업: 시간 수정 반영 + 휴강 → is_canceled + CLASS_CANCELED 이벤트', async () => {
  const ownerTok = await token(OWNER_EMAIL);
  const aid = F.academy.id;

  // 시간 수정
  const newDate = kstDateString(BOOK_AT);
  const patch = await fetch(`${BASE}/api/a/${aid}/schedules/${F.schEdit.id}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${ownerTok}`, 'content-type': 'application/json' },
    body: JSON.stringify({ date: newDate, startTime: '07:15', endTime: '08:45', capacity: 8 }),
  });
  expect(patch.ok, `수정 실패(${patch.status})`).toBeTruthy();
  const { data: sEdited } = await svc.from('schedules').select('start_time, max_students').eq('id', F.schEdit.id).single();
  expect(new Date(sEdited.start_time).getUTCHours()).toBe(22); // 07:15 KST = 22:15 UTC(전일)
  expect(sEdited.max_students).toBe(8);

  // 휴강 (소프트)
  const cancel = await fetch(`${BASE}/api/a/${aid}/schedules/${F.schEdit.id}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${ownerTok}`, 'content-type': 'application/json' },
    body: JSON.stringify({ isCanceled: true }),
  });
  expect(cancel.ok, `휴강 실패(${cancel.status})`).toBeTruthy();
  const { data: sCanceled } = await svc.from('schedules').select('is_canceled').eq('id', F.schEdit.id).single();
  expect(sCanceled.is_canceled).toBe(true);

  // CLASS_CANCELED 이벤트가 트리거로 기록됐다
  const { data: ev } = await svc
    .from('booking_events')
    .select('event_type, schedule_id')
    .eq('schedule_id', F.schEdit.id)
    .eq('event_type', 'CLASS_CANCELED');
  expect((ev ?? []).length, 'CLASS_CANCELED booking_event 가 없다').toBeGreaterThan(0);
});

test('수업 탭: 390px 가로 오버플로 없음 · 콘솔 에러 0', async ({ page, context }) => {
  await loginAs(context, OWNER_EMAIL);
  const errors = watchErrors(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/a/${F.academy.slug}/classes`);
  await expect(page.getByTestId('week-grid')).toBeVisible({ timeout: 25_000 });
  await page.locator(`[data-testid="week-day"][data-date="${TARGET_DATE}"]`).click();
  await expect(page.getByTestId('day-class-list')).toBeVisible({ timeout: 15_000 });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, `수업 탭 가로 오버플로 ${overflow}px`).toBeLessThanOrEqual(1);
  expect(errors, `콘솔 에러: ${errors.join(' | ')}`).toEqual([]);
});
