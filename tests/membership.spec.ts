/**
 * T3 멤버십 도메인 검증 (순수 모듈 + 라이브 DB 트랜잭션 + 관리자 API)
 *
 * 실행: npx playwright test tests/membership.spec.ts
 *
 * 픽스처는 전용 테스트 학원(slug: t3-membership-*) 안에서만 만들고 끝나면 지운다.
 * 실제 MID 학원(slug: mid) 데이터는 절대 건드리지 않는다.
 */
import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

import { kstToday, addDays, inclusiveExpiry } from '../lib/date/kst';
import { resolveDiscount, type LegacyDiscountRow } from '../lib/membership/discount';
import { isMembershipActiveOn, canAccessMembershipClass } from '../lib/membership/eligibility';
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
const svc = createClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
}) as any;

const STUDENT_ID = 'fd2fd033-2f2c-4cad-890b-f2c9c75a0f23'; // e2e-moveit-student@modoogoods.com
const OTHER_ID = '6e33f238-14c6-41d7-9715-d131067b6885'; // e2e-moveit-owner@modoogoods.com
const STUDENT_EMAIL = 'e2e-moveit-student@modoogoods.com';
const E2E_PASSWORD = 'Test1234!e2e';

const F: Record<string, any> = {};
const academyIds: string[] = [];

async function ins(table: string, row: Record<string, any>) {
  const { data, error } = await svc.from(table).insert(row).select().single();
  if (error) throw new Error(`${table} insert 실패: ${error.message}`);
  return data;
}

async function mkAcademy(tag: string) {
  const a = await ins('academies', {
    name_kr: `T3멤버십테스트-${tag}`,
    slug: `t3-membership-${tag}`,
    is_active: true,
    booking_policy: { open: null, close: { minutesBefore: 0 }, cancelUntil: { minutesBefore: 0 } },
  });
  academyIds.push(a.id);
  return a;
}

function isoInHours(h: number) {
  return new Date(Date.now() + h * 3600_000).toISOString();
}

function rejectedWith(res: any, code: string) {
  return !!res.error && String(res.error.message || '').includes(code);
}

async function grant(academyId: string, userId: string, membershipId: string, extra: Record<string, any> = {}) {
  return svc.rpc('grant_student_membership', {
    p_academy_id: academyId,
    p_user_id: userId,
    p_membership_id: membershipId,
    p_start_date: null,
    p_end_date: null,
    p_note: null,
    p_remaining_count: null,
    ...extra,
  });
}

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  const stamp = randomUUID().slice(0, 8);

  // ===== AC1: 부여 / 할인 / 자격 / 정지·재개 =====
  F.ac1 = await mkAcademy(`main-${stamp}`);
  F.group1 = await ins('class_groups', {
    academy_id: F.ac1.id, key: 'normal', name: '정규', is_special: false,
  });
  F.tBundle = await ins('tickets', {
    academy_id: F.ac1.id, name: 'VIP번들권', ticket_type: 'COUNT', total_count: 10,
    valid_days: 30, start_mode: 'IMMEDIATE', is_general: true, is_on_sale: false, is_public: false,
  });
  F.mVip = await ins('memberships', {
    academy_id: F.ac1.id, key: `vip-${stamp}`, name: 'VIP', visibility: 'hidden',
    is_active: true, bundled_ticket_id: F.tBundle.id,
  });
  // 할인 규칙: 10% / 25%(최고) / 5%(비활성) — 그룹 대상
  F.d10 = await ins('membership_discounts', {
    membership_id: F.mVip.id, class_group_id: F.group1.id, percent: 10, is_active: true,
  });
  F.d25 = await ins('membership_discounts', {
    membership_id: F.mVip.id, class_group_id: F.group1.id, percent: 25, is_active: true,
  });
  F.d5off = await ins('membership_discounts', {
    membership_id: F.mVip.id, class_group_id: F.group1.id, percent: 5, is_active: false,
  });

  F.classAud = await ins('classes', {
    academy_id: F.ac1.id, title: '멤버전용수업', class_group_id: F.group1.id,
    max_students: 10, is_active: true, audience_membership_id: F.mVip.id,
  });
  F.schedAud = await ins('schedules', {
    class_id: F.classAud.id, start_time: isoInHours(48), end_time: isoInHours(49),
    max_students: 10, is_canceled: false,
  });

  // ===== AC2: 원자성 (다른 학원 소속 번들권 → 실패) =====
  F.ac2 = await mkAcademy(`atomic-${stamp}`);
  F.acForeign = await mkAcademy(`foreign-${stamp}`);
  F.tForeign = await ins('tickets', {
    academy_id: F.acForeign.id, name: '외부학원권', ticket_type: 'COUNT', total_count: 5,
    is_on_sale: false, is_public: false,
  });
  F.mBad = await ins('memberships', {
    academy_id: F.ac2.id, key: `bad-${stamp}`, name: '잘못된번들', visibility: 'hidden',
    is_active: true, bundled_ticket_id: F.tForeign.id,
  });

  // ===== AC3: 만료 스윕 =====
  F.ac3 = await mkAcademy(`expiry-${stamp}`);
  F.tExpiryBundle = await ins('tickets', {
    academy_id: F.ac3.id, name: '만료테스트번들권', ticket_type: 'COUNT', total_count: 8,
    valid_days: 90, start_mode: 'IMMEDIATE', is_general: true, is_on_sale: false, is_public: false,
  });
  F.mExpiry = await ins('memberships', {
    academy_id: F.ac3.id, key: `exp-${stamp}`, name: '만료멤버십', visibility: 'hidden',
    is_active: true, bundled_ticket_id: F.tExpiryBundle.id,
  });

  // ===== AC4: 재개 충돌 =====
  F.ac4 = await mkAcademy(`resume-${stamp}`);
  F.mR1 = await ins('memberships', {
    academy_id: F.ac4.id, key: `r1-${stamp}`, name: '첫번째', visibility: 'hidden', is_active: true,
  });
  F.mR2 = await ins('memberships', {
    academy_id: F.ac4.id, key: `r2-${stamp}`, name: '두번째', visibility: 'hidden', is_active: true,
  });

  // ===== AC5: FIRST_BOOKING 시작모드 =====
  F.ac5 = await mkAcademy(`fb-${stamp}`);
  F.tFb = await ins('tickets', {
    academy_id: F.ac5.id, name: '최초예약개시번들권', ticket_type: 'COUNT', total_count: 4,
    valid_days: 30, start_mode: 'FIRST_BOOKING', is_general: true, is_on_sale: false, is_public: false,
  });
  F.mFb = await ins('memberships', {
    academy_id: F.ac5.id, key: `fb-${stamp}`, name: 'FB멤버십', visibility: 'hidden',
    is_active: true, bundled_ticket_id: F.tFb.id,
  });
});

test.afterAll(async () => {
  for (const aid of academyIds) {
    const classIds = ((await svc.from('classes').select('id').eq('academy_id', aid)).data || []).map((r: any) => r.id);
    const ticketIds = ((await svc.from('tickets').select('id').eq('academy_id', aid)).data || []).map((r: any) => r.id);
    const membershipIds = ((await svc.from('memberships').select('id').eq('academy_id', aid)).data || []).map((r: any) => r.id);

    if (classIds.length) await svc.from('bookings').delete().in('class_id', classIds);
    await svc.from('membership_review_actions').delete().eq('academy_id', aid);
    // 교차링크를 먼저 끊어야 user_tickets 를 지울 수 있다
    await svc.from('student_memberships').update({ bundled_user_ticket_id: null }).eq('academy_id', aid);
    if (ticketIds.length) {
      await svc.from('user_tickets').delete().in('ticket_id', ticketIds);
      await svc.from('ticket_coverage').delete().in('ticket_id', ticketIds);
      await svc.from('ticket_classes').delete().in('ticket_id', ticketIds);
    }
    await svc.from('student_memberships').delete().eq('academy_id', aid);
    if (membershipIds.length) {
      await svc.from('membership_discounts').delete().in('membership_id', membershipIds);
    }
    await svc.from('discounts').delete().eq('academy_id', aid);
    if (ticketIds.length) await svc.from('tickets').delete().in('id', ticketIds);
    if (classIds.length) await svc.from('schedules').delete().in('class_id', classIds);
    if (classIds.length) await svc.from('classes').delete().in('id', classIds);
    await svc.from('memberships').delete().eq('academy_id', aid);
    await svc.from('class_groups').delete().eq('academy_id', aid);
    await svc.from('academies').delete().eq('id', aid);
  }
});

// =========================================================================
// A. 순수 규칙
// =========================================================================

test('A1 SUSPENDED/EXPIRED 는 어떤 날짜에도 유효하지 않다', () => {
  const base = {
    id: 'x', academy_id: 'a', user_id: 'u', membership_id: 'm',
    start_date: '2026-01-01', end_date: null as string | null,
  };
  expect(isMembershipActiveOn({ ...base, status: 'ACTIVE' } as any, '2026-07-19')).toBe(true);
  expect(isMembershipActiveOn({ ...base, status: 'SUSPENDED' } as any, '2026-07-19')).toBe(false);
  expect(isMembershipActiveOn({ ...base, status: 'EXPIRED' } as any, '2026-07-19')).toBe(false);
  // 기간 밖
  expect(isMembershipActiveOn({ ...base, status: 'ACTIVE', end_date: '2026-06-30' } as any, '2026-07-19')).toBe(false);

  expect(canAccessMembershipClass([{ ...base, status: 'SUSPENDED' } as any], 'm', '2026-07-19')).toBe(false);
  expect(canAccessMembershipClass([{ ...base, status: 'ACTIVE' } as any], 'm', '2026-07-19')).toBe(true);
  expect(canAccessMembershipClass([], null, '2026-07-19')).toBe(true); // 제한 없는 수업
});

test('A2 할인은 최고 1건만 — 합산되지 않고, 비활성은 무시된다', () => {
  const target = { kind: 'class_group' as const, classGroupId: 'g1' };
  const rows = [
    { id: 'a', membership_id: 'm', class_group_id: 'g1', ticket_id: null, percent: 10, is_active: true },
    { id: 'b', membership_id: 'm', class_group_id: 'g1', ticket_id: null, percent: 25, is_active: true },
    { id: 'c', membership_id: 'm', class_group_id: 'g1', ticket_id: null, percent: 90, is_active: false },
    { id: 'd', membership_id: 'm', class_group_id: 'g2', ticket_id: null, percent: 80, is_active: true },
  ];
  const r = resolveDiscount({
    membershipStatus: 'ACTIVE', membershipId: 'm', membershipDiscounts: rows,
    legacyDiscounts: [], target, basePrice: 100000, today: '2026-07-19',
  });
  expect(r.source).toBe('MEMBERSHIP');
  expect(r.percent).toBe(25);           // 10+25 합산(35) 아님, 90(비활성) 아님, 80(다른 그룹) 아님
  expect(r.amount).toBe(25000);
  expect(r.membershipDiscountId).toBe('b');
  expect(r.reason).toContain('25%');
});

test('A3 SUSPENDED 멤버십은 할인을 주지 않는다', () => {
  const rows = [{ id: 'a', membership_id: 'm', class_group_id: 'g1', ticket_id: null, percent: 25, is_active: true }];
  for (const status of ['SUSPENDED', 'EXPIRED'] as const) {
    const r = resolveDiscount({
      membershipStatus: status, membershipId: 'm', membershipDiscounts: rows, legacyDiscounts: [],
      target: { kind: 'class_group', classGroupId: 'g1' }, basePrice: 100000, today: '2026-07-19',
    });
    expect(r.source).toBe('NONE');
    expect(r.amount).toBe(0);
  }
});

test('A4 레거시 discounts 와 중첩되지 않고 더 큰 쪽 하나만', () => {
  const target = { kind: 'class_group' as const, classGroupId: 'g1' };
  const mem = [{ id: 'a', membership_id: 'm', class_group_id: 'g1', ticket_id: null, percent: 20, is_active: true }];
  const bigLegacy: LegacyDiscountRow[] = [
    { id: 'L1', name: '여름할인', discount_type: 'FIXED', discount_value: 30000, is_active: true, valid_from: null, valid_until: null },
  ];
  const smallLegacy: LegacyDiscountRow[] = [
    { id: 'L2', name: '소액할인', discount_type: 'PERCENT', discount_value: 5, is_active: true, valid_from: null, valid_until: null },
  ];
  const common = { membershipStatus: 'ACTIVE' as const, membershipId: 'm', membershipDiscounts: mem, target, basePrice: 100000, today: '2026-07-19' };

  const a = resolveDiscount({ ...common, legacyDiscounts: bigLegacy });
  expect(a.source).toBe('LEGACY');
  expect(a.amount).toBe(30000);        // 20000 + 30000 = 50000 이 아니다

  const b = resolveDiscount({ ...common, legacyDiscounts: smallLegacy });
  expect(b.source).toBe('MEMBERSHIP');
  expect(b.amount).toBe(20000);        // 20000 + 5000 = 25000 이 아니다
});

// =========================================================================
// B. 원자적 부여
// =========================================================================

test('B1 부여는 번들 수강권을 함께 발급하고 양방향으로 교차링크한다', async () => {
  const res = await grant(F.ac1.id, STUDENT_ID, F.mVip.id);
  expect(res.error).toBeNull();
  expect(res.data.ok).toBe(true);
  F.sm1 = res.data.student_membership_id;
  F.ut1 = res.data.bundled_user_ticket_id;
  expect(F.ut1).toBeTruthy();

  // 방향 1: student_memberships.bundled_user_ticket_id → user_tickets
  const sm = (await svc.from('student_memberships').select('*').eq('id', F.sm1).single()).data;
  expect(sm.bundled_user_ticket_id).toBe(F.ut1);
  expect(sm.status).toBe('ACTIVE');

  // 방향 2: user_tickets.source_membership_id → memberships
  const ut = (await svc.from('user_tickets').select('*').eq('id', F.ut1).single()).data;
  expect(ut.source_membership_id).toBe(F.mVip.id);
  expect(ut.user_id).toBe(STUDENT_ID);
  expect(ut.ticket_id).toBe(F.tBundle.id);
  expect(ut.remaining_count).toBe(10);
  expect(ut.status).toBe('ACTIVE');

  // IMMEDIATE + valid_days=30 → 오늘 시작, inclusive 만료
  const today = kstToday();
  expect(ut.start_date).toBe(today);
  expect(ut.expiry_date).toBe(inclusiveExpiry(today, 30));
});

test('B2 원자성: 부여 도중 실패하면 멤버십도 수강권도 남지 않는다', async () => {
  const before = await svc.from('student_memberships').select('id').eq('academy_id', F.ac2.id);
  expect((before.data || []).length).toBe(0);

  // mBad 의 번들권은 다른 학원 소속 → 멤버십 행 INSERT 이후 단계에서 실패한다
  const res = await grant(F.ac2.id, STUDENT_ID, F.mBad.id);
  expect(rejectedWith(res, 'BUNDLED_TICKET_INVALID')).toBe(true);

  // 멤버십 행이 롤백되었는가 (한쪽만 남는 상태가 없어야 한다)
  const after = await svc.from('student_memberships').select('id').eq('academy_id', F.ac2.id);
  expect((after.data || []).length).toBe(0);

  // 수강권도 생기지 않았는가
  const uts = await svc.from('user_tickets').select('id').eq('source_membership_id', F.mBad.id);
  expect((uts.data || []).length).toBe(0);
});

test('B3 같은 학생+학원에 두 번째 ACTIVE 부여는 깔끔한 도메인 에러로 거절된다', async () => {
  const res = await grant(F.ac1.id, STUDENT_ID, F.mVip.id);
  expect(rejectedWith(res, 'ALREADY_ACTIVE_MEMBERSHIP')).toBe(true);
  // 인덱스 이름 같은 내부 구현이 새어나가지 않는다
  expect(String(res.error.message)).not.toContain('student_memberships_active_uniq');
});

test('B4 start_mode=FIRST_BOOKING 번들권은 날짜 없이 발급된다', async () => {
  const res = await grant(F.ac5.id, STUDENT_ID, F.mFb.id);
  expect(res.error).toBeNull();
  const ut = (await svc.from('user_tickets').select('*').eq('id', res.data.bundled_user_ticket_id).single()).data;
  expect(ut.start_date).toBeNull();
  expect(ut.expiry_date).toBeNull();
  expect(ut.source_membership_id).toBe(F.mFb.id);
});

// =========================================================================
// C. 할인 해석 (라이브 DB)
// =========================================================================

test('C1 ACTIVE 멤버십은 최고 percent 하나만 적용한다', async () => {
  const r = await resolveDiscountForStudent(svc, {
    academyId: F.ac1.id, userId: STUDENT_ID,
    target: { kind: 'class_group', classGroupId: F.group1.id },
    basePrice: 100000,
  });
  expect(r.source).toBe('MEMBERSHIP');
  expect(r.percent).toBe(25);
  expect(r.membershipDiscountId).toBe(F.d25.id);
  expect(r.membershipId).toBe(F.mVip.id);
});

test('C2 소프트 제거: 비활성화하면 적용이 멈추지만 행은 남는다', async () => {
  await svc.from('membership_discounts').update({ is_active: false }).eq('id', F.d25.id);

  const r = await resolveDiscountForStudent(svc, {
    academyId: F.ac1.id, userId: STUDENT_ID,
    target: { kind: 'class_group', classGroupId: F.group1.id },
    basePrice: 100000,
  });
  expect(r.percent).toBe(10);                       // 25% 는 더 이상 적용되지 않는다
  expect(r.membershipDiscountId).toBe(F.d10.id);

  // 행은 DELETE 되지 않고 그대로 남아 있다
  const row = (await svc.from('membership_discounts').select('*').eq('id', F.d25.id).single()).data;
  expect(row).toBeTruthy();
  expect(row.is_active).toBe(false);

  await svc.from('membership_discounts').update({ is_active: true }).eq('id', F.d25.id); // 복구
});

test('C3 레거시 discounts 와 중첩되지 않는다 (라이브)', async () => {
  const big = await ins('discounts', {
    academy_id: F.ac1.id, name: 'T3큰할인', discount_type: 'FIXED',
    discount_value: 40000, is_active: true,
  });

  const r = await resolveDiscountForStudent(svc, {
    academyId: F.ac1.id, userId: STUDENT_ID,
    target: { kind: 'class_group', classGroupId: F.group1.id },
    basePrice: 100000,
  });
  expect(r.source).toBe('LEGACY');
  expect(r.amount).toBe(40000);   // 25000 + 40000 = 65000 이 아니다
  expect(r.membershipDiscountId).toBeNull();

  await svc.from('discounts').delete().eq('id', big.id);
});

// =========================================================================
// D. 상태 전이 + 자격
// =========================================================================

test('D1 SUSPENDED 는 할인도 자격도 주지 않고, 재개하면 둘 다 복구된다', async () => {
  // --- 정지 ---
  const sus = await svc.rpc('suspend_student_membership', { p_student_membership_id: F.sm1, p_note: null });
  expect(sus.error).toBeNull();
  expect(sus.data.status).toBe('SUSPENDED');

  // 할인 없음
  const noDiscount = await resolveDiscountForStudent(svc, {
    academyId: F.ac1.id, userId: STUDENT_ID,
    target: { kind: 'class_group', classGroupId: F.group1.id }, basePrice: 100000,
  });
  expect(noDiscount.source).toBe('NONE');

  // 자격 없음 — 멤버십 전용 수업 예약 거절
  const eligible = await svc.rpc('has_active_membership', {
    p_user_id: STUDENT_ID, p_membership_id: F.mVip.id, p_on_date: null,
  });
  expect(eligible.data).toBe(false);

  const denied = await svc.rpc('create_booking_tx', {
    p_schedule_id: F.schedAud.id, p_user_ticket_id: F.ut1,
    p_order_item_id: null, p_user_id: STUDENT_ID,
  });
  expect(rejectedWith(denied, 'AUDIENCE_NOT_ELIGIBLE')).toBe(true);

  // 정지해도 번들 수강권은 회수되지 않는다
  const utDuring = (await svc.from('user_tickets').select('status').eq('id', F.ut1).single()).data;
  expect(utDuring.status).toBe('ACTIVE');

  // --- 재개 ---
  const res = await svc.rpc('resume_student_membership', { p_student_membership_id: F.sm1, p_note: null });
  expect(res.error).toBeNull();
  expect(res.data.status).toBe('ACTIVE');

  const backDiscount = await resolveDiscountForStudent(svc, {
    academyId: F.ac1.id, userId: STUDENT_ID,
    target: { kind: 'class_group', classGroupId: F.group1.id }, basePrice: 100000,
  });
  expect(backDiscount.source).toBe('MEMBERSHIP');
  expect(backDiscount.percent).toBe(25);

  const allowed = await svc.rpc('create_booking_tx', {
    p_schedule_id: F.schedAud.id, p_user_ticket_id: F.ut1,
    p_order_item_id: null, p_user_id: STUDENT_ID,
  });
  expect(allowed.error).toBeNull();
  expect(allowed.data.ok).toBe(true);
});

test('D2 다른 ACTIVE 멤버십이 있으면 재개는 거절된다', async () => {
  const g1 = await grant(F.ac4.id, STUDENT_ID, F.mR1.id);
  expect(g1.error).toBeNull();

  const sus = await svc.rpc('suspend_student_membership', {
    p_student_membership_id: g1.data.student_membership_id, p_note: null,
  });
  expect(sus.error).toBeNull();

  // 정지된 사이 두 번째 멤버십이 ACTIVE 로 부여됨
  const g2 = await grant(F.ac4.id, STUDENT_ID, F.mR2.id);
  expect(g2.error).toBeNull();

  const resume = await svc.rpc('resume_student_membership', {
    p_student_membership_id: g1.data.student_membership_id, p_note: null,
  });
  expect(rejectedWith(resume, 'ALREADY_ACTIVE_MEMBERSHIP')).toBe(true);

  // 첫 번째는 여전히 SUSPENDED 로 남아 있다
  const still = (await svc.from('student_memberships').select('status').eq('id', g1.data.student_membership_id).single()).data;
  expect(still.status).toBe('SUSPENDED');
});

test('D3 만료 cron: ACTIVE→EXPIRED 로 넘어가도 번들 수강권은 살아남는다', async () => {
  const start = addDays(kstToday(), -10);
  const end = addDays(kstToday(), -1); // 어제 종료
  const g = await grant(F.ac3.id, STUDENT_ID, F.mExpiry.id, { p_start_date: start, p_end_date: end });
  expect(g.error).toBeNull();
  const smId = g.data.student_membership_id;
  const utId = g.data.bundled_user_ticket_id;
  expect(utId).toBeTruthy();

  const utBefore = (await svc.from('user_tickets').select('*').eq('id', utId).single()).data;
  expect(utBefore.status).toBe('ACTIVE');

  const sweep = await svc.rpc('expire_student_memberships', { p_academy_id: F.ac3.id });
  expect(sweep.error).toBeNull();
  expect(sweep.data.expired).toBeGreaterThanOrEqual(1);

  const smAfter = (await svc.from('student_memberships').select('status').eq('id', smId).single()).data;
  expect(smAfter.status).toBe('EXPIRED');

  // 계약상 이미 부여된 혜택 — 수강권은 자기 만료일을 그대로 유지한다
  const utAfter = (await svc.from('user_tickets').select('*').eq('id', utId).single()).data;
  expect(utAfter.status).toBe('ACTIVE');
  expect(utAfter.expiry_date).toBe(utBefore.expiry_date);
  expect(utAfter.expiry_date).toBe(inclusiveExpiry(start, 90));
  expect(utAfter.remaining_count).toBe(8);

  // 멤버십이 만료돼도 할인/자격은 즉시 사라진다
  const elig = await svc.rpc('has_active_membership', {
    p_user_id: STUDENT_ID, p_membership_id: F.mExpiry.id, p_on_date: null,
  });
  expect(elig.data).toBe(false);
});

test('D4 만료 스윕은 멱등하다 (두 번 돌려도 추가 변경 없음)', async () => {
  const second = await svc.rpc('expire_student_memberships', { p_academy_id: F.ac3.id });
  expect(second.error).toBeNull();
  expect(second.data.expired).toBe(0);
});

// =========================================================================
// E. 만료 검토 큐
// =========================================================================

test('E1 만료 멤버십 + 멤버십 전용 수업의 미래 예약 = 검토 큐에 뜬다', async () => {
  // D1 에서 만든 예약이 살아 있는 상태에서 AC1 멤버십을 만료시킨다
  await svc.from('student_memberships')
    .update({ status: 'EXPIRED', end_date: addDays(kstToday(), -1) })
    .eq('id', F.sm1);

  const q = await svc.rpc('membership_expiry_review_queue', {
    p_academy_id: F.ac1.id, p_include_handled: false,
  });
  expect(q.error).toBeNull();
  const rows = q.data as any[];
  expect(rows.length).toBeGreaterThanOrEqual(1);

  const row = rows.find((r) => r.student_membership_id === F.sm1);
  expect(row).toBeTruthy();
  expect(row.user_id).toBe(STUDENT_ID);
  expect(row.class_id).toBe(F.classAud.id);
  expect(row.schedule_id).toBe(F.schedAud.id);
  expect(row.user_ticket_id).toBe(F.ut1);      // 어떤 수강권을 썼는지
  expect(row.ticket_name).toBe('VIP번들권');
  expect(row.last_action).toBeNull();

  // 처리 기록을 남길 수 있다 (누가/언제)
  const act = await ins('membership_review_actions', {
    academy_id: F.ac1.id, student_membership_id: F.sm1, booking_id: row.booking_id,
    action: 'RESOLVED', note: 'T3 테스트 처리', handled_by: OTHER_ID,
  });
  expect(act.handled_at).toBeTruthy();

  // 처리된 건은 기본 큐에서 빠진다
  const q2 = await svc.rpc('membership_expiry_review_queue', {
    p_academy_id: F.ac1.id, p_include_handled: false,
  });
  expect((q2.data as any[]).find((r) => r.student_membership_id === F.sm1)).toBeFalsy();

  const q3 = await svc.rpc('membership_expiry_review_queue', {
    p_academy_id: F.ac1.id, p_include_handled: true,
  });
  const handled = (q3.data as any[]).find((r) => r.student_membership_id === F.sm1);
  expect(handled.last_action).toBe('RESOLVED');
  expect(handled.last_handled_by).toBe(OTHER_ID);
});

// =========================================================================
// F. 권한 (스태프 전용)
// =========================================================================

test('F1 학생 JWT 는 멤버십 RPC 를 호출할 수 없다', async () => {
  const stu = createClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  }) as any;
  const auth = await stu.auth.signInWithPassword({ email: STUDENT_EMAIL, password: E2E_PASSWORD });
  expect(auth.error).toBeNull();
  F.studentToken = auth.data.session.access_token;

  const g = await stu.rpc('grant_student_membership', {
    p_academy_id: F.ac1.id, p_user_id: STUDENT_ID, p_membership_id: F.mVip.id,
    p_start_date: null, p_end_date: null, p_note: null, p_remaining_count: null,
  });
  expect(rejectedWith(g, 'NOT_ACADEMY_STAFF')).toBe(true);

  const s = await stu.rpc('suspend_student_membership', { p_student_membership_id: F.sm1, p_note: null });
  expect(s.error).not.toBeNull();

  const q = await stu.rpc('membership_expiry_review_queue', { p_academy_id: F.ac1.id, p_include_handled: false });
  expect(q.error).not.toBeNull();

  // 남의 자격을 훔쳐보는 것도 막힌다
  const peek = await stu.rpc('has_active_membership', {
    p_user_id: OTHER_ID, p_membership_id: F.mVip.id, p_on_date: null,
  });
  expect(rejectedWith(peek, 'NOT_AUTHORIZED')).toBe(true);

  // 본인 자격 조회는 허용
  const self = await stu.rpc('has_active_membership', {
    p_user_id: STUDENT_ID, p_membership_id: F.mVip.id, p_on_date: null,
  });
  expect(self.error).toBeNull();
});

test('F2 anon 은 멤버십 RPC 에 접근할 수 없다', async () => {
  const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  }) as any;

  for (const fn of ['grant_student_membership', 'suspend_student_membership',
                    'resume_student_membership', 'extend_student_membership',
                    'expire_student_memberships', 'membership_expiry_review_queue',
                    'has_active_membership']) {
    const res = await anon.rpc(fn, {});
    expect(res.error, `${fn} 은 anon 에게 열려 있으면 안 된다`).not.toBeNull();
  }
});

test('F3 관리자 API 는 학생 토큰을 거절한다', async ({ request }) => {
  const res = await request.post(`/api/academy-admin/${F.ac1.id}/memberships/students`, {
    headers: { Authorization: `Bearer ${F.studentToken}` },
    data: { user_id: STUDENT_ID, membership_id: F.mVip.id },
  });
  expect(res.status()).toBe(403);

  const list = await request.get(`/api/academy-admin/${F.ac1.id}/memberships`, {
    headers: { Authorization: `Bearer ${F.studentToken}` },
  });
  expect(list.status()).toBe(403);

  // 토큰 없이도 당연히 막힌다
  const anon = await request.get(`/api/academy-admin/${F.ac1.id}/memberships/review-queue`);
  expect([401, 403]).toContain(anon.status());
});
