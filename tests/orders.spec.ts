/**
 * T4 주문 조립 · 가격 스냅샷 · BANK 좌석 홀드 검증
 *
 * 실행: npx playwright test tests/orders.spec.ts
 *
 * 픽스처는 전용 테스트 학원(slug: t4-orders-*) 안에서만 만들고 끝나면 지운다.
 * 실제 MID 학원(slug: mid) 데이터는 절대 건드리지 않는다.
 */
import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

import {
  composeOrder,
  keepOrderableItems,
  newProviderOrderId,
  previewOrder,
  sanitizeItems,
} from '../lib/orders/composer';
import type { OrderItemInput, OrderPreflightResult } from '../lib/orders/types';
import { parseOrderError } from '../lib/orders/types';

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
const svc = createClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
}) as any;

const STUDENT_ID = 'fd2fd033-2f2c-4cad-890b-f2c9c75a0f23'; // e2e-moveit-student@modoogoods.com
const OTHER_ID = '6e33f238-14c6-41d7-9715-d131067b6885'; // e2e-moveit-owner@modoogoods.com

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

/**
 * schedules 에는 (class, KST 날짜) 유니크 제약이 있다.
 * 같은 수업의 스케줄은 반드시 서로 다른 날짜로 만들어야 한다.
 * beforeAll 이 2·3·4일 뒤를 쓰므로 개별 테스트는 5일 뒤부터 하루씩 당겨 쓴다.
 */
let dayCursor = 5;
function nextDaySlot() {
  const h = 24 * dayCursor++;
  return { start_time: isoInHours(h), end_time: isoInHours(h + 1) };
}

/** preflight 판정에서 특정 항목의 코드 */
function codeAt(res: OrderPreflightResult, index: number): string {
  const v = res.items.find((x) => x.index === index);
  if (!v) throw new Error(`판정 결과에 index=${index} 가 없다`);
  return v.code;
}

async function preflight(items: OrderItemInput[], userId: string | null = STUDENT_ID) {
  return previewOrder(svc, { academyId: F.academy.id, items, userId });
}

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  F.academy = await ins('academies', {
    name_kr: `T4주문테스트-${stamp}`,
    slug: `t4-orders-${stamp}`,
    is_active: true,
    booking_policy: { open: null, close: { minutesBefore: 0 }, cancelUntil: { minutesBefore: 0 } },
  });
  academyIds.push(F.academy.id);

  F.gNormal = await ins('class_groups', {
    academy_id: F.academy.id, key: 'normal', name: '정규', is_special: false,
  });
  F.gSpecial = await ins('class_groups', {
    academy_id: F.academy.id, key: 'special', name: '스페셜', is_special: true,
  });

  // --- 상품 ---
  F.tGeneral = await ins('tickets', {
    academy_id: F.academy.id, name: '자유수강권', ticket_type: 'COUNT',
    price: 50000, total_count: 10, valid_days: 30, start_mode: 'IMMEDIATE',
    is_general: true, is_on_sale: true, is_public: true,
  });
  F.tOptions = await ins('tickets', {
    academy_id: F.academy.id, name: '옵션권', ticket_type: 'COUNT',
    price: 30000, total_count: 1, valid_days: 30, start_mode: 'IMMEDIATE',
    is_general: true, is_on_sale: true, is_public: true,
    count_options: [
      { count: 1, price: 30000, valid_days: 30 },
      { count: 5, price: 120000, valid_days: 60 },
    ],
  });
  F.tOffSale = await ins('tickets', {
    academy_id: F.academy.id, name: '판매중지권', ticket_type: 'COUNT',
    price: 10000, total_count: 1, is_general: true, is_on_sale: false, is_public: false,
  });

  // --- 수업/스케줄 ---
  F.cNormal = await ins('classes', {
    academy_id: F.academy.id, title: '정규수업', class_group_id: F.gNormal.id,
    max_students: 10, is_active: true,
  });
  F.sNormal = await ins('schedules', {
    class_id: F.cNormal.id, start_time: isoInHours(48), end_time: isoInHours(49),
    max_students: 10, is_canceled: false,
  });
  // 중복 예약 판정용 (이미 예약된 수업)
  F.sDup = await ins('schedules', {
    class_id: F.cNormal.id, start_time: isoInHours(72), end_time: isoInHours(73),
    max_students: 10, is_canceled: false,
  });
  await ins('bookings', {
    user_id: STUDENT_ID, class_id: F.cNormal.id, schedule_id: F.sDup.id,
    status: 'CONFIRMED', payment_status: 'PAID',
  });

  // 정원 1명 — 이미 다른 학생이 채움
  F.sFull = await ins('schedules', {
    class_id: F.cNormal.id, start_time: isoInHours(96), end_time: isoInHours(97),
    max_students: 1, is_canceled: false,
  });
  await ins('bookings', {
    user_id: OTHER_ID, class_id: F.cNormal.id, schedule_id: F.sFull.id,
    status: 'CONFIRMED', payment_status: 'PAID',
  });

  // 예약 오픈 전 (수업일 당일 00:00 KST 오픈 → 48h 뒤 수업은 아직 오픈 전)
  F.cNotOpen = await ins('classes', {
    academy_id: F.academy.id, title: '오픈전수업', class_group_id: F.gNormal.id,
    max_students: 10, is_active: true,
    booking_policy: { open: { daysBefore: 0, time: '00:00' } },
  });
  F.sNotOpen = await ins('schedules', {
    class_id: F.cNotOpen.id, start_time: isoInHours(48), end_time: isoInHours(49),
    max_students: 10, is_canceled: false,
  });

  // 스페셜 수업 (명시 커버리지 없는 권으로는 예약 불가)
  F.cSpecial = await ins('classes', {
    academy_id: F.academy.id, title: '스페셜수업', class_group_id: F.gSpecial.id,
    max_students: 10, is_active: true,
  });
  F.sSpecial = await ins('schedules', {
    class_id: F.cSpecial.id, start_time: isoInHours(48), end_time: isoInHours(49),
    max_students: 10, is_canceled: false,
  });

  // --- 멤버십 ---
  F.mVip = await ins('memberships', {
    academy_id: F.academy.id, key: `vip-${stamp}`, name: 'VIP',
    visibility: 'hidden', is_active: true,
  });
  F.dVip = await ins('membership_discounts', {
    membership_id: F.mVip.id, ticket_id: F.tGeneral.id, percent: 20, is_active: true,
  });

  // 멤버 전용 수업 (비회원은 예약 불가)
  F.cAudience = await ins('classes', {
    academy_id: F.academy.id, title: '멤버전용수업', class_group_id: F.gNormal.id,
    max_students: 10, is_active: true, audience_membership_id: F.mVip.id,
  });
  F.sAudience = await ins('schedules', {
    class_id: F.cAudience.id, start_time: isoInHours(48), end_time: isoInHours(49),
    max_students: 10, is_canceled: false,
  });
});

test.afterAll(async () => {
  if (academyIds.length === 0) return;

  // 이 테스트가 만든 주문·예약만 지운다 (FK 안전 순서)
  const { data: ogs } = await svc.from('order_groups').select('id').in('academy_id', academyIds);
  const ogIds = (ogs ?? []).map((o: any) => o.id);

  const { data: cls } = await svc.from('classes').select('id').in('academy_id', academyIds);
  const classIds = (cls ?? []).map((c: any) => c.id);

  // 순서 주의: order_items.result_booking_id → bookings FK 가 있으므로
  // order_items 를 먼저 지워야 bookings 삭제가 통과한다.
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

  const { data: mss } = await svc.from('memberships').select('id').in('academy_id', academyIds);
  const msIds = (mss ?? []).map((m: any) => m.id);
  if (msIds.length > 0) {
    await svc.from('student_memberships').delete().in('membership_id', msIds);
    await svc.from('membership_discounts').delete().in('membership_id', msIds);
  }

  if (classIds.length > 0) await svc.from('schedules').delete().in('class_id', classIds);
  await svc.from('classes').delete().in('academy_id', academyIds);
  if (msIds.length > 0) await svc.from('memberships').delete().in('id', msIds);
  await svc.from('tickets').delete().in('academy_id', academyIds);
  await svc.from('class_groups').delete().in('academy_id', academyIds);
  await svc.from('academies').delete().in('id', academyIds);
});

// ===========================================================================
// AC1. preflight — 항목별 거절 사유가 결제 전에 전부 드러난다
// ===========================================================================

test('AC1-1 정원이 찬 수업 → SCHEDULE_FULL', async () => {
  const res = await preflight([{ item_type: 'SCHEDULE_BOOKING', schedule_id: F.sFull.id }]);
  expect(codeAt(res, 0)).toBe('SCHEDULE_FULL');
  expect(res.ok).toBe(false);
});

test('AC1-2 예약 오픈 전 → BOOKING_NOT_YET_OPEN', async () => {
  const res = await preflight([{ item_type: 'SCHEDULE_BOOKING', schedule_id: F.sNotOpen.id }]);
  expect(codeAt(res, 0)).toBe('BOOKING_NOT_YET_OPEN');
});

test('AC1-3 커버하지 않는 권으로 스페셜 수업 → SPECIAL_CLASS_NOT_COVERED', async () => {
  const res = await preflight([
    { item_type: 'TICKET_PURCHASE', ticket_id: F.tGeneral.id },
    { item_type: 'SCHEDULE_BOOKING', schedule_id: F.sSpecial.id, use_purchase_index: 0 },
  ]);
  expect(codeAt(res, 0)).toBe('OK');
  expect(codeAt(res, 1)).toBe('SPECIAL_CLASS_NOT_COVERED');
});

test('AC1-4 멤버 전용 수업을 비회원이 → AUDIENCE_NOT_ELIGIBLE', async () => {
  const res = await preflight([{ item_type: 'SCHEDULE_BOOKING', schedule_id: F.sAudience.id }]);
  expect(codeAt(res, 0)).toBe('AUDIENCE_NOT_ELIGIBLE');
});

test('AC1-5 이미 예약한 수업 → DUPLICATE_BOOKING', async () => {
  const res = await preflight([{ item_type: 'SCHEDULE_BOOKING', schedule_id: F.sDup.id }]);
  expect(codeAt(res, 0)).toBe('DUPLICATE_BOOKING');
});

test('AC1-6 판매중지 상품 → TICKET_NOT_ON_SALE / 사유는 코드+문구 둘 다', async () => {
  const res = await preflight([{ item_type: 'TICKET_PURCHASE', ticket_id: F.tOffSale.id }]);
  const v = res.items[0];
  expect(v.code).toBe('TICKET_NOT_ON_SALE');
  expect(v.message.length).toBeGreaterThan(0); // 사람이 읽는 문구도 함께
  expect(v.ok).toBe(false);
});

// ===========================================================================
// AC2. 불가 항목을 빼고 주문 — 거절된 항목은 결제되지 않는다
// ===========================================================================

test('AC2 OK 항목만 남긴 주문이 성공하고, 거절 항목은 청구되지 않는다', async () => {
  const cart: OrderItemInput[] = [
    { item_type: 'TICKET_PURCHASE', ticket_id: F.tGeneral.id },   // OK   50,000
    { item_type: 'SCHEDULE_BOOKING', schedule_id: F.sFull.id },   // 정원마감
    { item_type: 'SCHEDULE_BOOKING', schedule_id: F.sNotOpen.id },// 오픈전
    { item_type: 'TICKET_PURCHASE', ticket_id: F.tOffSale.id },   // 판매중지
  ];

  const pre = await preflight(cart);
  expect(pre.ok).toBe(false);
  const { items: kept, dropped } = keepOrderableItems(cart, pre.items);
  expect(dropped.map((d) => d.code).sort()).toEqual(
    ['BOOKING_NOT_YET_OPEN', 'SCHEDULE_FULL', 'TICKET_NOT_ON_SALE'].sort()
  );
  expect(kept).toHaveLength(1);

  const order = await composeOrder(svc, {
    academyId: F.academy.id, method: 'BANK', items: kept, userId: STUDENT_ID,
  });
  expect(order.ok).toBe(true);
  expect(order.total_amount).toBe(50000);

  const { data: rows } = await svc
    .from('order_items').select('*').eq('order_group_id', order.order_group_id);
  expect(rows).toHaveLength(1);
  // 거절된 스케줄은 주문에 흔적조차 없다
  expect(rows.some((r: any) => r.schedule_id === F.sFull.id)).toBe(false);
  expect(rows.some((r: any) => r.schedule_id === F.sNotOpen.id)).toBe(false);

  F.orderA = order;
});

// ===========================================================================
// AC3. 클라이언트가 보낸 금액은 절대 신뢰하지 않는다
// ===========================================================================

test('AC3-1 클라이언트가 끼워넣은 price/amount 는 무시된다', async () => {
  const tampered = [
    { item_type: 'TICKET_PURCHASE', ticket_id: F.tGeneral.id, price: 1, amount: 1, final_amount: 1 },
  ];
  // sanitize 가 금액 필드를 통째로 떨궈낸다
  const clean = sanitizeItems(tampered);
  expect(clean[0]).not.toHaveProperty('price');
  expect(clean[0]).not.toHaveProperty('amount');

  // sanitize 를 건너뛰고 원본을 그대로 넣어도 서버 계산가가 나온다
  const res = await preflight(tampered as unknown as OrderItemInput[]);
  expect(res.items[0].final_amount).toBe(50000);
  expect(res.total_amount).toBe(50000);
});

test('AC3-2 조작된 총액으로 주문 시도 → AMOUNT_MISMATCH 로 거절', async () => {
  const items: OrderItemInput[] = [{ item_type: 'TICKET_PURCHASE', ticket_id: F.tGeneral.id }];

  await expect(
    composeOrder(svc, {
      academyId: F.academy.id, method: 'BANK', items, userId: STUDENT_ID,
      expectedTotalAmount: 1, // 실제 50,000
    })
  ).rejects.toThrow(/AMOUNT_MISMATCH/);

  // 정확한 금액이면 통과
  const ok = await composeOrder(svc, {
    academyId: F.academy.id, method: 'ONSITE', items, userId: STUDENT_ID,
    expectedTotalAmount: 50000,
  });
  expect(ok.total_amount).toBe(50000);
});

test('AC3-3 옵션 인덱스로 가격·횟수·유효기간이 결정된다', async () => {
  const res = await preflight([
    { item_type: 'TICKET_PURCHASE', ticket_id: F.tOptions.id, count_option_index: 1 },
  ]);
  const v = res.items[0];
  expect(v.code).toBe('OK');
  expect(v.original_amount).toBe(120000);
  expect(v.grant_count_snapshot).toBe(5);
  expect(v.valid_days_snapshot).toBe(60);

  const bad = await preflight([
    { item_type: 'TICKET_PURCHASE', ticket_id: F.tOptions.id, count_option_index: 99 },
  ]);
  expect(bad.items[0].code).toBe('INVALID_COUNT_OPTION');
});

// ===========================================================================
// AC4. 스냅샷 불변성 — 주문 후 상품을 바꿔도 받을 것은 변하지 않는다
// ===========================================================================

test('AC4 주문 뒤 상품 가격·횟수를 바꿔도 주문 내용은 그대로다', async () => {
  const order = await composeOrder(svc, {
    academyId: F.academy.id, method: 'BANK', userId: STUDENT_ID,
    items: [{ item_type: 'TICKET_PURCHASE', ticket_id: F.tOptions.id, count_option_index: 1 }],
  });

  const before = (await svc.from('order_items').select('*')
    .eq('order_group_id', order.order_group_id).single()).data;
  expect(before.original_amount).toBe(120000);
  expect(before.grant_count_snapshot).toBe(5);
  expect(before.valid_days_snapshot).toBe(60);
  expect(before.ticket_name_snapshot).toBe('옵션권');

  // 주문 이후 운영자가 상품을 전면 수정
  await svc.from('tickets').update({
    name: '옵션권(개정)', price: 999000, total_count: 1, valid_days: 3,
    count_options: [{ count: 1, price: 999000, valid_days: 3 }],
  }).eq('id', F.tOptions.id);

  const after = (await svc.from('order_items').select('*')
    .eq('order_group_id', order.order_group_id).single()).data;
  expect(after.original_amount).toBe(120000);
  expect(after.final_amount).toBe(120000);
  expect(after.grant_count_snapshot).toBe(5);
  expect(after.valid_days_snapshot).toBe(60);
  expect(after.ticket_name_snapshot).toBe('옵션권');

  const og = (await svc.from('order_groups').select('total_amount')
    .eq('id', order.order_group_id).single()).data;
  expect(og.total_amount).toBe(120000);

  // 원상복구 (뒤 테스트에 영향 없도록)
  await svc.from('tickets').update({
    name: '옵션권', price: 30000, total_count: 1, valid_days: 30,
    count_options: [
      { count: 1, price: 30000, valid_days: 30 },
      { count: 5, price: 120000, valid_days: 60 },
    ],
  }).eq('id', F.tOptions.id);
});

// ===========================================================================
// AC5. BANK 홀드가 실제로 좌석을 점유한다
// ===========================================================================

test('AC5 BANK 주문이 PENDING 홀드를 만들고, 그 좌석은 다른 학생이 못 가져간다', async () => {
  const sHold = await ins('schedules', {
    class_id: F.cNormal.id, ...nextDaySlot(),
    max_students: 1, is_canceled: false,
  });
  F.sHold = sHold;

  const order = await composeOrder(svc, {
    academyId: F.academy.id, method: 'BANK', userId: STUDENT_ID,
    items: [
      { item_type: 'TICKET_PURCHASE', ticket_id: F.tGeneral.id },
      { item_type: 'SCHEDULE_BOOKING', schedule_id: sHold.id, use_purchase_index: 0 },
    ],
  });
  expect(order.hold_booking_ids).toHaveLength(1);
  F.holdOrder = order;

  const hold = (await svc.from('bookings').select('*')
    .eq('id', order.hold_booking_ids![0]).single()).data;
  expect(hold.status).toBe('PENDING');
  expect(hold.hold_expires_at).toBeTruthy();
  expect(hold.order_group_id).toBe(order.order_group_id);
  // 24시간 홀드 (오차 5분 허용)
  const holdMs = new Date(hold.hold_expires_at).getTime() - Date.now();
  expect(Math.abs(holdMs - 24 * 3600_000)).toBeLessThan(5 * 60_000);

  // 마지막 좌석이 홀드로 잠겼으므로 다른 학생은 정원 마감으로 보인다
  const other = await previewOrder(svc, {
    academyId: F.academy.id, userId: OTHER_ID,
    items: [{ item_type: 'SCHEDULE_BOOKING', schedule_id: sHold.id }],
  });
  expect(codeAt(other, 0)).toBe('SCHEDULE_FULL');
});

// ===========================================================================
// AC6. 마지막 한 자리 동시 주문 → 승자는 정확히 하나
// ===========================================================================

test('AC6 동시에 들어온 두 주문 중 정확히 하나만 성공한다', async () => {
  const sRace = await ins('schedules', {
    class_id: F.cNormal.id, ...nextDaySlot(),
    max_students: 1, is_canceled: false,
  });

  const mk = (userId: string) =>
    composeOrder(svc, {
      academyId: F.academy.id, method: 'BANK', userId,
      providerOrderId: newProviderOrderId(`RACE-${randomUUID().slice(0, 6)}`),
      items: [
        { item_type: 'TICKET_PURCHASE', ticket_id: F.tGeneral.id },
        { item_type: 'SCHEDULE_BOOKING', schedule_id: sRace.id, use_purchase_index: 0 },
      ],
    });

  const results = await Promise.allSettled([mk(STUDENT_ID), mk(OTHER_ID)]);
  const ok = results.filter((r) => r.status === 'fulfilled');
  const failed = results.filter((r) => r.status === 'rejected');

  expect(ok).toHaveLength(1);
  expect(failed).toHaveLength(1);
  // 진 쪽은 "정원 마감"으로 거절된다
  const err = parseOrderError((failed[0] as PromiseRejectedResult).reason);
  expect(err.code).toBe('ORDER_ITEM_REJECTED');
  expect(err.itemCode).toBe('SCHEDULE_FULL');

  // 좌석을 점유한 예약은 하나뿐
  const { data: holds } = await svc.from('bookings').select('id')
    .eq('schedule_id', sRace.id).eq('status', 'PENDING');
  expect(holds).toHaveLength(1);
});

// ===========================================================================
// AC7. 더블클릭 멱등 — 같은 provider_order_id 는 주문 하나
// ===========================================================================

test('AC7 같은 provider_order_id 로 두 번 제출해도 주문은 하나', async () => {
  const poid = newProviderOrderId('DBL');
  const items: OrderItemInput[] = [{ item_type: 'TICKET_PURCHASE', ticket_id: F.tGeneral.id }];

  const [a, b] = await Promise.all([
    composeOrder(svc, { academyId: F.academy.id, method: 'BANK', items, userId: STUDENT_ID, providerOrderId: poid }),
    composeOrder(svc, { academyId: F.academy.id, method: 'BANK', items, userId: STUDENT_ID, providerOrderId: poid }),
  ]);

  expect(a.order_group_id).toBe(b.order_group_id);
  expect([a.idempotent, b.idempotent].filter(Boolean)).toHaveLength(1); // 하나만 재사용 응답

  const { data: rows } = await svc.from('order_groups').select('id').eq('provider_order_id', poid);
  expect(rows).toHaveLength(1);

  // 순차 재제출도 동일 (멱등)
  const c = await composeOrder(svc, {
    academyId: F.academy.id, method: 'BANK', items, userId: STUDENT_ID, providerOrderId: poid,
  });
  expect(c.order_group_id).toBe(a.order_group_id);
  expect(c.idempotent).toBe(true);
});

// ===========================================================================
// AC8. 홀드 만료 크론
// ===========================================================================

test('AC8-1 만료된 BANK 주문 → EXPIRED + 홀드 CANCELLED + 좌석 재개방', async () => {
  const order = F.holdOrder;
  const holdId = order.hold_booking_ids[0];

  // 24시간이 지난 상태로 만든다
  const past = new Date(Date.now() - 60_000).toISOString();
  await svc.from('order_groups').update({ expires_at: past }).eq('id', order.order_group_id);
  await svc.from('bookings').update({ hold_expires_at: past }).eq('id', holdId);

  const { data, error } = await svc.rpc('expire_pending_bank_orders');
  expect(error).toBeNull();
  expect(data.expired_orders).toBeGreaterThanOrEqual(1);

  const og = (await svc.from('order_groups').select('status').eq('id', order.order_group_id).single()).data;
  expect(og.status).toBe('EXPIRED');

  const hold = (await svc.from('bookings').select('status, hold_expires_at').eq('id', holdId).single()).data;
  expect(hold.status).toBe('CANCELLED'); // 프로젝트 표기: L 두 개
  expect(hold.hold_expires_at).toBeNull();

  // 좌석이 다시 열렸다
  const other = await previewOrder(svc, {
    academyId: F.academy.id, userId: OTHER_ID,
    items: [{ item_type: 'SCHEDULE_BOOKING', schedule_id: F.sHold.id }],
  });
  expect(codeAt(other, 0)).not.toBe('SCHEDULE_FULL');
});

test('AC8-2 크론을 두 번 돌려도 아무 일도 더 일어나지 않는다 (idempotent)', async () => {
  const { data } = await svc.rpc('expire_pending_bank_orders');
  expect(data.expired_orders).toBe(0);
  expect(data.released_holds).toBe(0);
});

test('AC8-3 이미 CONFIRMED 된 주문은 만료 스윕이 건드리지 않는다', async () => {
  const sKeep = await ins('schedules', {
    class_id: F.cNormal.id, ...nextDaySlot(),
    max_students: 5, is_canceled: false,
  });

  const order = await composeOrder(svc, {
    academyId: F.academy.id, method: 'BANK', userId: STUDENT_ID,
    items: [
      { item_type: 'TICKET_PURCHASE', ticket_id: F.tGeneral.id },
      { item_type: 'SCHEDULE_BOOKING', schedule_id: sKeep.id, use_purchase_index: 0 },
    ],
  });
  const holdId = order.hold_booking_ids![0];

  // 입금 확인이 이미 끝난 주문인데 expires_at 은 지난 상태 (경합 상황)
  const past = new Date(Date.now() - 60_000).toISOString();
  await svc.from('order_groups')
    .update({ status: 'CONFIRMED', expires_at: past, confirmed_at: new Date().toISOString() })
    .eq('id', order.order_group_id);

  const { data } = await svc.rpc('expire_pending_bank_orders');
  expect(data.expired_orders).toBe(0);

  const og = (await svc.from('order_groups').select('status').eq('id', order.order_group_id).single()).data;
  expect(og.status).toBe('CONFIRMED'); // 만료로 뒤집히지 않았다

  const hold = (await svc.from('bookings').select('status').eq('id', holdId).single()).data;
  expect(hold.status).toBe('PENDING'); // 좌석도 그대로 유지
});

// ===========================================================================
// AC9. 멤버십 할인 스냅샷
// ===========================================================================

test('AC9 멤버십 할인이 멤버십 id + percent 와 함께 스냅샷된다', async () => {
  await ins('student_memberships', {
    academy_id: F.academy.id, user_id: STUDENT_ID, membership_id: F.mVip.id,
    status: 'ACTIVE', start_date: '2020-01-01', end_date: null,
  });

  const order = await composeOrder(svc, {
    academyId: F.academy.id, method: 'BANK', userId: STUDENT_ID,
    items: [{ item_type: 'TICKET_PURCHASE', ticket_id: F.tGeneral.id }],
  });

  const item = (await svc.from('order_items').select('*')
    .eq('order_group_id', order.order_group_id).single()).data;

  expect(item.original_amount).toBe(50000);
  expect(item.discount_percent).toBe(20);
  expect(item.discount_membership_id).toBe(F.mVip.id);
  expect(item.discount_amount).toBe(10000);
  expect(item.final_amount).toBe(40000);

  const og = (await svc.from('order_groups').select('*').eq('id', order.order_group_id).single()).data;
  expect(og.original_amount).toBe(50000);
  expect(og.discount_amount).toBe(10000);
  expect(og.total_amount).toBe(40000); // CHECK: total = original - discount

  // 멤버가 되었으니 멤버 전용 수업도 열린다 (자격 판정이 같은 정본을 쓴다는 증거)
  const aud = await preflight([{ item_type: 'SCHEDULE_BOOKING', schedule_id: F.sAudience.id }]);
  expect(codeAt(aud, 0)).not.toBe('AUDIENCE_NOT_ELIGIBLE');
});

// ===========================================================================
// AC10. 사서 바로 쓰기 — 예약 항목이 구매 항목에 연결된다
// ===========================================================================

test('AC10 구매+즉시사용 주문의 예약 항목은 source_purchase_item_id 로 연결된다', async () => {
  const sUse = await ins('schedules', {
    class_id: F.cNormal.id, ...nextDaySlot(),
    max_students: 5, is_canceled: false,
  });

  const order = await composeOrder(svc, {
    academyId: F.academy.id, method: 'BANK', userId: STUDENT_ID,
    items: [
      { item_type: 'TICKET_PURCHASE', ticket_id: F.tGeneral.id },
      { item_type: 'SCHEDULE_BOOKING', schedule_id: sUse.id, use_purchase_index: 0 },
    ],
  });

  const { data: rows } = await svc.from('order_items').select('*')
    .eq('order_group_id', order.order_group_id);

  const purchase = rows.find((r: any) => r.item_type === 'TICKET_PURCHASE');
  const booking = rows.find((r: any) => r.item_type === 'SCHEDULE_BOOKING');

  expect(purchase).toBeTruthy();
  expect(booking).toBeTruthy();
  expect(booking.source_purchase_item_id).toBe(purchase.id);
  expect(booking.result_booking_id).toBeTruthy(); // 홀드 예약과도 연결
  expect(booking.final_amount).toBe(0);           // 금액은 구매 항목에서만 발생

  // 방금 만든 홀드는 "이미 예약함"으로 잡힌다 (홀드가 실제 좌석 점유라는 또 하나의 증거)
  const again = await preflight([{ item_type: 'SCHEDULE_BOOKING', schedule_id: sUse.id }]);
  expect(codeAt(again, 0)).toBe('DUPLICATE_BOOKING');

  // 존재하지 않는 구매 항목을 가리키는 연결은 거절된다
  const sFresh = await ins('schedules', {
    class_id: F.cNormal.id, ...nextDaySlot(),
    max_students: 5, is_canceled: false,
  });
  const bad = await preflight([
    { item_type: 'SCHEDULE_BOOKING', schedule_id: sFresh.id, use_purchase_index: 0 },
  ]);
  expect(codeAt(bad, 0)).toBe('INVALID_PURCHASE_LINK');

  // 자기 자신을 가리키는 연결도 거절
  const selfRef = await preflight([
    { item_type: 'SCHEDULE_BOOKING', schedule_id: sFresh.id, use_purchase_index: 0 },
    { item_type: 'TICKET_PURCHASE', ticket_id: F.tGeneral.id },
  ]);
  expect(codeAt(selfRef, 0)).toBe('INVALID_PURCHASE_LINK');
});
