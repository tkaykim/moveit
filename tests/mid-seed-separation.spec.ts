/**
 * T11 시드의 **행동** 검증 — 임시(throwaway) 학원 안에서만.
 *
 * 실행: npx playwright test tests/mid-seed-separation.spec.ts --workers=1
 *
 * 왜 임시 학원인가:
 *   실제 MID 학원(slug='mid')은 다크런치 중이고, 거기에 테스트 학생·예약을 만드는 것은
 *   운영 데이터 오염이다. 그래서 **같은 시드 설정(scripts/mid-seed-config.mjs)** 을
 *   임시 학원에 그대로 적용하고, 그 위에서 예약을 실제로 시도한다.
 *   검증되는 것은 "설정이 만들어내는 행동"이므로 실제 학원에도 동일하게 성립한다.
 *
 * ⛔ 이 스펙은 slug='mid' 를 절대 읽지도 쓰지도 않는다.
 *
 * 검증:
 *   S1 ALL PASS 로 춤숨찐 수업 예약 → 거절
 *   S2 ALL PASS 로 워크샵 수업 예약 → 거절
 *   S3 ALL PASS 로 정규·팝업 수업 예약 → 승인 (분리가 과하지 않다는 증거)
 *   S4 춤숨찐 티켓으로 춤숨찐 수업 예약 → 승인
 *   S5 춤숨찐 티켓으로 정규 수업 예약 → 거절
 *   X1 외부 일정툴 호환: service_role 로 class_group_id 없는 수업 INSERT +
 *      schedule INSERT + is_canceled 토글이 전부 성공하고,
 *      그 수업이 운영자의 "예약 준비 안 됨" 큐에 뜬다
 */
import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

import { applySeed, CLASS_TYPE_TO_GROUP } from '../scripts/mid-seed-config.mjs';
import { listNotReadyClasses } from '../lib/booking/readiness';
import { kstToday, addDays } from '../lib/date/kst';

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

const F: Record<string, any> = {};

async function ins(table: string, row: Record<string, any>) {
  const { data, error } = await svc.from(table).insert(row).select().single();
  if (error) throw new Error(`${table} insert 실패: ${error.message}`);
  return data;
}

function isoInHours(h: number) {
  return new Date(Date.now() + h * 3600_000).toISOString();
}

/** 시드가 만든 수강권을 학생에게 지급 */
async function grant(ticketName: string, over: Record<string, any> = {}) {
  const today = kstToday();
  return ins('user_tickets', {
    user_id: STUDENT_ID,
    ticket_id: F.tickets[ticketName],
    remaining_count: 10,
    start_date: addDays(today, -1),
    expiry_date: addDays(today, 60),
    status: 'ACTIVE',
    ...over,
  });
}

async function book(scheduleId: string, userTicketId: string) {
  return svc.rpc('create_booking_tx', {
    p_schedule_id: scheduleId,
    p_user_ticket_id: userTicketId,
    p_order_item_id: null,
    p_user_id: STUDENT_ID,
  });
}

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  const stamp = randomUUID().slice(0, 8);

  // --- 임시 학원 (실제 mid 가 아니다) ---
  F.academy = await ins('academies', {
    name_kr: `T11시드분리테스트-${stamp}`,
    slug: `t11-seed-${stamp}`,
    is_active: true,
  });

  // --- 시드가 돌기 전에 수업을 만들어 둔다 (실제 mid 와 같은 순서: 수업이 먼저 존재) ---
  const mkClass = (title: string, classType: string, extra: Record<string, any> = {}) =>
    ins('classes', {
      academy_id: F.academy.id,
      title,
      class_type: classType,
      max_students: 10,
      is_active: true,
      ...extra,
    });

  // 시드된 학원 정책은 "수업 1일 전 17:00 오픈"이라 48시간 뒤 회차는 아직 안 열린다.
  // 이 스펙이 검증하려는 것은 **커버리지 분리**이지 예약 오픈시각이 아니므로,
  // 예약을 시도할 수업들은 수업 단위 정책으로 창을 미리 열어 두고 격리한다.
  // (오픈시각 자체는 tests/booking-engine.spec.ts 가 이미 검증한다.)
  const OPEN_EARLY = { open: { daysBefore: 30, time: '00:00' } };

  F.cRegular = await mkClass('정규수업', 'regular', { booking_policy: OPEN_EARLY });
  F.cPopup = await mkClass('팝업수업', 'popup', { booking_policy: OPEN_EARLY });
  F.cCszz = await mkClass('춤숨찐수업', 'cszz', { booking_policy: OPEN_EARLY });
  F.cWorkshop = await mkClass('워크샵수업', 'workshop', { booking_policy: OPEN_EARLY });
  F.cShare = await mkClass('포에잇쉐어수업', 'share'); // 매핑 없음 → 미태깅 유지

  // --- 실제 MID 와 **같은 설정·같은 코드**로 시드 ---
  F.report = await applySeed(svc, F.academy.id, { tagClasses: true });
  F.tickets = F.report.tickets.byName;
  F.groups = F.report.groups.byKey;

  // --- 회차 (schedules 에 (class, KST일자) 유니크가 있어 수업마다 다른 시각) ---
  const mkSched = (klass: any, hoursAhead: number) =>
    ins('schedules', {
      class_id: klass.id,
      start_time: isoInHours(hoursAhead),
      end_time: isoInHours(hoursAhead + 1),
      max_students: 10,
      is_canceled: false,
    });

  F.sRegular = await mkSched(F.cRegular, 48);
  F.sPopup = await mkSched(F.cPopup, 49);
  F.sCszz = await mkSched(F.cCszz, 50);
  F.sCszz2 = await mkSched(F.cCszz, 74); // 다른 날 — 춤숨찐 티켓 승인 케이스용
  F.sWorkshop = await mkSched(F.cWorkshop, 51);
  F.sRegular2 = await mkSched(F.cRegular, 72); // 춤숨찐 티켓 거절 케이스용
});

test.afterAll(async () => {
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

// ===========================================================================
// 시드 자체
// ===========================================================================

test('S0 시드가 4그룹·7상품·2멤버십을 만들고 share 는 미태깅으로 남긴다', async () => {
  expect(Object.keys(F.groups).sort()).toEqual(['cszz', 'popup', 'regular', 'workshop']);
  expect(Object.keys(F.tickets).length).toBe(7);
  expect(F.report.memberships.created).toBe(2);
  // share 는 매핑이 없으므로 추측하지 않고 남긴다
  expect(Object.keys(CLASS_TYPE_TO_GROUP)).not.toContain('share');
  expect(F.report.classTagging.leftUntagged).toBe(1);

  const { data: share } = await svc
    .from('classes')
    .select('class_group_id')
    .eq('id', F.cShare.id)
    .single();
  expect(share.class_group_id).toBeNull();
});

test('S0b 같은 학원에 시드를 다시 돌리면 아무것도 안 바뀐다 (멱등)', async () => {
  const again = await applySeed(svc, F.academy.id, { tagClasses: true });
  expect(again.changedRows).toBe(0);
  expect(again.groups.created).toBe(0);
  expect(again.tickets.created).toBe(0);
  expect(again.coverage.created).toBe(0);
  expect(again.memberships.created).toBe(0);
  expect(again.discounts.created).toBe(0);
  expect(again.classTagging.updated).toBe(0);
  expect(again.bookingPolicy.alreadyCorrect).toBe(true);
});

// ===========================================================================
// 분리 — 이 시드의 핵심 요구사항
// ===========================================================================

test('S1 ALL PASS 로 춤숨찐 수업은 예약할 수 없다', async () => {
  const ut = await grant('ALL PASS', { remaining_count: null });
  const res = await book(F.sCszz.id, ut.id);
  expect(res.error).not.toBeNull();
  // 스페셜 그룹은 명시적 커버리지 없이는 절대 열리지 않는다
  expect(String(res.error.message)).toContain('COVERED');
});

test('S2 ALL PASS 로 워크샵 수업은 예약할 수 없다', async () => {
  const ut = await grant('ALL PASS', { remaining_count: null });
  const res = await book(F.sWorkshop.id, ut.id);
  expect(res.error).not.toBeNull();
  expect(String(res.error.message)).toContain('COVERED');
});

test('S3 ALL PASS 로 정규·팝업 수업은 예약된다 (분리가 과하지 않다)', async () => {
  const ut = await grant('ALL PASS', { remaining_count: null });
  const reg = await book(F.sRegular.id, ut.id);
  expect(reg.error).toBeNull();
  expect(reg.data.ok).toBe(true);

  const ut2 = await grant('ALL PASS', { remaining_count: null });
  const pop = await book(F.sPopup.id, ut2.id);
  expect(pop.error).toBeNull();
  expect(pop.data.ok).toBe(true);
});

test('S4 춤숨찐 티켓으로 춤숨찐 수업은 예약된다', async () => {
  const ut = await grant('춤숨찐 티켓', { remaining_count: 1 });
  const res = await book(F.sCszz2.id, ut.id);
  expect(res.error).toBeNull();
  expect(res.data.ok).toBe(true);
});

test('S5 춤숨찐 티켓으로 정규 수업은 예약할 수 없다', async () => {
  const ut = await grant('춤숨찐 티켓', { remaining_count: 1 });
  const res = await book(F.sRegular2.id, ut.id);
  expect(res.error).not.toBeNull();
  expect(String(res.error.message)).toContain('COVERED');
});

// ===========================================================================
// 외부 일정툴(mid-class-board / MID_WORK) 호환
// ===========================================================================

test('X1 외부 툴의 service_role 쓰기가 그대로 동작하고, 미태깅 수업은 준비안됨 큐에 뜬다', async () => {
  // ① 예약 도메인을 모르는 툴처럼 class_group_id 없이 수업 INSERT
  const { data: newClass, error: cErr } = await svc
    .from('classes')
    .insert({
      academy_id: F.academy.id,
      title: '외부툴이만든수업',
      class_type: 'regular',
      max_students: 12,
      is_active: true,
      // class_group_id 를 주지 않는다 — 그 툴은 이 컬럼의 존재를 모른다
    })
    .select()
    .single();
  expect(cErr).toBeNull();
  expect(newClass.class_group_id).toBeNull();

  // ② 회차 INSERT
  const { data: newSched, error: sErr } = await svc
    .from('schedules')
    .insert({
      class_id: newClass.id,
      start_time: isoInHours(96),
      end_time: isoInHours(97),
      max_students: 12,
      is_canceled: false,
    })
    .select()
    .single();
  expect(sErr).toBeNull();

  // ③ is_canceled 토글
  const { data: canceled, error: uErr } = await svc
    .from('schedules')
    .update({ is_canceled: true })
    .eq('id', newSched.id)
    .select()
    .single();
  expect(uErr).toBeNull();
  expect(canceled.is_canceled).toBe(true);

  const { data: restored } = await svc
    .from('schedules')
    .update({ is_canceled: false })
    .eq('id', newSched.id)
    .select()
    .single();
  expect(restored.is_canceled).toBe(false);

  // ④ 그 수업은 예약이 열리지 않고 운영자 큐에 뜬다 (설계된 동작)
  const queue = await listNotReadyClasses(svc, F.academy.id);
  expect(queue.academy_uses_groups).toBe(true);
  const ids = queue.classes.map((c) => c.id);
  expect(ids).toContain(newClass.id);
  expect(ids).toContain(F.cShare.id); // 포에잇쉐어도 같은 큐에
  const entry = queue.classes.find((c) => c.id === newClass.id)!;
  expect(entry.gates).toContain('MISSING_CLASS_GROUP');

  // ⑤ 태깅된 수업은 큐에 없다
  expect(ids).not.toContain(F.cRegular.id);
  expect(ids).not.toContain(F.cCszz.id);
});
