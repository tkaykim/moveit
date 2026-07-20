/**
 * V — 전체 루프 E2E (실제 UI + DB 단언)
 *
 * 실행: npx playwright test tests/full-loop-e2e.spec.ts --workers=1
 *
 * MID 와 **동일한 시드(scripts/mid-seed-config.mjs)** 를 적용한 전용 테스트 학원
 * (slug: v-loop-*, is_active=true) 위에서, 학생 미니앱과 운영 콘솔의 실제 화면을
 * 조작해 한 바퀴 전체를 증명한다. 실제 MID 학원(slug='mid')은 읽지도 쓰지도 않는다.
 *
 * 증명하는 7단계 (각 단계마다 DB 단언):
 *   1) 신청(예약) + 계좌이체 : 수업별 링크 + 시간표 두 경로로 장바구니 담기 → BANK 결제
 *        ⇒ order_group PENDING_PAYMENT · PENDING 홀드(≈now+24h) · 좌석이 정원에 잡힌다
 *   2) 입금확인 : 운영자가 콘솔에서 주문 그룹 단위로 입금 확정
 *        ⇒ 주문 CONFIRMED · 스냅샷대로 수강권 발급 · 예약 CONFIRMED · COUNT 정확히 1회 차감
 *   3) 출석체크 : 예약 QR → 운영자 스캔 ⇒ 예약 COMPLETED · 출석 감사 로그 기록
 *   4) 취소 + 횟수 회복 : COUNT 예약 취소(마감 이내) ⇒ CANCELLED · 정확히 1회만 복구(2번 취소해도 1회)
 *   5) 차감 정확성 : 다회 쿠폰 N회 예약 ⇒ 잔여가 정확히 N 감소 / ALL PASS(PERIOD)가 COUNT 태우기보다 우선
 *   6) 환불 : 운영자가 환불 제안 → 산출값 확인 → 사유와 함께 조정 → 확인
 *        ⇒ 감사행(산출값 vs 조정값·누가·언제·사유) · 돈은 움직이지 않고 수강권 상태도 안 바뀐다(제안 전용)
 *   7) 카드결제 경로 : TossPayments stub ⇒ requestPayment 가 서버 주문번호+서버 금액으로 열리고, 콜백이 확정한다
 *
 * 카드 경로의 전체(실패/금액불일치 등)는 tests/toss-checkout.spec.ts 가 담당한다 — 여기선 중복하지 않는다.
 */
import { test, expect, type Page, type BrowserContext } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

import { applySeed } from '../scripts/mid-seed-config.mjs';
import { previewOrder } from '../lib/orders/composer';
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

/* 픽스처는 다음 주(offset=1)에 고정 — 실행 시각/주 경계에 흔들리지 않게. */
const WEEK_OFFSET = 1;
const WEEK_SUNDAY = kstDateString(weekStartFromOffset(WEEK_OFFSET));
function dayAt(d: number, time: string): string {
  return kstDateTimeToUtc(addDays(WEEK_SUNDAY, d), time).toISOString();
}

async function ins(table: string, row: Record<string, any>) {
  const { data, error } = await svc.from(table).insert(row).select().single();
  if (error) throw new Error(`${table} insert 실패: ${error.message}`);
  return data;
}

async function loginAs(context: BrowserContext, email: string) {
  const anon = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await anon.auth.signInWithPassword({ email, password: E2E_PASSWORD });
  if (error || !data.session) throw new Error(`${email} 로그인 실패: ${error?.message}`);

  const encoded =
    'base64-' + Buffer.from(JSON.stringify(data.session), 'utf8').toString('base64url');
  const base = new URL(BASE);
  const common = { domain: base.hostname, path: '/', httpOnly: false, secure: false } as const;

  await context.clearCookies();
  if (encoded.length <= MAX_CHUNK) {
    await context.addCookies([{ name: AUTH_COOKIE, value: encoded, ...common }]);
  } else {
    const chunks: string[] = [];
    for (let i = 0; i < encoded.length; i += MAX_CHUNK) chunks.push(encoded.slice(i, i + MAX_CHUNK));
    await context.addCookies(
      chunks.map((value, i) => ({ name: `${AUTH_COOKIE}.${i}`, value, ...common }))
    );
  }
  return { userId: data.session.user.id, accessToken: data.session.access_token };
}

/** 브라우저 없이 쓰는 토큰 (QR 등 API 직접 호출용) */
async function token(email: string): Promise<string> {
  const anon = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
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

/** 학생 미니앱 장바구니(localStorage)를 직접 세팅한다 — 실제 카트 저장 키와 동일 */
async function setCart(page: Page, entries: any[]) {
  await page.evaluate(
    ({ aid, list }) => window.localStorage.setItem(`miniapp-cart:${aid}`, JSON.stringify(list)),
    { aid: F.academy.id, list: entries }
  );
}
async function clearCart(page: Page) {
  await page.evaluate((aid) => window.localStorage.removeItem(`miniapp-cart:${aid}`), F.academy.id);
}

/** create_booking_tx (엔진 그대로) */
function book(scheduleId: string, userTicketId: string | null, userId = STUDENT_ID) {
  return svc.rpc('create_booking_tx', {
    p_schedule_id: scheduleId,
    p_user_ticket_id: userTicketId,
    p_order_item_id: null,
    p_user_id: userId,
  });
}

/* ------------------------------------------------------------------ */
/* 픽스처 — MID 와 동일한 시드                                          */
/* ------------------------------------------------------------------ */

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  // 예약창은 학원 정책(시드는 전일 17:00 오픈)과 무관하게 항상 열리도록 수업 단위로 연다.
  // (이 스펙의 관심사는 결제·발급·차감·환불 루프이지 예약창 판정이 아니다 —
  //  예약창은 booking-engine / miniapp-checkout 이 이미 검증한다.)
  const alwaysOpen = { open: null, close: { minutesBefore: 0 }, cancelUntil: { minutesBefore: 0 } };

  F.academy = await ins('academies', {
    name_kr: `V전체루프-${stamp}`,
    slug: `v-loop-${stamp}`,
    is_active: true,
    brand_color: '#0EA5E9',
    booking_policy: alwaysOpen,
    section_config: { miniapp: { heroEyebrow: 'VLOOP' } },
  });

  await ins('academy_user_roles', {
    academy_id: F.academy.id,
    user_id: OWNER_ID,
    role: 'ACADEMY_OWNER',
  });

  // 시드가 class_type 매핑으로 태깅하도록 수업을 먼저 만든다 (전부 정규 = 쿠폰·ALL PASS 커버)
  const mkClass = (title: string, extra: Record<string, any> = {}) =>
    ins('classes', {
      academy_id: F.academy.id,
      title,
      class_type: 'regular',
      instructor_name: `강사-${stamp}`,
      max_students: 20,
      is_active: true,
      booking_policy: alwaysOpen,
      ...extra,
    });

  F.classEntry = await mkClass(`V진입데모-${stamp}`); // 진입 경로 데모용(담기만 함)
  F.classSeat1 = await mkClass(`V한자리-${stamp}`, { max_students: 1 }); // 정원 1 → 좌석 점유 증명
  F.classR2 = await mkClass(`V취소용-${stamp}`);
  F.classR3 = await mkClass(`V다회1-${stamp}`);
  F.classR4 = await mkClass(`V다회2-${stamp}`);
  F.classR5 = await mkClass(`V올패스우선-${stamp}`);

  // MID 와 **같은 설정·같은 코드**로 시드 → 4그룹 / 7상품 / 커버리지 / 2멤버십 + 수업 태깅
  F.report = await applySeed(svc, F.academy.id, { tagClasses: true });
  F.tickets = F.report.tickets.byName as Record<string, string>;
  F.coupon5 = F.tickets['쿠폰 5장']; // COUNT 5, 정규·팝업 커버
  F.allPass = F.tickets['ALL PASS']; // PERIOD, 정규·팝업 커버

  // 시드는 academies.booking_policy 를 전일17시로 되돌린다 → 수업창은 위 alwaysOpen 오버라이드로 유지.
  // (시드가 학원 정책을 덮으므로 학원 정책을 다시 alwaysOpen 으로 돌려 miniapp week 판정도 안정화)
  await svc.from('academies').update({ booking_policy: alwaysOpen }).eq('id', F.academy.id);

  const mkSched = (classId: string, day: number, max = 20) =>
    ins('schedules', {
      class_id: classId,
      start_time: dayAt(day, '19:00'),
      end_time: dayAt(day, '20:30'),
      max_students: max,
      is_canceled: false,
    });

  F.schedEntry = await mkSched(F.classEntry.id, 1);
  F.schedSeat1 = await mkSched(F.classSeat1.id, 2, 1);
  F.schedR2 = await mkSched(F.classR2.id, 3);
  F.schedR3 = await mkSched(F.classR3.id, 4);
  F.schedR4 = await mkSched(F.classR4.id, 5);
  F.schedR5 = await mkSched(F.classR5.id, 6);
});

test.afterAll(async () => {
  const aid = F.academy?.id ?? '';
  if (!aid) return;
  const fail = (label: string, error: any) => {
    if (error) console.error(`[V cleanup] ${label} 실패: ${error.message}`);
  };

  const { data: classes } = await svc.from('classes').select('id').eq('academy_id', aid);
  const classIds = (classes ?? []).map((c: any) => c.id);
  const { data: orders } = await svc.from('order_groups').select('id').eq('academy_id', aid);
  const orderIds = (orders ?? []).map((o: any) => o.id);
  const { data: tks } = await svc.from('tickets').select('id').eq('academy_id', aid);
  const ticketIds = (tks ?? []).map((t: any) => t.id);
  const { data: mss } = await svc.from('memberships').select('id').eq('academy_id', aid);
  const membershipIds = (mss ?? []).map((m: any) => m.id);

  // FK 역순. supabase-js delete 는 FK 위반에도 throw 하지 않으므로 순서를 정확히 지킨다.
  fail('refund_proposals', (await svc.from('refund_proposals').delete().eq('academy_id', aid)).error);
  fail('membership_review_actions', (await svc.from('membership_review_actions').delete().eq('academy_id', aid)).error);
  fail('revenue_transactions', (await svc.from('revenue_transactions').delete().eq('academy_id', aid)).error);
  fail('booking_events', (await svc.from('booking_events').delete().eq('academy_id', aid)).error);
  fail('enrollment_activity_log', (await svc.from('enrollment_activity_log').delete().eq('academy_id', aid)).error);
  if (orderIds.length) {
    fail('order_items', (await svc.from('order_items').delete().in('order_group_id', orderIds)).error);
  }
  if (classIds.length) {
    fail('bookings', (await svc.from('bookings').delete().in('class_id', classIds)).error);
  }
  if (orderIds.length) {
    fail('order_groups', (await svc.from('order_groups').delete().in('id', orderIds)).error);
  }
  if (classIds.length) {
    fail('schedules', (await svc.from('schedules').delete().in('class_id', classIds)).error);
  }
  fail('student_memberships', (await svc.from('student_memberships').delete().eq('academy_id', aid)).error);
  if (ticketIds.length) {
    fail('user_tickets', (await svc.from('user_tickets').delete().in('ticket_id', ticketIds)).error);
    fail('ticket_coverage', (await svc.from('ticket_coverage').delete().in('ticket_id', ticketIds)).error);
    fail('ticket_classes', (await svc.from('ticket_classes').delete().in('ticket_id', ticketIds)).error);
  }
  if (membershipIds.length) {
    fail('membership_discounts', (await svc.from('membership_discounts').delete().in('membership_id', membershipIds)).error);
  }
  // classes.audience_membership_id → memberships 이므로 classes 가 먼저다
  fail('classes', (await svc.from('classes').delete().eq('academy_id', aid)).error);
  fail('class_groups', (await svc.from('class_groups').delete().eq('academy_id', aid)).error);
  fail('memberships', (await svc.from('memberships').delete().eq('academy_id', aid)).error);
  fail('tickets', (await svc.from('tickets').delete().eq('academy_id', aid)).error);
  fail('academy_user_roles', (await svc.from('academy_user_roles').delete().eq('academy_id', aid)).error);
  fail('academies', (await svc.from('academies').delete().eq('id', aid)).error);

  const { count } = await svc
    .from('academies')
    .select('id', { count: 'exact', head: true })
    .eq('id', aid);
  if (count) console.error(`[V cleanup] 테스트 학원 ${aid} 이 남아 있다 — FK 역순을 다시 확인하라`);
});

/* ================================================================== */
/* 1. 신청(예약) + 계좌이체                                             */
/* ================================================================== */

test('STEP1 신청+계좌이체: 두 진입경로로 담고 BANK 결제 → PENDING_PAYMENT · 24h 홀드 · 좌석 점유', async ({
  page,
  context,
}) => {
  await loginAs(context, STUDENT_EMAIL);
  const errors = watchErrors(page);
  await page.setViewportSize({ width: 390, height: 844 });

  // --- 진입경로 A: 수업 회차 딥링크 /s/[slug]/c/[scheduleId] ---
  await page.goto(`/s/${F.academy.slug}/c/${F.schedEntry.id}`);
  await page.waitForLoadState('domcontentloaded');
  await clearCart(page); // 오리진 로드 후에 비운다 (about:blank 에선 localStorage 접근 불가)
  await expect(page.getByTestId('class-link')).toHaveAttribute('data-state', 'BOOKABLE');
  await page.getByTestId('class-book').click();
  await page.waitForURL(/\/cart$/, { timeout: 20000 });
  let inCart = await page.evaluate(
    ({ aid, sid }) => {
      const raw = window.localStorage.getItem(`miniapp-cart:${aid}`);
      return (raw ? JSON.parse(raw) : []).some(
        (e: any) => e?.item?.item_type === 'SCHEDULE_BOOKING' && e.item.schedule_id === sid
      );
    },
    { aid: F.academy.id, sid: F.schedEntry.id }
  );
  expect(inCart, '딥링크 신청이 장바구니에 담기지 않았다').toBe(true);

  // --- 진입경로 B: 시간표 보드에서 담기 ---
  await clearCart(page);
  await page.goto(`/s/${F.academy.slug}/schedule?w=${WEEK_OFFSET}`);
  await page.waitForLoadState('networkidle');
  const boardRow = page.locator(
    `[data-testid="schedule-row"][data-schedule-id="${F.schedEntry.id}"]`
  );
  await expect(boardRow).toHaveCount(1);
  await boardRow.getByTestId('add-to-cart').click();
  inCart = await page.evaluate(
    ({ aid, sid }) => {
      const raw = window.localStorage.getItem(`miniapp-cart:${aid}`);
      return (raw ? JSON.parse(raw) : []).some(
        (e: any) => e?.item?.item_type === 'SCHEDULE_BOOKING' && e.item.schedule_id === sid
      );
    },
    { aid: F.academy.id, sid: F.schedEntry.id }
  );
  expect(inCart, '시간표 보드 담기가 장바구니에 반영되지 않았다').toBe(true);

  // --- 실제 결제: 쿠폰 5장 구매 + 그 쿠폰으로 정원1 회차 예약 (BANK) ---
  // (진입 데모는 여기서 끝내고, 결제는 "사서 바로 쓰는" 실제 카트 상태로 진행한다)
  await setCart(page, [
    { label: '쿠폰 5장', item: { item_type: 'TICKET_PURCHASE', ticket_id: F.coupon5 } },
    {
      label: 'V한자리 예약',
      item: { item_type: 'SCHEDULE_BOOKING', schedule_id: F.schedSeat1.id, use_purchase_index: 0 },
    },
  ]);
  await page.goto(`/s/${F.academy.slug}/cart`);
  await page.waitForLoadState('networkidle');
  await page.getByTestId('method-BANK').click();
  await expect(page.getByTestId('checkout')).toBeEnabled();
  await page.getByTestId('checkout').click();
  await page.waitForURL(/\/orders\//, { timeout: 20000 });
  await expect(page.getByTestId('order-status')).toHaveAttribute('data-phase', 'PENDING');

  const providerOrderId = decodeURIComponent(page.url().split('/orders/')[1]);
  F.bankProviderOrderId = providerOrderId;

  // DB: 주문 PENDING_PAYMENT / BANK
  const { data: og } = await svc
    .from('order_groups')
    .select('id, method, status, total_amount')
    .eq('provider_order_id', providerOrderId)
    .single();
  F.bankOrderId = og.id;
  expect(og.method).toBe('BANK');
  expect(og.status).toBe('PENDING_PAYMENT');

  // DB: PENDING 홀드 + hold_expires_at ≈ now+24h
  const { data: holds } = await svc
    .from('bookings')
    .select('id, status, hold_expires_at, schedule_id, class_id')
    .eq('order_group_id', og.id);
  const hold = (holds ?? []).find((h: any) => h.schedule_id === F.schedSeat1.id);
  expect(hold, '예약 홀드가 생기지 않았다').toBeTruthy();
  expect(hold.status).toBe('PENDING');
  F.seat1BookingId = hold.id;
  const holdMs = new Date(hold.hold_expires_at).getTime() - Date.now();
  expect(holdMs, `홀드 만료가 24h 근처가 아니다 (${holdMs}ms)`).toBeGreaterThan(23 * 3600_000);
  expect(holdMs).toBeLessThan(25 * 3600_000);

  // 좌석이 정원(1)에 잡혔다 — 다른 사람(운영자)은 그 회차를 못 잡는다
  const pre = await previewOrder(svc, {
    academyId: F.academy.id,
    items: [{ item_type: 'SCHEDULE_BOOKING', schedule_id: F.schedSeat1.id }],
    userId: OWNER_ID,
  });
  expect(pre.items[0].code, '살아있는 홀드가 정원에 안 잡혔다').toBe('SCHEDULE_FULL');

  expect(errors, `콘솔 에러: ${errors.join(' | ')}`).toEqual([]);
});

/* ================================================================== */
/* 2. 입금확인 (운영 콘솔)                                              */
/* ================================================================== */

test('STEP2 입금확인: 콘솔에서 주문 그룹 확정 → CONFIRMED · 발급 · 예약 CONFIRMED · COUNT 1회 차감', async ({
  page,
  context,
}) => {
  await loginAs(context, OWNER_EMAIL);
  const errors = watchErrors(page);

  await page.goto(`/academy-admin/${F.academy.slug}/payments`);
  await page.waitForLoadState('domcontentloaded');
  await expect(page.getByRole('heading', { name: '결제 처리' })).toBeVisible({ timeout: 20_000 });

  const orderRow = page.locator(
    `[data-testid="pending-order-row"][data-order-id="${F.bankOrderId}"]`
  );
  await expect(orderRow).toBeVisible({ timeout: 20_000 });
  await orderRow.getByTestId('order-confirm').click();
  await expect(page.getByTestId('payments-notice')).toContainText('주문 전체를 확정', {
    timeout: 30_000,
  });

  // 주문 그룹 전체 확정
  const { data: og } = await svc
    .from('order_groups')
    .select('status, confirmed_by')
    .eq('id', F.bankOrderId)
    .single();
  expect(og.status).toBe('CONFIRMED');
  expect(og.confirmed_by).toBe(OWNER_ID);

  // 항목이 모두 결과를 얻었다 (수강권 발급 + 예약 확정)
  const { data: items } = await svc
    .from('order_items')
    .select('item_type, result_user_ticket_id, result_booking_id')
    .eq('order_group_id', F.bankOrderId);
  expect(items.length).toBe(2);
  for (const it of items) {
    expect(it.result_user_ticket_id || it.result_booking_id).toBeTruthy();
  }

  // 예약 CONFIRMED + 홀드 해제
  const { data: bk } = await svc
    .from('bookings')
    .select('status, hold_expires_at, user_ticket_id')
    .eq('id', F.seat1BookingId)
    .single();
  expect(bk.status).toBe('CONFIRMED');
  expect(bk.hold_expires_at).toBeNull();

  // 발급된 쿠폰(5장)에서 정확히 1회 차감 → 잔여 4
  F.couponUtId = bk.user_ticket_id;
  const { data: ut } = await svc
    .from('user_tickets')
    .select('remaining_count, status, ticket_id')
    .eq('id', F.couponUtId)
    .single();
  expect(ut.ticket_id).toBe(F.coupon5);
  expect(ut.remaining_count, '발급 5장에서 예약 1건 차감 후 잔여는 4여야 한다').toBe(4);

  expect(errors, `콘솔 에러: ${errors.join(' | ')}`).toEqual([]);
});

/* ================================================================== */
/* 3. 출석체크 (QR → 운영자 스캔)                                       */
/* ================================================================== */

test('STEP3 출석체크: 학생 QR → 운영자 스캔 → 예약 COMPLETED · 출석 감사 로그', async () => {
  const studentToken = await token(STUDENT_EMAIL);
  const ownerToken = await token(OWNER_EMAIL);

  // 학생이 자기 확정 예약의 QR 토큰을 생성
  const genRes = await fetch(`${BASE}/api/attendance/qr-generate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', Authorization: `Bearer ${studentToken}` },
    body: JSON.stringify({ bookingId: F.seat1BookingId }),
  });
  expect(genRes.status, `QR 생성 실패(${genRes.status})`).toBe(200);
  const genBody = await genRes.json();
  expect(genBody.token).toBeTruthy();

  // 운영자가 스캔 → 출석 처리
  const scanRes = await fetch(`${BASE}/api/attendance/qr-checkin`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', Authorization: `Bearer ${ownerToken}` },
    body: JSON.stringify({ token: genBody.token, academyId: F.academy.id }),
  });
  expect(scanRes.status, `QR 스캔 실패(${scanRes.status})`).toBe(200);
  expect((await scanRes.json()).success).toBe(true);

  // 예약 COMPLETED
  const { data: bk } = await svc
    .from('bookings')
    .select('status')
    .eq('id', F.seat1BookingId)
    .single();
  expect(bk.status).toBe('COMPLETED');

  // 출석 감사 로그 기록
  const { data: audit } = await svc
    .from('enrollment_activity_log')
    .select('action, booking_id, actor_user_id')
    .eq('booking_id', F.seat1BookingId)
    .eq('action', 'ATTENDANCE_CHECKED');
  expect((audit ?? []).length, '출석 감사 로그가 없다').toBeGreaterThan(0);
  expect(audit[0].actor_user_id).toBe(OWNER_ID);
});

/* ================================================================== */
/* 4. 취소 + 횟수 회복 (정확히 1회)                                     */
/* ================================================================== */

test('STEP4 취소+횟수회복: COUNT 예약 취소(마감 이내) → CANCELLED · 정확히 1회 복구(2번 취소해도 1회)', async () => {
  const studentClient = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  }) as any;
  const signIn = await studentClient.auth.signInWithPassword({
    email: STUDENT_EMAIL,
    password: E2E_PASSWORD,
  });
  expect(signIn.error).toBeNull();

  // 발급된 쿠폰(잔여 4)으로 두 번째 예약 → 잔여 3
  const booked = await book(F.schedR2.id, F.couponUtId);
  expect(booked.error, `예약 실패: ${booked.error?.message}`).toBeNull();
  const bookingId = booked.data.booking_id;
  const afterBook = await svc.from('user_tickets').select('remaining_count').eq('id', F.couponUtId).single();
  expect(afterBook.data.remaining_count).toBe(3);

  // 학생이 직접 취소 (마감 이내 → 정확히 1회 복구)
  const c1 = await studentClient.rpc('cancel_my_booking', { p_booking_id: bookingId });
  expect(c1.error, `취소 실패: ${c1.error?.message}`).toBeNull();
  expect(c1.data.status).toBe('CANCELLED');
  const afterCancel = await svc.from('user_tickets').select('remaining_count').eq('id', F.couponUtId).single();
  expect(afterCancel.data.remaining_count, '취소 후 잔여가 4로 복구돼야 한다').toBe(4);

  // 두 번째 취소 시도 → 이미 CANCELLED (상태전이 거부) → 중복 복구 없음
  const c2 = await studentClient.rpc('cancel_my_booking', { p_booking_id: bookingId });
  expect(c2.error).not.toBeNull();
  const afterRetry = await svc.from('user_tickets').select('remaining_count').eq('id', F.couponUtId).single();
  expect(afterRetry.data.remaining_count, '두 번째 취소로 이중 복구가 일어나면 안 된다').toBe(4);
});

/* ================================================================== */
/* 5. 차감 정확성 (다회 쿠폰 N감소 / PERIOD 우선)                        */
/* ================================================================== */

test('STEP5 차감정확성: 다회 쿠폰 2회 예약 → 잔여 정확히 2 감소 / ALL PASS 가 COUNT 태우기보다 우선', async () => {
  // (a) 쿠폰(잔여 4)으로 서로 다른 회차 2건 예약 → 잔여가 정확히 2 감소해 2 가 된다
  const before = (await svc.from('user_tickets').select('remaining_count').eq('id', F.couponUtId).single()).data
    .remaining_count;
  expect(before).toBe(4);

  const b3 = await book(F.schedR3.id, F.couponUtId);
  expect(b3.error, `R3 예약 실패: ${b3.error?.message}`).toBeNull();
  const b4 = await book(F.schedR4.id, F.couponUtId);
  expect(b4.error, `R4 예약 실패: ${b4.error?.message}`).toBeNull();

  const afterN = (await svc.from('user_tickets').select('remaining_count').eq('id', F.couponUtId).single()).data
    .remaining_count;
  expect(afterN, 'N회 예약 후 잔여는 before-N 이어야 한다').toBe(before - 2);

  // (b) ALL PASS(PERIOD) 를 지급하고 지정 없이 예약 → PERIOD 가 선택되고 쿠폰은 안 태운다
  const allPassUt = await ins('user_tickets', {
    user_id: STUDENT_ID,
    ticket_id: F.allPass,
    remaining_count: null,
    start_date: kstDateString(new Date()),
    expiry_date: '2099-12-31',
    status: 'ACTIVE',
  });
  const couponBefore = (await svc.from('user_tickets').select('remaining_count').eq('id', F.couponUtId).single())
    .data.remaining_count;

  const auto = await book(F.schedR5.id, null); // 지정 없음 → 엔진 자동 선택
  expect(auto.error, `자동선택 예약 실패: ${auto.error?.message}`).toBeNull();
  expect(auto.data.user_ticket_id, 'PERIOD(ALL PASS)가 선택되지 않았다').toBe(allPassUt.id);
  expect(auto.data.deducted, 'PERIOD 는 횟수를 태우지 않는다').toBe(false);

  const couponAfter = (await svc.from('user_tickets').select('remaining_count').eq('id', F.couponUtId).single())
    .data.remaining_count;
  expect(couponAfter, 'ALL PASS 로 잡혔는데 쿠폰이 태워졌다').toBe(couponBefore);
});

/* ================================================================== */
/* 6. 환불 (제안 전용 — 돈은 움직이지 않는다)                           */
/* ================================================================== */

test('STEP6 환불: 제안 → 산출값 → 사유와 함께 조정 → 확인. 감사행 남고 돈·수강권 상태는 그대로', async ({
  page,
  context,
}) => {
  await loginAs(context, OWNER_EMAIL);
  const errors = watchErrors(page);

  await page.goto(`/academy-admin/${F.academy.slug}/payments`);
  await page.waitForLoadState('domcontentloaded');

  // 화면은 "확인해도 돈은 빠져나가지 않는다"를 분명히 말한다
  const notice = page.getByTestId('refund-no-money-notice');
  await expect(notice).toBeVisible({ timeout: 20_000 });
  await expect(notice).toContainText('돈은 빠져나가지 않습니다');

  // 제안 생성 (STEP2 확정으로 생긴 쿠폰 결제내역이 환불 대상)
  const refundable = page.getByTestId('refundable-row').filter({ hasText: '쿠폰 5장' }).first();
  await expect(refundable).toBeVisible({ timeout: 20_000 });
  await refundable.getByTestId('refund-propose').click();

  const proposal = page.locator('[data-testid="proposal-row"][data-status="PROPOSED"]').first();
  await expect(proposal).toBeVisible({ timeout: 30_000 });

  // 사유는 필수
  await proposal.getByTestId('proposal-adjust').fill('11000');
  const reasonInput = proposal.getByTestId('proposal-reason');
  await expect(reasonInput).toHaveAttribute('required', '');

  // 사유와 함께 조정 확인
  await reasonInput.fill('원장 재량 조정 (V 루프)');
  await proposal.getByTestId('proposal-confirm').click();
  await expect(page.getByTestId('payments-notice')).toContainText('송금은 아직', { timeout: 30_000 });

  // DB: 감사행 (산출값 vs 조정값 · 누가 · 언제 · 사유)
  const { data: row } = await svc
    .from('refund_proposals')
    .select('status, computed_amount, adjusted_amount, reason, confirmed_by, confirmed_at, user_ticket_id')
    .eq('academy_id', F.academy.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  expect(row.status).toBe('CONFIRMED');
  expect(row.computed_amount, '엔진 산출값이 기록돼야 한다').not.toBeNull();
  expect(row.adjusted_amount).toBe(11000);
  expect(row.reason).toContain('원장 재량 조정');
  expect(row.confirmed_by).toBe(OWNER_ID);
  expect(row.confirmed_at).toBeTruthy();

  // 돈은 움직이지 않았다 — 매출 환불액 0
  const { data: rev } = await svc
    .from('revenue_transactions')
    .select('refunded_amount')
    .eq('user_ticket_id', F.couponUtId)
    .order('transaction_date', { ascending: false })
    .limit(1)
    .single();
  expect(rev?.refunded_amount ?? 0, '확인은 집행이 아니다 — 환불액이 반영되면 안 된다').toBe(0);

  // 수강권 상태도 안 바뀐다 (제안 전용 — 자동 상태 전이 없음)
  const { data: ut } = await svc.from('user_tickets').select('status').eq('id', F.couponUtId).single();
  expect(ut.status, '환불 제안이 수강권 상태를 바꿨다').toBe('ACTIVE');

  expect(errors, `콘솔 에러: ${errors.join(' | ')}`).toEqual([]);
});

/* ================================================================== */
/* 7. 카드결제 경로 (Toss 위젯 stub)                                    */
/* ================================================================== */

test('STEP7 카드결제 경로: requestPayment 가 서버 주문번호+서버 금액으로 열리고, 성공 콜백이 확정한다', async ({
  page,
  context,
}) => {
  await loginAs(context, STUDENT_EMAIL);
  const errors = watchErrors(page);
  await page.setViewportSize({ width: 390, height: 844 });

  // 실제 결제창(리다이렉트) 없이 호출만 기록하는 stub
  await page.addInitScript(() => {
    (window as any).__tossCalls = [];
    function TossPayments(clientKey: string) {
      return {
        payment: (opts: any) => ({
          requestPayment: async (args: any) => {
            (window as any).__tossCalls.push({ clientKey, customerKey: opts?.customerKey, args });
          },
        }),
      };
    }
    (TossPayments as any).ANONYMOUS = 'ANONYMOUS';
    (window as any).TossPayments = TossPayments;
  });

  // 쿠폰 5장 구매를 카드로
  await page.goto(`/s/${F.academy.slug}/schedule?w=${WEEK_OFFSET}`);
  await setCart(page, [{ label: '쿠폰 5장', item: { item_type: 'TICKET_PURCHASE', ticket_id: F.coupon5 } }]);
  await page.goto(`/s/${F.academy.slug}/cart`);
  await page.waitForLoadState('networkidle');
  await page.getByTestId('method-TOSS').click();
  await expect(page.getByTestId('checkout')).toBeEnabled();
  await page.getByTestId('checkout').click();

  // requestPayment 가 실제로 호출됐다
  await page.waitForFunction(() => (window as any).__tossCalls?.length > 0, null, { timeout: 15000 });
  const calls = await page.evaluate(() => (window as any).__tossCalls);
  expect(calls.length).toBe(1);
  const args = calls[0].args;

  // 서버가 만든 주문번호 + 서버 금액
  const storedId = await page.evaluate(
    (aid) => window.localStorage.getItem(`miniapp-pending-order:${aid}`),
    F.academy.id
  );
  expect(args.orderId).toBe(storedId);

  const { data: og } = await svc
    .from('order_groups')
    .select('method, status, total_amount')
    .eq('provider_order_id', storedId)
    .single();
  expect(og.method).toBe('TOSS');
  expect(og.status).toBe('PENDING_PAYMENT');
  expect(args.amount).toEqual({ currency: 'KRW', value: og.total_amount });

  // 성공 콜백이 서버 주문번호+금액으로 확정을 호출한다 (실제 승인 호출은 stub)
  let confirmBody: any = null;
  await page.route('**/api/orders/toss-confirm', async (route) => {
    confirmBody = route.request().postDataJSON();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, idempotent: false, order_group_id: og && 'stub', status: 'CONFIRMED', issued_tickets: 1 }),
    });
  });
  await page.goto(
    `/s/${F.academy.slug}/orders/toss-callback?paymentKey=v_pk_${stamp}&orderId=${encodeURIComponent(
      storedId!
    )}&amount=${og.total_amount}`
  );
  await expect.poll(() => confirmBody).not.toBeNull();
  expect(confirmBody).toEqual({ orderId: storedId, paymentKey: `v_pk_${stamp}`, amount: og.total_amount });
  await page.waitForURL(new RegExp(`/orders/${storedId}$`), { timeout: 15000 });
  await expect(page.getByTestId('order-status')).toBeVisible();

  // 이 PENDING TOSS 주문은 확정되지 않은 채 남으므로(승인 stub) 정리에서 함께 지워진다.
  expect(errors, `콘솔 에러: ${errors.join(' | ')}`).toEqual([]);
});
