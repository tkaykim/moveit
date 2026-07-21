/**
 * 라이트 어드민(/a/[slug]) Phase 2 — 입금·결제 / 수강생 / 전문반 E2E
 *
 * 실행: npx playwright test tests/lite-admin-2.spec.ts --workers=1
 *
 * 전용 테스트 학원 위에서만 동작한다(slug: a-lite2-*). 실제 MID(slug='mid')는 손대지 않는다.
 * 정리(afterAll)는 FK 역순으로 전부 되돌린다.
 *
 * 돈·감사·보안이 걸린 검증은 API/DB 로(결정적), 렌더·오버플로·콘솔은 UI 로 잡는다.
 * 새 라우트는 전부 기존 검증된 엔진(create_order_group / finalize / adjust-ticket-count /
 * grant/suspend/extend / review-queue)을 재사용하며 비즈니스 규칙을 새로 만들지 않는다.
 */
import { test, expect, type Page, type BrowserContext } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

import { applySeed } from '../scripts/mid-seed-config.mjs';
import { kstToday, kstDateString } from '../lib/date/kst';

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

const ALWAYS_OPEN = { open: null, close: { minutesBefore: 0 }, cancelUntil: { minutesBefore: 0 } };
const BOOK_AT = new Date(Date.now() + 3 * 60 * 60 * 1000);
const FUTURE_AT = new Date(Date.now() + 7 * 86400_000);

async function ins(table: string, row: Record<string, any>) {
  const { data, error } = await svc.from(table).insert(row).select().single();
  if (error) throw new Error(`${table} insert 실패: ${error.message}`);
  return data;
}
async function token(email: string): Promise<string> {
  const anon = createClient(SUPABASE_URL, ANON_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data, error } = await anon.auth.signInWithPassword({ email, password: E2E_PASSWORD });
  if (error || !data.session) throw new Error(`${email} 토큰 발급 실패: ${error?.message}`);
  return data.session.access_token;
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
function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console: ${m.text()}`);
  });
  return errors;
}
async function api(method: string, url: string, tok: string, body?: unknown) {
  const res = await fetch(`${BASE}${url}`, {
    method,
    headers: { Authorization: `Bearer ${tok}`, 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, json };
}
async function countUserTickets(userId: string, ticketId: string): Promise<number> {
  const { count } = await svc
    .from('user_tickets')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('ticket_id', ticketId);
  return count ?? 0;
}

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  F.academy = await ins('academies', {
    name_kr: `라이트어드민2-${stamp}`,
    slug: `a-lite2-${stamp}`,
    is_active: true,
    brand_color: '#7C3AED',
    booking_policy: ALWAYS_OPEN,
  });
  await ins('academy_user_roles', { academy_id: F.academy.id, user_id: OWNER_ID, role: 'ACADEMY_OWNER' });

  F.report = await applySeed(svc, F.academy.id, { tagClasses: false });
  await svc.from('academies').update({ booking_policy: ALWAYS_OPEN }).eq('id', F.academy.id);

  F.regularGroup = F.report.groups.byKey['regular'];
  F.coupon5 = F.report.tickets.byName['쿠폰 5장']; // COUNT, on_sale, regular 커버
  F.allPass = F.report.tickets.byName['ALL PASS']; // PERIOD
  F.cszz = F.report.tickets.byName['춤숨찐 티켓']; // COUNT, pro 할인 50%
  F.proId = F.report.memberships.byKey['pro'];

  const { data: cszzRow } = await svc.from('tickets').select('price').eq('id', F.cszz).single();
  F.cszzPrice = cszzRow?.price ?? 0;

  // regular 수업 + 오늘 회차 (현장결제 오늘예약 옵션·roster 용)
  F.classToday = await ins('classes', {
    academy_id: F.academy.id,
    title: `오늘수업2-${stamp}`,
    class_type: 'regular',
    status: '정상',
    is_active: true,
    max_students: 20,
    class_group_id: F.regularGroup,
    booking_policy: ALWAYS_OPEN,
  });
  F.schToday = await ins('schedules', {
    class_id: F.classToday.id,
    start_time: BOOK_AT.toISOString(),
    end_time: new Date(BOOK_AT.getTime() + 90 * 60000).toISOString(),
    max_students: 20,
    is_canceled: false,
  });

  // studentA(=STUDENT_ID) 에 COUNT 수강권 2개: 잔여 2 / 잔여 0
  F.utCount = (await ins('user_tickets', {
    user_id: STUDENT_ID,
    ticket_id: F.coupon5,
    remaining_count: 2,
    start_date: kstToday(),
    expiry_date: '2099-12-31',
    status: 'ACTIVE',
  })).id;
  F.utZero = (await ins('user_tickets', {
    user_id: STUDENT_ID,
    ticket_id: F.coupon5,
    remaining_count: 0,
    start_date: kstToday(),
    expiry_date: '2099-12-31',
    status: 'USED',
  })).id;
});

test.afterAll(async () => {
  const aid = F.academy?.id ?? '';
  if (!aid) return;
  const fail = (label: string, error: any) => {
    if (error) console.error(`[lite2 cleanup] ${label} 실패: ${error.message}`);
  };
  const { data: classes } = await svc.from('classes').select('id').eq('academy_id', aid);
  const classIds = (classes ?? []).map((c: any) => c.id);
  const { data: orders } = await svc.from('order_groups').select('id').eq('academy_id', aid);
  const orderIds = (orders ?? []).map((o: any) => o.id);
  const { data: tks } = await svc.from('tickets').select('id').eq('academy_id', aid);
  const ticketIds = (tks ?? []).map((t: any) => t.id);
  const { data: mss } = await svc.from('memberships').select('id').eq('academy_id', aid);
  const membershipIds = (mss ?? []).map((m: any) => m.id);

  fail('membership_review_actions', (await svc.from('membership_review_actions').delete().eq('academy_id', aid)).error);
  fail('revenue_transactions', (await svc.from('revenue_transactions').delete().eq('academy_id', aid)).error);
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
});

/* ================================================================== */
test('보안: 학생 JWT 는 Phase 2 새 API 전부에서 403', async () => {
  const st = await token(STUDENT_EMAIL);
  const aid = F.academy.id;
  for (const [method, url, body] of [
    ['GET', `/api/a/${aid}/payments`, null],
    ['GET', `/api/a/${aid}/products`, null],
    ['GET', `/api/a/${aid}/pro`, null],
    ['GET', `/api/a/${aid}/students/activity?user_id=${STUDENT_ID}`, null],
    ['POST', `/api/a/${aid}/onsite-order`, { userId: STUDENT_ID, items: [{ item_type: 'TICKET_PURCHASE', ticket_id: F.coupon5 }] }],
  ] as const) {
    const r = await api(method, url, st, body);
    expect(r.status, `${method} ${url} 는 학생에게 403`).toBe(403);
  }
});

test('입금·결제: BANK 주문 → 입금 대기(남은 시간) → 원탭 확정 → 발급, 이중탭 무해', async ({ page, context }) => {
  const st = await token(STUDENT_EMAIL);
  // 학생이 BANK 주문 생성 (검증된 /api/orders 경로)
  const order = await api('POST', '/api/orders', st, {
    academyId: F.academy.id,
    method: 'BANK',
    items: [{ item_type: 'TICKET_PURCHASE', ticket_id: F.coupon5, count_option_index: null, fixed_class_id: null }],
  });
  expect(order.status, `주문 생성(${JSON.stringify(order.json)})`).toBeLessThan(300);
  const orderId = order.json.order_group_id;
  F.bankOrderId = orderId;

  const before = await countUserTickets(STUDENT_ID, F.coupon5);

  await loginAs(context, OWNER_EMAIL);
  const errors = watchErrors(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/a/${F.academy.slug}/pay`);
  await expect(page.getByTestId('lite-admin-shell')).toBeVisible({ timeout: 25_000 });

  const row = page.locator(`[data-testid="bank-order"][data-order-id="${orderId}"]`);
  await expect(row).toBeVisible({ timeout: 20_000 });
  await expect(row).toContainText('남음'); // 만료까지 남은 시간
  await row.getByTestId('bank-confirm').click();
  await expect(row.getByTestId('bank-issued')).toBeVisible({ timeout: 15_000 });

  // DB: 주문 CONFIRMED + 수강권 1건 발급
  await expect
    .poll(async () => (await svc.from('order_groups').select('status').eq('id', orderId).single()).data?.status, { timeout: 15_000 })
    .toBe('CONFIRMED');
  const afterConfirm = await countUserTickets(STUDENT_ID, F.coupon5);
  expect(afterConfirm, '입금확정으로 수강권 1건 발급').toBe(before + 1);

  // 이중탭 무해: confirm 을 API 로 한 번 더 → 이중발급 없음
  const dup = await api('POST', `/api/academy-admin/${F.academy.id}/orders/confirm`, await token(OWNER_EMAIL), { orderGroupId: orderId });
  expect(dup.ok).toBeTruthy();
  expect(await countUserTickets(STUDENT_ID, F.coupon5), '이중 확정이 수강권을 또 만들지 않는다').toBe(before + 1);

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, `입금·결제 오버플로 ${overflow}px`).toBeLessThanOrEqual(1);
  expect(errors, `콘솔 에러: ${errors.join(' | ')}`).toEqual([]);
});

test('현장결제(API): 회원 발급 = 수강권 ACTIVE + 매출 1건 / 비회원은 SIGN_IN_REQUIRED 로 거절', async () => {
  const owner = await token(OWNER_EMAIL);
  const before = await countUserTickets(STUDENT_ID, F.coupon5);
  const { count: revBefore } = await svc.from('revenue_transactions').select('id', { count: 'exact', head: true }).eq('academy_id', F.academy.id);

  const res = await api('POST', `/api/a/${F.academy.id}/onsite-order`, owner, {
    userId: STUDENT_ID,
    items: [{ item_type: 'TICKET_PURCHASE', ticket_id: F.coupon5, count_option_index: null, fixed_class_id: null }],
  });
  expect(res.ok, `현장결제(${JSON.stringify(res.json)})`).toBeTruthy();
  expect(res.json.issued_tickets, '수강권 1건 발급').toBeGreaterThanOrEqual(1);
  expect(await countUserTickets(STUDENT_ID, F.coupon5)).toBe(before + 1);
  const { count: revAfter } = await svc.from('revenue_transactions').select('id', { count: 'exact', head: true }).eq('academy_id', F.academy.id);
  expect((revAfter ?? 0) - (revBefore ?? 0), '매출 정확히 1건 기록').toBe(1);

  // 비회원 수강권 발급은 검증된 엔진이 거절한다 (규칙 우회 금지)
  const guest = await api('POST', `/api/a/${F.academy.id}/onsite-order`, owner, {
    orderer: { name: `워크인-${stamp}`, phone: '01000000000' },
    items: [{ item_type: 'TICKET_PURCHASE', ticket_id: F.coupon5, count_option_index: null, fixed_class_id: null }],
  });
  expect(guest.ok, '비회원 수강권 발급은 거절돼야 한다').toBeFalsy();
  expect(guest.json.itemCode).toBe('SIGN_IN_REQUIRED');
  expect(await countUserTickets(STUDENT_ID, F.coupon5), '거절이 수강권을 만들지 않는다').toBe(before + 1);
});

test('처리 필요: 막힌 주문(PAYMENT_APPROVED)이 뜨고 재시도로 확정된다', async ({ page, context }) => {
  // 검증된 엔진으로 막힌 주문 합성: create_order_group(ONSITE) → 승인기록(이행 전) = PAYMENT_APPROVED
  const created = await svc.rpc('create_order_group', {
    p_academy_id: F.academy.id,
    p_method: 'ONSITE',
    p_provider_order_id: `lite2-stuck-${stamp}`,
    p_items: [{ item_type: 'TICKET_PURCHASE', ticket_id: F.coupon5, count_option_index: null, fixed_class_id: null }],
    p_user_id: STUDENT_ID,
    p_orderer: null,
  });
  expect(created.error, `stuck 주문 생성: ${created.error?.message}`).toBeFalsy();
  const stuckId = created.data.order_group_id;
  const approve = await svc.rpc('record_order_payment_approval', {
    p_order_group_id: stuckId,
    p_approved_amount: created.data.total_amount,
    p_payment_key: null,
    p_expected_method: 'ONSITE',
  });
  expect(approve.error, `승인기록: ${approve.error?.message}`).toBeFalsy();

  const before = await countUserTickets(STUDENT_ID, F.coupon5);

  await loginAs(context, OWNER_EMAIL);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/a/${F.academy.slug}/pay`);
  const row = page.locator(`[data-testid="stuck-row"][data-order-id="${stuckId}"]`);
  await expect(row).toBeVisible({ timeout: 20_000 });
  await row.getByTestId('stuck-retry').click();

  await expect
    .poll(async () => (await svc.from('order_groups').select('status').eq('id', stuckId).single()).data?.status, { timeout: 15_000 })
    .toBe('CONFIRMED');
  expect(await countUserTickets(STUDENT_ID, F.coupon5), '재시도가 이행을 끝낸다').toBe(before + 1);
});

test('수강생: 라벨=ticket_type / 차감·복구 감사 + 0에서 차감 차단', async ({ page, context }) => {
  const owner = await token(OWNER_EMAIL);

  // 잔여를 2 로 리셋(앞선 테스트 영향 격리)
  await svc.from('user_tickets').update({ remaining_count: 2, status: 'ACTIVE' }).eq('id', F.utCount);

  await loginAs(context, OWNER_EMAIL);
  const errors = watchErrors(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/a/${F.academy.slug}/students`);
  await expect(page.getByTestId('lite-admin-shell')).toBeVisible({ timeout: 25_000 });

  await page.getByTestId('students-search').fill('e2e');
  // 학생 카드가 없으면 이름 일부로 재검색 — STUDENT 프로필 이름 기준
  const results = page.getByTestId('students-results');
  await expect(results).toBeVisible({ timeout: 15_000 });
  await page.locator(`[data-testid="student-open"][data-user-id="${STUDENT_ID}"]`).first().click();

  // 라벨: COUNT 수강권은 '횟수제', 절대 '기간제' 아님
  const countTicket = page.locator(`[data-testid="student-ticket"][data-user-ticket-id="${F.utCount}"]`);
  await expect(countTicket).toBeVisible({ timeout: 15_000 });
  await expect(countTicket.getByTestId('ticket-type-label')).toHaveText('횟수제');
  await expect(countTicket.getByTestId('ticket-type-label')).not.toHaveText('기간제');

  // 차감 -1 + 사유 → 잔여 1 + 감사행(actor=owner, reason)
  await countTicket.getByTestId('ticket-deduct').click();
  await page.getByTestId('adjust-reason').fill(`E2E차감-${stamp}`);
  await page.getByTestId('adjust-submit').click();
  await expect(page.getByTestId('adjust-dialog')).toHaveCount(0, { timeout: 15_000 });
  await expect
    .poll(async () => (await svc.from('user_tickets').select('remaining_count').eq('id', F.utCount).single()).data?.remaining_count, { timeout: 15_000 })
    .toBe(1);
  const { data: deductLog } = await svc
    .from('enrollment_activity_log')
    .select('action, actor_user_id, note')
    .eq('user_ticket_id', F.utCount)
    .eq('action', 'COUNT_DEDUCT')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  expect(deductLog?.actor_user_id, '차감 감사에 actor 가 남아야 한다').toBe(OWNER_ID);
  expect(deductLog?.note).toContain('E2E차감');

  // 복구 +1 + 사유 → 잔여 2 + 감사행
  await page.locator(`[data-testid="student-ticket"][data-user-ticket-id="${F.utCount}"]`).getByTestId('ticket-restore').click();
  await page.getByTestId('adjust-reason').fill(`E2E복구-${stamp}`);
  await page.getByTestId('adjust-submit').click();
  await expect(page.getByTestId('adjust-dialog')).toHaveCount(0, { timeout: 15_000 });
  await expect
    .poll(async () => (await svc.from('user_tickets').select('remaining_count').eq('id', F.utCount).single()).data?.remaining_count, { timeout: 15_000 })
    .toBe(2);
  const { count: restoreCount } = await svc
    .from('enrollment_activity_log')
    .select('id', { count: 'exact', head: true })
    .eq('user_ticket_id', F.utCount)
    .eq('action', 'COUNT_RESTORE');
  expect(restoreCount ?? 0, '복구 감사행이 남아야 한다').toBeGreaterThanOrEqual(1);

  // 0 에서 차감 차단 (검증된 경로가 400)
  const blocked = await api('POST', `/api/academy-admin/${F.academy.id}/adjust-ticket-count`, owner, {
    user_ticket_id: F.utZero,
    delta: -1,
    reason: '0에서 차감 시도',
  });
  expect(blocked.status, '잔여 0 에서 차감은 400').toBe(400);

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, `수강생 오버플로 ${overflow}px`).toBeLessThanOrEqual(1);
  expect(errors, `콘솔 에러: ${errors.join(' | ')}`).toEqual([]);
});

test('전문반: 부여(번들 발급) → 목록 노출 / 정지 → 할인 무효 (UI + API)', async ({ page, context }) => {
  const allPassBefore = await countUserTickets(STUDENT_ID, F.allPass);

  await loginAs(context, OWNER_EMAIL);
  const errors = watchErrors(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/a/${F.academy.slug}/pro`);
  await expect(page.getByTestId('lite-admin-shell')).toBeVisible({ timeout: 25_000 });

  const card = page.locator(`[data-testid="membership-card"][data-membership-id="${F.proId}"]`);
  await expect(card).toBeVisible({ timeout: 20_000 });
  await card.getByTestId('membership-toggle').click();
  await card.getByTestId('membership-grant-open').click();

  await page.getByTestId('grant-student-input').fill('e2e');
  await page.locator(`[data-testid="student-result"][data-user-id="${STUDENT_ID}"]`).first().click();
  await page.getByTestId('grant-submit').click();
  await expect(page.getByTestId('grant-sheet')).toHaveCount(0, { timeout: 15_000 });

  // DB: ACTIVE 멤버십 + 번들 ALL PASS 발급
  await expect
    .poll(async () => {
      const { data } = await svc.from('student_memberships').select('id, status').eq('academy_id', F.academy.id).eq('user_id', STUDENT_ID).eq('membership_id', F.proId).order('created_at', { ascending: false }).limit(1);
      return data?.[0]?.status;
    }, { timeout: 15_000 })
    .toBe('ACTIVE');
  expect(await countUserTickets(STUDENT_ID, F.allPass), '번들 수강권 자동 발급').toBe(allPassBefore + 1);
  const { data: sm } = await svc.from('student_memberships').select('id').eq('academy_id', F.academy.id).eq('user_id', STUDENT_ID).eq('membership_id', F.proId).order('created_at', { ascending: false }).limit(1).single();
  F.smId = sm.id;

  // 할인 유효(ACTIVE): 춤숨찐 티켓 preflight 가 할인가
  const pre1 = await svc.rpc('order_preflight', {
    p_academy_id: F.academy.id,
    p_items: [{ item_type: 'TICKET_PURCHASE', ticket_id: F.cszz, count_option_index: null, fixed_class_id: null }],
    p_user_id: STUDENT_ID,
  });
  expect(pre1.error, `preflight1: ${pre1.error?.message}`).toBeFalsy();
  expect(pre1.data.total_amount, 'ACTIVE 멤버십 할인 적용').toBeLessThan(F.cszzPrice);

  // 정지 → 목록 상태 SUSPENDED + 할인 무효
  await page.locator(`[data-testid="membership-member"][data-sm-id="${F.smId}"]`).getByTestId('member-suspend').click();
  await expect
    .poll(async () => (await svc.from('student_memberships').select('status').eq('id', F.smId).single()).data?.status, { timeout: 15_000 })
    .toBe('SUSPENDED');
  const pre2 = await svc.rpc('order_preflight', {
    p_academy_id: F.academy.id,
    p_items: [{ item_type: 'TICKET_PURCHASE', ticket_id: F.cszz, count_option_index: null, fixed_class_id: null }],
    p_user_id: STUDENT_ID,
  });
  expect(pre2.data.total_amount, '정지 후 할인 무효(정가)').toBe(F.cszzPrice);

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, `전문반 오버플로 ${overflow}px`).toBeLessThanOrEqual(1);
  expect(errors, `콘솔 에러: ${errors.join(' | ')}`).toEqual([]);
});

test('전문반: 월평가 빠른 개설 → 전문반 전용(비회원 예약 불가)', async () => {
  const owner = await token(OWNER_EMAIL);
  const evalDate = kstDateString(FUTURE_AT);
  const res = await api('POST', `/api/a/${F.academy.id}/classes`, owner, {
    title: `월평가-${stamp}`,
    classGroupId: F.regularGroup,
    date: evalDate,
    startTime: '19:00',
    endTime: '20:30',
    audienceMembershipId: F.proId,
    repeatWeeks: 1,
  });
  expect(res.ok, `월평가 개설(${JSON.stringify(res.json)})`).toBeTruthy();

  const { data: cls } = await svc.from('classes').select('id, audience_membership_id').eq('academy_id', F.academy.id).eq('title', `월평가-${stamp}`).single();
  expect(cls.audience_membership_id, '전문반 전용으로 개설').toBe(F.proId);
  const { data: sched } = await svc.from('schedules').select('id').eq('class_id', cls.id).single();

  // 비회원(anon) 예약은 대상 아님
  const pre = await svc.rpc('order_preflight', {
    p_academy_id: F.academy.id,
    p_items: [{ item_type: 'SCHEDULE_BOOKING', schedule_id: sched.id, use_purchase_index: null }],
    p_user_id: null,
  });
  expect(pre.data.items[0].code, '비회원은 전문반 전용 수업 예약 불가').toBe('AUDIENCE_NOT_ELIGIBLE');
});

test('전문반: 만료 처리 큐 → 처리하면 담당자 기록', async () => {
  const owner = await token(OWNER_EMAIL);

  // 만료 시나리오 합성: pro 전용 미래 회차 + studentA 예약 + 멤버십 EXPIRED
  const evalCls = await ins('classes', {
    academy_id: F.academy.id,
    title: `큐수업-${stamp}`,
    class_type: 'regular',
    status: '정상',
    is_active: true,
    max_students: 20,
    class_group_id: F.regularGroup,
    audience_membership_id: F.proId,
    booking_policy: ALWAYS_OPEN,
  });
  const evalSched = await ins('schedules', {
    class_id: evalCls.id,
    start_time: FUTURE_AT.toISOString(),
    end_time: new Date(FUTURE_AT.getTime() + 90 * 60000).toISOString(),
    max_students: 20,
    is_canceled: false,
  });
  await ins('bookings', {
    schedule_id: evalSched.id,
    class_id: evalCls.id,
    user_id: STUDENT_ID,
    status: 'CONFIRMED',
  });
  // 앞 테스트에서 만든 studentA 의 pro 멤버십을 EXPIRED 로
  await svc.from('student_memberships').update({ status: 'EXPIRED', end_date: '2000-01-01' }).eq('id', F.smId);

  // 큐에 뜬다
  const q = await api('GET', `/api/a/${F.academy.id}/pro`, owner);
  expect(q.ok).toBeTruthy();
  const row = (q.json.reviewQueue ?? []).find((r: any) => r.student_membership_id === F.smId);
  expect(row, '만료 처리 큐에 행이 있어야 한다').toBeTruthy();

  // 처리(유지) → membership_review_actions 에 담당자 기록
  const act = await api('POST', `/api/academy-admin/${F.academy.id}/memberships/review-queue`, owner, {
    student_membership_id: F.smId,
    booking_id: row.booking_id,
    action: 'RESOLVED',
  });
  expect(act.ok, `처리(${JSON.stringify(act.json)})`).toBeTruthy();
  const { data: ra } = await svc
    .from('membership_review_actions')
    .select('handled_by, action')
    .eq('student_membership_id', F.smId)
    .order('handled_at', { ascending: false })
    .limit(1)
    .single();
  expect(ra?.handled_by, '처리 담당자(who) 가 기록돼야 한다').toBe(OWNER_ID);
  expect(ra?.action).toBe('RESOLVED');
});
