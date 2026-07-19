/**
 * T5 결제 확정 (BANK / TOSS / ONSITE) · 이행 실패 복구 검증
 *
 * 실행: npx playwright test tests/payments.spec.ts
 *
 * 픽스처는 전용 테스트 학원(slug: t5-pay-*) 안에서만 만들고 끝나면 지운다.
 * 실제 MID 학원(slug: mid) 데이터는 절대 건드리지 않는다.
 * 결제사(Toss)는 실제로 호출하지 않는다 — 승인 응답은 stub 하고,
 * "멱등키가 실제로 전송되는가"는 요청 조립 함수로 따로 증명한다.
 */
import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

import { composeOrder, newProviderOrderId } from '../lib/orders/composer';
import type { OrderItemInput } from '../lib/orders/types';
import {
  approveAndFinalize,
  finalizeOrder,
  parseFulfilmentError,
} from '../lib/payments/fulfilment';
import { buildTossConfirmRequest, confirmTossPayment } from '../lib/payments/toss';
import { kstToday } from '../lib/date/kst';
import { assertAcademyAdmin } from '../lib/supabase/academy-admin-auth';

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
// createServiceClient() 등 앱 코드는 process.env 를 읽는다. 주입하지 않으면
// 서비스롤 대신 anon 키로 떨어져 권한 테스트가 **무의미하게 통과**한다.
for (const [k, v] of Object.entries(env)) {
  if (process.env[k] === undefined) process.env[k] = v as string;
}

const svc = createClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
}) as any;

const STUDENT_ID = 'fd2fd033-2f2c-4cad-890b-f2c9c75a0f23'; // e2e-moveit-student@modoogoods.com
const OWNER_ID = '6e33f238-14c6-41d7-9715-d131067b6885'; // e2e-moveit-owner@modoogoods.com
const STUDENT_EMAIL = 'e2e-moveit-student@modoogoods.com';
const E2E_PW = 'Test1234!e2e';

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

/** schedules 에는 (class, KST 날짜) 유니크 제약이 있다 — 테스트마다 다른 날짜를 쓴다. */
let dayCursor = 2;
function nextDaySlot() {
  const h = 24 * dayCursor++;
  return { start_time: isoInHours(h), end_time: isoInHours(h + 1) };
}

async function newSchedule(classId: string, maxStudents = 10) {
  return ins('schedules', {
    class_id: classId,
    ...nextDaySlot(),
    max_students: maxStudents,
    is_canceled: false,
  });
}

/** 주문 생성 (서비스롤). 결제 전 상태(PENDING_PAYMENT)까지. */
async function makeOrder(method: 'BANK' | 'TOSS' | 'ONSITE', items: OrderItemInput[]) {
  return composeOrder(svc, {
    academyId: F.academy.id,
    method,
    items,
    userId: STUDENT_ID,
    providerOrderId: newProviderOrderId(`T5${method}`),
  });
}

async function getOrder(id: string) {
  const { data } = await svc.from('order_groups').select('*').eq('id', id).single();
  return data;
}
async function getItems(orderId: string) {
  const { data } = await svc
    .from('order_items')
    .select('*')
    .eq('order_group_id', orderId)
    .order('created_at');
  return data ?? [];
}
async function getBookings(orderId: string) {
  const { data } = await svc.from('bookings').select('*').eq('order_group_id', orderId);
  return data ?? [];
}
async function getRevenue(orderId: string) {
  const { data } = await svc.from('revenue_transactions').select('*').eq('order_group_id', orderId);
  return data ?? [];
}
async function getUserTicket(id: string) {
  const { data } = await svc.from('user_tickets').select('*').eq('id', id).single();
  return data;
}
/** 이 주문이 발급한 수강권 전부 (중복 발급 검출용) */
async function ticketsOfOrder(orderId: string) {
  const items = await getItems(orderId);
  return items.map((i: any) => i.result_user_ticket_id).filter(Boolean);
}

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  F.academy = await ins('academies', {
    name_kr: `T5결제테스트-${stamp}`,
    slug: `t5-pay-${stamp}`,
    is_active: true,
    // 예약 오픈/마감 제약 없음 — 결제 확정 자체를 보기 위한 설정
    booking_policy: { open: null, close: { minutesBefore: 0 }, cancelUntil: { minutesBefore: 0 } },
  });
  academyIds.push(F.academy.id);

  // 스태프 권한: 소유자 계정을 이 테스트 학원의 ACADEMY_OWNER 로 붙인다.
  F.ownerRole = await ins('academy_user_roles', {
    academy_id: F.academy.id,
    user_id: OWNER_ID,
    role: 'ACADEMY_OWNER',
  });

  F.group = await ins('class_groups', {
    academy_id: F.academy.id,
    key: 'normal',
    name: '정규',
    is_special: false,
  });

  // --- 상품 ---
  F.tCount = await ins('tickets', {
    academy_id: F.academy.id, name: '5회권', ticket_type: 'COUNT',
    price: 50000, total_count: 5, valid_days: 30, start_mode: 'IMMEDIATE',
    is_general: true, is_on_sale: true, is_public: true,
  });
  // 1일 쿠폰: 시작=만료=확정일 규칙 검증용
  F.tCoupon = await ins('tickets', {
    academy_id: F.academy.id, name: '1일쿠폰', ticket_type: 'COUNT',
    price: 10000, total_count: 1, valid_days: 1, start_mode: 'IMMEDIATE',
    is_general: true, is_on_sale: true, is_public: true, is_coupon: true,
  });
  // 주문 후 상품이 수정되는 시나리오 (스냅샷 준수 검증용)
  F.tEdit = await ins('tickets', {
    academy_id: F.academy.id, name: '스냅샷권', ticket_type: 'COUNT',
    price: 20000, total_count: 2, valid_days: 20, start_mode: 'IMMEDIATE',
    is_general: true, is_on_sale: true, is_public: true,
  });

  F.cls = await ins('classes', {
    academy_id: F.academy.id, title: '정규수업', class_group_id: F.group.id,
    max_students: 10, is_active: true,
  });
});

test.afterAll(async () => {
  if (academyIds.length === 0) return;

  const { data: ogs } = await svc.from('order_groups').select('id').in('academy_id', academyIds);
  const ogIds = (ogs ?? []).map((o: any) => o.id);
  const { data: cls } = await svc.from('classes').select('id').in('academy_id', academyIds);
  const classIds = (cls ?? []).map((c: any) => c.id);

  // 매출 → 주문항목 → 예약 → 주문 순서 (FK 안전)
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
  await svc.from('academy_user_roles').delete().in('academy_id', academyIds);
  await svc.from('academies').delete().in('id', academyIds);
});

// ===========================================================================
// AC1. BANK — 입금 확인이 그룹 전체를 확정한다 (홀드 승격 · 중복 예약 없음)
// ===========================================================================

test('AC1-1 BANK 확정: 스냅샷대로 발급 · 홀드가 CONFIRMED 로 승격 · 차감 1회 · 주문 CONFIRMED', async () => {
  const sched = await newSchedule(F.cls.id);
  const order = await makeOrder('BANK', [
    { item_type: 'TICKET_PURCHASE', ticket_id: F.tCount.id },
    { item_type: 'SCHEDULE_BOOKING', schedule_id: sched.id, use_purchase_index: 0 },
  ]);

  // 결제 전: 좌석은 PENDING 홀드로 잡혀 있다
  const holds = await getBookings(order.order_group_id);
  expect(holds).toHaveLength(1);
  expect(holds[0].status).toBe('PENDING');
  expect(holds[0].hold_expires_at).not.toBeNull();
  const holdId = holds[0].id;

  // 스태프 입금 확인
  const res = await approveAndFinalize(svc, {
    orderGroupId: order.order_group_id,
    approvedAmount: order.total_amount,
    method: 'BANK',
    confirmedBy: OWNER_ID,
  });

  expect(res.status).toBe('CONFIRMED');
  expect(res.promoted_holds).toBe(1);
  expect(res.created_bookings).toBe(0); // 새로 만들지 않았다 = 이중예약 없음

  const og = await getOrder(order.order_group_id);
  expect(og.status).toBe('CONFIRMED');
  expect(og.confirmed_at).not.toBeNull();
  expect(og.confirmed_by).toBe(OWNER_ID);

  // 예약은 **같은 행**이 승격된 것 — 주문에 딸린 예약은 여전히 1건
  const after = await getBookings(order.order_group_id);
  expect(after).toHaveLength(1);
  expect(after[0].id).toBe(holdId);
  expect(after[0].status).toBe('CONFIRMED');
  expect(after[0].hold_expires_at).toBeNull();

  // 수강권은 스냅샷대로 발급되고, 예약 1건분만 차감됐다 (5 → 4)
  const items = await getItems(order.order_group_id);
  const purchase = items.find((i: any) => i.item_type === 'TICKET_PURCHASE');
  const ut = await getUserTicket(purchase.result_user_ticket_id);
  expect(ut.remaining_count).toBe(4);
  expect(ut.start_date).toBe(kstToday());

  // 매출은 구매 항목당 한 줄
  expect(await getRevenue(order.order_group_id)).toHaveLength(1);

  F.bankOrder = order;
  F.bankUserTicketId = purchase.result_user_ticket_id;
});

test('AC1-2 "사서 바로 쓴다": 예약이 같은 주문에서 발급된 수강권을 소비한다', async () => {
  const items = await getItems(F.bankOrder.order_group_id);
  const purchase = items.find((i: any) => i.item_type === 'TICKET_PURCHASE');
  const booking = items.find((i: any) => i.item_type === 'SCHEDULE_BOOKING');

  expect(booking.source_purchase_item_id).toBe(purchase.id);

  const { data: b } = await svc.from('bookings').select('*').eq('id', booking.result_booking_id).single();
  // 예약이 쓴 수강권 == 이 주문이 방금 발급한 수강권
  expect(b.user_ticket_id).toBe(purchase.result_user_ticket_id);
});

test('AC1-3 같은 주문을 두 번 확정해도 아무것도 더 생기지 않는다 (멱등)', async () => {
  const id = F.bankOrder.order_group_id;

  const beforeTickets = await ticketsOfOrder(id);
  const beforeBookings = await getBookings(id);
  const beforeRevenue = await getRevenue(id);
  const beforeUt = await getUserTicket(F.bankUserTicketId);

  const again = await approveAndFinalize(svc, {
    orderGroupId: id,
    approvedAmount: F.bankOrder.total_amount,
    method: 'BANK',
    confirmedBy: OWNER_ID,
  });
  expect(again.idempotent).toBe(true);
  expect(again.status).toBe('CONFIRMED');

  expect(await ticketsOfOrder(id)).toEqual(beforeTickets);
  expect(await getBookings(id)).toHaveLength(beforeBookings.length);
  expect(await getRevenue(id)).toHaveLength(beforeRevenue.length);
  // 차감이 두 번 일어나지 않았다
  expect((await getUserTicket(F.bankUserTicketId)).remaining_count).toBe(beforeUt.remaining_count);
});

// ===========================================================================
// AC2. 만료 vs 확정 경합 — 정확히 하나만 이긴다
// ===========================================================================

test('AC2-1 만료 스윕과 입금 확정을 동시에 → 결과는 하나, 상태 일관', async () => {
  const sched = await newSchedule(F.cls.id);
  const order = await makeOrder('BANK', [
    { item_type: 'TICKET_PURCHASE', ticket_id: F.tCount.id },
    { item_type: 'SCHEDULE_BOOKING', schedule_id: sched.id, use_purchase_index: 0 },
  ]);

  // 만료 시각을 과거로 당겨 스윕 대상으로 만든다
  await svc
    .from('order_groups')
    .update({ expires_at: new Date(Date.now() - 60_000).toISOString() })
    .eq('id', order.order_group_id);

  const [sweep, confirm] = await Promise.allSettled([
    svc.rpc('expire_pending_bank_orders', {}),
    approveAndFinalize(svc, {
      orderGroupId: order.order_group_id,
      approvedAmount: order.total_amount,
      method: 'BANK',
      confirmedBy: OWNER_ID,
    }),
  ]);
  void sweep;

  const og = await getOrder(order.order_group_id);
  const bookings = await getBookings(order.order_group_id);
  const tickets = (await ticketsOfOrder(order.order_group_id)).length;

  // 승자는 둘 중 하나뿐이고, 데이터는 그 결과와 정확히 일치한다
  expect(['CONFIRMED', 'EXPIRED']).toContain(og.status);

  if (og.status === 'CONFIRMED') {
    expect(confirm.status).toBe('fulfilled');
    expect(bookings.every((b: any) => b.status === 'CONFIRMED')).toBe(true);
    expect(tickets).toBe(1);
  } else {
    expect(confirm.status).toBe('rejected');
    // 만료가 이겼다면 좌석은 반납되고 아무것도 발급되지 않았다
    expect(bookings.every((b: any) => b.status === 'CANCELLED')).toBe(true);
    expect(tickets).toBe(0);
  }

  F.raceOrderId = order.order_group_id;
  F.raceStatus = og.status;
});

test('AC2-2 확정된 주문은 이후 만료 스윕으로 절대 EXPIRED 가 되지 않는다', async () => {
  // 확정된 주문(AC1)의 만료 시각을 과거로 당겨도 스윕은 건드리지 못한다
  await svc
    .from('order_groups')
    .update({ expires_at: new Date(Date.now() - 60_000).toISOString() })
    .eq('id', F.bankOrder.order_group_id);

  await svc.rpc('expire_pending_bank_orders', {});

  const og = await getOrder(F.bankOrder.order_group_id);
  expect(og.status).toBe('CONFIRMED');

  const bookings = await getBookings(F.bankOrder.order_group_id);
  expect(bookings.every((b: any) => b.status === 'CONFIRMED')).toBe(true);
});

// ===========================================================================
// AC3. 이행 실패 → 승인은 남는다 → 재시도로 복구 (중복 없이)
// ===========================================================================

test('AC3-1 승인 후 이행 실패 → FULFILLMENT_FAILED 로 사유 기록, 승인은 살아있다', async () => {
  const sched = await newSchedule(F.cls.id, 1); // 정원 1
  const order = await makeOrder('TOSS', [
    { item_type: 'TICKET_PURCHASE', ticket_id: F.tCount.id },
    { item_type: 'SCHEDULE_BOOKING', schedule_id: sched.id, use_purchase_index: 0 },
  ]);

  // 승인과 이행 사이에 다른 학생이 마지막 좌석을 가져간 상황을 만든다
  F.blockerBooking = await ins('bookings', {
    user_id: OWNER_ID,
    class_id: F.cls.id,
    schedule_id: sched.id,
    status: 'CONFIRMED',
    payment_status: 'PAID',
  });

  let failed: unknown = null;
  try {
    await approveAndFinalize(svc, {
      orderGroupId: order.order_group_id,
      approvedAmount: order.total_amount,
      method: 'TOSS',
      paymentKey: `test_paykey_${stamp}_1`,
      confirmedBy: STUDENT_ID,
    });
  } catch (e) {
    failed = e;
  }
  expect(failed).not.toBeNull();
  expect(parseFulfilmentError(failed).code).toBe('SCHEDULE_FULL');

  const og = await getOrder(order.order_group_id);
  expect(og.status).toBe('FULFILLMENT_FAILED');
  expect(og.fulfillment_error_code).toBe('SCHEDULE_FULL');
  expect(og.fulfillment_error_message).toContain('SCHEDULE_FULL');
  expect(og.retry_count).toBe(1);

  // ⭐ 결제 승인은 조용히 사라지지 않았다
  expect(og.payment_key).toBe(`test_paykey_${stamp}_1`);
  expect(og.payment_approved_at).not.toBeNull();

  // 실패한 이행은 전부 롤백됐다 — 발급/예약/매출 없음
  expect(await ticketsOfOrder(order.order_group_id)).toHaveLength(0);
  expect(await getBookings(order.order_group_id)).toHaveLength(0);
  expect(await getRevenue(order.order_group_id)).toHaveLength(0);

  F.failedOrder = order;
});

test('AC3-2 재시도 → CONFIRMED, 수강권·예약·매출 어느 것도 중복되지 않는다', async () => {
  // 좌석을 다시 비운다 (경합 상황 해소)
  await svc.from('bookings').delete().eq('id', F.blockerBooking.id);

  const res = await finalizeOrder(svc, F.failedOrder.order_group_id, OWNER_ID);
  expect(res.status).toBe('CONFIRMED');

  const og = await getOrder(F.failedOrder.order_group_id);
  expect(og.status).toBe('CONFIRMED');
  expect(og.fulfillment_error_code).toBeNull();

  const tickets = await ticketsOfOrder(F.failedOrder.order_group_id);
  expect(tickets).toHaveLength(1);
  expect(await getBookings(F.failedOrder.order_group_id)).toHaveLength(1);
  expect(await getRevenue(F.failedOrder.order_group_id)).toHaveLength(1);

  // 재시도를 한 번 더 해도 늘지 않는다
  const again = await finalizeOrder(svc, F.failedOrder.order_group_id, OWNER_ID);
  expect(again.idempotent).toBe(true);
  expect(await ticketsOfOrder(F.failedOrder.order_group_id)).toHaveLength(1);
  expect(await getBookings(F.failedOrder.order_group_id)).toHaveLength(1);
  expect(await getRevenue(F.failedOrder.order_group_id)).toHaveLength(1);
});

test('AC3-3 막힌 주문은 운영자가 조회할 수 있다 (list_stuck_orders)', async () => {
  // 일부러 하나를 막힌 상태로 만든다
  const order = await makeOrder('TOSS', [
    { item_type: 'TICKET_PURCHASE', ticket_id: F.tCount.id },
  ]);
  await svc.rpc('record_order_payment_approval', {
    p_order_group_id: order.order_group_id,
    p_approved_amount: order.total_amount,
    p_payment_key: `test_paykey_${stamp}_stuck`,
    p_expected_method: 'TOSS',
  });

  const { data, error } = await svc.rpc('list_stuck_orders', {
    p_academy_id: F.academy.id,
    p_limit: 50,
  });
  expect(error).toBeNull();
  const ids = (data ?? []).map((r: any) => r.order_group_id);
  expect(ids).toContain(order.order_group_id);

  F.stuckOrderId = order.order_group_id;
});

// ===========================================================================
// AC4. 금액 검증 — 승인액 ≠ 주문액이면 이행하지 않는다
// ===========================================================================

test('AC4-1 승인 금액 불일치 → 거절, 아무것도 이행되지 않는다', async () => {
  const order = await makeOrder('TOSS', [
    { item_type: 'TICKET_PURCHASE', ticket_id: F.tCount.id },
  ]);

  let failed: unknown = null;
  try {
    await approveAndFinalize(svc, {
      orderGroupId: order.order_group_id,
      approvedAmount: order.total_amount - 1000, // 위·변조된 승인액
      method: 'TOSS',
      paymentKey: `test_paykey_${stamp}_mismatch`,
      confirmedBy: STUDENT_ID,
    });
  } catch (e) {
    failed = e;
  }
  expect(failed).not.toBeNull();
  expect(parseFulfilmentError(failed).code).toBe('ORDER_AMOUNT_MISMATCH');

  const og = await getOrder(order.order_group_id);
  expect(og.status).toBe('PENDING_PAYMENT'); // 승인조차 기록되지 않는다
  expect(og.payment_approved_at).toBeNull();
  expect(await ticketsOfOrder(order.order_group_id)).toHaveLength(0);
  expect(await getRevenue(order.order_group_id)).toHaveLength(0);
});

test('AC4-2 항목 합계와 주문 총액이 어긋난 주문은 이행되지 않는다', async () => {
  const order = await makeOrder('ONSITE', [
    { item_type: 'TICKET_PURCHASE', ticket_id: F.tCount.id },
  ]);
  // 총액만 조작 (항목 합계와 불일치)
  await svc
    .from('order_groups')
    .update({ original_amount: 99000, total_amount: 99000 })
    .eq('id', order.order_group_id);

  let failed: unknown = null;
  try {
    await finalizeOrder(svc, order.order_group_id, OWNER_ID);
  } catch (e) {
    failed = e;
  }
  expect(parseFulfilmentError(failed).code).toBe('ORDER_AMOUNT_MISMATCH');
  expect(await ticketsOfOrder(order.order_group_id)).toHaveLength(0);
});

// ===========================================================================
// AC5. TOSS — 멱등키 전송 · 중복 승인은 한 번만 확정
// ===========================================================================

test('AC5-1 승인 요청에 주문당 유일한 Idempotency-Key 가 실제로 실린다', async () => {
  const req = buildTossConfirmRequest({
    paymentKey: 'pk_test',
    orderId: 'MV-TESTORDER-0001',
    amount: 50000,
    secretKey: 'sk_test',
  });
  expect(req.headers['Idempotency-Key']).toBe('MV-TESTORDER-0001');
  expect(JSON.parse(req.body)).toMatchObject({ orderId: 'MV-TESTORDER-0001', amount: 50000 });

  // stub 을 써도 헤더가 실제로 나가는지는 증명된다
  const seen: Array<Record<string, string>> = [];
  const stub = async (_url: string, init: any) => {
    seen.push(init.headers);
    return {
      ok: true,
      status: 200,
      json: async () => ({ paymentKey: 'pk_test', orderId: 'MV-TESTORDER-0001', totalAmount: 50000 }),
    };
  };
  const approval = await confirmTossPayment(
    { paymentKey: 'pk_test', orderId: 'MV-TESTORDER-0001', amount: 50000, secretKey: 'sk_test' },
    stub as any
  );
  expect(approval.ok).toBe(true);
  expect(approval.approvedAmount).toBe(50000);
  expect(seen).toHaveLength(1);
  expect(seen[0]['Idempotency-Key']).toBe('MV-TESTORDER-0001');
});

test('AC5-2 TOSS 이중 승인 → 확정은 정확히 한 번', async () => {
  const sched = await newSchedule(F.cls.id);
  const order = await makeOrder('TOSS', [
    { item_type: 'TICKET_PURCHASE', ticket_id: F.tCount.id },
    { item_type: 'SCHEDULE_BOOKING', schedule_id: sched.id, use_purchase_index: 0 },
  ]);

  const args = {
    orderGroupId: order.order_group_id,
    approvedAmount: order.total_amount,
    method: 'TOSS' as const,
    paymentKey: `test_paykey_${stamp}_double`,
    confirmedBy: STUDENT_ID,
  };

  const first = await approveAndFinalize(svc, args);
  expect(first.status).toBe('CONFIRMED');
  expect(first.idempotent).toBe(false);
  expect(first.created_bookings).toBe(1); // TOSS 는 확정 시점에 예약을 만든다

  const second = await approveAndFinalize(svc, args);
  expect(second.idempotent).toBe(true);

  expect(await ticketsOfOrder(order.order_group_id)).toHaveLength(1);
  expect(await getBookings(order.order_group_id)).toHaveLength(1);
  expect(await getRevenue(order.order_group_id)).toHaveLength(1);
});

// ===========================================================================
// AC6. ONSITE — 학원 스태프만 (서버측 권한 검사)
// ===========================================================================

test('AC6-1 비스태프(학생)는 확정할 수 없다 — 서버가 막는다', async () => {
  const order = await makeOrder('ONSITE', [
    { item_type: 'TICKET_PURCHASE', ticket_id: F.tCount.id },
  ]);

  // 학생 세션으로 로그인한 클라이언트 (RLS·함수 권한이 그대로 적용된다)
  const studentClient = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL!,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  ) as any;
  const { error: signInErr } = await studentClient.auth.signInWithPassword({
    email: STUDENT_EMAIL,
    password: E2E_PW,
  });
  expect(signInErr).toBeNull();

  // 이행 함수는 service_role 에게만 EXECUTE 가 있다
  const { error: finErr } = await studentClient.rpc('finalize_order_group', {
    p_order_group_id: order.order_group_id,
    p_confirmed_by: STUDENT_ID,
  });
  expect(finErr).not.toBeNull();

  // 승인 기록도 마찬가지
  const { error: apprErr } = await studentClient.rpc('record_order_payment_approval', {
    p_order_group_id: order.order_group_id,
    p_approved_amount: order.total_amount,
    p_payment_key: null,
    p_expected_method: 'ONSITE',
  });
  expect(apprErr).not.toBeNull();

  // 관리자 권한 검사 자체도 학생을 거부한다 (API 라우트가 쓰는 경로)
  let adminRejected = false;
  try {
    await assertAcademyAdmin(F.academy.id, STUDENT_ID);
  } catch {
    adminRejected = true;
  }
  expect(adminRejected).toBe(true);

  // 아무것도 이행되지 않았다
  const og = await getOrder(order.order_group_id);
  expect(og.status).toBe('PENDING_PAYMENT');
  expect(await ticketsOfOrder(order.order_group_id)).toHaveLength(0);

  F.onsiteOrder = order;
  await studentClient.auth.signOut();
});

test('AC6-2 스태프(소유자)는 확정할 수 있다', async () => {
  let staffOk = true;
  try {
    await assertAcademyAdmin(F.academy.id, OWNER_ID);
  } catch {
    staffOk = false;
  }
  expect(staffOk).toBe(true);

  const res = await approveAndFinalize(svc, {
    orderGroupId: F.onsiteOrder.order_group_id,
    approvedAmount: F.onsiteOrder.total_amount,
    method: 'ONSITE',
    confirmedBy: OWNER_ID,
  });
  expect(res.status).toBe('CONFIRMED');
  expect(await ticketsOfOrder(F.onsiteOrder.order_group_id)).toHaveLength(1);
  expect(await getRevenue(F.onsiteOrder.order_group_id)).toHaveLength(1);
});

// ===========================================================================
// AC7. 발급 규칙 — 1일 쿠폰 · 스냅샷 준수
// ===========================================================================

test('AC7-1 1일 쿠폰을 BANK 로 사면 시작=만료=입금 확인일(KST)', async () => {
  const order = await makeOrder('BANK', [
    { item_type: 'TICKET_PURCHASE', ticket_id: F.tCoupon.id },
  ]);

  // 주문일과 확정일이 다를 수 있음을 드러내기 위해, 주문 생성 시각을 어제로 돌린다.
  await svc
    .from('order_groups')
    .update({ created_at: new Date(Date.now() - 26 * 3600_000).toISOString() })
    .eq('id', order.order_group_id);

  await approveAndFinalize(svc, {
    orderGroupId: order.order_group_id,
    approvedAmount: order.total_amount,
    method: 'BANK',
    confirmedBy: OWNER_ID,
  });

  const items = await getItems(order.order_group_id);
  expect(items[0].is_coupon_snapshot).toBe(true);
  expect(items[0].valid_days_snapshot).toBe(1);

  const ut = await getUserTicket(items[0].result_user_ticket_id);
  const today = kstToday();
  expect(ut.start_date).toBe(today);
  expect(ut.expiry_date).toBe(today); // 시작 = 만료 = 확정일
});

test('AC7-2 주문 후 상품이 수정돼도 발급 내용은 주문 시점 스냅샷을 따른다', async () => {
  const order = await makeOrder('ONSITE', [
    { item_type: 'TICKET_PURCHASE', ticket_id: F.tEdit.id },
  ]);

  const before = await getItems(order.order_group_id);
  expect(before[0].grant_count_snapshot).toBe(2);
  expect(before[0].valid_days_snapshot).toBe(20);

  // 확정 전에 상품을 바꾼다 (횟수·유효기간·가격 전부)
  await svc
    .from('tickets')
    .update({ total_count: 99, valid_days: 999, price: 1, name: '변경된상품' })
    .eq('id', F.tEdit.id);

  await approveAndFinalize(svc, {
    orderGroupId: order.order_group_id,
    approvedAmount: order.total_amount,
    method: 'ONSITE',
    confirmedBy: OWNER_ID,
  });

  const items = await getItems(order.order_group_id);
  const ut = await getUserTicket(items[0].result_user_ticket_id);

  // 지금 tickets 행이 아니라 **스냅샷**대로 발급됐다
  expect(ut.remaining_count).toBe(2);
  expect(ut.start_date).toBe(kstToday());
  const expectedExpiry = new Date(Date.parse(`${kstToday()}T00:00:00Z`) + 19 * 86400000)
    .toISOString()
    .slice(0, 10);
  expect(ut.expiry_date).toBe(expectedExpiry); // 20일권 = 시작일 포함 20일

  // 매출도 스냅샷 이름·금액으로 남는다
  const rev = await getRevenue(order.order_group_id);
  expect(rev).toHaveLength(1);
  expect(rev[0].ticket_name).toBe('스냅샷권');
  expect(rev[0].final_price).toBe(20000);
});
