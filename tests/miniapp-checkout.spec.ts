/**
 * T10 학생 미니앱 — 시간표 스킨 · 장바구니 결제 E2E
 *
 * 실행: npx playwright test tests/miniapp-checkout.spec.ts --workers=1
 *
 * 픽스처는 전용 테스트 학원(slug: t10-mini-*) 안에서만 만들고 끝나면 지운다.
 * 실제 MID 학원(slug: mid) 데이터는 절대 건드리지 않는다.
 *
 * 이 스펙이 지키는 것 중 가장 중요한 세 가지:
 *   1) 멤버십 전용 수업이 안 보이는 것은 **RLS 의 결과**다 — API 응답 자체를 검증한다
 *      (화면에서만 숨기는 것은 보안이 아니다).
 *   2) 거절 항목은 **결제 전에** 각자의 사유와 함께 드러난다 — 결제 후 취소가 아니다.
 *   3) 승인됐지만 이행 전인 주문은 **실패라고 말하지 않는다**.
 */
import { test, expect, type Page, type BrowserContext } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

import { composeOrder, newProviderOrderId, previewOrder } from '../lib/orders/composer';
import type { OrderItemInput } from '../lib/orders/types';
import { approveAndFinalize, recordApproval } from '../lib/payments/fulfilment';
import { buildTossConfirmRequest } from '../lib/payments/toss';
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

const STUDENT_EMAIL = 'e2e-moveit-student@modoogoods.com';
const E2E_PASSWORD = 'Test1234!e2e';
const STUDENT_ID = 'fd2fd033-2f2c-4cad-890b-f2c9c75a0f23';

const PROJECT_REF = new URL(SUPABASE_URL).hostname.split('.')[0];
const AUTH_COOKIE = `sb-${PROJECT_REF}-auth-token`;
const MAX_CHUNK = 3180;

const stamp = randomUUID().slice(0, 8);
const F: Record<string, any> = {};
const academyIds: string[] = [];
const syntheticUserIds: string[] = [];
const createdUserTicketIds: string[] = [];

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

/**
 * 픽스처는 **다음 주**(offset=1)에 고정한다.
 *   - "지금부터 N시간 뒤"로 잡으면 실행 시각에 따라 주 경계를 넘나들어 테스트가 흔들린다.
 *   - schedules 는 (class_id, KST 날짜) 유니크라 한 수업은 하루에 한 회차뿐이다.
 * 그래서 회차를 늘릴 땐 **수업을 늘린다** (그게 원래 N+1 이 문제되는 축이기도 하다).
 */
const FIXTURE_WEEK_OFFSET = 1;
const WEEK_SUNDAY = kstDateString(weekStartFromOffset(FIXTURE_WEEK_OFFSET));

/** 픽스처 주의 d(0=일)요일 hh:mm (KST) → UTC ISO */
function dayAt(d: number, time: string): string {
  return kstDateTimeToUtc(addDays(WEEK_SUNDAY, d), time).toISOString();
}

function kstToday(): string {
  return new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
}

/** @supabase/ssr 0.8 브라우저 세션 쿠키를 직접 심는다 (admin-console.spec 과 동일 방식) */
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
    for (let i = 0; i < encoded.length; i += MAX_CHUNK) chunks.push(encoded.slice(i, i + MAX_CHUNK));
    await context.addCookies(
      chunks.map((value, i) => ({ name: `${AUTH_COOKIE}.${i}`, value, ...common }))
    );
  }
  return { userId: data.session.user.id, accessToken: data.session.access_token };
}

function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console: ${m.text()}`);
  });
  return errors;
}

/** 390px 에서 가로 스크롤이 생기지 않아야 한다 */
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

async function gotoMini(page: Page, seg: string) {
  await page.goto(`/s/${F.academy.slug}${seg}`);
  await page.waitForLoadState('networkidle');
}

/** 픽스처가 들어있는 주의 시간표 */
async function gotoSchedule(page: Page) {
  await page.goto(`/s/${F.academy.slug}/schedule?w=${FIXTURE_WEEK_OFFSET}`);
  await page.waitForLoadState('networkidle');
}

/** 세션 없이/있이 미니앱 주간 API 를 직접 부른다 (RLS 결과 자체를 검증하기 위함) */
async function fetchWeekApi(accessToken: string | null, offset = 0) {
  const base = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';
  const res = await fetch(`${base}/api/s/${F.academy.slug}/week?w=${offset}`, {
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
  });
  return { status: res.status, body: (await res.json()) as any };
}

/* ------------------------------------------------------------------ */
/* 픽스처                                                              */
/* ------------------------------------------------------------------ */

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  // 학원 — 스킨은 전부 **데이터**로 준다 (코드에 slug 분기 없음을 증명)
  F.academy = await ins('academies', {
    name_kr: `T10미니앱-${stamp}`,
    slug: `t10-mini-${stamp}`,
    is_active: true,
    brand_color: '#7C3AED',
    booking_policy: { open: null, close: { minutesBefore: 0 }, cancelUntil: { minutesBefore: 0 } },
    section_config: {
      miniapp: {
        heroEyebrow: 'T10SKIN',
        scheduleNote: 'T10 스킨 문구입니다',
        specialNotice: 'T10 특별수업은 별도 결제가 필요합니다',
        checkoutCta: 'T10 결제하기',
      },
    },
  });
  academyIds.push(F.academy.id);

  // 그룹: 정규 / 특별
  F.groupRegular = await ins('class_groups', {
    academy_id: F.academy.id,
    key: 'regular',
    name: '정규반',
    is_special: false,
    display_order: 1,
  });
  F.groupSpecial = await ins('class_groups', {
    academy_id: F.academy.id,
    key: 'special',
    name: '특별반',
    is_special: true,
    display_order: 2,
  });

  // 멤버십 (대상 한정 수업용)
  F.membership = await ins('memberships', {
    academy_id: F.academy.id,
    key: `t10-vip-${stamp}`,
    name: 'T10 VIP',
    visibility: 'locked',
    is_active: true,
  });

  const alwaysOpen = { open: null, close: { minutesBefore: 0 }, cancelUntil: { minutesBefore: 0 } };

  const mkClass = (title: string, extra: Record<string, any> = {}) =>
    ins('classes', {
      academy_id: F.academy.id,
      title,
      class_type: 'regular',
      max_students: 20,
      is_active: true,
      class_group_id: F.groupRegular.id,
      booking_policy: alwaysOpen,
      ...extra,
    });

  const mkSched = (classId: string, day: number, time: string, max = 20, canceled = false) =>
    ins('schedules', {
      class_id: classId,
      start_time: dayAt(day, time),
      end_time: dayAt(day, time === '19:00' ? '20:00' : '21:00'),
      max_students: max,
      is_canceled: canceled,
    });

  // 수업들 — 회차 하나당 수업 하나 (하루 한 회차 제약)
  F.classRegular = await mkClass(`T10정규-${stamp}`);
  F.classSpecial = await mkClass(`T10특별-${stamp}`, { class_group_id: F.groupSpecial.id });
  F.classSeat1 = await mkClass(`T10한자리-${stamp}`, { max_students: 1 });
  F.classCanceled = await mkClass(`T10휴강-${stamp}`);
  // 아직 예약 오픈 전: 수업 당일 00:00 에 열린다 → 다음 주 수업이면 지금은 오픈 전
  F.classNotOpen = await mkClass(`T10오픈전-${stamp}`, {
    booking_policy: { open: { daysBefore: 0, time: '00:00' }, close: { minutesBefore: 0 } },
  });
  F.classMemberOnly = await mkClass(`T10멤버전용-${stamp}`, {
    audience_membership_id: F.membership.id,
  });

  // 회차 — 전부 픽스처 주(다음 주) 안
  F.schedRegular = await mkSched(F.classRegular.id, 1, '19:00'); // 월
  F.schedSpecial = await mkSched(F.classSpecial.id, 1, '20:00'); // 월
  F.schedSeat1 = await mkSched(F.classSeat1.id, 2, '19:00', 1); // 화 · 정원 1석
  F.schedCanceled = await mkSched(F.classCanceled.id, 2, '20:00', 20, true); // 화 · 휴강
  F.schedNotOpen = await mkSched(F.classNotOpen.id, 3, '19:00'); // 수
  F.schedMemberOnly = await mkSched(F.classMemberOnly.id, 4, '19:00'); // 목

  // 상품
  // ① 올패스(무제한, PERIOD, is_general) — coverage row 가 없어 특별그룹은 통과 못한다
  F.ticketAllPass = await ins('tickets', {
    academy_id: F.academy.id,
    name: `T10올패스-${stamp}`,
    price: 150000,
    ticket_type: 'PERIOD',
    valid_days: 30,
    is_on_sale: true,
    is_general: true,
    is_public: true,
    start_mode: 'IMMEDIATE',
  });
  // ② 특별수업 전용 수강권 — coverage 로 특별그룹을 명시적으로 덮는다
  F.ticketSpecial = await ins('tickets', {
    academy_id: F.academy.id,
    name: `T10특별권-${stamp}`,
    price: 40000,
    ticket_type: 'COUNT',
    total_count: 2,
    valid_days: 30,
    is_on_sale: true,
    is_general: false,
    is_public: true,
    start_mode: 'IMMEDIATE',
  });
  await ins('ticket_coverage', {
    ticket_id: F.ticketSpecial.id,
    class_group_id: F.groupSpecial.id,
    is_active: true,
  });
  // ③ FIRST_BOOKING 수강권 — MY 의 "아직 시작 안 함" 검증용
  F.ticketFirstBooking = await ins('tickets', {
    academy_id: F.academy.id,
    name: `T10첫예약권-${stamp}`,
    price: 60000,
    ticket_type: 'COUNT',
    total_count: 5,
    valid_days: 45,
    is_on_sale: true,
    is_general: true,
    is_public: true,
    start_mode: 'FIRST_BOOKING',
  });

  // 학생에게 올패스 지급 (특별수업이 왜 막히는지 보기 위한 출발점)
  F.utAllPass = await ins('user_tickets', {
    user_id: STUDENT_ID,
    ticket_id: F.ticketAllPass.id,
    remaining_count: null,
    start_date: kstToday(),
    expiry_date: '2099-12-31',
    status: 'ACTIVE',
  });
  createdUserTicketIds.push(F.utAllPass.id);
});

test.afterAll(async () => {
  const aid = F.academy?.id ?? '';
  if (!aid) return;

  /**
   * 삭제 순서는 FK 역순이어야 한다. 한 단계라도 앞서면 그 뒤가 전부 조용히 실패하고
   * (supabase-js delete 는 예외를 던지지 않는다) 테스트 학원이 DB 에 남는다.
   *   booking_events → bookings → order_items → order_groups → schedules
   *   → user_tickets/coverage → student_memberships → classes(멤버십 참조자)
   *   → class_groups → memberships → tickets → academies
   */
  const fail = (label: string, error: any) => {
    if (error) console.error(`[T10 cleanup] ${label} 실패: ${error.message}`);
  };

  const { data: classes } = await svc.from('classes').select('id').eq('academy_id', aid);
  const classIds = (classes ?? []).map((c: any) => c.id);
  const { data: orders } = await svc.from('order_groups').select('id').eq('academy_id', aid);
  const orderIds = (orders ?? []).map((o: any) => o.id);
  const { data: tks } = await svc.from('tickets').select('id').eq('academy_id', aid);
  const ticketIds = (tks ?? []).map((t: any) => t.id);

  fail('booking_events', (await svc.from('booking_events').delete().eq('academy_id', aid)).error);
  // revenue_transactions.order_item_id → order_items 이므로 이게 먼저다
  fail(
    'revenue_transactions',
    (await svc.from('revenue_transactions').delete().eq('academy_id', aid)).error
  );
  // order_items.result_booking_id → bookings 이므로 order_items 가 bookings 보다 먼저다
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
  // student_memberships.bundled_user_ticket_id → user_tickets 이므로 이게 먼저다
  fail(
    'student_memberships',
    (await svc.from('student_memberships').delete().eq('academy_id', aid)).error
  );
  if (ticketIds.length) {
    fail('user_tickets', (await svc.from('user_tickets').delete().in('ticket_id', ticketIds)).error);
    fail('ticket_coverage', (await svc.from('ticket_coverage').delete().in('ticket_id', ticketIds)).error);
    fail('ticket_classes', (await svc.from('ticket_classes').delete().in('ticket_id', ticketIds)).error);
  }
  // classes 가 memberships(audience_membership_id)를 참조하므로 classes 를 먼저 지운다
  fail('classes', (await svc.from('classes').delete().eq('academy_id', aid)).error);
  fail('class_groups', (await svc.from('class_groups').delete().eq('academy_id', aid)).error);
  fail('memberships', (await svc.from('memberships').delete().eq('academy_id', aid)).error);
  fail('tickets', (await svc.from('tickets').delete().eq('academy_id', aid)).error);
  if (syntheticUserIds.length) {
    fail('users', (await svc.from('users').delete().in('id', syntheticUserIds)).error);
  }
  for (const id of academyIds) {
    fail('academies', (await svc.from('academies').delete().eq('id', id)).error);
  }

  const { count } = await svc
    .from('academies')
    .select('id', { count: 'exact', head: true })
    .eq('id', aid);
  if (count) console.error(`[T10 cleanup] 테스트 학원 ${aid} 이 남아 있다`);
});

/* ------------------------------------------------------------------ */
/* 1. 시간표 — 그룹 배지 · 특별수업 · 오픈 전                            */
/* ------------------------------------------------------------------ */

test('AC1-1 시간표에 그룹 배지와 특별수업(별도 결제) 표시가 나온다', async ({ page, context }) => {
  await loginAs(context, STUDENT_EMAIL);
  const errors = watchErrors(page);
  await page.setViewportSize({ width: 390, height: 844 });

  await gotoSchedule(page);

  // 그룹 배지
  const groupBadges = page.getByTestId('group-badge');
  expect(await groupBadges.count()).toBeGreaterThan(0);
  await expect(groupBadges.filter({ hasText: '정규반' }).first()).toBeVisible();

  // 특별수업 = 별도 결제라고 화면에 적혀 있다
  const specialRow = page.locator('[data-testid="schedule-row"][data-special="1"]').first();
  await expect(specialRow).toBeVisible();
  await expect(specialRow.getByTestId('special-badge')).toContainText('별도 결제');

  // 학원 데이터로 넣은 스킨 문구가 그대로 나온다 (코드 분기 아님)
  await expect(page.getByTestId('special-notice')).toContainText('T10 특별수업은 별도 결제가 필요합니다');
  await expect(page.getByText('T10 스킨 문구입니다')).toBeVisible();

  await expectNoHorizontalOverflow(page, '시간표');
  expect(errors, `콘솔 에러: ${errors.join(' | ')}`).toEqual([]);
});

test('AC1-2 예약 오픈 전 수업은 오픈 시각을 보여주고 담을 수 없다', async ({ page, context }) => {
  await loginAs(context, STUDENT_EMAIL);
  await page.setViewportSize({ width: 390, height: 844 });

  await gotoSchedule(page);
  const row = page.locator(
    `[data-testid="schedule-row"][data-schedule-id="${F.schedNotOpen.id}"]`
  );
  await expect(row, '오픈 전 회차를 시간표에서 찾지 못했다').toHaveCount(1);

  await expect(row.getByTestId('opens-at')).toContainText('예약 오픈');
  await expect(row.getByTestId('add-disabled')).toContainText('예약 오픈 전');
  // 담기 버튼 자체가 없어야 한다
  expect(await row.getByTestId('add-to-cart').count()).toBe(0);

  // 서버 판정도 같은 결론이어야 한다 (화면만 막는 게 아니다)
  const pre = await previewOrder(svc, {
    academyId: F.academy.id,
    items: [{ item_type: 'SCHEDULE_BOOKING', schedule_id: F.schedNotOpen.id }],
    userId: STUDENT_ID,
  });
  expect(pre.items[0].code).toBe('BOOKING_NOT_YET_OPEN');
});

/* ------------------------------------------------------------------ */
/* 2. 멤버십 전용 수업 — 가림의 정본은 RLS                              */
/* ------------------------------------------------------------------ */

test('AC2 멤버십 전용 수업은 비회원에게 API 응답에서부터 없다 (회원에겐 보인다)', async ({
  page,
  context,
}) => {
  // ① 비회원(로그인 없음) — API 응답 자체에 없어야 한다
  const anonRes = await fetchWeekApi(null, FIXTURE_WEEK_OFFSET);
  expect(anonRes.status).toBe(200);
  const anonIds = (anonRes.body.items ?? []).map((i: any) => i.id);
  expect(
    anonIds,
    '비회원 API 응답에 멤버십 전용 회차가 들어있다 = RLS 가 아니라 화면에서만 숨긴 것'
  ).not.toContain(F.schedMemberOnly.id);
  // 다른 정규 수업은 정상적으로 보인다 (전부 막힌 게 아님을 증명)
  expect(anonIds).toContain(F.schedRegular.id);

  // 화면에서도 안 보인다
  await context.clearCookies();
  await page.setViewportSize({ width: 390, height: 844 });
  await gotoSchedule(page);
  expect(
    await page
      .locator(`[data-testid="schedule-row"][data-schedule-id="${F.schedMemberOnly.id}"]`)
      .count()
  ).toBe(0);

  // ② 멤버십을 부여하면 — 같은 API 가 이제 그 회차를 돌려준다
  F.studentMembership = await ins('student_memberships', {
    academy_id: F.academy.id,
    user_id: STUDENT_ID,
    membership_id: F.membership.id,
    status: 'ACTIVE',
    start_date: '2020-01-01',
    end_date: '2099-12-31',
  });

  const { accessToken } = await loginAs(context, STUDENT_EMAIL);
  const memberRes = await fetchWeekApi(accessToken, FIXTURE_WEEK_OFFSET);
  expect(memberRes.status).toBe(200);
  const memberIds = (memberRes.body.items ?? []).map((i: any) => i.id);
  expect(memberIds, '자격 있는 회원에게도 멤버십 전용 수업이 안 보인다').toContain(
    F.schedMemberOnly.id
  );

  // 화면에도 나오고, 멤버십 전용 배지가 붙는다
  await gotoSchedule(page);
  const row = page.locator(
    `[data-testid="schedule-row"][data-schedule-id="${F.schedMemberOnly.id}"]`
  );
  await expect(row).toBeVisible();
  await expect(row.getByTestId('audience-badge')).toContainText('멤버십 전용');
});

/* ------------------------------------------------------------------ */
/* 3. 주간 조회는 수업 수에 비례해 요청이 늘지 않는다                     */
/* ------------------------------------------------------------------ */

test('AC3 주간 시간표는 한 번의 집계 질의로 오고, 요청 수가 수업 수에 비례하지 않는다', async ({
  page,
  context,
}) => {
  const { accessToken } = await loginAs(context, STUDENT_EMAIL);

  // ① API 한 번에 한 주 전체가 (그룹·대상·정원·정책까지) 온다
  const res = await fetchWeekApi(accessToken, FIXTURE_WEEK_OFFSET);
  expect(res.status).toBe(200);
  const items = res.body.items as any[];
  expect(items.length).toBeGreaterThanOrEqual(5);
  for (const it of items) {
    expect(it).toHaveProperty('group_name');
    expect(it).toHaveProperty('is_special');
    expect(it).toHaveProperty('is_audience_limited');
    expect(it).toHaveProperty('max_students');
    expect(it).toHaveProperty('booking_state');
  }

  // ② 수업을 12개 더 만들어도 화면이 내는 데이터 요청 수는 그대로여야 한다
  const countDataRequests = async () => {
    let n = 0;
    const onReq = (r: any) => {
      const u = r.url();
      if (u.includes('/rest/v1/') || u.includes('/api/')) n++;
    };
    page.on('request', onReq);
    await page.goto(`/s/${F.academy.slug}/schedule?w=${FIXTURE_WEEK_OFFSET}`);
    await page.waitForLoadState('networkidle');
    page.off('request', onReq);
    return n;
  };

  const before = await countDataRequests();

  for (let i = 0; i < 12; i++) {
    const c = await ins('classes', {
      academy_id: F.academy.id,
      title: `T10부하${i}-${stamp}`,
      class_type: 'regular',
      max_students: 20,
      is_active: true,
      class_group_id: F.groupRegular.id,
      booking_policy: { open: null, close: { minutesBefore: 0 }, cancelUntil: { minutesBefore: 0 } },
    });
    await ins('schedules', {
      class_id: c.id,
      start_time: dayAt(5, '19:00'),
      end_time: dayAt(5, '20:00'),
      max_students: 20,
      is_canceled: false,
    });
  }

  const after = await countDataRequests();

  // 수업이 12개 늘었는데 요청이 그만큼 늘면 = 수업마다 요청하는 구조(N+1)
  expect(
    after,
    `수업 12개 추가 후 데이터 요청이 ${before} → ${after} 로 늘었다 (수업 수에 비례하면 결함)`
  ).toBeLessThanOrEqual(before + 2);

  // 그래도 데이터는 다 늘어나 있어야 한다 (요청만 줄고 내용이 빠진 게 아님)
  const res2 = await fetchWeekApi(accessToken, FIXTURE_WEEK_OFFSET);
  expect((res2.body.items as any[]).length).toBeGreaterThanOrEqual(items.length + 12);
});

/* ------------------------------------------------------------------ */
/* 4. 특별수업 — 올패스로는 안 되고, 덮는 수강권으로는 된다               */
/* ------------------------------------------------------------------ */

test('AC4-1 특별수업은 무제한(올패스) 수강권으로 예약되지 않고 별도 결제가 필요하다고 알려준다', async ({
  page,
  context,
}) => {
  await loginAs(context, STUDENT_EMAIL);
  const errors = watchErrors(page);
  await page.setViewportSize({ width: 390, height: 844 });

  // 서버 판정: 올패스만 가진 상태에서 특별수업 → SPECIAL_CLASS_NOT_COVERED
  const pre = await previewOrder(svc, {
    academyId: F.academy.id,
    items: [{ item_type: 'SCHEDULE_BOOKING', schedule_id: F.schedSpecial.id }],
    userId: STUDENT_ID,
  });
  expect(pre.items[0].ok).toBe(false);
  expect(pre.items[0].code).toBe('SPECIAL_CLASS_NOT_COVERED');

  // 화면: 담아서 장바구니로 가면 그 항목의 사유가 그대로 뜬다
  await gotoSchedule(page);
  await page
    .locator(`[data-testid="schedule-row"][data-schedule-id="${F.schedSpecial.id}"]`)
    .getByTestId('add-to-cart')
    .click();

  await gotoMini(page, '/cart');
  const reason = page.getByTestId('reject-reason').first();
  await expect(reason).toBeVisible();
  await expect(reason).toHaveAttribute('data-code', 'SPECIAL_CLASS_NOT_COVERED');
  await expect(reason).toContainText('예약할 수 없는 수업');

  // 결제 버튼은 막혀 있다 — "일단 결제하고 취소"를 하지 않는다
  await expect(page.getByTestId('checkout')).toBeDisabled();

  await expectNoHorizontalOverflow(page, '장바구니(거절)');
  expect(errors, `콘솔 에러: ${errors.join(' | ')}`).toEqual([]);

  // 다음 테스트를 위해 장바구니를 비운다
  await page.evaluate((aid) => window.localStorage.removeItem(`miniapp-cart:${aid}`), F.academy.id);
});

test('AC4-2 특별수업을 덮는 수강권이 있으면 예약할 수 있다', async ({ context }) => {
  await loginAs(context, STUDENT_EMAIL);

  // 특별그룹을 coverage 로 덮는 수강권 지급
  F.utSpecial = await ins('user_tickets', {
    user_id: STUDENT_ID,
    ticket_id: F.ticketSpecial.id,
    remaining_count: 2,
    start_date: kstToday(),
    expiry_date: '2099-12-31',
    status: 'ACTIVE',
  });
  createdUserTicketIds.push(F.utSpecial.id);

  const pre = await previewOrder(svc, {
    academyId: F.academy.id,
    items: [{ item_type: 'SCHEDULE_BOOKING', schedule_id: F.schedSpecial.id }],
    userId: STUDENT_ID,
  });
  expect(pre.items[0].code).toBe('OK');
  expect(pre.items[0].ok).toBe(true);
});

/* ------------------------------------------------------------------ */
/* 5. 장바구니 — 섞인 항목 / 빼고 계속 / 거절 항목은 결제되지 않는다      */
/* ------------------------------------------------------------------ */

test('AC5 가능·불가가 섞인 장바구니: 사유가 항목별로 뜨고, 빼면 결제가 진행되며 거절 항목은 결제되지 않는다', async ({
  page,
  context,
}) => {
  await loginAs(context, STUDENT_EMAIL);
  const errors = watchErrors(page);
  await page.setViewportSize({ width: 390, height: 844 });

  // 장바구니: [OK 예약] + [취소된 회차(픽스처) = 거절]
  await gotoSchedule(page);
  await page.evaluate(
    ({ aid, okId, badId }) => {
      window.localStorage.setItem(
        `miniapp-cart:${aid}`,
        JSON.stringify([
          { label: 'OK수업', item: { item_type: 'SCHEDULE_BOOKING', schedule_id: okId } },
          { label: '취소된수업', item: { item_type: 'SCHEDULE_BOOKING', schedule_id: badId } },
        ])
      );
    },
    { aid: F.academy.id, okId: F.schedRegular.id, badId: F.schedCanceled.id }
  );

  await gotoMini(page, '/cart');

  // 항목별 사유
  await expect(page.getByTestId('cart-item')).toHaveCount(2);
  const bad = page.locator('[data-testid="cart-item"][data-ok="0"]');
  await expect(bad).toHaveCount(1);
  await expect(bad.getByTestId('reject-reason')).toContainText('취소된 수업');
  await expect(page.getByTestId('checkout')).toBeDisabled();

  // "빼고 계속" → 결제 가능해진다
  await page.getByTestId('drop-rejected').click();
  await expect(page.getByTestId('cart-item')).toHaveCount(1);
  await expect(page.getByTestId('checkout')).toBeEnabled();

  // 계좌이체로 결제
  await page.getByTestId('method-BANK').click();
  await page.getByTestId('checkout').click();
  await page.waitForURL(/\/orders\//, { timeout: 20000 });

  const orderStatus = page.getByTestId('order-status');
  await expect(orderStatus).toBeVisible();
  await expect(orderStatus).toHaveAttribute('data-phase', 'PENDING');

  // 거절 항목은 **주문에 들어가지 않았다**
  const providerOrderId = decodeURIComponent(page.url().split('/orders/')[1]);
  F.bankProviderOrderId = providerOrderId;
  const { data: og } = await svc
    .from('order_groups')
    .select('id, method, status')
    .eq('provider_order_id', providerOrderId)
    .single();
  F.bankOrderId = og.id;
  expect(og.method).toBe('BANK');

  const { data: oi } = await svc.from('order_items').select('schedule_id').eq('order_group_id', og.id);
  const scheduleIds = (oi ?? []).map((r: any) => r.schedule_id);
  expect(scheduleIds).toContain(F.schedRegular.id);
  expect(scheduleIds, '거절된 항목이 결제 대상에 포함됐다').not.toContain(F.schedCanceled.id);

  await expectNoHorizontalOverflow(page, '주문 상태');
  expect(errors, `콘솔 에러: ${errors.join(' | ')}`).toEqual([]);
});

test('AC5-2 계좌이체 주문은 좌석을 실제로 잡는다 (24시간 홀드)', async () => {
  // 홀드가 생겼는지
  const { data: holds } = await svc
    .from('bookings')
    .select('id, status, hold_expires_at, schedule_id')
    .eq('order_group_id', F.bankOrderId);

  expect((holds ?? []).length).toBeGreaterThan(0);
  const hold = (holds ?? []).find((h: any) => h.schedule_id === F.schedRegular.id);
  expect(hold, '예약 홀드가 만들어지지 않았다').toBeTruthy();
  expect(hold.status).toBe('PENDING');
  expect(hold.hold_expires_at, '홀드 만료 시각이 없다').toBeTruthy();

  // 정원 1석짜리 회차를 홀드로 채우면 다른 사람은 못 들어온다
  const other = await ins('users', {
    id: randomUUID(),
    name: `T10타학생-${stamp}`,
    email: `t10-${stamp}-other@example.test`,
    phone: '01099990000',
    role: 'USER',
  });
  syntheticUserIds.push(other.id);

  const seatOrder = await composeOrder(svc, {
    academyId: F.academy.id,
    method: 'BANK',
    items: [
      { item_type: 'TICKET_PURCHASE', ticket_id: F.ticketAllPass.id },
      { item_type: 'SCHEDULE_BOOKING', schedule_id: F.schedSeat1.id, use_purchase_index: 0 },
    ],
    userId: STUDENT_ID,
    providerOrderId: newProviderOrderId('T10SEAT'),
  });
  expect(seatOrder.ok).toBe(true);

  // 이제 그 1석은 찼다
  const pre = await previewOrder(svc, {
    academyId: F.academy.id,
    items: [{ item_type: 'SCHEDULE_BOOKING', schedule_id: F.schedSeat1.id }],
    userId: other.id,
  });
  expect(pre.items[0].code).toBe('SCHEDULE_FULL');
});

/* ------------------------------------------------------------------ */
/* 6. 결제 상태를 정직하게 — 처리 중 / 새로고침 복구                     */
/* ------------------------------------------------------------------ */

test('AC6-1 승인됐지만 아직 이행 전이면 "결제는 완료됐고 처리 중"을 보여준다 (실패라고 하지 않는다)', async ({
  page,
  context,
}) => {
  await loginAs(context, STUDENT_EMAIL);
  const errors = watchErrors(page);
  await page.setViewportSize({ width: 390, height: 844 });

  // 승인만 기록하고 이행은 하지 않는다 → PAYMENT_APPROVED
  const providerOrderId = newProviderOrderId('T10APPR');
  const order = await composeOrder(svc, {
    academyId: F.academy.id,
    method: 'TOSS',
    items: [{ item_type: 'TICKET_PURCHASE', ticket_id: F.ticketAllPass.id }],
    userId: STUDENT_ID,
    providerOrderId,
  });
  await recordApproval(svc, {
    orderGroupId: order.order_group_id,
    approvedAmount: order.total_amount,
    paymentKey: `T10-TESTKEY-${stamp}`,
    expectedMethod: 'TOSS',
  });

  const { data: og } = await svc
    .from('order_groups')
    .select('status')
    .eq('id', order.order_group_id)
    .single();
  expect(og.status).toBe('PAYMENT_APPROVED');

  await page.goto(`/s/${F.academy.slug}/orders/${encodeURIComponent(providerOrderId)}`);
  await page.waitForLoadState('domcontentloaded');

  const status = page.getByTestId('order-status');
  await expect(status).toHaveAttribute('data-phase', 'PROCESSING');
  await expect(page.getByTestId('order-headline')).toContainText('결제는 완료됐고 처리 중');
  await expect(page.getByTestId('order-message')).toContainText('정상 승인');
  // 실패라고 말하지 않는다
  await expect(page.getByTestId('order-headline')).not.toContainText('실패');

  await expectNoHorizontalOverflow(page, '처리 중 화면');
  expect(errors, `콘솔 에러: ${errors.join(' | ')}`).toEqual([]);

  F.approvedOnlyOrderId = order.order_group_id;
  F.approvedOnlyProviderId = providerOrderId;
});

test('AC6-2 결제 중 새로고침해도 주문의 진짜 상태로 돌아온다', async ({ page, context }) => {
  await loginAs(context, STUDENT_EMAIL);
  await page.setViewportSize({ width: 390, height: 844 });

  // 앞서 만든 계좌이체 주문 화면으로 복귀
  await page.goto(`/s/${F.academy.slug}/orders/${encodeURIComponent(F.bankProviderOrderId)}`);
  await page.waitForLoadState('domcontentloaded');
  await expect(page.getByTestId('order-status')).toHaveAttribute('data-phase', 'PENDING');

  // 새로고침 — 낙관적 화면 상태가 아니라 서버에서 다시 읽는다
  await page.reload();
  await page.waitForLoadState('domcontentloaded');
  await expect(page.getByTestId('order-status')).toHaveAttribute('data-phase', 'PENDING');
  await expect(page.getByText(F.bankProviderOrderId)).toBeVisible();

  // 서버에서 확정되면 같은 URL 이 확정 상태를 보여준다
  await approveAndFinalize(svc, {
    orderGroupId: F.bankOrderId,
    approvedAmount: 0,
    method: 'BANK',
    confirmedBy: STUDENT_ID,
  });
  await page.reload();
  await page.waitForLoadState('domcontentloaded');
  await expect(page.getByTestId('order-status')).toHaveAttribute('data-phase', 'DONE');
  await expect(page.getByTestId('order-headline')).toContainText('결제가 완료');
});

test('AC6-3 카드(Toss) 경로는 멱등키를 실어 보내고 확정까지 도달한다', async ({ page, context }) => {
  await loginAs(context, STUDENT_EMAIL);
  await page.setViewportSize({ width: 390, height: 844 });

  // 결제사 호출은 **네트워크 없이** 요청 조립만 검증한다 (실제 결제 금지)
  const providerOrderId = newProviderOrderId('T10TOSS');
  const req = buildTossConfirmRequest({
    paymentKey: 'test_payment_key',
    orderId: providerOrderId,
    amount: 1000,
    secretKey: 'test_secret',
  });
  expect(req.headers['Idempotency-Key']).toBe(providerOrderId);

  // 승인 → 이행까지 (결제사 stub: 실제 승인 호출 없이 우리 확정 경로만 탄다)
  const order = await composeOrder(svc, {
    academyId: F.academy.id,
    method: 'TOSS',
    items: [{ item_type: 'TICKET_PURCHASE', ticket_id: F.ticketSpecial.id }],
    userId: STUDENT_ID,
    providerOrderId,
  });
  const result = await approveAndFinalize(svc, {
    orderGroupId: order.order_group_id,
    approvedAmount: order.total_amount,
    method: 'TOSS',
    paymentKey: `T10-TOSS-${stamp}`,
    confirmedBy: STUDENT_ID,
  });
  expect(result.status).toBe('CONFIRMED');
  expect(result.issued_tickets).toBeGreaterThan(0);

  // 학생 화면이 확정을 보여준다
  await page.goto(`/s/${F.academy.slug}/orders/${encodeURIComponent(providerOrderId)}`);
  await page.waitForLoadState('domcontentloaded');
  await expect(page.getByTestId('order-status')).toHaveAttribute('data-phase', 'DONE');

  await expectNoHorizontalOverflow(page, '카드 결제 완료');
});

/* ------------------------------------------------------------------ */
/* 7. 게스트 갭 — 이행 불가한 주문은 애초에 만들어지지 않는다             */
/* ------------------------------------------------------------------ */

test('AC7 비회원의 수강권 구매는 분명한 안내와 함께 막힌다 (이행 불가 주문이 생기지 않는다)', async ({
  page,
  context,
}) => {
  await context.clearCookies();
  const errors = watchErrors(page);
  await page.setViewportSize({ width: 390, height: 844 });

  // ① 서버 판정부터 막힌다
  const pre = await previewOrder(svc, {
    academyId: F.academy.id,
    items: [{ item_type: 'TICKET_PURCHASE', ticket_id: F.ticketAllPass.id }],
    userId: null,
  });
  expect(pre.items[0].ok).toBe(false);
  expect(pre.items[0].code).toBe('SIGN_IN_REQUIRED');

  // ② 주문 생성도 막힌다 — 이행 불가한 주문은 아예 안 생긴다
  const before = await svc
    .from('order_groups')
    .select('id', { count: 'exact', head: true })
    .eq('academy_id', F.academy.id);

  let threw = false;
  try {
    await composeOrder(svc, {
      academyId: F.academy.id,
      method: 'BANK',
      items: [{ item_type: 'TICKET_PURCHASE', ticket_id: F.ticketAllPass.id }],
      userId: null,
      providerOrderId: newProviderOrderId('T10GUEST'),
      orderer: { name: '게스트', phone: '01011112222', email: 'guest@example.test' },
    });
  } catch (e) {
    threw = true;
    expect(String((e as Error).message)).toContain('SIGN_IN_REQUIRED');
  }
  expect(threw, '비회원 수강권 구매 주문이 생성됐다 (이행 불가 주문)').toBe(true);

  const after = await svc
    .from('order_groups')
    .select('id', { count: 'exact', head: true })
    .eq('academy_id', F.academy.id);
  expect(after.count).toBe(before.count);

  // ③ 화면: 로그인 안내가 뜨고 결제 버튼은 막혀 있다
  await gotoMini(page, '/tickets');
  await page.getByTestId('ticket-add').first().click();
  await gotoMini(page, '/cart');

  await expect(page.getByTestId('signin-required')).toBeVisible();
  await expect(page.getByTestId('signin-required')).toContainText('로그인');
  await expect(page.getByTestId('reject-reason').first()).toHaveAttribute(
    'data-code',
    'SIGN_IN_REQUIRED'
  );
  await expect(page.getByTestId('checkout')).toBeDisabled();
  await expect(page.getByTestId('signin-link')).toBeVisible();

  await expectNoHorizontalOverflow(page, '장바구니(비회원)');
  expect(errors, `콘솔 에러: ${errors.join(' | ')}`).toEqual([]);

  await page.evaluate((aid) => window.localStorage.removeItem(`miniapp-cart:${aid}`), F.academy.id);
});

/* ------------------------------------------------------------------ */
/* 8. MY — 잔여·만료·"아직 시작 안 함"·멤버십                            */
/* ------------------------------------------------------------------ */

test('AC8 MY 는 잔여/만료와 FIRST_BOOKING 의 "아직 시작 안 함"을 보여주고, 내 멤버십만 보여준다', async ({
  page,
  context,
}) => {
  await loginAs(context, STUDENT_EMAIL);
  const errors = watchErrors(page);
  await page.setViewportSize({ width: 390, height: 844 });

  // 아직 시작하지 않은 FIRST_BOOKING 수강권 (start_date 없음)
  F.utFirstBooking = await ins('user_tickets', {
    user_id: STUDENT_ID,
    ticket_id: F.ticketFirstBooking.id,
    remaining_count: 5,
    start_date: null,
    expiry_date: null,
    status: 'ACTIVE',
  });
  createdUserTicketIds.push(F.utFirstBooking.id);

  await gotoMini(page, '/my');

  // 잔여 횟수 · 만료일
  const tickets = page.getByTestId('my-ticket');
  expect(await tickets.count()).toBeGreaterThan(0);
  await expect(page.getByTestId('ticket-remaining').first()).toContainText('남은 횟수');

  // "아직 시작 안 함"
  const notStarted = page.locator('[data-testid="my-ticket"][data-not-started="1"]');
  await expect(notStarted).toHaveCount(1);
  await expect(notStarted.getByTestId('ticket-not-started')).toContainText('아직 시작 안 함');
  await expect(notStarted.getByTestId('ticket-expiry')).toContainText('첫 예약일부터');

  // 시작된 수강권은 만료일을 보여준다
  const started = page.locator('[data-testid="my-ticket"][data-not-started="0"]').first();
  await expect(started.getByTestId('ticket-expiry')).toContainText('까지');

  // 내 멤버십 (AC2 에서 부여됨) — 이름이 보인다
  await expect(page.getByTestId('membership-card').first()).toContainText('T10 VIP');

  await expectNoHorizontalOverflow(page, 'MY');
  expect(errors, `콘솔 에러: ${errors.join(' | ')}`).toEqual([]);
});

test('AC8-2 다른 학생의 멤버십·수강권은 내 MY 에 새어나오지 않는다', async ({ context }) => {
  const { accessToken } = await loginAs(context, STUDENT_EMAIL);
  const base = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';

  const res = await fetch(`${base}/api/s/${F.academy.slug}/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body = (await res.json()) as any;
  expect(res.status).toBe(200);

  // 내 것만 — 학원의 멤버십 "목록"이 아니라 내가 가진 것만 온다
  for (const m of body.memberships ?? []) {
    const { data } = await svc
      .from('student_memberships')
      .select('user_id')
      .eq('id', m.id)
      .single();
    expect(data.user_id).toBe(STUDENT_ID);
  }

  // 비로그인은 아무것도 못 받는다
  const anonRes = await fetch(`${base}/api/s/${F.academy.slug}/me`);
  expect(anonRes.status).toBe(401);
});

/* ------------------------------------------------------------------ */
/* 9. 390px · 마켓플레이스 요소 없음                                     */
/* ------------------------------------------------------------------ */

test('AC9 모든 미니앱 화면이 390px 에서 가로 오버플로 없이, 콘솔 에러 없이 뜬다', async ({
  page,
  context,
}) => {
  await loginAs(context, STUDENT_EMAIL);
  const errors = watchErrors(page);
  await page.setViewportSize({ width: 390, height: 844 });

  const screens = ['', '/schedule', '/tickets', '/workshops', '/my', '/cart'];
  for (const seg of screens) {
    await gotoMini(page, seg);
    await expectNoHorizontalOverflow(page, `화면 ${seg || '/(홈)'}`);
    // 화이트라벨: 마켓플레이스 전역 네비가 섞이면 안 된다
    expect(
      await page.locator('nav a[href="/academies"], nav a[href="/dancers"]').count(),
      `화면 ${seg} 에 마켓플레이스 네비가 있다`
    ).toBe(0);
  }

  expect(errors, `콘솔 에러: ${errors.join(' | ')}`).toEqual([]);
});
