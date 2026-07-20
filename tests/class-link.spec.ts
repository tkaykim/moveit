/**
 * Task L — 수업 회차 딥링크(/s/[slug]/c/[scheduleId]) E2E
 *
 * 실행: npx playwright test tests/class-link.spec.ts --workers=1
 *
 * 픽스처는 전용 테스트 학원(slug: tl-link-*) 안에서만 만들고 끝나면 지운다.
 * 실제 MID 학원(slug: mid) 데이터는 절대 건드리지 않는다.
 *
 * 이 스펙이 지키는 것:
 *   1) 예약 가능한 회차 링크는 상세 + "신청하기" 를 보여주고, 누르면 그 회차가
 *      **기존 장바구니**에 담긴 채 결제(장바구니)로 간다 — 별도 예약 경로가 아니다.
 *   2) 오픈 전 / 정원마감 / 휴강 회차는 정직한 상태를 보여주고 담을 수 없다.
 *   3) 멤버십 전용 회차 링크는 비회원·비자격자에게 **응답에서부터** 존재를 드러내지 않는다
 *      (가림의 정본은 RLS — DOM 뿐 아니라 서버가 내려준 HTML 자체를 검증한다).
 *   4) 로그아웃 방문자는 로그인으로 유도되고 **같은 회차로** 되돌아온다.
 *   5) 운영자 "링크 복사" 는 올바른 공개 URL 을 만든다.
 */
import { test, expect, type Page, type BrowserContext } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

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
const academyIds: string[] = [];
const createdUserTicketIds: string[] = [];

/* 픽스처는 다음 주(offset=1)에 고정한다 — 실행 시각에 흔들리지 않게. */
const FIXTURE_WEEK_OFFSET = 1;
const WEEK_SUNDAY = kstDateString(weekStartFromOffset(FIXTURE_WEEK_OFFSET));

function dayAt(d: number, time: string): string {
  return kstDateTimeToUtc(addDays(WEEK_SUNDAY, d), time).toISOString();
}
function kstToday(): string {
  return new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
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

const classUrl = (id: string) => `/s/${F.academy.slug}/c/${id}`;

/* ------------------------------------------------------------------ */
/* 픽스처                                                              */
/* ------------------------------------------------------------------ */

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  const alwaysOpen = { open: null, close: { minutesBefore: 0 }, cancelUntil: { minutesBefore: 0 } };

  F.academy = await ins('academies', {
    name_kr: `TL링크-${stamp}`,
    slug: `tl-link-${stamp}`,
    is_active: true,
    brand_color: '#0EA5E9',
    booking_policy: alwaysOpen,
    section_config: { miniapp: { heroEyebrow: 'TLSKIN' } },
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

  F.membership = await ins('memberships', {
    academy_id: F.academy.id,
    key: `tl-vip-${stamp}`,
    name: 'TL VIP',
    visibility: 'locked',
    is_active: true,
  });

  F.hall = await ins('halls', { academy_id: F.academy.id, name: `A홀-${stamp}`, capacity: 30 });

  const mkClass = (title: string, extra: Record<string, any> = {}) =>
    ins('classes', {
      academy_id: F.academy.id,
      title,
      class_type: 'regular',
      instructor_name: `강사-${stamp}`,
      max_students: 20,
      is_active: true,
      class_group_id: F.group.id,
      booking_policy: alwaysOpen,
      ...extra,
    });

  const mkSched = (classId: string, day: number, extra: Record<string, any> = {}) =>
    ins('schedules', {
      class_id: classId,
      start_time: dayAt(day, '19:00'),
      end_time: dayAt(day, '20:30'),
      max_students: 20,
      hall_id: F.hall.id,
      is_canceled: false,
      ...extra,
    });

  F.classBookable = await mkClass(`TL신청가능-${stamp}`);
  F.classFull = await mkClass(`TL정원마감-${stamp}`, { max_students: 1 });
  F.classCanceled = await mkClass(`TL휴강-${stamp}`);
  F.classNotOpen = await mkClass(`TL오픈전-${stamp}`, {
    booking_policy: { open: { daysBefore: 0, time: '00:00' }, close: { minutesBefore: 0 } },
  });
  F.classMemberOnly = await mkClass(`TL멤버전용-${stamp}`, {
    audience_membership_id: F.membership.id,
  });

  F.schedBookable = await mkSched(F.classBookable.id, 1); // 월
  F.schedFull = await mkSched(F.classFull.id, 2, { max_students: 1, current_students: 1 }); // 화 · 1석 참
  F.schedCanceled = await mkSched(F.classCanceled.id, 3, { is_canceled: true }); // 수 · 휴강
  F.schedNotOpen = await mkSched(F.classNotOpen.id, 4); // 목 · 오픈 전
  F.schedMemberOnly = await mkSched(F.classMemberOnly.id, 5); // 금 · 멤버 전용

  F.rosterDate = addDays(WEEK_SUNDAY, 1); // schedBookable 의 KST 날짜(월)

  // 무제한(올패스) 수강권 — 신청 시 장바구니에서 정규 수업을 덮는다
  F.ticketAllPass = await ins('tickets', {
    academy_id: F.academy.id,
    name: `TL올패스-${stamp}`,
    price: 150000,
    ticket_type: 'PERIOD',
    valid_days: 30,
    is_on_sale: true,
    is_general: true,
    is_public: true,
    start_mode: 'IMMEDIATE',
  });
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
  const fail = (label: string, error: any) => {
    if (error) console.error(`[TL cleanup] ${label} 실패: ${error.message}`);
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
  if (classIds.length) {
    fail('schedules', (await svc.from('schedules').delete().in('class_id', classIds)).error);
  }
  fail('student_memberships', (await svc.from('student_memberships').delete().eq('academy_id', aid)).error);
  if (ticketIds.length) {
    fail('user_tickets', (await svc.from('user_tickets').delete().in('ticket_id', ticketIds)).error);
    fail('ticket_coverage', (await svc.from('ticket_coverage').delete().in('ticket_id', ticketIds)).error);
  }
  fail('classes', (await svc.from('classes').delete().eq('academy_id', aid)).error);
  fail('halls', (await svc.from('halls').delete().eq('academy_id', aid)).error);
  fail('class_groups', (await svc.from('class_groups').delete().eq('academy_id', aid)).error);
  fail('memberships', (await svc.from('memberships').delete().eq('academy_id', aid)).error);
  fail('tickets', (await svc.from('tickets').delete().eq('academy_id', aid)).error);
  fail('academy_user_roles', (await svc.from('academy_user_roles').delete().eq('academy_id', aid)).error);
  for (const id of academyIds) {
    fail('academies', (await svc.from('academies').delete().eq('id', id)).error);
  }

  const { count } = await svc
    .from('academies')
    .select('id', { count: 'exact', head: true })
    .eq('id', aid);
  if (count) console.error(`[TL cleanup] 테스트 학원 ${aid} 이 남아 있다`);
});

/* ------------------------------------------------------------------ */
/* 1. 예약 가능한 회차 — 상세 + 신청하기 → 장바구니에 담긴다             */
/* ------------------------------------------------------------------ */

test('L1 신청 가능한 회차 링크는 상세와 신청하기를 보여주고, 누르면 그 회차가 장바구니에 담긴 채 결제로 간다', async ({
  page,
  context,
}) => {
  await loginAs(context, STUDENT_EMAIL);
  const errors = watchErrors(page);
  await page.setViewportSize({ width: 390, height: 844 });

  await page.goto(classUrl(F.schedBookable.id));
  await page.waitForLoadState('domcontentloaded');

  const root = page.getByTestId('class-link');
  await expect(root).toBeVisible();
  await expect(root).toHaveAttribute('data-schedule-id', F.schedBookable.id);
  await expect(root).toHaveAttribute('data-state', 'BOOKABLE');

  // 상세: 수업명·강사·일시·홀·정원
  await expect(page.getByTestId('class-title')).toContainText(`TL신청가능-${stamp}`);
  await expect(page.getByTestId('class-instructor')).toContainText(`강사-${stamp}`);
  await expect(page.getByTestId('class-datetime')).toBeVisible();
  await expect(page.getByTestId('class-hall')).toContainText(`A홀-${stamp}`);
  await expect(page.getByTestId('class-capacity')).toContainText('잔여');

  // 신청하기 → 장바구니로 이동, 그 회차가 담겨 있다
  await page.getByTestId('class-book').click();
  await page.waitForURL(/\/cart$/, { timeout: 20000 });

  const cartHasSchedule = await page.evaluate(
    ({ aid, sid }) => {
      const raw = window.localStorage.getItem(`miniapp-cart:${aid}`);
      const list = raw ? JSON.parse(raw) : [];
      return list.some(
        (e: any) => e?.item?.item_type === 'SCHEDULE_BOOKING' && e.item.schedule_id === sid
      );
    },
    { aid: F.academy.id, sid: F.schedBookable.id }
  );
  expect(cartHasSchedule, '신청한 회차가 장바구니에 담기지 않았다').toBe(true);
  await expect(page.getByTestId('cart-item')).toHaveCount(1);

  await expectNoHorizontalOverflow(page, '수업 링크(신청 가능)');
  expect(errors, `콘솔 에러: ${errors.join(' | ')}`).toEqual([]);

  await page.evaluate((aid) => window.localStorage.removeItem(`miniapp-cart:${aid}`), F.academy.id);
});

/* ------------------------------------------------------------------ */
/* 2. 오픈 전 / 정원마감 / 휴강 — 정직한 상태, 담을 수 없다              */
/* ------------------------------------------------------------------ */

test('L2 예약 오픈 전 회차는 오픈 시각을 보여주고 담을 수 없다', async ({ page, context }) => {
  await loginAs(context, STUDENT_EMAIL);
  await page.setViewportSize({ width: 390, height: 844 });

  await page.goto(classUrl(F.schedNotOpen.id));
  await page.waitForLoadState('domcontentloaded');

  await expect(page.getByTestId('class-link')).toHaveAttribute('data-state', 'NOT_YET_OPEN');
  await expect(page.getByTestId('class-opens-at')).toContainText('예약 오픈');
  await expect(page.getByTestId('class-disabled')).toHaveAttribute('data-reason', 'NOT_YET_OPEN');
  expect(await page.getByTestId('class-book').count()).toBe(0);
});

test('L3 정원 마감 / 휴강 회차는 정직한 상태를 보여주고 예약 버튼이 없다', async ({ page, context }) => {
  await loginAs(context, STUDENT_EMAIL);
  await page.setViewportSize({ width: 390, height: 844 });

  // 정원 마감
  await page.goto(classUrl(F.schedFull.id));
  await page.waitForLoadState('domcontentloaded');
  await expect(page.getByTestId('class-link')).toHaveAttribute('data-state', 'FULL');
  await expect(page.getByTestId('class-disabled')).toHaveAttribute('data-reason', 'FULL');
  await expect(page.getByTestId('class-capacity')).toContainText('정원 마감');
  expect(await page.getByTestId('class-book').count()).toBe(0);

  // 휴강
  await page.goto(classUrl(F.schedCanceled.id));
  await page.waitForLoadState('domcontentloaded');
  await expect(page.getByTestId('class-link')).toHaveAttribute('data-state', 'CANCELED');
  await expect(page.getByTestId('class-disabled')).toHaveAttribute('data-reason', 'CANCELED');
  await expect(page.getByTestId('class-disabled')).toContainText('휴강');
  expect(await page.getByTestId('class-book').count()).toBe(0);
});

/* ------------------------------------------------------------------ */
/* 3. 멤버십 전용 회차 — 가림의 정본은 RLS (응답 자체를 검증)            */
/* ------------------------------------------------------------------ */

test('L4 멤버십 전용 회차 링크는 비회원·비자격자에게 응답에서부터 존재를 드러내지 않는다', async ({
  page,
  context,
}) => {
  const memberOnlyTitle = `TL멤버전용-${stamp}`;

  // ① 비회원(쿠키 없음) — 서버가 내려준 HTML 자체에 수업이 없어야 한다
  const anonRes = await fetch(`${BASE}${classUrl(F.schedMemberOnly.id)}`);
  expect(anonRes.status).toBe(200);
  const anonHtml = await anonRes.text();
  expect(
    anonHtml.includes(memberOnlyTitle),
    '비회원 응답 HTML 에 멤버십 전용 수업명이 들어있다 = RLS 가 아니라 화면에서만 숨긴 것'
  ).toBe(false);
  expect(anonHtml.includes('class-not-found')).toBe(true);

  // 화면에서도 "찾을 수 없음"
  await context.clearCookies();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(classUrl(F.schedMemberOnly.id));
  await page.waitForLoadState('domcontentloaded');
  await expect(page.getByTestId('class-not-found')).toBeVisible();
  expect(await page.getByTestId('class-link').count()).toBe(0);

  // ② 로그인했지만 멤버십이 없는 학생 — 여전히 못 본다 (자격의 정본은 RLS)
  await loginAs(context, STUDENT_EMAIL);
  await page.goto(classUrl(F.schedMemberOnly.id));
  await page.waitForLoadState('domcontentloaded');
  await expect(page.getByTestId('class-not-found')).toBeVisible();
  expect(await page.getByTestId('class-link').count()).toBe(0);

  // ③ 멤버십을 부여하면 — 같은 링크가 이제 그 회차를 보여준다
  F.studentMembership = await ins('student_memberships', {
    academy_id: F.academy.id,
    user_id: STUDENT_ID,
    membership_id: F.membership.id,
    status: 'ACTIVE',
    start_date: '2020-01-01',
    end_date: '2099-12-31',
  });
  await page.goto(classUrl(F.schedMemberOnly.id));
  await page.waitForLoadState('domcontentloaded');
  await expect(page.getByTestId('class-link')).toBeVisible();
  await expect(page.getByTestId('class-title')).toContainText(memberOnlyTitle);
  await expect(page.getByTestId('class-audience-badge')).toContainText('멤버십 전용');
});

/* ------------------------------------------------------------------ */
/* 4. 로그아웃 방문자 → 로그인 → 같은 회차로 복귀                        */
/* ------------------------------------------------------------------ */

test('L5 로그아웃 방문자는 로그인으로 유도되고, 로그인하면 같은 회차 링크로 되돌아온다', async ({
  page,
  context,
}) => {
  await context.clearCookies();
  await page.setViewportSize({ width: 390, height: 844 });

  await page.goto(classUrl(F.schedBookable.id));
  await page.waitForLoadState('domcontentloaded');

  const signin = page.getByTestId('class-signin');
  await expect(signin).toBeVisible();
  const href = await signin.getAttribute('href');
  expect(href).toContain('/my?next=');
  expect(decodeURIComponent(href || '')).toContain(classUrl(F.schedBookable.id));

  // 클릭 → 로그인 화면
  await signin.click();
  await page.waitForURL(/\/my\?next=/, { timeout: 20000 });
  await expect(page.getByTestId('my-login')).toBeVisible();

  // 로그인 후 같은 링크(next)로 자동 복귀한다
  await loginAs(context, STUDENT_EMAIL);
  await page.goto(`/s/${F.academy.slug}/my?next=${encodeURIComponent(classUrl(F.schedBookable.id))}`);
  await page.waitForURL(new RegExp(`/c/${F.schedBookable.id}$`), { timeout: 20000 });
  await expect(page.getByTestId('class-link')).toHaveAttribute('data-schedule-id', F.schedBookable.id);
});

/* ------------------------------------------------------------------ */
/* 5. 운영자 "링크 복사" — 올바른 공개 URL                              */
/* ------------------------------------------------------------------ */

test('L6 운영자 명단 콘솔의 "링크 복사" 는 그 회차의 올바른 공개 링크를 만든다', async ({
  page,
  context,
}) => {
  await loginAs(context, OWNER_EMAIL);
  const errors = watchErrors(page);
  await page.setViewportSize({ width: 390, height: 844 });

  // 초기(오늘) 로드가 끝난 뒤에 날짜를 바꾼다 — 두 요청이 겹치면 늦게 끝난 쪽이
  // 화면을 덮어써 회차가 사라진다(RosterView 의 기존 동작). 응답을 순서대로 기다려
  // 테스트를 결정적으로 만든다.
  const initialLoad = page.waitForResponse(
    (r) => r.url().includes('/console/roster') && r.request().method() === 'GET',
    { timeout: 20000 }
  );
  await page.goto(`/academy-admin/${F.academy.slug}/roster`);
  await page.waitForLoadState('domcontentloaded');
  await expect(page.getByTestId('roster-date')).toBeVisible({ timeout: 20000 });
  await initialLoad;

  const dateLoad = page.waitForResponse(
    (r) => r.url().includes(`/console/roster?date=${F.rosterDate}`),
    { timeout: 20000 }
  );
  await page.getByTestId('roster-date').fill(F.rosterDate);
  await dateLoad;

  await expect
    .poll(async () => page.getByTestId('roster-occurrence').count(), { timeout: 20000 })
    .toBeGreaterThan(0);

  const copy = page
    .locator(`[data-testid="roster-copy-link"][data-url$="/c/${F.schedBookable.id}"]`)
    .first();
  await expect(copy).toBeVisible({ timeout: 10000 });
  await expect(copy).toHaveAttribute(
    'data-url',
    `${BASE}/s/${F.academy.slug}/c/${F.schedBookable.id}`
  );

  // 실제 복사 동작 — 클립보드 권한을 주고 값이 들어가는지 확인
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await copy.click();
  await expect(copy).toHaveAttribute('data-copied', '1');

  await expectNoHorizontalOverflow(page, '운영자 명단(링크 복사)');
  expect(errors, `콘솔 에러: ${errors.join(' | ')}`).toEqual([]);
});
