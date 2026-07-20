/**
 * T-P 학생 카드결제 — Toss 일회성 결제 위젯 E2E
 *
 * 실행: npx playwright test tests/toss-checkout.spec.ts --workers=1
 *
 * 실제 카드는 자동으로 결제할 수 없으므로(사람 필요), 사람 없이 증명할 수 있는 만큼 증명한다:
 *   1) 장바구니에서 TOSS 선택 → 결제 클릭 시 Toss SDK 의 requestPayment 가
 *      **서버 주문번호(provider_order_id)와 서버 금액**으로 실제 호출된다 (SDK stub).
 *   2) Toss 성공 리다이렉트를 흉내내면 콜백이 /api/orders/toss-confirm 을 올바른 body 로
 *      호출하고 주문 상태 화면으로 착지한다.
 *   3) 실패 리다이렉트는 취소 상태를 보여주고 **중복 주문을 만들지 않는다**.
 *   4) 서버는 승인 금액 불일치를 거절한다 → 이행되지 않는다.
 *
 * 픽스처는 전용 테스트 학원(slug: tp-toss-*) 안에서만 만들고 끝나면 지운다.
 * 실제 MID 학원(slug: mid) 데이터는 절대 건드리지 않는다. 실제 결제(돈)는 하지 않는다.
 */
import { test, expect, type Page, type BrowserContext } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

import { composeOrder, newProviderOrderId } from '../lib/orders/composer';
import { approveAndFinalize } from '../lib/payments/fulfilment';

// --- env (.env.local → process.env) ---
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
const TICKET_PRICE = 33000;

/* ------------------------------------------------------------------ */
/* 헬퍼                                                                */
/* ------------------------------------------------------------------ */

async function ins(table: string, row: Record<string, any>) {
  const { data, error } = await svc.from(table).insert(row).select().single();
  if (error) throw new Error(`${table} insert 실패: ${error.message}`);
  return data;
}

/** @supabase/ssr 0.8 브라우저 세션 쿠키를 직접 심는다 */
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

/** window.TossPayments 를 stub 으로 심어 실제 결제창(리다이렉트) 없이 호출만 기록한다 */
async function stubTossSdk(page: Page) {
  await page.addInitScript(() => {
    (window as any).__tossCalls = [];
    function TossPayments(clientKey: string) {
      return {
        payment: (opts: any) => ({
          requestPayment: async (args: any) => {
            (window as any).__tossCalls.push({ clientKey, customerKey: opts?.customerKey, args });
            // 실제 결제창은 리다이렉트하지만, stub 은 여기서 멈춘다(호출을 검증하기 위함).
          },
        }),
      };
    }
    (TossPayments as any).ANONYMOUS = 'ANONYMOUS';
    (window as any).TossPayments = TossPayments;
  });
}

function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console: ${m.text()}`);
  });
  return errors;
}

async function countOrders(): Promise<number> {
  const { count } = await svc
    .from('order_groups')
    .select('id', { count: 'exact', head: true })
    .eq('academy_id', F.academy.id);
  return count ?? 0;
}

/* ------------------------------------------------------------------ */
/* 픽스처                                                              */
/* ------------------------------------------------------------------ */

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  F.academy = await ins('academies', {
    name_kr: `TP토스-${stamp}`,
    slug: `tp-toss-${stamp}`,
    is_active: true,
    brand_color: '#7C3AED',
    booking_policy: { open: null, close: { minutesBefore: 0 }, cancelUntil: { minutesBefore: 0 } },
    section_config: { miniapp: { checkoutCta: 'TP 결제하기' } },
  });

  // 학생이 살 수 있는 일반 판매 수강권 (금액 고정 → 서버 금액 검증에 씀)
  F.ticket = await ins('tickets', {
    academy_id: F.academy.id,
    name: `TP올패스-${stamp}`,
    price: TICKET_PRICE,
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
    if (error) console.error(`[TP cleanup] ${label} 실패: ${error.message}`);
  };

  const { data: orders } = await svc.from('order_groups').select('id').eq('academy_id', aid);
  const orderIds = (orders ?? []).map((o: any) => o.id);
  const { data: tks } = await svc.from('tickets').select('id').eq('academy_id', aid);
  const ticketIds = (tks ?? []).map((t: any) => t.id);

  fail('booking_events', (await svc.from('booking_events').delete().eq('academy_id', aid)).error);
  fail('revenue_transactions', (await svc.from('revenue_transactions').delete().eq('academy_id', aid)).error);
  if (orderIds.length) {
    fail('order_items', (await svc.from('order_items').delete().in('order_group_id', orderIds)).error);
    fail('order_groups', (await svc.from('order_groups').delete().in('id', orderIds)).error);
  }
  if (ticketIds.length) {
    fail('user_tickets', (await svc.from('user_tickets').delete().in('ticket_id', ticketIds)).error);
  }
  fail('tickets', (await svc.from('tickets').delete().eq('academy_id', aid)).error);
  fail('academies', (await svc.from('academies').delete().eq('id', aid)).error);

  const { count } = await svc
    .from('academies')
    .select('id', { count: 'exact', head: true })
    .eq('id', aid);
  if (count) console.error(`[TP cleanup] 테스트 학원 ${aid} 이 남아 있다`);
});

function setTicketCart(page: Page) {
  return page.evaluate(
    ({ aid, tid }) => {
      window.localStorage.setItem(
        `miniapp-cart:${aid}`,
        JSON.stringify([{ label: 'TP올패스', item: { item_type: 'TICKET_PURCHASE', ticket_id: tid } }])
      );
    },
    { aid: F.academy.id, tid: F.ticket.id }
  );
}

/* ------------------------------------------------------------------ */
/* 1. 결제창 실제 호출 — 서버 주문번호 + 서버 금액                        */
/* ------------------------------------------------------------------ */

test('TP1 TOSS 결제는 실제 Toss SDK requestPayment 를 서버 주문번호·서버 금액으로 연다', async ({
  page,
  context,
}) => {
  await loginAs(context, STUDENT_EMAIL);
  await stubTossSdk(page);
  const errors = watchErrors(page);
  await page.setViewportSize({ width: 390, height: 844 });

  // 장바구니에 수강권을 담고 카트로
  await page.goto(`/s/${F.academy.slug}/schedule`);
  await setTicketCart(page);
  await page.goto(`/s/${F.academy.slug}/cart`);
  await page.waitForLoadState('networkidle');

  // 금액은 서버가 계산한 값이 화면에 뜬다
  await expect(page.getByTestId('cart-total')).toContainText(TICKET_PRICE.toLocaleString('ko-KR'));

  // TOSS 선택 → 결제
  await page.getByTestId('method-TOSS').click();
  await expect(page.getByTestId('checkout')).toBeEnabled();
  await page.getByTestId('checkout').click();

  // requestPayment 가 실제로 호출됐다
  await page.waitForFunction(() => (window as any).__tossCalls?.length > 0, null, { timeout: 15000 });
  const calls = await page.evaluate(() => (window as any).__tossCalls);
  expect(calls.length).toBe(1);
  const args = calls[0].args;

  // 서버가 만든 주문번호(provider_order_id) — 로컬에 저장된 값과 같아야 한다
  const storedId = await page.evaluate(
    (aid) => window.localStorage.getItem(`miniapp-pending-order:${aid}`),
    F.academy.id
  );
  expect(args.orderId).toBe(storedId);

  // 서버 금액 (화면 합계가 아니라 주문의 total_amount)
  expect(args.amount).toEqual({ currency: 'KRW', value: TICKET_PRICE });

  // 리다이렉트 URL 은 /s/[slug] 아래 콜백/실패 라우트
  expect(args.successUrl).toContain(`/s/${F.academy.slug}/orders/toss-callback`);
  expect(args.failUrl).toContain(`/s/${F.academy.slug}/orders/toss-fail`);

  // 서버에 실제 PENDING TOSS 주문이 생겼고 금액이 일치한다
  const { data: og } = await svc
    .from('order_groups')
    .select('id, method, status, total_amount, provider_order_id')
    .eq('provider_order_id', storedId)
    .single();
  expect(og.method).toBe('TOSS');
  expect(og.status).toBe('PENDING_PAYMENT');
  expect(og.total_amount).toBe(TICKET_PRICE);

  F.providerOrderId = storedId;
  F.orderTotal = og.total_amount;

  expect(errors, `콘솔 에러: ${errors.join(' | ')}`).toEqual([]);
});

/* ------------------------------------------------------------------ */
/* 2. 성공 리다이렉트 → 콜백이 toss-confirm 을 부르고 상태 화면으로       */
/* ------------------------------------------------------------------ */

test('TP2 Toss 성공 리다이렉트는 toss-confirm 을 올바른 body 로 부르고 주문 상태로 착지한다', async ({
  page,
  context,
}) => {
  await loginAs(context, STUDENT_EMAIL);
  await page.setViewportSize({ width: 390, height: 844 });

  const providerOrderId: string = F.providerOrderId;
  const amount: number = F.orderTotal;
  expect(providerOrderId, 'TP1 이 먼저 성공해야 한다').toBeTruthy();

  // 장바구니를 채워두고(비워지는지 검증용)
  await page.goto(`/s/${F.academy.slug}/schedule`);
  await setTicketCart(page);

  // toss-confirm 을 가로채 body 를 검증하고 성공으로 응답한다 (실제 승인 호출 금지)
  let confirmBody: any = null;
  await page.route('**/api/orders/toss-confirm', async (route) => {
    confirmBody = route.request().postDataJSON();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        idempotent: false,
        order_group_id: 'stub',
        status: 'CONFIRMED',
        issued_tickets: 1,
      }),
    });
  });

  // Toss 성공 리다이렉트 흉내
  await page.goto(
    `/s/${F.academy.slug}/orders/toss-callback?paymentKey=test_pk_${stamp}&orderId=${encodeURIComponent(
      providerOrderId
    )}&amount=${amount}`
  );

  // 콜백이 올바른 body 로 확정을 호출했다
  await expect.poll(() => confirmBody).not.toBeNull();
  expect(confirmBody).toEqual({
    orderId: providerOrderId,
    paymentKey: `test_pk_${stamp}`,
    amount,
  });

  // 주문 상태 화면으로 착지한다
  await page.waitForURL(new RegExp(`/orders/${providerOrderId}$`), { timeout: 15000 });
  await expect(page.getByTestId('order-status')).toBeVisible();

  // 장바구니가 비워졌다
  const cart = await page.evaluate(
    (aid) => window.localStorage.getItem(`miniapp-cart:${aid}`),
    F.academy.id
  );
  expect(cart === null || cart === '[]').toBeTruthy();
});

/* ------------------------------------------------------------------ */
/* 3. 실패 리다이렉트 → 취소 상태, 중복 주문 없음                         */
/* ------------------------------------------------------------------ */

test('TP3 Toss 실패 리다이렉트는 취소 상태를 보여주고 중복 주문을 만들지 않는다', async ({
  page,
  context,
}) => {
  await loginAs(context, STUDENT_EMAIL);
  const errors = watchErrors(page);
  await page.setViewportSize({ width: 390, height: 844 });

  const before = await countOrders();

  await page.goto(
    `/s/${F.academy.slug}/orders/toss-fail?code=USER_CANCEL&message=${encodeURIComponent(
      '사용자가 결제를 취소했습니다.'
    )}&orderId=${encodeURIComponent(F.providerOrderId)}`
  );
  await page.waitForLoadState('domcontentloaded');

  await expect(page.getByTestId('toss-fail')).toBeVisible();
  await expect(page.getByTestId('toss-fail-headline')).toContainText('결제가 취소되었습니다');
  await expect(page.getByTestId('toss-fail-cart-link')).toBeVisible();

  // 실패 화면은 아무 주문도 만들지 않는다
  const after = await countOrders();
  expect(after, '실패 리다이렉트가 주문을 새로 만들었다').toBe(before);

  expect(errors, `콘솔 에러: ${errors.join(' | ')}`).toEqual([]);
});

/* ------------------------------------------------------------------ */
/* 4. 서버는 승인 금액 불일치를 거절한다 (이행되지 않는다)                */
/* ------------------------------------------------------------------ */

test('TP4 승인 금액이 주문 금액과 다르면 서버가 거절하고 주문은 확정되지 않는다', async () => {
  const providerOrderId = newProviderOrderId('TPMIS');
  const order = await composeOrder(svc, {
    academyId: F.academy.id,
    method: 'TOSS',
    items: [{ item_type: 'TICKET_PURCHASE', ticket_id: F.ticket.id }],
    userId: STUDENT_ID,
    providerOrderId,
  });
  expect(order.total_amount).toBe(TICKET_PRICE);

  // 틀린 금액으로 승인 시도 → ORDER_AMOUNT_MISMATCH
  let threw = false;
  try {
    await approveAndFinalize(svc, {
      orderGroupId: order.order_group_id,
      approvedAmount: TICKET_PRICE + 1000,
      method: 'TOSS',
      paymentKey: `TP-MIS-${stamp}`,
      confirmedBy: STUDENT_ID,
    });
  } catch (e) {
    threw = true;
    expect(String((e as Error).message)).toContain('ORDER_AMOUNT_MISMATCH');
  }
  expect(threw, '금액 불일치인데 승인이 통과됐다').toBe(true);

  // 주문은 확정되지 않았다
  const { data: og } = await svc
    .from('order_groups')
    .select('status')
    .eq('id', order.order_group_id)
    .single();
  expect(og.status).not.toBe('CONFIRMED');

  // 올바른 금액으로는 정상 확정된다 (거절이 정상 결제까지 막지 않음을 증명)
  const good = await approveAndFinalize(svc, {
    orderGroupId: order.order_group_id,
    approvedAmount: TICKET_PRICE,
    method: 'TOSS',
    paymentKey: `TP-OK-${stamp}`,
    confirmedBy: STUDENT_ID,
  });
  expect(good.status).toBe('CONFIRMED');
});
