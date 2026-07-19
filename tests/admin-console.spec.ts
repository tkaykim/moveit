/**
 * T9 운영 콘솔 (원장·인포데스크) E2E — 실제 UI 를 로그인한 원장으로 조작한다.
 *
 * 실행: npx playwright test tests/admin-console.spec.ts --workers=1
 *
 * 픽스처는 전용 테스트 학원(slug: t9-console-*) 안에서만 만들고 끝나면 지운다.
 * 실제 MID 학원(slug: mid) 데이터는 절대 건드리지 않는다.
 *
 * 이 스펙이 지키는 것 중 가장 중요한 두 가지:
 *   1) 수강생 목록은 **학생 수에 비례해 요청이 늘지 않는다** (N+1 = 결함).
 *   2) 환불 "확인"은 돈을 움직이지 않는다는 사실이 화면에 분명히 적혀 있다.
 */
import { test, expect, type Page, type BrowserContext } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

import { composeOrder, newProviderOrderId } from '../lib/orders/composer';
import type { OrderItemInput } from '../lib/orders/types';
import { resolveDiscountForStudent } from '../lib/db/memberships';

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

const stamp = randomUUID().slice(0, 8);
const F: Record<string, any> = {};
const academyIds: string[] = [];
const syntheticUserIds: string[] = [];

/* ------------------------------------------------------------------ */
/* 헬퍼                                                                */
/* ------------------------------------------------------------------ */

async function ins(table: string, row: Record<string, any>) {
  const { data, error } = await svc.from(table).insert(row).select().single();
  if (error) throw new Error(`${table} insert 실패: ${error.message}`);
  return data;
}

function isoInHours(h: number) {
  return new Date(Date.now() + h * 3600_000).toISOString();
}

function kstToday(): string {
  return new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
}

/**
 * @supabase/ssr 0.8 의 브라우저 세션 쿠키를 심는다.
 * 값 = "base64-" + base64url(JSON(session)), 3180자 초과 시 name.0 / name.1 로 쪼갠다.
 * (앱에 별도 로그인 페이지가 없어 UI 로그인 폼을 거칠 수 없다.)
 */
async function loginAs(context: BrowserContext, email: string) {
  const anon = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await anon.auth.signInWithPassword({ email, password: E2E_PASSWORD });
  if (error || !data.session) throw new Error(`${email} 로그인 실패: ${error?.message}`);

  const encoded =
    'base64-' + Buffer.from(JSON.stringify(data.session), 'utf8').toString('base64url');

  const base = new URL(process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000');
  const common = { domain: base.hostname, path: '/', httpOnly: false, secure: false } as const;

  await context.clearCookies();
  if (encoded.length <= MAX_CHUNK) {
    await context.addCookies([{ name: AUTH_COOKIE, value: encoded, ...common }]);
  } else {
    const chunks: string[] = [];
    for (let i = 0; i < encoded.length; i += MAX_CHUNK) {
      chunks.push(encoded.slice(i, i + MAX_CHUNK));
    }
    await context.addCookies(
      chunks.map((value, i) => ({ name: `${AUTH_COOKIE}.${i}`, value, ...common }))
    );
  }
  return data.session.user.id;
}

/** 콘솔 에러를 모으는 페이지 (모든 새 화면에서 0이어야 한다) */
function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console: ${m.text()}`);
  });
  return errors;
}

async function gotoConsole(page: Page, seg: string) {
  await page.goto(`/academy-admin/${F.academy.slug}/${seg}`);
  await page.waitForLoadState('domcontentloaded');
}

/* ------------------------------------------------------------------ */
/* 픽스처                                                              */
/* ------------------------------------------------------------------ */

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  // 학원
  F.academy = await ins('academies', {
    name_kr: `T9콘솔테스트-${stamp}`,
    slug: `t9-console-${stamp}`,
    is_active: true,
    booking_policy: { open: null, close: { minutesBefore: 0 }, cancelUntil: { minutesBefore: 0 } },
  });
  academyIds.push(F.academy.id);

  // 원장 권한 (레이아웃이 클라이언트에서 이 행을 직접 읽는다 — 없으면 접근 거부 화면)
  await ins('academy_user_roles', {
    academy_id: F.academy.id,
    user_id: OWNER_ID,
    role: 'ACADEMY_OWNER',
  });

  // 수업 그룹 (준비 큐가 동작하려면 그룹을 쓰는 학원이어야 한다)
  F.group = await ins('class_groups', {
    academy_id: F.academy.id,
    key: 'regular',
    name: '정규반',
    display_order: 1,
  });

  // 수강권 상품
  F.ticket = await ins('tickets', {
    academy_id: F.academy.id,
    name: `T9수강권-${stamp}`,
    price: 50000,
    ticket_type: 'COUNT',
    total_count: 10,
    valid_days: 60,
    is_on_sale: true,
    is_general: true,
    is_public: true,
    start_mode: 'IMMEDIATE',
  });

  // 멤버십 (검토 큐용)
  F.membership = await ins('memberships', {
    academy_id: F.academy.id,
    key: `vip-${stamp}`,
    name: 'VIP회원',
    visibility: 'locked',
    is_active: true,
  });

  // 예약 가능한 수업 (그룹 지정 완료)
  F.classReady = await ins('classes', {
    academy_id: F.academy.id,
    title: `T9정규수업-${stamp}`,
    class_type: 'regular',
    max_students: 20,
    is_active: true,
    class_group_id: F.group.id,
    booking_policy: { open: null, close: { minutesBefore: 0 }, cancelUntil: { minutesBefore: 0 } },
  });

  // 아직 예약을 열 수 없는 수업 (그룹 미지정) → 준비 큐에 뜬다
  F.classNotReady = await ins('classes', {
    academy_id: F.academy.id,
    title: `T9미정리수업-${stamp}`,
    class_type: 'regular',
    max_students: 20,
    is_active: true,
    class_group_id: null,
  });

  // 멤버십 전용 수업 (검토 큐 조건: classes.audience_membership_id)
  F.classVip = await ins('classes', {
    academy_id: F.academy.id,
    title: `T9VIP수업-${stamp}`,
    class_type: 'regular',
    max_students: 20,
    is_active: true,
    class_group_id: F.group.id,
    audience_membership_id: F.membership.id,
    booking_policy: { open: null, close: { minutesBefore: 0 }, cancelUntil: { minutesBefore: 0 } },
  });

  // 회차 — 오늘(명단용) / 미래(보강 대상·검토 큐용)
  F.scheduleToday = await ins('schedules', {
    class_id: F.classReady.id,
    start_time: isoInHours(6),
    end_time: isoInHours(7),
    max_students: 20,
    is_canceled: false,
  });
  F.scheduleFuture = await ins('schedules', {
    class_id: F.classReady.id,
    start_time: isoInHours(24 * 8),
    end_time: isoInHours(24 * 8 + 1),
    max_students: 20,
    is_canceled: false,
  });
  F.scheduleVip = await ins('schedules', {
    class_id: F.classVip.id,
    start_time: isoInHours(24 * 9),
    end_time: isoInHours(24 * 9 + 1),
    max_students: 20,
    is_canceled: false,
  });

  // 실제 주문 경로로 만든 주문 — 수강권 구매 + 그 수강권으로 회차 예약 (BANK = 미입금 홀드)
  const items: OrderItemInput[] = [
    { item_type: 'TICKET_PURCHASE', ticket_id: F.ticket.id },
    { item_type: 'SCHEDULE_BOOKING', schedule_id: F.scheduleToday.id, use_purchase_index: 0 },
  ];
  F.order = await composeOrder(svc, {
    academyId: F.academy.id,
    method: 'BANK',
    items,
    userId: STUDENT_ID,
    providerOrderId: newProviderOrderId('T9'),
    orderer: { name: 'E2E학생', phone: '01000000000', email: STUDENT_EMAIL },
  });

  // 수강생 목록 N+1 검증용 합성 학생 6명 + 각자 수강권
  for (let i = 0; i < 6; i++) {
    const u = await ins('users', {
      id: randomUUID(),
      name: `T9학생${i}-${stamp}`,
      email: `t9-${stamp}-${i}@example.test`,
      phone: `0100000${String(i).padStart(4, '0')}`,
      role: 'USER',
    });
    syntheticUserIds.push(u.id);
    await ins('user_tickets', {
      user_id: u.id,
      ticket_id: F.ticket.id,
      remaining_count: 10 - i,
      start_date: kstToday(),
      expiry_date: '2099-12-31',
      status: 'ACTIVE',
    });
  }
  F.studentCount = syntheticUserIds.length;

  // 검토 큐: 만료 멤버십 + 그 멤버십 전용 수업의 미래 예약
  F.expiredSm = await ins('student_memberships', {
    academy_id: F.academy.id,
    user_id: syntheticUserIds[0],
    membership_id: F.membership.id,
    status: 'EXPIRED',
    start_date: '2020-01-01',
    end_date: '2020-12-31',
  });
  F.vipBooking = await ins('bookings', {
    user_id: syntheticUserIds[0],
    class_id: F.classVip.id,
    schedule_id: F.scheduleVip.id,
    status: 'CONFIRMED',
  });

  // 실패한 예약 이벤트
  F.failedEvent = await ins('booking_events', {
    academy_id: F.academy.id,
    event_type: 'SCHEDULE_CREATED',
    schedule_id: F.scheduleFuture.id,
    status: 'FAILED',
    attempts: 3,
    last_error: 'T9 테스트용 실패 사유',
  });

  // 고정 주1회 배치 이슈 (user_ticket_id 는 NOT NULL)
  F.issueTicket = await ins('user_tickets', {
    user_id: syntheticUserIds[1],
    ticket_id: F.ticket.id,
    remaining_count: 4,
    start_date: kstToday(),
    expiry_date: '2099-12-31',
    status: 'ACTIVE',
  });
  F.placementIssue = await ins('fixed_weekly_placement_issues', {
    academy_id: F.academy.id,
    user_id: syntheticUserIds[1],
    user_ticket_id: F.issueTicket.id,
    class_id: F.classReady.id,
    schedule_id: F.scheduleFuture.id,
    occurrence_date: kstToday(),
    reason: 'SCHEDULE_FULL',
    shortfall: 1,
    detail: 'T9 테스트용 배치 이슈',
    source: 'BACKFILL',
  });

  // 막힌 주문 (재시도 대상) — 결제는 승인됐는데 이행이 안 끝난 상태
  const stuckItems: OrderItemInput[] = [{ item_type: 'TICKET_PURCHASE', ticket_id: F.ticket.id }];
  F.stuckOrder = await composeOrder(svc, {
    academyId: F.academy.id,
    method: 'BANK',
    items: stuckItems,
    userId: STUDENT_ID,
    providerOrderId: newProviderOrderId('T9S'),
  });
  await svc
    .from('order_groups')
    .update({
      status: 'PAYMENT_APPROVED',
      payment_approved_at: new Date().toISOString(),
      fulfillment_error_message: null,
    })
    .eq('id', F.stuckOrder.order_group_id);

  // 환불 제안 대상 결제 내역
  F.userTicket = await ins('user_tickets', {
    user_id: syntheticUserIds[2],
    ticket_id: F.ticket.id,
    remaining_count: 10,
    start_date: kstToday(),
    expiry_date: '2099-12-31',
    status: 'ACTIVE',
  });
  F.revenue = await ins('revenue_transactions', {
    academy_id: F.academy.id,
    user_id: syntheticUserIds[2],
    ticket_id: F.ticket.id,
    user_ticket_id: F.userTicket.id,
    original_price: 50000,
    discount_amount: 0,
    final_price: 50000,
    payment_method: 'BANK',
    payment_status: 'COMPLETED',
    quantity: 10,
    valid_days: 60,
    ticket_name: F.ticket.name,
    ticket_type_snapshot: 'COUNT',
    transaction_date: new Date().toISOString(),
  });
});

test.afterAll(async () => {
  // 우리가 만든 것만 지운다. 순서는 FK 역순.
  await svc.from('membership_review_actions').delete().eq('academy_id', F.academy?.id ?? '');
  await svc.from('refund_proposals').delete().eq('academy_id', F.academy?.id ?? '');
  await svc.from('revenue_transactions').delete().eq('academy_id', F.academy?.id ?? '');
  await svc.from('fixed_weekly_placement_issues').delete().eq('academy_id', F.academy?.id ?? '');
  await svc.from('booking_events').delete().eq('academy_id', F.academy?.id ?? '');
  // enrollment_activity_log 는 academies/bookings/user_tickets 를 전부 참조한다.
  // 이걸 빠뜨리면 그 뒤 삭제가 **조용히** 전부 실패하고(supabase-js delete 는 throw 하지 않는다)
  // 테스트 학원이 DB 에 그대로 남는다. 실제로 남아 있었다.
  await svc.from('enrollment_activity_log').delete().eq('academy_id', F.academy?.id ?? '');

  const { data: classes } = await svc.from('classes').select('id').eq('academy_id', F.academy?.id ?? '');
  const classIds = (classes ?? []).map((c: any) => c.id);
  const { data: orders } = await svc.from('order_groups').select('id').eq('academy_id', F.academy?.id ?? '');
  const orderIds = (orders ?? []).map((o: any) => o.id);

  // order_items.result_booking_id → bookings 이므로 **order_items 가 bookings 보다 먼저다**.
  // 순서를 뒤집으면 bookings 삭제가 조용히 실패하고, 그 뒤 schedules·classes·memberships 가 줄줄이 남는다.
  if (orderIds.length) {
    await svc.from('order_items').delete().in('order_group_id', orderIds);
  }
  if (classIds.length) {
    await svc.from('bookings').delete().in('class_id', classIds);
  }
  if (orderIds.length) {
    await svc.from('order_groups').delete().in('id', orderIds);
  }
  if (classIds.length) {
    await svc.from('schedules').delete().in('class_id', classIds);
  }

  await svc.from('student_memberships').delete().eq('academy_id', F.academy?.id ?? '');
  if (syntheticUserIds.length) {
    await svc.from('user_tickets').delete().in('user_id', syntheticUserIds);
  }
  // 이 학원의 **모든** 상품에 딸린 수강권을 지운다 (F.ticket 하나만 지우면 tickets 삭제가 FK 에 막힌다).
  const { data: tks } = await svc.from('tickets').select('id').eq('academy_id', F.academy?.id ?? '');
  const ticketIds = (tks ?? []).map((t: any) => t.id);
  if (ticketIds.length) {
    await svc.from('user_tickets').delete().in('ticket_id', ticketIds);
    await svc.from('ticket_coverage').delete().in('ticket_id', ticketIds);
    await svc.from('ticket_classes').delete().in('ticket_id', ticketIds);
  }
  // membership_discounts 는 이 학원의 **모든** 멤버십에 대해 지운다
  // (F.membership 하나만 지우면 나머지 멤버십이 FK 에 걸려 남는다).
  const { data: ms } = await svc.from('memberships').select('id').eq('academy_id', F.academy?.id ?? '');
  const membershipIds = (ms ?? []).map((m: any) => m.id);
  if (membershipIds.length) {
    await svc.from('membership_discounts').delete().in('membership_id', membershipIds);
  }
  // classes.audience_membership_id → memberships 이므로 **classes 가 memberships 보다 먼저다**.
  await svc.from('classes').delete().eq('academy_id', F.academy?.id ?? '');
  await svc.from('class_groups').delete().eq('academy_id', F.academy?.id ?? '');
  await svc.from('memberships').delete().eq('academy_id', F.academy?.id ?? '');
  await svc.from('tickets').delete().eq('academy_id', F.academy?.id ?? '');
  await svc.from('academy_user_roles').delete().eq('academy_id', F.academy?.id ?? '');
  if (syntheticUserIds.length) {
    await svc.from('users').delete().in('id', syntheticUserIds);
  }
  for (const id of academyIds) await svc.from('academies').delete().eq('id', id);

  // 정리가 실패했으면 **소리내어** 알린다. 조용히 남으면 다음 실행부터 DB 가 오염된다.
  for (const id of academyIds) {
    const { count } = await svc.from('academies').select('id', { count: 'exact', head: true }).eq('id', id);
    if (count) console.error(`[T9 cleanup] 테스트 학원 ${id} 이 남아 있다 — FK 역순을 다시 확인하라`);
  }
});

/* ------------------------------------------------------------------ */
/* 1. 수업별 예약자 명단                                                 */
/* ------------------------------------------------------------------ */

test('명단: 새 주문 경로로 들어온 예약이 수강권·미입금 상태와 함께 보인다', async ({
  page,
  context,
}) => {
  const errors = watchErrors(page);
  await loginAs(context, OWNER_EMAIL);
  await gotoConsole(page, 'roster');

  await expect(page.getByRole('heading', { name: '수업별 예약자 명단' })).toBeVisible({
    timeout: 20_000,
  });

  const occurrence = page.getByTestId('roster-occurrence').filter({ hasText: F.classReady.title });
  await expect(occurrence).toBeVisible({ timeout: 20_000 });
  await occurrence.click();

  const row = page.getByTestId('roster-student').first();
  await expect(row).toBeVisible();
  // 미입금(홀드) 주문에서 넘어온 예약임이 화면에 드러난다
  await expect(row.getByText(/미입금 예약/)).toBeVisible();
  // 어떤 수강권으로 잡힌 예약인지도 함께
  await expect(row.getByText(/수강권:/)).toBeVisible();

  expect(errors).toEqual([]);
});

/* ------------------------------------------------------------------ */
/* 2. 수강생 목록 — N+1 금지                                            */
/* ------------------------------------------------------------------ */

test('수강생 목록: 학생 수에 비례해 요청이 늘지 않는다 (N+1 금지)', async ({ page, context }) => {
  const errors = watchErrors(page);
  await loginAs(context, OWNER_EMAIL);

  const apiCalls: string[] = [];
  page.on('request', (r) => {
    const u = r.url();
    if (u.includes('/api/academy-admin/')) apiCalls.push(u);
  });

  await gotoConsole(page, 'students-overview');
  await expect(page.getByRole('heading', { name: '수강생 목록' })).toBeVisible({ timeout: 20_000 });

  const rows = page.getByTestId('student-row');
  await expect(rows.first()).toBeVisible({ timeout: 20_000 });
  const count = await rows.count();
  expect(count).toBeGreaterThanOrEqual(F.studentCount);

  // 수강권·멤버십이 각 행에 함께 렌더된다 (따로 불러오지 않는다)
  await expect(rows.first().getByTestId('student-tickets')).toBeVisible();
  await expect(rows.first().getByTestId('student-membership')).toBeVisible();

  // 핵심 단언 ①: 학생 개인을 가리키는 요청이 단 하나도 없다.
  //   (N+1 이 생기면 반드시 user_id 가 URL 에 실려 나간다 — 이게 가장 직접적인 증거다)
  for (const uid of syntheticUserIds) {
    expect(apiCalls.filter((u) => u.includes(uid))).toHaveLength(0);
  }

  // 핵심 단언 ②: 요청 수가 학생 수에 비례하지 않는다.
  //   목록 엔드포인트는 렌더당 1회. dev 의 React StrictMode 는 effect 를 2번 실행하므로 2까지 허용한다.
  const listCalls = apiCalls.filter((u) => u.includes('/console/students'));
  expect(listCalls.length).toBeGreaterThanOrEqual(1);
  expect(listCalls.length).toBeLessThanOrEqual(2);
  expect(apiCalls.length).toBeLessThan(count);

  expect(errors).toEqual([]);
});

/* ------------------------------------------------------------------ */
/* 3. 멤버십 — 생성 → 부여 → 정지 → 재개 → 연장                          */
/* ------------------------------------------------------------------ */

test('멤버십: 만들기 → 부여 → 일시정지 → 재개 → 연장이 화면에 반영된다', async ({
  page,
  context,
}) => {
  const errors = watchErrors(page);
  await loginAs(context, OWNER_EMAIL);
  await gotoConsole(page, 'memberships');

  await expect(page.getByRole('heading', { name: '멤버십 관리' })).toBeVisible({ timeout: 20_000 });

  // --- 만들기
  const membershipName = `콘솔멤버십-${stamp}`;
  await page.getByTestId('membership-new-toggle').click();
  await page.getByTestId('membership-name').fill(membershipName);
  await page.getByTestId('membership-key').fill(`console-${stamp}`);
  await page.getByTestId('membership-create-submit').click();

  // data-membership-name 은 행 자체의 속성이다 (자손이 아니다)
  const created = page.locator(
    `[data-testid="membership-row"][data-membership-name="${membershipName}"]`
  );
  await expect(created).toBeVisible({ timeout: 20_000 });

  // --- 부여
  const studentName = `T9학생3-${stamp}`;
  await page.getByTestId('grant-user').selectOption({ label: studentName });
  await page.getByTestId('grant-membership').selectOption({ label: membershipName });
  await page.getByTestId('grant-submit').click();

  const smRow = page.getByTestId('student-membership-row').filter({ hasText: studentName }).first();
  await expect(smRow).toBeVisible({ timeout: 20_000 });
  await expect(smRow).toHaveAttribute('data-status', 'ACTIVE');

  // --- 일시정지
  await smRow.getByTestId('membership-suspend').click();
  await expect(
    page.getByTestId('student-membership-row').filter({ hasText: studentName }).first()
  ).toHaveAttribute('data-status', 'SUSPENDED', { timeout: 20_000 });
  await expect(page.getByText('일시정지', { exact: true }).first()).toBeVisible();

  // --- 재개
  await page
    .getByTestId('student-membership-row')
    .filter({ hasText: studentName })
    .first()
    .getByTestId('membership-resume')
    .click();
  await expect(
    page.getByTestId('student-membership-row').filter({ hasText: studentName }).first()
  ).toHaveAttribute('data-status', 'ACTIVE', { timeout: 20_000 });

  // --- 연장 (종료일이 화면에 생긴다)
  await page
    .getByTestId('student-membership-row')
    .filter({ hasText: studentName })
    .first()
    .getByTestId('membership-extend')
    .click();
  await expect(
    page
      .getByTestId('student-membership-row')
      .filter({ hasText: studentName })
      .first()
      .getByText(/^~\d{4}-\d{2}-\d{2}$/)
  ).toBeVisible({ timeout: 20_000 });

  expect(errors).toEqual([]);
});

/* ------------------------------------------------------------------ */
/* 4. 할인 비활성 = 소프트                                              */
/* ------------------------------------------------------------------ */

test('할인: 적용을 중지하면 적용에서 빠지지만 기록은 남는다 (삭제 아님)', async ({
  page,
  context,
}) => {
  const errors = watchErrors(page);
  await loginAs(context, OWNER_EMAIL);
  await gotoConsole(page, 'memberships');

  // VIP회원 멤버십을 펼친다
  const row = page.locator('[data-testid="membership-row"][data-membership-name="VIP회원"]');
  await expect(row).toBeVisible({ timeout: 20_000 });
  await row.click();
  await expect(row.getByTestId('membership-detail')).toBeVisible();

  // 할인 추가 (정규반 20%)
  await row.getByTestId('discount-group').selectOption({ label: '정규반' });
  await row.getByTestId('discount-percent').fill('20');
  await row.getByTestId('discount-add').click();

  const discountRow = row.getByTestId('discount-row').first();
  await expect(discountRow).toBeVisible({ timeout: 20_000 });
  await expect(discountRow).toHaveAttribute('data-active', 'true');
  const discountId = await discountRow.getAttribute('data-discount-id');
  expect(discountId).toBeTruthy();

  // 활성 상태에서는 학생에게 실제로 적용된다
  await svc.from('student_memberships').insert({
    academy_id: F.academy.id,
    user_id: syntheticUserIds[4],
    membership_id: F.membership.id,
    status: 'ACTIVE',
    start_date: '2020-01-01',
    end_date: '2099-12-31',
  });
  const target = { kind: 'class_group' as const, classGroupId: F.group.id };
  const before = await resolveDiscountForStudent(svc, {
    academyId: F.academy.id,
    userId: syntheticUserIds[4],
    target,
    basePrice: 50000,
  });
  expect(before.percent).toBe(20);

  // --- 적용 중지
  await discountRow.getByTestId('discount-deactivate').click();
  await expect(row.getByTestId('discount-row').first()).toHaveAttribute('data-active', 'false', {
    timeout: 20_000,
  });

  // 적용에서는 빠졌지만
  const after = await resolveDiscountForStudent(svc, {
    academyId: F.academy.id,
    userId: syntheticUserIds[4],
    target,
    basePrice: 50000,
  });
  expect(after.percent).toBe(0);

  // 행 자체는 남아 있다 (지난 결제의 근거)
  const { data: still } = await svc
    .from('membership_discounts')
    .select('id, is_active')
    .eq('id', discountId)
    .single();
  expect(still).toBeTruthy();
  expect(still.is_active).toBe(false);

  expect(errors).toEqual([]);
});

/* ------------------------------------------------------------------ */
/* 5. 검토 큐 처리                                                      */
/* ------------------------------------------------------------------ */

test('검토 큐: 처리하면 누가 언제 처리했는지 화면에 남는다', async ({ page, context }) => {
  const errors = watchErrors(page);
  await loginAs(context, OWNER_EMAIL);
  await gotoConsole(page, 'memberships');

  const queue = page.getByTestId('review-queue');
  await expect(queue).toBeVisible({ timeout: 20_000 });

  const target = queue.getByTestId('review-queue-row').filter({ hasText: 'VIP회원' }).first();
  await expect(target).toBeVisible({ timeout: 20_000 });

  await target.getByTestId('review-action-CONTACTED').click();

  const handled = queue.getByTestId('review-handled').first();
  await expect(handled).toBeVisible({ timeout: 20_000 });
  await expect(handled).toContainText('연락함');

  // 감사 기록이 실제로 남았는가 (담당자 = 원장)
  const { data: action } = await svc
    .from('membership_review_actions')
    .select('action, handled_by, handled_at')
    .eq('student_membership_id', F.expiredSm.id)
    .order('handled_at', { ascending: false })
    .limit(1)
    .single();
  expect(action.action).toBe('CONTACTED');
  expect(action.handled_by).toBe(OWNER_ID);
  expect(action.handled_at).toBeTruthy();

  expect(errors).toEqual([]);
});

/* ------------------------------------------------------------------ */
/* 6. 입금 확인 = 주문 그룹 전체 확정                                     */
/* ------------------------------------------------------------------ */

test('입금 확인: 한 번의 확인이 주문 묶음 전체를 확정한다', async ({ page, context }) => {
  const errors = watchErrors(page);
  await loginAs(context, OWNER_EMAIL);
  await gotoConsole(page, 'payments');

  await expect(page.getByRole('heading', { name: '결제 처리' })).toBeVisible({ timeout: 20_000 });

  const orderId = F.order.order_group_id;
  const orderRow = page.locator(`[data-testid="pending-order-row"][data-order-id="${orderId}"]`);
  await expect(orderRow).toBeVisible({ timeout: 20_000 });
  // 이 주문은 항목이 2개 (수강권 + 회차 예약) — 하나로 묶여 있다
  await expect(orderRow).toContainText('항목 2개');

  await orderRow.getByTestId('order-confirm').click();
  await expect(page.getByTestId('payments-notice')).toContainText('주문 전체를 확정', {
    timeout: 30_000,
  });

  // 주문 그룹 전체가 확정되었는가
  const { data: og } = await svc
    .from('order_groups')
    .select('status, confirmed_at, confirmed_by')
    .eq('id', orderId)
    .single();
  expect(og.status).toBe('CONFIRMED');
  expect(og.confirmed_by).toBe(OWNER_ID);

  // 묶여 있던 항목들이 모두 결과를 얻었는가 (수강권 발급 + 예약 확정)
  const { data: items } = await svc
    .from('order_items')
    .select('item_type, result_user_ticket_id, result_booking_id')
    .eq('order_group_id', orderId);
  expect(items.length).toBe(2);
  for (const it of items) {
    expect(it.result_user_ticket_id || it.result_booking_id).toBeTruthy();
  }

  expect(errors).toEqual([]);
});

/* ------------------------------------------------------------------ */
/* 7. 환불 제안 → 조정 → 확인 (돈은 움직이지 않는다)                       */
/* ------------------------------------------------------------------ */

test('환불: 제안 → 사유와 함께 조정 → 확인, 그리고 돈이 안 나간다고 화면이 말한다', async ({
  page,
  context,
}) => {
  const errors = watchErrors(page);
  await loginAs(context, OWNER_EMAIL);
  await gotoConsole(page, 'payments');

  // 화면은 "확인해도 돈은 빠져나가지 않는다"를 분명히 말해야 한다
  const notice = page.getByTestId('refund-no-money-notice');
  await expect(notice).toBeVisible({ timeout: 20_000 });
  await expect(notice).toContainText('돈은 빠져나가지 않습니다');

  // --- 제안 생성
  const refundable = page.getByTestId('refundable-row').filter({ hasText: F.ticket.name }).first();
  await expect(refundable).toBeVisible({ timeout: 20_000 });
  await refundable.getByTestId('refund-propose').click();

  const proposal = page.locator('[data-testid="proposal-row"][data-status="PROPOSED"]').first();
  await expect(proposal).toBeVisible({ timeout: 30_000 });

  // --- 사유 없이 확인하면 거절된다 (사유는 필수)
  await proposal.getByTestId('proposal-adjust').fill('12345');
  const reasonInput = proposal.getByTestId('proposal-reason');
  await expect(reasonInput).toHaveAttribute('required', '');

  // --- 사유와 함께 조정 확인
  await reasonInput.fill('원장 재량 조정 (E2E)');
  await proposal.getByTestId('proposal-confirm').click();

  await expect(page.getByTestId('payments-notice')).toContainText('송금은 아직', {
    timeout: 30_000,
  });

  // 감사 기록이 화면에 보인다
  const confirmed = page.locator('[data-testid="proposal-row"][data-status="CONFIRMED"]').first();
  await expect(confirmed).toBeVisible({ timeout: 20_000 });
  const audit = confirmed.getByTestId('proposal-audit');
  await expect(audit).toContainText('원장 재량 조정 (E2E)');
  await expect(audit).toContainText('12,345원');

  // DB 에도 누가·언제·엔진값 대비 최종값·사유가 남았다
  const { data: row } = await svc
    .from('refund_proposals')
    .select('status, adjusted_amount, computed_amount, reason, confirmed_by, confirmed_at')
    .eq('academy_id', F.academy.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  expect(row.status).toBe('CONFIRMED');
  expect(row.adjusted_amount).toBe(12345);
  expect(row.reason).toContain('원장 재량 조정');
  expect(row.confirmed_by).toBe(OWNER_ID);
  expect(row.confirmed_at).toBeTruthy();

  // 확인은 집행이 아니다 — 실제 환불액은 아직 반영되지 않았다
  const { data: rev } = await svc
    .from('revenue_transactions')
    .select('refunded_amount')
    .eq('id', F.revenue.id)
    .single();
  expect(rev.refunded_amount ?? 0).toBe(0);

  expect(errors).toEqual([]);
});

/* ------------------------------------------------------------------ */
/* 8. 재처리 대시보드                                                    */
/* ------------------------------------------------------------------ */

test('재처리: 다섯 목록이 모두 뜨고, 막힌 주문을 다시 처리할 수 있다', async ({ page, context }) => {
  const errors = watchErrors(page);
  await loginAs(context, OWNER_EMAIL);
  await gotoConsole(page, 'reprocess');

  await expect(page.getByRole('heading', { name: '재처리' })).toBeVisible({ timeout: 20_000 });

  // 다섯 갈래 모두 렌더된다
  for (const id of [
    'list-stuck-orders',
    'list-failed-events',
    'list-placement-issues',
    'list-expired-membership-bookings',
    'list-not-ready-classes',
  ]) {
    await expect(page.getByTestId(id)).toBeVisible({ timeout: 20_000 });
  }

  // ② 실패한 이벤트는 시도 횟수와 원인을 보여준다
  const ev = page.getByTestId('failed-event-row').first();
  await expect(ev).toBeVisible();
  await expect(ev).toContainText('시도 3회');
  await expect(ev).toContainText('T9 테스트용 실패 사유');

  // ③ 배치 이슈
  await expect(page.getByTestId('placement-issue-row').first()).toBeVisible();

  // ④ 만료 멤버십 + 미래 예약
  await expect(page.getByTestId('expired-membership-row').first()).toBeVisible();

  // ⑤ 예약을 열 수 없는 수업 — 인라인 태깅
  const notReady = page
    .getByTestId('not-ready-row')
    .filter({ hasText: F.classNotReady.title })
    .first();
  await expect(notReady).toBeVisible();
  await notReady.getByTestId('tag-group').selectOption({ label: '정규반' });
  await notReady.getByTestId('tag-submit').click();
  await expect(page.getByTestId('reprocess-notice')).toContainText('수업을 정리', {
    timeout: 30_000,
  });
  // 정리되면 큐에서 빠지고 "정상"이 된다
  await expect(page.getByTestId('list-not-ready-classes').getByTestId('all-clear')).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.getByTestId('list-not-ready-classes')).toContainText('정상');

  // ① 막힌 주문 재시도
  const stuckId = F.stuckOrder.order_group_id;
  const stuck = page.locator(`[data-testid="stuck-order-row"][data-order-id="${stuckId}"]`);
  await expect(stuck).toBeVisible({ timeout: 20_000 });
  await stuck.getByTestId('stuck-order-retry').click();
  await expect(page.getByTestId('reprocess-notice')).toContainText('다시 처리', {
    timeout: 30_000,
  });

  const { data: og } = await svc
    .from('order_groups')
    .select('status')
    .eq('id', stuckId)
    .single();
  expect(og.status).toBe('CONFIRMED');

  // 재시도가 끝나면 이 목록도 "정상"으로 읽힌다
  await expect(page.getByTestId('list-stuck-orders')).toContainText('정상', { timeout: 20_000 });

  expect(errors).toEqual([]);
});

test('재처리: 빈 목록은 고장이 아니라 "정상"으로 읽힌다', async ({ page, context }) => {
  await loginAs(context, OWNER_EMAIL);
  await gotoConsole(page, 'reprocess');
  await expect(page.getByRole('heading', { name: '재처리' })).toBeVisible({ timeout: 20_000 });

  // 오류 배너는 없다 (page.getByRole('alert') 는 Next 라우트 안내자까지 잡으므로 우리 컴포넌트로 좁힌다)
  await expect(page.getByTestId('console-error')).toHaveCount(0);

  // 앞선 테스트에서 비워진 목록(막힌 주문 · 예약 못 여는 수업)은 "정상"으로 읽힌다.
  for (const id of ['list-stuck-orders', 'list-not-ready-classes']) {
    const card = page.getByTestId(id);
    await expect(card.getByTestId('all-clear')).toBeVisible({ timeout: 20_000 });
    await expect(card).toContainText('정상');
    // 빈 목록이 "실패/오류"로 읽히면 안 된다 — 정상 문구 안에는 그런 말이 없어야 한다
    await expect(card.getByTestId('all-clear')).not.toContainText(/실패|오류|에러/);
  }
});

/* ------------------------------------------------------------------ */
/* 9. 권한 — 학생은 못 들어온다                                          */
/* ------------------------------------------------------------------ */

test('권한: 학생 계정은 운영 콘솔 어느 화면에도 접근하지 못한다', async ({ page, context }) => {
  await loginAs(context, STUDENT_EMAIL);

  for (const seg of ['roster', 'students-overview', 'memberships', 'payments', 'reprocess']) {
    await gotoConsole(page, seg);
    // 운영 데이터가 새어 나오면 안 된다
    await expect(page.getByTestId('roster-student')).toHaveCount(0);
    await expect(page.getByTestId('student-row')).toHaveCount(0);
    await expect(page.getByTestId('pending-order-row')).toHaveCount(0);
    await expect(page.getByTestId('stuck-order-row')).toHaveCount(0);
    await expect(page.getByTestId('membership-row')).toHaveCount(0);
  }

  // API 도 직접 막혀 있다
  const anon = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: auth } = await anon.auth.signInWithPassword({
    email: STUDENT_EMAIL,
    password: E2E_PASSWORD,
  });
  const base = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';
  for (const p of ['console/roster', 'console/students', 'console/reprocess', 'console/payments']) {
    const res = await page.request.get(`${base}/api/academy-admin/${F.academy.id}/${p}`, {
      headers: { Authorization: `Bearer ${auth!.session!.access_token}` },
    });
    expect(res.status()).toBe(403);
  }
});

/* ------------------------------------------------------------------ */
/* 10. 모바일 390px — 가로 넘침 금지 + 콘솔 에러 0                        */
/* ------------------------------------------------------------------ */

test('모바일 390px: 모든 새 화면에 가로 스크롤이 없고 콘솔 에러가 없다', async ({
  page,
  context,
}) => {
  const errors = watchErrors(page);
  await loginAs(context, OWNER_EMAIL);
  await page.setViewportSize({ width: 390, height: 844 });

  for (const seg of ['roster', 'students-overview', 'memberships', 'payments', 'reprocess']) {
    await gotoConsole(page, seg);
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 20_000 });
    // 목록이 그려질 시간을 준다 (빈 목록이면 정상 문구가 뜬다)
    await page.waitForTimeout(1500);

    const overflow = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(
      overflow.scrollWidth,
      `${seg} 화면이 390px 에서 가로로 넘칩니다 (${overflow.scrollWidth}px)`
    ).toBeLessThanOrEqual(overflow.clientWidth + 1);
  }

  expect(errors).toEqual([]);
});
