/**
 * Q-간편가입 (2026-07-22) — 비회원 즉시 가입 + 세션 + 예약 이어가기 E2E
 *
 * 실행: npx playwright test tests/quick-signup.spec.ts --workers=1
 *
 * 픽스처는 전용 테스트 학원(slug: qs-signup-*) 안에서만 만들고 끝나면 지운다.
 * 생성한 계정은 auth.admin.deleteUser + public.users 삭제까지 정리한다.
 * 실제 MID 학원(slug: mid) 데이터는 절대 건드리지 않는다.
 *
 * 이 스펙이 지키는 것:
 *   Q1) 로그아웃 상태의 수업 딥링크에서 이름/전화/이메일만으로 → auth + public.users 에
 *       올바른 이름·전화로 계정이 생기고, 세션이 살아나며, 같은 흐름에서 계좌이체(BANK)
 *       예약을 끝까지 완료한다.
 *   Q2) 장바구니 SIGN_IN_REQUIRED 판정에서 간편가입 시트로 가입하면 결제가 이어진다.
 *   Q3) EXISTS 경로: 이미 가입된 이메일은 **어떤 토큰도** 반환하지 않고 로그인으로 유도된다.
 *   Q4) 보안: 기존 사용자에 대해 응답에 action_link/refresh token 이 절대 없다.
 *       같은 이메일로 두 번째 간편가입해도 세션을 탈취할 수 없다.
 *   Q5) 게스트 병합: 전화 P 로 게스트 예약이 있던 사람이 전화 P 로 간편가입하면 그 예약이
 *       새 계정으로 연결된다(트리거 자동 병합).
 *   Q6) 390px 가로 오버플로 없음 + 세 표면(수업링크/장바구니/MY)에서 시트 콘솔 에러 0.
 */
import { test, expect, type Page, type BrowserContext } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

import { approveAndFinalize } from '../lib/payments/fulfilment';
import { weekStartFromOffset } from '../lib/miniapp/week';
import { kstDateString, kstDateTimeToUtc, addDays } from '../lib/date/kst';

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

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL!;
const svc = createClient(SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
}) as any;

// 기존 정식 회원(EXISTS 경로 검증용) — 생성/삭제하지 않는다.
const MEMBER_EMAIL = 'e2e-moveit-student@modoogoods.com';
const OWNER_ID = '6e33f238-14c6-41d7-9715-d131067b6885';

const BASE = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';
const stamp = randomUUID().slice(0, 8);
const F: Record<string, any> = {};
const academyIds: string[] = [];

const FIXTURE_WEEK_OFFSET = 1;
const WEEK_SUNDAY = kstDateString(weekStartFromOffset(FIXTURE_WEEK_OFFSET));
function dayAt(d: number, time: string): string {
  return kstDateTimeToUtc(addDays(WEEK_SUNDAY, d), time).toISOString();
}

async function ins(table: string, row: Record<string, any>) {
  const { data, error } = await svc.from(table).insert(row).select().single();
  if (error) throw new Error(`${table} insert 실패: ${error.message}`);
  return data;
}

let phoneSeq = 0;
function newPhone(): string {
  phoneSeq += 1;
  const mid = String(Date.now()).slice(-6);
  return `010${mid}${String(phoneSeq).padStart(2, '0')}`; // 11 digits
}
let emailSeq = 0;
function newEmail(): string {
  emailSeq += 1;
  return `e2e-qs-${stamp}-${emailSeq}@modoogoods.com`;
}

async function postQuick(body: Record<string, unknown>) {
  const res = await fetch(`${BASE}/api/auth/quick-signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json: any = {};
  try {
    json = JSON.parse(text);
  } catch {
    /* keep raw */
  }
  return { status: res.status, json, raw: text };
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
  const overflow = await page.evaluate(() => {
    const d = document.documentElement;
    return { scrollWidth: d.scrollWidth, clientWidth: d.clientWidth };
  });
  expect(
    overflow.scrollWidth,
    `${label}: 가로 오버플로 (scrollWidth=${overflow.scrollWidth} clientWidth=${overflow.clientWidth})`
  ).toBeLessThanOrEqual(overflow.clientWidth + 1);
}

/** 간편가입 시트를 채우고 제출 */
async function fillAndSubmitSheet(page: Page, name: string, phone: string, email: string) {
  await expect(page.getByTestId('quick-join-sheet')).toBeVisible();
  await page.getByTestId('quick-join-name').fill(name);
  await page.getByTestId('quick-join-phone').fill(phone);
  await page.getByTestId('quick-join-email').fill(email);
  await page.getByTestId('quick-join-submit').click();
}

/** public.users 행이 트리거로 채워질 때까지 폴링 */
async function pollUserByEmail(email: string, timeoutMs = 6000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const { data } = await svc
      .from('users')
      .select('id, name, phone, email, is_guest')
      .ilike('email', email)
      .maybeSingle();
    if (data) return data;
    await new Promise((r) => setTimeout(r, 300));
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* 픽스처                                                              */
/* ------------------------------------------------------------------ */

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  const alwaysOpen = { open: null, close: { minutesBefore: 0 }, cancelUntil: { minutesBefore: 0 } };

  F.academy = await ins('academies', {
    name_kr: `QS간편-${stamp}`,
    slug: `qs-signup-${stamp}`,
    is_active: true,
    brand_color: '#7C3AED',
    booking_policy: alwaysOpen,
  });
  academyIds.push(F.academy.id);

  await ins('academy_user_roles', {
    academy_id: F.academy.id,
    user_id: OWNER_ID,
    role: 'ACADEMY_OWNER',
  });

  F.group = await ins('class_groups', {
    academy_id: F.academy.id,
    key: 'regular',
    name: '정규반',
    is_special: false,
    display_order: 1,
  });

  F.hall = await ins('halls', { academy_id: F.academy.id, name: `A홀-${stamp}`, capacity: 30 });

  F.class = await ins('classes', {
    academy_id: F.academy.id,
    title: `QS수업-${stamp}`,
    class_type: 'regular',
    instructor_name: `강사-${stamp}`,
    max_students: 20,
    is_active: true,
    class_group_id: F.group.id,
    booking_policy: alwaysOpen,
  });

  F.sched = await ins('schedules', {
    class_id: F.class.id,
    start_time: dayAt(1, '19:00'),
    end_time: dayAt(1, '20:30'),
    max_students: 20,
    hall_id: F.hall.id,
    is_canceled: false,
  });

  // 정규 수업을 덮는 일반 PERIOD 수강권(판매중·공개). BANK 예약 완주에 쓴다.
  F.ticket = await ins('tickets', {
    academy_id: F.academy.id,
    name: `QS올패스-${stamp}`,
    price: 50000,
    ticket_type: 'PERIOD',
    valid_days: 30,
    is_on_sale: true,
    is_general: true,
    is_public: true,
    start_mode: 'IMMEDIATE',
  });
});

test.afterAll(async () => {
  const aid = F.academy?.id ?? '';
  if (!aid) return;
  const fail = (label: string, error: any) => {
    if (error) console.error(`[QS cleanup] ${label} 실패: ${error.message}`);
  };

  const { data: classes } = await svc.from('classes').select('id').eq('academy_id', aid);
  const classIds = (classes ?? []).map((c: any) => c.id);
  const { data: orders } = await svc.from('order_groups').select('id').eq('academy_id', aid);
  const orderIds = (orders ?? []).map((o: any) => o.id);
  const { data: tks } = await svc.from('tickets').select('id').eq('academy_id', aid);
  const ticketIds = (tks ?? []).map((t: any) => t.id);

  fail('booking_events', (await svc.from('booking_events').delete().eq('academy_id', aid)).error);
  fail('revenue_transactions', (await svc.from('revenue_transactions').delete().eq('academy_id', aid)).error);
  if (orderIds.length) {
    fail('order_items', (await svc.from('order_items').delete().in('order_group_id', orderIds)).error);
  }
  if (classIds.length) {
    fail('bookings', (await svc.from('bookings').delete().in('class_id', classIds)).error);
  }
  if (orderIds.length) {
    fail('order_groups', (await svc.from('order_groups').delete().in('id', orderIds)).error);
  }
  if (ticketIds.length) {
    fail('user_tickets', (await svc.from('user_tickets').delete().in('ticket_id', ticketIds)).error);
    fail('ticket_coverage', (await svc.from('ticket_coverage').delete().in('ticket_id', ticketIds)).error);
    fail('user_ticket_payment_orders', (await svc.from('user_ticket_payment_orders').delete().in('ticket_id', ticketIds)).error);
  }
  fail('bank_transfer_orders', (await svc.from('bank_transfer_orders').delete().eq('academy_id', aid)).error);
  if (classIds.length) {
    fail('schedules', (await svc.from('schedules').delete().in('class_id', classIds)).error);
  }
  fail('academy_students', (await svc.from('academy_students').delete().eq('academy_id', aid)).error);
  fail('classes', (await svc.from('classes').delete().eq('academy_id', aid)).error);
  fail('halls', (await svc.from('halls').delete().eq('academy_id', aid)).error);
  fail('class_groups', (await svc.from('class_groups').delete().eq('academy_id', aid)).error);
  fail('tickets', (await svc.from('tickets').delete().eq('academy_id', aid)).error);
  fail('academy_user_roles', (await svc.from('academy_user_roles').delete().eq('academy_id', aid)).error);

  // 이 스펙이 만든 계정 전부 정리: auth.admin.deleteUser + public.users 행 삭제.
  const { data: qsUsers } = await svc.from('users').select('id').ilike('email', `e2e-qs-${stamp}%`);
  for (const u of qsUsers ?? []) {
    try {
      await svc.auth.admin.deleteUser(u.id);
    } catch (e) {
      console.error(`[QS cleanup] deleteUser ${u.id} 실패:`, (e as Error).message);
    }
    await svc.from('users').delete().eq('id', u.id);
  }

  for (const id of academyIds) {
    fail('academies', (await svc.from('academies').delete().eq('id', id)).error);
  }

  const { count } = await svc.from('academies').select('id', { count: 'exact', head: true }).eq('id', aid);
  if (count) console.error(`[QS cleanup] 테스트 학원 ${aid} 이 남아 있다`);
});

/* ------------------------------------------------------------------ */
/* Q1. 수업 딥링크 → 즉시 가입 → 세션 → BANK 예약 완주                   */
/* ------------------------------------------------------------------ */

test('Q1 로그아웃 수업링크에서 간편가입하면 계정·세션이 생기고 같은 흐름에서 계좌이체 예약을 끝까지 완료한다', async ({
  page,
  context,
}) => {
  await context.clearCookies();
  const errors = watchErrors(page);
  await page.setViewportSize({ width: 390, height: 844 });

  const name = '간편가입자';
  const phone = newPhone();
  const email = newEmail();

  // ① 수업 딥링크(로그아웃) — CTA 는 페이지를 떠나지 않고 시트를 연다
  await page.goto(`/s/${F.academy.slug}/c/${F.sched.id}`);
  await page.waitForLoadState('domcontentloaded');
  await expect(page.getByTestId('class-link')).toHaveAttribute('data-state', 'BOOKABLE');
  await page.getByTestId('class-signin').click();

  // ② 이름·전화·이메일 입력 → 가입하고 계속
  await fillAndSubmitSheet(page, name, phone, email);

  // ③ 세션이 살아나 중단된 예약을 이어간다 → 장바구니로 이동
  await page.waitForURL(/\/cart$/, { timeout: 25000 });

  // ④ auth + public.users 에 올바른 이름·전화로 계정 생성
  const row = await pollUserByEmail(email);
  expect(row, 'public.users 에 간편가입 계정이 없다').toBeTruthy();
  expect(row.name).toBe(name);
  expect(row.phone).toBe(phone);
  expect(row.is_guest).toBe(false);
  const newUserId = row.id;
  const { data: authUser, error: authErr } = await svc.auth.admin.getUserById(newUserId);
  expect(authErr).toBeFalsy();
  expect(authUser?.user?.email?.toLowerCase()).toBe(email.toLowerCase());

  // ⑤ 세션 활성 확인 — MY 가 로그인 폼이 아니라 인증 화면을 보여준다
  await page.goto(`/s/${F.academy.slug}/my`);
  await page.waitForLoadState('domcontentloaded');
  await expect(page.getByTestId('my-login')).toHaveCount(0);

  // ⑥ 같은 흐름에서 BANK 예약 완주 — 수강권 구매 + 그 수강권으로 이 회차 예약(연결)
  await page.goto(`/s/${F.academy.slug}/cart`);
  await page.evaluate(
    ({ aid, tid, sid }) => {
      window.localStorage.setItem(
        `miniapp-cart:${aid}`,
        JSON.stringify([
          { label: '수강권', item: { item_type: 'TICKET_PURCHASE', ticket_id: tid } },
          { label: '수업예약', item: { item_type: 'SCHEDULE_BOOKING', schedule_id: sid, use_purchase_index: 0 } },
        ])
      );
    },
    { aid: F.academy.id, tid: F.ticket.id, sid: F.sched.id }
  );
  await page.reload();
  await page.waitForLoadState('domcontentloaded');

  await expect(page.getByTestId('cart-item')).toHaveCount(2);
  await expect(page.getByTestId('checkout')).toBeEnabled({ timeout: 15000 });
  await page.getByTestId('method-BANK').click();
  await page.getByTestId('checkout').click();
  await page.waitForURL(/\/orders\//, { timeout: 25000 });
  await expect(page.getByTestId('order-status')).toHaveAttribute('data-phase', 'PENDING');

  const providerOrderId = decodeURIComponent(page.url().split('/orders/')[1]);
  const { data: og } = await svc
    .from('order_groups')
    .select('id, method, user_id')
    .eq('provider_order_id', providerOrderId)
    .single();
  expect(og.method).toBe('BANK');
  expect(og.user_id, '주문이 간편가입 계정 소유가 아니다').toBe(newUserId);

  // ⑦ 입금 확정 → DONE + 이 회차 예약이 새 계정 소유로 확정
  await approveAndFinalize(svc, {
    orderGroupId: og.id,
    approvedAmount: F.ticket.price,
    method: 'BANK',
    confirmedBy: OWNER_ID,
  });
  await page.reload();
  await page.waitForLoadState('domcontentloaded');
  await expect(page.getByTestId('order-status')).toHaveAttribute('data-phase', 'DONE');

  const { data: bk } = await svc
    .from('bookings')
    .select('id, user_id, status')
    .eq('schedule_id', F.sched.id)
    .eq('user_id', newUserId);
  expect((bk ?? []).length, '간편가입 계정의 예약이 만들어지지 않았다').toBeGreaterThan(0);

  await expectNoHorizontalOverflow(page, 'Q1 주문 완료');
  expect(errors, `콘솔 에러: ${errors.join(' | ')}`).toEqual([]);
});

/* ------------------------------------------------------------------ */
/* Q2. 장바구니 SIGN_IN_REQUIRED → 간편가입 → 결제 진행                   */
/* ------------------------------------------------------------------ */

test('Q2 장바구니 SIGN_IN_REQUIRED 판정에서 간편가입하면 결제가 이어진다', async ({ page, context }) => {
  await context.clearCookies();
  const errors = watchErrors(page);
  await page.setViewportSize({ width: 390, height: 844 });

  const phone = newPhone();
  const email = newEmail();

  // 로그아웃 상태 수강권 구매 장바구니 → SIGN_IN_REQUIRED
  await page.goto(`/s/${F.academy.slug}/cart`);
  await page.evaluate(
    ({ aid, tid }) => {
      window.localStorage.setItem(
        `miniapp-cart:${aid}`,
        JSON.stringify([{ label: '수강권', item: { item_type: 'TICKET_PURCHASE', ticket_id: tid } }])
      );
    },
    { aid: F.academy.id, tid: F.ticket.id }
  );
  await page.reload();
  await page.waitForLoadState('domcontentloaded');
  await expect(page.getByTestId('signin-required')).toBeVisible();
  await expect(page.getByTestId('checkout')).toBeDisabled();

  // 간편가입 → 세션 확립 → 판정 재실행으로 SIGN_IN_REQUIRED 해제
  await page.getByTestId('quick-join-open').click();
  await fillAndSubmitSheet(page, '장바구니가입', phone, email);

  await expect(page.getByTestId('signin-required')).toHaveCount(0, { timeout: 20000 });
  await expect(page.getByTestId('checkout')).toBeEnabled({ timeout: 20000 });

  // 결제가 이어진다 — BANK 주문 생성
  await page.getByTestId('method-BANK').click();
  await page.getByTestId('checkout').click();
  await page.waitForURL(/\/orders\//, { timeout: 25000 });
  await expect(page.getByTestId('order-status')).toHaveAttribute('data-phase', 'PENDING');

  const row = await pollUserByEmail(email);
  expect(row).toBeTruthy();
  const providerOrderId = decodeURIComponent(page.url().split('/orders/')[1]);
  const { data: og } = await svc
    .from('order_groups')
    .select('user_id, method')
    .eq('provider_order_id', providerOrderId)
    .single();
  expect(og.method).toBe('BANK');
  expect(og.user_id).toBe(row.id);

  expect(errors, `콘솔 에러: ${errors.join(' | ')}`).toEqual([]);
});

/* ------------------------------------------------------------------ */
/* Q3. EXISTS — 이미 가입된 이메일은 토큰 없음 + 로그인 유도             */
/* ------------------------------------------------------------------ */

test('Q3 이미 가입된 이메일로 간편가입하면 토큰 없이 EXISTS 를 돌려주고 UI 는 로그인으로 유도한다', async ({
  page,
}) => {
  // ① API: 정식 회원 이메일 → EXISTS, 토큰 전무
  const r = await postQuick({ name: '아무개', phone: newPhone(), email: MEMBER_EMAIL });
  expect(r.json.status).toBe('EXISTS');
  expect(r.json.token_hash, 'EXISTS 응답에 token_hash 가 들어있다').toBeUndefined();
  expect(r.raw.includes('token_hash')).toBe(false);
  expect(r.raw.includes('action_link')).toBe(false);
  expect(r.raw.includes('refresh_token')).toBe(false);
  expect(r.raw.includes('access_token')).toBe(false);

  // ② UI: MY 시트에서 기존 이메일 입력 → 안내 후 로그인 폼으로 유도(이메일 프리필)
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/s/${F.academy.slug}/my`);
  await page.waitForLoadState('domcontentloaded');
  await page.getByTestId('quick-join-open').click();
  await fillAndSubmitSheet(page, '기존회원', newPhone(), MEMBER_EMAIL);
  await expect(page.getByTestId('quick-join-error')).toContainText('이미 가입된 이메일');
  // 로그인 폼으로 되돌아오고 이메일이 프리필된다
  await expect(page.getByTestId('quick-join-sheet')).toHaveCount(0, { timeout: 5000 });
  await expect(page.getByTestId('my-login')).toBeVisible();
});

/* ------------------------------------------------------------------ */
/* Q4. 보안 — 기존 사용자에 대한 토큰 유출 없음 · 재시도 탈취 불가        */
/* ------------------------------------------------------------------ */

test('Q4 기존 사용자 응답에 action link/refresh token 이 없고, 같은 이메일 재간편가입으로 세션을 탈취할 수 없다', async () => {
  const phone = newPhone();
  const email = newEmail();

  // 첫 간편가입 → CREATED + token_hash (방금 만든 계정)
  const first = await postQuick({ name: '최초가입', phone, email });
  expect(first.json.status).toBe('CREATED');
  expect(typeof first.json.token_hash).toBe('string');
  expect(first.json.token_hash.length).toBeGreaterThan(10);
  // action_link/refresh/access token 은 절대 노출 안 함
  expect(first.raw.includes('action_link')).toBe(false);
  expect(first.raw.includes('refresh_token')).toBe(false);
  expect(first.raw.includes('access_token')).toBe(false);

  // 같은 이메일로 두 번째 → EXISTS, 어떤 토큰도 없음 (탈취 불가)
  const second = await postQuick({ name: '탈취시도', phone: newPhone(), email });
  expect(second.json.status).toBe('EXISTS');
  expect(second.json.token_hash).toBeUndefined();
  expect(second.raw.includes('token_hash')).toBe(false);
  expect(second.raw.includes('action_link')).toBe(false);

  // 다른 사람이 이 회원의 전화로 간편가입해도 EXISTS(PHONE) 로 막힌다(회원 전화 UNIQUE 보호)
  const byPhone = await postQuick({ name: '전화도용', phone, email: newEmail() });
  expect(byPhone.json.status).toBe('EXISTS');
  expect(byPhone.json.reason).toBe('PHONE');
  expect(byPhone.raw.includes('token_hash')).toBe(false);
});

/* ------------------------------------------------------------------ */
/* Q5. 게스트 병합 — 전화 P 게스트 예약이 새 계정으로 연결된다           */
/* ------------------------------------------------------------------ */

test('Q5 전화 P 로 게스트 예약이 있던 사람이 전화 P 로 간편가입하면 그 예약이 새 계정으로 병합된다', async () => {
  const phone = newPhone();
  const guestEmail = newEmail(); // 게스트 행 이메일(병합 시 삭제됨)
  const signupEmail = newEmail(); // 실제 간편가입 이메일(신규)

  // 게스트 행 + 그 게스트 소유의 예약(이전 비회원 예약 시뮬레이션)
  const guestId = randomUUID();
  await ins('users', { id: guestId, name: '게스트예약', phone, email: guestEmail, is_guest: true, role: 'USER' });
  const guestBooking = await ins('bookings', {
    user_id: guestId,
    schedule_id: F.sched.id,
    class_id: F.class.id,
    status: 'CONFIRMED',
    guest_name: '게스트예약',
    guest_phone: phone,
  });

  // 전화 P 로 간편가입 → 트리거가 게스트 예약을 새 계정으로 병합
  const r = await postQuick({ name: '병합가입', phone, email: signupEmail });
  expect(r.json.status).toBe('CREATED');

  const row = await pollUserByEmail(signupEmail);
  expect(row).toBeTruthy();
  const newUserId = row.id;

  // 예약이 새 계정으로 재지정되고, 게스트 행은 사라진다
  const { data: bk } = await svc.from('bookings').select('user_id').eq('id', guestBooking.id).maybeSingle();
  expect(bk?.user_id, '게스트 예약이 새 계정으로 병합되지 않았다').toBe(newUserId);
  const { data: gone } = await svc.from('users').select('id').eq('id', guestId).maybeSingle();
  expect(gone, '병합 후 게스트 행이 남아 있다').toBeNull();
});

/* ------------------------------------------------------------------ */
/* Q6. 세 표면에서 390px 오버플로 없음 + 시트 콘솔 에러 0               */
/* ------------------------------------------------------------------ */

test('Q6 수업링크·장바구니·MY 세 표면에서 시트가 390px 오버플로 없이 콘솔 에러 없이 열린다', async ({
  page,
  context,
}) => {
  await context.clearCookies();
  const errors = watchErrors(page);
  await page.setViewportSize({ width: 390, height: 844 });

  // ① 수업링크
  await page.goto(`/s/${F.academy.slug}/c/${F.sched.id}`);
  await page.waitForLoadState('domcontentloaded');
  await page.getByTestId('class-signin').click();
  await expect(page.getByTestId('quick-join-sheet')).toBeVisible();
  await expectNoHorizontalOverflow(page, 'Q6 수업링크 시트');
  await page.getByTestId('quick-join-close').click();

  // ② 장바구니 (SIGN_IN_REQUIRED)
  await page.goto(`/s/${F.academy.slug}/cart`);
  await page.evaluate(
    ({ aid, tid }) => {
      window.localStorage.setItem(
        `miniapp-cart:${aid}`,
        JSON.stringify([{ label: '수강권', item: { item_type: 'TICKET_PURCHASE', ticket_id: tid } }])
      );
    },
    { aid: F.academy.id, tid: F.ticket.id }
  );
  await page.reload();
  await page.waitForLoadState('domcontentloaded');
  await expect(page.getByTestId('signin-required')).toBeVisible();
  await page.getByTestId('quick-join-open').click();
  await expect(page.getByTestId('quick-join-sheet')).toBeVisible();
  await expectNoHorizontalOverflow(page, 'Q6 장바구니 시트');
  await page.getByTestId('quick-join-close').click();

  // ③ MY
  await page.goto(`/s/${F.academy.slug}/my`);
  await page.waitForLoadState('domcontentloaded');
  await page.getByTestId('quick-join-open').click();
  await expect(page.getByTestId('quick-join-sheet')).toBeVisible();
  await expectNoHorizontalOverflow(page, 'Q6 MY 시트');
  await page.getByTestId('quick-join-close').click();

  await page.evaluate((aid) => window.localStorage.removeItem(`miniapp-cart:${aid}`), F.academy.id);
  expect(errors, `콘솔 에러: ${errors.join(' | ')}`).toEqual([]);
});
