/**
 * T2 예약 엔진 검증 (순수 모듈 + 라이브 DB 트랜잭션)
 *
 * 실행: npx playwright test tests/booking-engine.spec.ts
 *   (브라우저 불필요. PLAYWRIGHT_BASE_URL 을 주면 dev 서버도 안 띄운다.)
 *
 * 픽스처는 전용 테스트 학원(slug: t2-engine-test) 안에서만 만들고 끝나면 지운다.
 * 실제 MID 학원(slug: mid) 데이터는 절대 건드리지 않는다.
 */
import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

import {
  kstDateString,
  addDays,
  inclusiveExpiry,
  legacyExpiry,
  monthsExpiry,
} from '../lib/date/kst';
import { resolveBookingPolicy, evaluateBookingWindow } from '../lib/booking/policy';
import { evaluateCoverage } from '../lib/booking/coverage';
import { selectUserTicket, type SelectableUserTicket } from '../lib/booking/selection';

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

// --- 생성 추적(정리용) ---
const created: Array<{ table: string; id: string }> = [];
function track(table: string, id: string) {
  created.push({ table, id });
  return id;
}

const F: Record<string, any> = {};

function isoInHours(h: number) {
  return new Date(Date.now() + h * 3600_000).toISOString();
}

async function ins(table: string, row: Record<string, any>) {
  const { data, error } = await svc.from(table).insert(row).select().single();
  if (error) throw new Error(`${table} insert 실패: ${error.message}`);
  track(table, data.id);
  return data;
}

async function callCreate(scheduleId: string, userTicketId: string | null = null, userId = STUDENT_ID) {
  return svc.rpc('create_booking_tx', {
    p_schedule_id: scheduleId,
    p_user_ticket_id: userTicketId,
    p_order_item_id: null,
    p_user_id: userId,
  });
}

/** create_booking_tx 가 특정 코드로 거절했는지 */
function rejectedWith(res: any, code: string) {
  return !!res.error && String(res.error.message || '').includes(code);
}

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  const stamp = randomUUID().slice(0, 8);

  F.academy = await ins('academies', {
    name_kr: `T2엔진테스트-${stamp}`,
    slug: `t2-engine-test-${stamp}`,
    is_active: true,
    booking_policy: { open: null, close: { minutesBefore: 0 }, cancelUntil: { minutesBefore: 0 } },
  });

  F.groupNormal = await ins('class_groups', {
    academy_id: F.academy.id,
    key: 'normal',
    name: '정규',
    is_special: false,
  });
  F.groupSpecial = await ins('class_groups', {
    academy_id: F.academy.id,
    key: 'special',
    name: '스페셜',
    is_special: true,
  });

  F.membership = await ins('memberships', {
    academy_id: F.academy.id,
    key: `vip-${stamp}`,
    name: 'VIP',
    visibility: 'hidden',
    is_active: true,
  });

  const mkClass = (title: string, extra: Record<string, any> = {}) =>
    ins('classes', {
      academy_id: F.academy.id,
      title,
      class_group_id: F.groupNormal.id,
      max_students: 10,
      is_active: true,
      ...extra,
    });

  F.classNormal = await mkClass('정규수업');
  F.classNormal2 = await mkClass('정규수업2');
  F.classSpecial = await mkClass('스페셜수업', { class_group_id: F.groupSpecial.id });
  F.classNoGroup = await mkClass('그룹없는수업', { class_group_id: null });
  F.classAudience = await mkClass('멤버전용수업', { audience_membership_id: F.membership.id });
  F.classNotYetOpen = await mkClass('오픈전수업', {
    booking_policy: { open: { daysBefore: 1, time: '17:00' } },
  });
  F.classOpened = await mkClass('오픈된수업', {
    booking_policy: { open: { daysBefore: 30, time: '00:00' } },
  });
  F.classClosed = await mkClass('마감된수업', {
    booking_policy: { close: { minutesBefore: 60 } },
  });
  F.classCapacity = await mkClass('정원1수업', { max_students: 1 });
  F.classCancel = await mkClass('취소테스트수업', {
    booking_policy: { cancelUntil: { minutesBefore: 60 } },
  });
  F.classCancelLate = await mkClass('취소마감수업', {
    booking_policy: { cancelUntil: { minutesBefore: 600 } },
  });
  // schedules 에 (class, KST date) 유니크 제약이 있어 예약 테스트마다 전용 수업을 쓴다
  F.classExpiry = await mkClass('만료테스트수업');
  F.classFirstBooking = await mkClass('최초개시수업');
  F.classDup = await mkClass('중복예약수업');

  const mkSched = (klass: any, hoursAhead: number, max = 10) =>
    ins('schedules', {
      class_id: klass.id,
      start_time: isoInHours(hoursAhead),
      end_time: isoInHours(hoursAhead + 1),
      max_students: max,
      is_canceled: false,
    });

  F.schedNormal = await mkSched(F.classNormal, 48);
  F.schedNormal2 = await mkSched(F.classNormal2, 49);
  F.schedSpecial = await mkSched(F.classSpecial, 50);
  F.schedNoGroup = await mkSched(F.classNoGroup, 51);
  F.schedAudience = await mkSched(F.classAudience, 52);
  F.schedNotYetOpen = await mkSched(F.classNotYetOpen, 24 * 10); // 오픈은 수업 1일 전 → 아직
  F.schedOpened = await mkSched(F.classOpened, 48); // 오픈은 수업 30일 전 → 이미 열림
  F.schedClosed = await mkSched(F.classClosed, 0.25); // 15분 후 시작, 마감은 60분 전 → 이미 마감
  F.schedCapacity = await mkSched(F.classCapacity, 48, 1);
  F.schedCancel = await mkSched(F.classCancel, 48);
  F.schedCancelLate = await mkSched(F.classCancelLate, 2); // 2시간 후 시작, 취소마감 10시간 전 → 지남
  F.schedExpiry = await mkSched(F.classExpiry, 48);
  F.schedFirstBooking = await mkSched(F.classFirstBooking, 72);
  F.schedDup = await mkSched(F.classDup, 48);

  // --- 수강권 ---
  const mkTicket = (name: string, extra: Record<string, any> = {}) =>
    ins('tickets', {
      academy_id: F.academy.id,
      name,
      ticket_type: 'COUNT',
      is_general: true,
      is_on_sale: false,
      is_public: false,
      ...extra,
    });

  F.tAllPass = await mkTicket('올패스기간권', { ticket_type: 'PERIOD', is_general: true });
  F.tSpecialCover = await mkTicket('스페셜커버권', { ticket_type: 'COUNT', is_general: false });
  await ins('ticket_coverage', {
    ticket_id: F.tSpecialCover.id,
    class_group_id: F.groupSpecial.id,
    is_active: true,
  });
  F.tCountSoon = await mkTicket('횟수권-임박', { ticket_type: 'COUNT' });
  F.tCountLate = await mkTicket('횟수권-여유', { ticket_type: 'COUNT' });
  F.tFixed = await mkTicket('고정수업권', { ticket_type: 'COUNT' });
  F.tFirstBooking = await mkTicket('최초예약개시권', {
    ticket_type: 'COUNT',
    start_mode: 'FIRST_BOOKING',
    valid_days: 30,
  });
  F.tExpiry = await mkTicket('만료테스트권', { ticket_type: 'COUNT' });
  F.tCancel = await mkTicket('취소테스트권', { ticket_type: 'COUNT' });
});

test.afterAll(async () => {
  // 이 테스트가 만든 학원 범위 전체를 의존성 역순으로 삭제한다.
  // (id 추적만으로는 beforeAll 이 중간에 실패했을 때 잔여가 남는다)
  const aid = F.academy?.id;
  if (!aid) return;

  const classIds = ((await svc.from('classes').select('id').eq('academy_id', aid)).data || []).map(
    (r: any) => r.id
  );
  const ticketIds = ((await svc.from('tickets').select('id').eq('academy_id', aid)).data || []).map(
    (r: any) => r.id
  );
  const membershipIds = (
    (await svc.from('memberships').select('id').eq('academy_id', aid)).data || []
  ).map((r: any) => r.id);

  if (classIds.length) await svc.from('bookings').delete().in('class_id', classIds);
  if (ticketIds.length) {
    await svc.from('user_tickets').delete().in('ticket_id', ticketIds);
    await svc.from('ticket_coverage').delete().in('ticket_id', ticketIds);
    await svc.from('ticket_classes').delete().in('ticket_id', ticketIds);
  }
  await svc.from('student_memberships').delete().eq('academy_id', aid);
  if (membershipIds.length) {
    await svc.from('membership_discounts').delete().in('membership_id', membershipIds);
  }
  if (ticketIds.length) await svc.from('tickets').delete().in('id', ticketIds);
  if (classIds.length) await svc.from('schedules').delete().in('class_id', classIds);
  if (classIds.length) await svc.from('classes').delete().in('id', classIds);
  await svc.from('memberships').delete().eq('academy_id', aid);
  await svc.from('class_groups').delete().eq('academy_id', aid);
  await svc.from('academies').delete().eq('id', aid);
});

async function grantTicket(ticket: any, over: Record<string, any> = {}, userId = STUDENT_ID) {
  const today = kstDateString(new Date());
  return ins('user_tickets', {
    user_id: userId,
    ticket_id: ticket.id,
    remaining_count: 10,
    start_date: addDays(today, -1),
    expiry_date: addDays(today, 60),
    status: 'ACTIVE',
    ...over,
  });
}

// =========================================================================
// A. 순수 모듈 (DB 없음)
// =========================================================================

test('A1 KST 날짜/만료 규칙', () => {
  // 신규 규칙은 시작일 포함
  expect(inclusiveExpiry('2026-01-01', 1)).toBe('2026-01-01');
  expect(inclusiveExpiry('2026-01-01', 30)).toBe('2026-01-30');
  // 레거시(운영 DB 저장값) 규칙은 시작일 미포함
  expect(legacyExpiry('2026-01-01', 30)).toBe('2026-01-31');
  // 달력 개월 + 말일 clamp
  expect(monthsExpiry('2026-01-15', 1)).toBe('2026-02-14');
  expect(monthsExpiry('2026-01-31', 1)).toBe('2026-02-27');
  // KST 경계: UTC 로는 전날인 시각이 KST 로는 다음날
  expect(kstDateString('2026-03-01T15:30:00Z')).toBe('2026-03-02');
  expect(kstDateString('2026-03-01T14:30:00Z')).toBe('2026-03-01');
});

test('A2 booking_policy 는 필드 단위로 병합된다', () => {
  const p = resolveBookingPolicy(
    { open: { daysBefore: 3, time: '10:00' }, close: { minutesBefore: 30 }, cancelUntil: { minutesBefore: 120 } },
    { open: { daysBefore: 1, time: '17:00' } } // open 만 오버라이드
  );
  expect(p.open).toEqual({ daysBefore: 1, time: '17:00' });
  expect(p.close.minutesBefore).toBe(30); // 학원값 유지
  expect(p.cancelUntil.minutesBefore).toBe(120); // 학원값 유지
  // 명시적 null = 항상 열림
  expect(resolveBookingPolicy({ open: { daysBefore: 1, time: '10:00' } }, { open: null }).open).toBeNull();
});

test('A3 예약 창(open/close) 판정', () => {
  const start = new Date('2026-05-10T02:00:00Z'); // KST 5/10 11:00
  const policy = resolveBookingPolicy(null, {
    open: { daysBefore: 1, time: '17:00' },
    close: { minutesBefore: 30 },
  });
  // 오픈: KST 5/9 17:00 = UTC 5/9 08:00
  expect(evaluateBookingWindow(start, policy, new Date('2026-05-09T07:59:00Z'))).toBe('NOT_YET_OPEN');
  expect(evaluateBookingWindow(start, policy, new Date('2026-05-09T08:01:00Z'))).toBe('OPEN');
  // 마감: 시작 30분 전 = UTC 01:30
  expect(evaluateBookingWindow(start, policy, new Date('2026-05-10T01:31:00Z'))).toBe('CLOSED');
});

test('A4 커버리지 우선순위 체인', () => {
  const normal = { id: 'c1', academyId: 'a1', classGroupId: 'g1', groupIsSpecial: false };
  const special = { id: 'c2', academyId: 'a1', classGroupId: 'g2', groupIsSpecial: true };
  const base = { id: 't1', academyId: 'a1', isGeneral: true, classId: null, mappedClassIds: [], coveredClassGroupIds: [] };

  // ③ 레거시: 일반권은 정규수업 커버, 스페셜은 절대 불가
  expect(evaluateCoverage(base, normal).covered).toBe(true);
  expect(evaluateCoverage(base, special).covered).toBe(false);
  expect(evaluateCoverage(base, special).reason).toBe('SPECIAL_CLASS_REQUIRES_EXPLICIT_COVERAGE');

  // ② ticket_coverage 가 있으면 그 계층이 결론 (일반권이어도 그룹 밖이면 탈락)
  const withCov = { ...base, coveredClassGroupIds: ['g2'] };
  expect(evaluateCoverage(withCov, special).covered).toBe(true);
  expect(evaluateCoverage(withCov, normal).covered).toBe(false);

  // ① ticket_classes 가 있으면 최우선
  const withMap = { ...base, mappedClassIds: ['c2'], coveredClassGroupIds: ['g1'] };
  expect(evaluateCoverage(withMap, special).covered).toBe(true);
  expect(evaluateCoverage(withMap, normal).covered).toBe(false);

  // 그룹 미지정 수업은 어떤 권으로도 불가
  expect(evaluateCoverage(base, { ...normal, classGroupId: null }).covered).toBe(false);
});

test('A5 선택 우선순위: PERIOD > COUNT, COUNT 는 만료 임박 순', () => {
  const klass = { id: 'c1', academyId: 'a1', classGroupId: 'g1', groupIsSpecial: false };
  const tk = (over: Partial<SelectableUserTicket>): SelectableUserTicket => ({
    id: 'x', status: 'ACTIVE', remainingCount: 5, startDate: '2026-01-01', expiryDate: '2026-12-31',
    fixedClassId: null, startMode: 'IMMEDIATE', ticketType: 'COUNT',
    ticket: { id: 'tk', academyId: 'a1', isGeneral: true, classId: null, mappedClassIds: [], coveredClassGroupIds: [] },
    ...over,
  });
  const period = tk({ id: 'p1', ticketType: 'PERIOD', remainingCount: null });
  const soon = tk({ id: 'c-soon', expiryDate: '2026-02-01' });
  const late = tk({ id: 'c-late', expiryDate: '2026-11-01' });

  const withPeriod = selectUserTicket({ candidates: [soon, period, late], klass, classDate: '2026-01-15' });
  expect(withPeriod.selected?.id).toBe('p1');
  expect(withPeriod.via).toBe('PERIOD');

  const countsOnly = selectUserTicket({ candidates: [late, soon], klass, classDate: '2026-01-15' });
  expect(countsOnly.selected?.id).toBe('c-soon');

  // ④ 고정 수업권은 다른 수업에서 탈락
  const fixed = tk({ id: 'f1', fixedClassId: 'OTHER' });
  expect(selectUserTicket({ candidates: [fixed], klass, classDate: '2026-01-15' }).selected).toBeNull();

  // ① 지정권은 대체 없이 그것만
  const designated = selectUserTicket({
    candidates: [soon, period], klass, classDate: '2026-01-15', designatedUserTicketId: 'c-soon',
  });
  expect(designated.selected?.id).toBe('c-soon');
  expect(designated.via).toBe('DESIGNATED');
});

// =========================================================================
// B. DB 트랜잭션 (create_booking_tx / cancel_booking_tx)
// =========================================================================

test('B1 스페셜 수업: 올패스 기간권 거절 / 그룹 커버권 승인', async () => {
  const allpass = await grantTicket(F.tAllPass, { remaining_count: null });
  const rejected = await callCreate(F.schedSpecial.id, allpass.id);
  expect(rejectedWith(rejected, 'SPECIAL_CLASS_NOT_COVERED')).toBe(true);

  const cover = await grantTicket(F.tSpecialCover);
  const accepted = await callCreate(F.schedSpecial.id, cover.id);
  expect(accepted.error).toBeNull();
  expect(accepted.data.ok).toBe(true);
  track('bookings', accepted.data.booking_id);
});

test('B2 class_group_id 가 NULL 인 수업은 예약 불가', async () => {
  const t = await grantTicket(F.tAllPass, { remaining_count: null });
  const res = await callCreate(F.schedNoGroup.id, t.id);
  expect(rejectedWith(res, 'CLASS_NOT_BOOKABLE')).toBe(true);
});

test('B3 audience 제한 수업: 비회원 거절 / 멤버 승인', async () => {
  const t = await grantTicket(F.tAllPass, { remaining_count: null });
  const rejected = await callCreate(F.schedAudience.id, t.id);
  expect(rejectedWith(rejected, 'AUDIENCE_NOT_ELIGIBLE')).toBe(true);

  await ins('student_memberships', {
    academy_id: F.academy.id,
    user_id: STUDENT_ID,
    membership_id: F.membership.id,
    status: 'ACTIVE',
    start_date: addDays(kstDateString(new Date()), -1),
  });
  const accepted = await callCreate(F.schedAudience.id, t.id);
  expect(accepted.error).toBeNull();
  track('bookings', accepted.data.booking_id);
});

test('B4 오픈 전 거절 / 오픈 후 승인 / 마감 후 거절', async () => {
  const t1 = await grantTicket(F.tAllPass, { remaining_count: null });
  expect(rejectedWith(await callCreate(F.schedNotYetOpen.id, t1.id), 'BOOKING_NOT_YET_OPEN')).toBe(true);

  const opened = await callCreate(F.schedOpened.id, t1.id);
  expect(opened.error).toBeNull();
  track('bookings', opened.data.booking_id);

  expect(rejectedWith(await callCreate(F.schedClosed.id, t1.id), 'BOOKING_CLOSED')).toBe(true);
});

test('B5 유효기간은 수업일 기준: 만료일 당일 승인 / 만료+1일 거절', async () => {
  const classDate = kstDateString(F.schedExpiry.start_time);

  const exact = await grantTicket(F.tExpiry, { expiry_date: classDate });
  const ok = await callCreate(F.schedExpiry.id, exact.id);
  expect(ok.error).toBeNull();
  track('bookings', ok.data.booking_id);
  await svc.from('bookings').delete().eq('id', ok.data.booking_id); // 중복예약 방지

  const past = await grantTicket(F.tExpiry, { expiry_date: addDays(classDate, -1) });
  expect(rejectedWith(await callCreate(F.schedExpiry.id, past.id), 'TICKET_EXPIRED')).toBe(true);
});

test('B6 FIRST_BOOKING: 최초 예약에 개시되고, 취소해도 되돌아가지 않는다', async () => {
  const ut = await grantTicket(F.tFirstBooking, { start_date: null, expiry_date: null });

  const before = await svc.from('user_tickets').select('start_date, expiry_date').eq('id', ut.id).single();
  expect(before.data.start_date).toBeNull();
  expect(before.data.expiry_date).toBeNull();

  const res = await callCreate(F.schedFirstBooking.id, ut.id);
  expect(res.error).toBeNull();
  track('bookings', res.data.booking_id);

  const classDate = kstDateString(F.schedFirstBooking.start_time);
  const after = await svc.from('user_tickets').select('start_date, expiry_date').eq('id', ut.id).single();
  expect(after.data.start_date).toBe(classDate);
  expect(after.data.expiry_date).toBe(inclusiveExpiry(classDate, 30)); // valid_days=30, 당일 포함

  // 취소해도 개시 상태는 유지
  await svc.rpc('cancel_booking_tx', { p_booking_id: res.data.booking_id });
  const afterCancel = await svc.from('user_tickets').select('start_date, expiry_date').eq('id', ut.id).single();
  expect(afterCancel.data.start_date).toBe(classDate);
  expect(afterCancel.data.expiry_date).toBe(after.data.expiry_date);
});

test('B7 자동 선택: PERIOD 우선 (횟수를 태우지 않는다) / COUNT 는 만료 임박 순', async () => {
  const today = kstDateString(new Date());
  // 앞선 테스트가 발급한 수강권을 모두 비활성화해 후보군을 이 테스트가 통제한다
  const priorIds = created.filter((c) => c.table === 'user_tickets').map((c) => c.id);
  if (priorIds.length) await svc.from('user_tickets').update({ status: 'USED' }).in('id', priorIds);

  const period = await grantTicket(F.tAllPass, { remaining_count: null });
  const soon = await grantTicket(F.tCountSoon, { remaining_count: 5, expiry_date: addDays(today, 3) });
  const late = await grantTicket(F.tCountLate, { remaining_count: 5, expiry_date: addDays(today, 40) });

  // 지정 없이 호출 → PERIOD 선택, 횟수권은 차감되지 않아야 한다
  const res = await callCreate(F.schedNormal.id, null);
  expect(res.error).toBeNull();
  expect(res.data.user_ticket_id).toBe(period.id);
  expect(res.data.deducted).toBe(false);
  track('bookings', res.data.booking_id);

  const soonAfter = await svc.from('user_tickets').select('remaining_count').eq('id', soon.id).single();
  expect(soonAfter.data.remaining_count).toBe(5); // 안 태움

  // PERIOD 를 비활성화하면 COUNT 중 만료 임박한 것이 선택된다
  await svc.from('user_tickets').update({ status: 'USED' }).eq('id', period.id);
  const res2 = await callCreate(F.schedNormal2.id, null);
  expect(res2.error).toBeNull();
  expect(res2.data.user_ticket_id).toBe(soon.id);
  expect(res2.data.deducted).toBe(true);
  track('bookings', res2.data.booking_id);
  void late;
});

test('B8 고정 수업권은 다른 수업에서 거절된다', async () => {
  const ut = await grantTicket(F.tFixed, { fixed_class_id: F.classNormal.id });
  const res = await callCreate(F.schedNormal2.id, ut.id);
  expect(rejectedWith(res, 'FIXED_CLASS_MISMATCH')).toBe(true);
});

test('B9 정원: 살아있는 PENDING 홀드는 세고, 만료된 홀드는 무시한다', async () => {
  const hold = await ins('bookings', {
    user_id: OTHER_ID,
    class_id: F.classCapacity.id,
    schedule_id: F.schedCapacity.id,
    status: 'PENDING',
    hold_expires_at: isoInHours(1), // 살아있는 홀드
  });

  const t = await grantTicket(F.tAllPass, { remaining_count: null });
  expect(rejectedWith(await callCreate(F.schedCapacity.id, t.id), 'SCHEDULE_FULL')).toBe(true);

  // 홀드 만료 → 좌석이 풀린다
  await svc.from('bookings').update({ hold_expires_at: isoInHours(-1) }).eq('id', hold.id);
  const ok = await callCreate(F.schedCapacity.id, t.id);
  expect(ok.error).toBeNull();
  track('bookings', ok.data.booking_id);
});

test('B10 취소: 마감 이내면 정확히 1회만 복구, 마감 이후면 복구 없음', async () => {
  // (a) 마감 이내 — 두 번 호출해도 복구는 1회
  const ut = await grantTicket(F.tCancel, { remaining_count: 5 });
  const booked = await callCreate(F.schedCancel.id, ut.id);
  expect(booked.error).toBeNull();
  track('bookings', booked.data.booking_id);

  const afterBook = await svc.from('user_tickets').select('remaining_count').eq('id', ut.id).single();
  expect(afterBook.data.remaining_count).toBe(4);

  const c1 = await svc.rpc('cancel_booking_tx', { p_booking_id: booked.data.booking_id });
  expect(c1.data.restored).toBe(true);
  const c2 = await svc.rpc('cancel_booking_tx', { p_booking_id: booked.data.booking_id });
  expect(c2.data.restored).toBe(false);
  expect(c2.data.already_cancelled).toBe(true);

  const afterCancel = await svc.from('user_tickets').select('remaining_count').eq('id', ut.id).single();
  expect(afterCancel.data.remaining_count).toBe(5); // 정확히 1회 복구

  // (b) 취소 마감 이후 — 복구 없음
  const ut2 = await grantTicket(F.tCancel, { remaining_count: 5 });
  const booked2 = await callCreate(F.schedCancelLate.id, ut2.id);
  expect(booked2.error).toBeNull();
  track('bookings', booked2.data.booking_id);

  const c3 = await svc.rpc('cancel_booking_tx', { p_booking_id: booked2.data.booking_id });
  expect(c3.data.within_deadline).toBe(false);
  expect(c3.data.restored).toBe(false);
  const afterLate = await svc.from('user_tickets').select('remaining_count').eq('id', ut2.id).single();
  expect(afterLate.data.remaining_count).toBe(4); // 복구 안 됨
});

test('B11 중복 예약은 거절된다', async () => {
  const t = await grantTicket(F.tAllPass, { remaining_count: null });
  const first = await callCreate(F.schedDup.id, t.id);
  if (!first.error) track('bookings', first.data.booking_id);
  const second = await callCreate(F.schedDup.id, t.id);
  expect(rejectedWith(second, 'DUPLICATE_BOOKING')).toBe(true);
});

test('B12 보안: anon 은 예약 엔진 트랜잭션을 호출할 수 없다', async () => {
  const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  }) as any;

  // SECURITY DEFINER 함수이므로 anon 에게 EXECUTE 가 남아 있으면
  // 임의 p_user_id 로 남의 예약을 만들 수 있다 → 반드시 거부되어야 한다.
  const create = await anon.rpc('create_booking_tx', {
    p_schedule_id: F.schedNormal.id,
    p_user_ticket_id: null,
    p_order_item_id: null,
    p_user_id: STUDENT_ID,
  });
  expect(create.error).not.toBeNull();

  const cancel = await anon.rpc('cancel_booking_tx', { p_booking_id: randomUUID() });
  expect(cancel.error).not.toBeNull();
});

test('B13 보안(FINDING2): 학생이 cancel_my_booking 을 직접 호출해도 COUNT 티켓이 정확히 1회만 복구된다', async () => {
  // cancel_my_booking 은 authenticated 에게 직접 노출된 SECURITY DEFINER 함수다.
  // 예전 정의는 예약만 CANCELLED 로 바꾸고 차감분을 복구하지 않아, 학생이 PostgREST 로
  // 직접 호출하면 횟수가 환불 없이 소실됐다. 이제 cancel_booking_tx 에 위임하므로
  // 마감 이내면 +1 복구, 재호출은 상태전이 거부(중복복구 없음)여야 한다.
  const student = createClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  }) as any;
  const signIn = await student.auth.signInWithPassword({
    email: 'e2e-moveit-student@modoogoods.com',
    password: 'Test1234!e2e',
  });
  expect(signIn.error, `학생 로그인 실패: ${signIn.error?.message}`).toBeNull();
  expect(signIn.data.user?.id).toBe(STUDENT_ID);

  // 마감 이내 스케줄에 COUNT 티켓으로 예약 → 차감
  const ut = await grantTicket(F.tCancel, { remaining_count: 5 });
  const booked = await callCreate(F.schedCancel.id, ut.id);
  expect(booked.error).toBeNull();
  const bookingId = booked.data.booking_id;
  track('bookings', bookingId);

  const afterBook = await svc.from('user_tickets').select('remaining_count').eq('id', ut.id).single();
  expect(afterBook.data.remaining_count).toBe(4);

  // 학생 JWT 로 직접 cancel_my_booking 호출
  const c1 = await student.rpc('cancel_my_booking', { p_booking_id: bookingId });
  expect(c1.error, `cancel_my_booking 실패: ${c1.error?.message}`).toBeNull();
  expect(c1.data.status).toBe('CANCELLED');

  const afterCancel = await svc
    .from('user_tickets')
    .select('remaining_count')
    .eq('id', ut.id)
    .single();
  expect(afterCancel.data.remaining_count).toBe(5); // 정확히 1회 복구

  // 재호출은 이미 CANCELLED → 상태전이 거부(복구 재발 없음)
  const c2 = await student.rpc('cancel_my_booking', { p_booking_id: bookingId });
  expect(c2.error).not.toBeNull();
  const afterRetry = await svc
    .from('user_tickets')
    .select('remaining_count')
    .eq('id', ut.id)
    .single();
  expect(afterRetry.data.remaining_count).toBe(5); // 중복 복구 없음

  // 남의 예약은 취소 불가 (소유자 가드)
  const otherUt = await grantTicket(F.tCancel, { remaining_count: 5 }, OTHER_ID);
  const otherBooked = await callCreate(F.schedCancelLate.id, otherUt.id, OTHER_ID);
  expect(otherBooked.error).toBeNull();
  track('bookings', otherBooked.data.booking_id);
  const cOther = await student.rpc('cancel_my_booking', { p_booking_id: otherBooked.data.booking_id });
  expect(cOther.error).not.toBeNull(); // NOT_BOOKING_OWNER
});

// =========================================================================
// C. 회귀: 기존 수강권의 만료 의미가 바뀌지 않았는가
// =========================================================================

test('C1 회귀: 기존 user_tickets 의 저장 만료일 의미 불변 (start + valid_days)', async () => {
  const createdIds = created.filter((c) => c.table === 'user_tickets').map((c) => c.id);
  // ⚠ 전체 실행(full-suite) 격리: 이 회귀는 **운영 데이터**의 만료 규칙 불변을 검증한다.
  //   다른 스펙이 만든 테스트 수강권(expiry_date='2099-12-31' 등 레거시 공식 미준수)이
  //   표본에 섞이면 mismatch 비율이 튀어 간헐 실패한다. 테스트 픽스처는 항상 **방금**
  //   생성되므로, created_at 오름차순으로 가장 오래된 200건만 본다 = 순수 운영 이력.
  //   (이 스펙 자신의 created 도 별도로 한 번 더 제외한다.)
  const { data, error } = await svc
    .from('user_tickets')
    .select('id, start_date, expiry_date, created_at, tickets!inner(valid_days)')
    .not('start_date', 'is', null)
    .not('expiry_date', 'is', null)
    .order('created_at', { ascending: true })
    .limit(200);
  expect(error).toBeNull();

  const sample = (data || []).filter(
    (r: any) => !createdIds.includes(r.id) && r.tickets?.valid_days != null
  );
  expect(sample.length).toBeGreaterThan(10); // 표본이 있어야 검증이 의미 있음

  const mismatched = sample.filter(
    (r: any) => legacyExpiry(r.start_date, r.tickets.valid_days) !== r.expiry_date
  );
  // 운영 데이터에 수동 연장 등 소수 예외가 존재 → 절대다수가 레거시 공식과 일치해야 한다.
  expect(mismatched.length / sample.length).toBeLessThan(0.05);

  // 그리고 신규 규칙(-1일)은 기존 저장값과 명백히 다르다는 것을 확인 (의미 분리가 실제로 필요했음)
  const wouldChange = sample.filter(
    (r: any) => inclusiveExpiry(r.start_date, r.tickets.valid_days) === r.expiry_date
  );
  expect(wouldChange.length).toBeLessThan(sample.length);
});
