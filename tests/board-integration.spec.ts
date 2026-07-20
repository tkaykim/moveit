/**
 * T8 검증 — 일정툴 공존 계약 · 예약 준비 큐 · 이벤트 처리 지연
 *
 * 실행: npx playwright test tests/board-integration.spec.ts --workers=1
 *
 * 픽스처는 전용 테스트 학원(slug: t8-bi-*) 안에서만 만들고 끝나면 지운다.
 * 실제 MID 학원(slug: mid) 데이터는 절대 건드리지 않는다 — 읽지도 쓰지도 않는다.
 *
 * ── 이 스펙이 지키는 방어선 ──────────────────────────────────────────────
 * A 그룹(공존 계약)이 핵심이다. 외부 일정툴(mid-class-board)은 이 앱의 API 를
 * 거치지 않고 **service_role 로 직접** classes/recurring_schedules/schedules 에
 * 쓴다. T0 의 RLS 잠금 · T1 의 새 FK/CHECK · T6/T7 트리거가 그 쓰기를 깨면
 * 학원의 일일 운영이 멈춘다. 그래서 A 그룹은 그 툴이 실제로 하는 컬럼 조합을
 * 그대로 재현해 넣어본다.
 *
 * 재현 근거 (읽기 전용으로 확인한 실제 쓰기 경로):
 *   · classes INSERT 12컬럼 고정      — mid-class-board/app/api/classes/route.ts:117-134
 *                                        · scripts/import-mid.ts:184-200, :244-260
 *     → class_group_id / audience_membership_id / booking_policy 를 **한 번도 쓰지 않는다**
 *   · recurring_schedules INSERT      — app/api/classes/route.ts:138-150
 *                                        · scripts/import-mid.ts:215-230 (hall_id 생략)
 *   · schedules INSERT (1행씩, 벌크 아님) — lib/week.ts:109 (루프), app/api/classes/route.ts:155-166,
 *                                        app/api/schedule/route.ts:97-109, scripts/import-mid.ts:285-296
 *   · 휴강 = schedules.is_canceled     — 단건: app/api/schedule/[id]/route.ts:158, :208
 *                                        일괄: app/api/classes/[id]/route.ts:127-131
 *                                              (.eq("class_id").gte("start_time") — 이미 취소된 행도 다시 훑는다)
 *   · schedule_meta 는 부분 UPSERT     — 12개 사이트, 예: scripts/sync-local.ts:261-272
 *   · DELETE 는 어디에도 없다(전부 소프트 삭제)
 *   · C:\MID_WORK 는 스크립트 2개만 접근하고, 런타임 요청 경로는 무관하다
 *
 * 이 앱이 T8 에서 추가한 것 중 C:\MID_WORK 에 쓰거나 일정툴 변경을 요구하는 것은 없다.
 */
import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

import { validateBookingPolicyShape } from '../lib/booking/policy';
import { listNotReadyClasses } from '../lib/booking/readiness';

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

/** 외부 일정툴과 동일한 권한 — service_role. RLS 를 우회한다. */
const svc = createClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
}) as any;

const STUDENT_ID = 'fd2fd033-2f2c-4cad-890b-f2c9c75a0f23'; // e2e-moveit-student@modoogoods.com
const OWNER_ID = '6e33f238-14c6-41d7-9715-d131067b6885'; // e2e-moveit-owner@modoogoods.com
const STUDENT_EMAIL = 'e2e-moveit-student@modoogoods.com';
const OWNER_EMAIL = 'e2e-moveit-owner@modoogoods.com';
const E2E_PASSWORD = 'Test1234!e2e';

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

async function eventsFor(scheduleId: string, type: string) {
  const { data } = await svc
    .from('booking_events')
    .select('*')
    .eq('schedule_id', scheduleId)
    .eq('event_type', type);
  return data ?? [];
}

function api(pathname: string) {
  return `/api/academy-admin/${F.academy.id}${pathname}`;
}

const authHdr = (token: string) => ({ Authorization: `Bearer ${token}` });

/** cron 라우트는 CRON_SECRET 이 설정돼 있으면 Bearer 를 요구한다 (Vercel cron 헤더 대체) */
const cronHdr = (): Record<string, string> =>
  env.CRON_SECRET ? { Authorization: `Bearer ${env.CRON_SECRET}` } : {};

type Requester = { get: (url: string, opts?: any) => Promise<any> };

const runProcessor = (request: Requester) =>
  request.get('/api/cron/process-booking-events', { headers: cronHdr() });

/**
 * 이벤트가 PENDING 을 벗어날 때까지 짧게 재시도한다.
 * 프로세서는 `for update skip locked` 를 쓰고 검증 읽기에는 지연이 있을 수 있어
 * 단발 조회로 단정하면 간헐적으로 틀린다. 프로세서가 멱등하므로 재호출은 안전하다.
 */
async function waitForNotPending(
  scheduleId: string,
  type: string,
  request: Requester,
  attempts = 8
): Promise<string> {
  let status = 'PENDING';
  for (let i = 0; i < attempts; i++) {
    const rows = await eventsFor(scheduleId, type);
    status = rows[0]?.status ?? 'PENDING';
    if (status !== 'PENDING') return status;
    await runProcessor(request);
    // 전체 실행 시 전역 큐가 커져 처리·읽기 지연이 늘 수 있어 백오프를 넉넉히 준다.
    await new Promise((r) => setTimeout(r, 400));
  }
  return status;
}

/** 이 학원의 대기 큐가 빌 때까지 짧게 재시도한다. */
async function waitForAcademyQueueDrained(
  academyId: string,
  request: Requester,
  attempts = 8
): Promise<number> {
  let pending = -1;
  for (let i = 0; i < attempts; i++) {
    const { count } = await svc
      .from('booking_events')
      .select('id', { count: 'exact', head: true })
      .eq('academy_id', academyId)
      .eq('status', 'PENDING');
    pending = count ?? 0;
    if (pending === 0) return 0;
    await runProcessor(request);
    // 전체 실행 시 전역 큐가 커져 처리·읽기 지연이 늘 수 있어 백오프를 넉넉히 준다.
    await new Promise((r) => setTimeout(r, 400));
  }
  return pending;
}

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  F.startedAt = new Date(Date.now() - 5000).toISOString();

  F.academy = await ins('academies', {
    name_kr: `T8보드연동-${stamp}`,
    slug: `t8-bi-${stamp}`,
    is_active: true,
    booking_policy: { open: null, close: { minutesBefore: 0 }, cancelUntil: { minutesBefore: 0 } },
  });
  academyIds.push(F.academy.id);

  // 이 학원은 class_groups 를 도입했다 → T2 의 예약 가능 게이트가 실제로 적용된다.
  F.group = await ins('class_groups', {
    academy_id: F.academy.id,
    key: 'normal',
    name: '정규',
    is_special: false,
  });

  // 예약 가능한 대조군 수업 (그룹 태깅 완료)
  F.cTagged = await ins('classes', {
    academy_id: F.academy.id,
    title: '태깅완료수업',
    class_group_id: F.group.id,
    max_students: 10,
    is_active: true,
    class_type: 'regular',
  });

  F.ticket = await ins('tickets', {
    academy_id: F.academy.id,
    name: '10회권',
    ticket_type: 'COUNT',
    price: 250000,
    total_count: 10,
    valid_days: 60,
    is_general: true,
    is_on_sale: true,
    is_public: true,
  });

  const anonClient = () =>
    createClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    }) as any;

  const stu = anonClient();
  const sAuth = await stu.auth.signInWithPassword({ email: STUDENT_EMAIL, password: E2E_PASSWORD });
  expect(sAuth.error).toBeNull();
  F.studentToken = sAuth.data.session.access_token;

  const own = anonClient();
  const oAuth = await own.auth.signInWithPassword({ email: OWNER_EMAIL, password: E2E_PASSWORD });
  expect(oAuth.error).toBeNull();
  F.ownerToken = oAuth.data.session.access_token;

  await svc.from('academy_user_roles').insert({
    academy_id: F.academy.id,
    user_id: OWNER_ID,
    role: 'ACADEMY_OWNER',
  });
});

test.afterAll(async () => {
  if (academyIds.length === 0) return;

  const { data: cls } = await svc.from('classes').select('id').in('academy_id', academyIds);
  const classIds = (cls ?? []).map((c: any) => c.id);

  await svc.from('class_cancel_restorations').delete().in('academy_id', academyIds);
  await svc.from('fixed_weekly_placement_issues').delete().in('academy_id', academyIds);
  await svc.from('booking_events').delete().in('academy_id', academyIds);
  await svc.from('enrollment_activity_log').delete().in('academy_id', academyIds);
  if (classIds.length > 0) await svc.from('bookings').delete().in('class_id', classIds);

  const { data: tks } = await svc.from('tickets').select('id').in('academy_id', academyIds);
  const ticketIds = (tks ?? []).map((t: any) => t.id);
  if (ticketIds.length > 0) {
    await svc.from('user_tickets').delete().in('ticket_id', ticketIds);
    await svc.from('ticket_coverage').delete().in('ticket_id', ticketIds);
    await svc.from('ticket_classes').delete().in('ticket_id', ticketIds);
  }

  if (classIds.length > 0) {
    await svc.from('schedule_meta').delete().in('schedule_id', F.metaScheduleIds ?? []);
    await svc.from('recurring_schedules').delete().in('class_id', classIds);
    await svc.from('schedules').delete().in('class_id', classIds);
  }
  await svc.from('classes').delete().in('academy_id', academyIds);
  await svc.from('tickets').delete().in('academy_id', academyIds);
  await svc.from('class_groups').delete().in('academy_id', academyIds);
  await svc.from('academy_user_roles').delete().in('academy_id', academyIds);
  await svc.from('academies').delete().in('id', academyIds);
});

// ===========================================================================
// A. 공존 계약 — 외부 일정툴의 실제 쓰기가 여전히 성공하는가
// ===========================================================================

test('A1 일정툴의 classes INSERT(12컬럼 고정)는 class_group_id 없이도 성공한다', async () => {
  // 재현: mid-class-board/app/api/classes/route.ts:117-134 의 컬럼 집합 그대로.
  // 그 툴은 예약 도메인을 모르므로 class_group_id 를 절대 쓰지 않는다.
  const { data, error } = await svc
    .from('classes')
    .insert({
      academy_id: F.academy.id,
      title: `보드생성수업-${stamp}`,
      class_type: 'regular',
      genre: 'K-POP',
      instructor_id: null,
      instructor_name: '보드강사',
      hall_id: null,
      status: '정상',
      base_salary: 0,
      price: 0,
      max_students: 0,
      is_active: true,
    })
    .select('id, class_group_id, audience_membership_id, booking_policy')
    .single();

  expect(error).toBeNull();
  expect(data.class_group_id).toBeNull();
  // T1 이 새 컬럼에 NOT NULL 을 걸지 않았다는 증거 — 걸었다면 위 insert 가 터진다.
  expect(data.audience_membership_id).toBeNull();
  expect(data.booking_policy).toBeNull();

  F.cUntagged = data;
});

test('A2 일정툴의 recurring_schedules INSERT 가 성공한다 (hall_id 생략 경로 포함)', async () => {
  // 재현: app/api/classes/route.ts:138-150 (hall_id 포함) 과
  //       scripts/import-mid.ts:215-230 (hall_id 생략) 두 변형 모두.
  const withHall = await svc
    .from('recurring_schedules')
    .insert({
      class_id: F.cUntagged.id,
      academy_id: F.academy.id,
      start_date: '2026-01-01',
      end_date: '2099-12-31', // FAR_END 센티널 (lib/week.ts:9)
      start_time: '19:00',
      end_time: '20:10',
      days_of_week: [1],
      hall_id: null,
      instructor_id: null,
      max_students: 10,
      is_active: true,
    })
    .select('id')
    .single();
  expect(withHall.error).toBeNull();

  const withoutHall = await svc
    .from('recurring_schedules')
    .insert({
      class_id: F.cUntagged.id,
      academy_id: F.academy.id,
      start_date: '2026-01-01',
      end_date: '2099-12-31',
      start_time: '20:00',
      end_time: '21:10',
      days_of_week: [3],
      instructor_id: null,
      max_students: 10,
      is_active: true,
    })
    .select('id')
    .single();
  expect(withoutHall.error).toBeNull();
});

test('A3 schedules INSERT 1건 → SCHEDULE_CREATED 이벤트 정확히 1건, insert 는 실패하지 않는다', async () => {
  // 재현: lib/week.ts:109 — 배열을 만들어도 실제로는 한 행씩 insert 한다.
  const t0 = Date.now();
  const { data, error } = await svc
    .from('schedules')
    .insert({
      class_id: F.cUntagged.id,
      instructor_id: null,
      hall_id: null,
      start_time: isoInHours(48),
      end_time: isoInHours(49),
      max_students: 10,
    })
    .select('id, is_canceled')
    .single();

  expect(error).toBeNull();
  expect(data.id).toBeTruthy();
  F.schedUntagged = data;

  const evts = await eventsFor(data.id, 'SCHEDULE_CREATED');
  expect(evts).toHaveLength(1);
  expect(evts[0].status).toBe('PENDING');
  expect(evts[0].academy_id).toBe(F.academy.id);

  // 트리거가 insert 를 느리게 만들지 않는다 (HTTP 호출 없이 행 1건만 남긴다)
  expect(Date.now() - t0).toBeLessThan(5000);
});

test('A4 schedules 를 여러 건 넣어도 각각 이벤트 1건씩만 생긴다', async () => {
  const ids: string[] = [];
  for (let i = 0; i < 3; i++) {
    const { data, error } = await svc
      .from('schedules')
      .insert({
        class_id: F.cTagged.id,
        start_time: isoInHours(72 + i * 24),
        end_time: isoInHours(73 + i * 24),
        max_students: 10,
      })
      .select('id')
      .single();
    expect(error).toBeNull();
    ids.push(data.id);
  }
  F.taggedSchedules = ids;

  for (const id of ids) {
    expect(await eventsFor(id, 'SCHEDULE_CREATED')).toHaveLength(1);
  }
});

test('A5 is_canceled 플립 → CLASS_CANCELED 이벤트 정확히 1건', async () => {
  // 재현: app/api/schedule/[id]/route.ts:158 (단건 "휴강" 토글)
  const target = F.taggedSchedules[0];
  const { error } = await svc.from('schedules').update({ is_canceled: true }).eq('id', target);
  expect(error).toBeNull();

  const evts = await eventsFor(target, 'CLASS_CANCELED');
  expect(evts).toHaveLength(1);
  expect(evts[0].status).toBe('PENDING');
});

test('A6 일괄 휴강이 이미 취소된 행을 다시 훑어도 실패하지 않고 이벤트가 늘지 않는다', async () => {
  // 재현: app/api/classes/[id]/route.ts:127-131
  //   .update({is_canceled:true}).eq("class_id", id).gte("start_time", today)
  // 이 배치는 **이미 is_canceled=true 인 행도 다시 UPDATE 한다.**
  // 트리거가 false→true 전환만 보고 + on conflict do nothing 이므로 중복 이벤트도,
  // 유니크 위반 에러도 발생하지 않아야 한다. 여기가 T7 이 일정툴을 깨뜨릴 수 있던 지점이다.
  const { error } = await svc
    .from('schedules')
    .update({ is_canceled: true })
    .eq('class_id', F.cTagged.id)
    .gte('start_time', new Date(Date.now() - 3600_000).toISOString());
  expect(error).toBeNull();

  // 이미 취소돼 있던 행: 여전히 1건
  expect(await eventsFor(F.taggedSchedules[0], 'CLASS_CANCELED')).toHaveLength(1);
  // 새로 취소된 행들: 각 1건
  expect(await eventsFor(F.taggedSchedules[1], 'CLASS_CANCELED')).toHaveLength(1);
  expect(await eventsFor(F.taggedSchedules[2], 'CLASS_CANCELED')).toHaveLength(1);

  // 같은 배치를 한 번 더 (일정툴에서 흔한 재시도)
  const again = await svc
    .from('schedules')
    .update({ is_canceled: true })
    .eq('class_id', F.cTagged.id)
    .gte('start_time', new Date(Date.now() - 3600_000).toISOString());
  expect(again.error).toBeNull();
  expect(await eventsFor(F.taggedSchedules[1], 'CLASS_CANCELED')).toHaveLength(1);
});

test('A7 schedule_meta 부분 UPSERT 가 성공한다 (sync-local 경로)', async () => {
  // 재현: scripts/sync-local.ts:261-272 — schedule_id/artist/song_title 만 주는 부분 upsert.
  const sid = F.taggedSchedules[2];
  F.metaScheduleIds = [sid];

  const first = await svc.from('schedule_meta').upsert(
    {
      schedule_id: sid,
      artist: '아티스트',
      song_title: '곡',
      updated_by: 'mid-class-sync',
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'schedule_id' }
  );
  expect(first.error).toBeNull();

  // 두 번째 upsert (같은 키) 도 성공해야 한다
  const second = await svc.from('schedule_meta').upsert(
    {
      schedule_id: sid,
      artist: '아티스트2',
      song_title: '곡2',
      updated_by: 'mid-class-sync',
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'schedule_id' }
  );
  expect(second.error).toBeNull();
});

// ===========================================================================
// B. 예약 준비 큐 — 태깅 안 된 수업이 보이고, 고치면 예약이 열린다
// ===========================================================================

test('B1 태깅 안 된 수업은 큐에 뜨고 예약도 막혀 있다', async () => {
  const queue = await listNotReadyClasses(svc, F.academy.id);
  expect(queue.academy_uses_groups).toBe(true);

  const row = queue.classes.find((c) => c.id === F.cUntagged.id);
  expect(row).toBeTruthy();
  expect(row!.gates).toContain('MISSING_CLASS_GROUP');
  // 미래 회차가 있다는 신호도 함께 (A3 에서 1건 만들었다)
  expect(row!.upcoming_schedule_count).toBeGreaterThanOrEqual(1);

  // 이미 태깅된 수업은 큐에 없다
  expect(queue.classes.find((c) => c.id === F.cTagged.id)).toBeFalsy();

  // 실제로 예약도 거절된다
  const res = await svc.rpc('create_booking_tx', {
    p_schedule_id: F.schedUntagged.id,
    p_user_ticket_id: null,
    p_order_item_id: null,
    p_user_id: STUDENT_ID,
  });
  const rejected =
    !!res.error && String(res.error.message || '').includes('CLASS_NOT_BOOKABLE');
  expect(rejected).toBe(true);
});

test('B2 GET 큐 API 는 직원에게 같은 목록을 준다', async ({ request }) => {
  const res = await request.get(api('/class-readiness'), { headers: authHdr(F.ownerToken) });
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.success).toBe(true);
  expect(body.academy_uses_groups).toBe(true);
  expect(body.classes.some((c: any) => c.id === F.cUntagged.id)).toBe(true);
});

test('B3 태깅하면 큐에서 빠지고 학생이 실제로 예약할 수 있다', async ({ request }) => {
  const res = await request.patch(api('/class-readiness'), {
    headers: authHdr(F.ownerToken),
    data: {
      classId: F.cUntagged.id,
      classGroupId: F.group.id,
      bookingPolicy: { open: null, close: { minutesBefore: 0 } },
    },
  });
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.after.class_group_id).toBe(F.group.id);

  // 큐에서 사라졌다
  const queue = await listNotReadyClasses(svc, F.academy.id);
  expect(queue.classes.find((c) => c.id === F.cUntagged.id)).toBeFalsy();

  // 커버하는 수강권을 주고 실제 예약
  const ut = await ins('user_tickets', {
    user_id: STUDENT_ID,
    ticket_id: F.ticket.id,
    status: 'ACTIVE',
    remaining_count: 10,
    start_date: '2020-01-01',
    expiry_date: '2099-12-31',
  });

  const created = await svc.rpc('create_booking_tx', {
    p_schedule_id: F.schedUntagged.id,
    p_user_ticket_id: ut.id,
    p_order_item_id: null,
    p_user_id: STUDENT_ID,
  });
  expect(created.error).toBeNull();
  expect(created.data.ok).toBe(true);
});

test('B4 잘못된 booking_policy 형태는 저장 전에 거절된다', async ({ request }) => {
  // 순수 검증기 단위
  expect(validateBookingPolicyShape({ open: null }).ok).toBe(true);
  expect(validateBookingPolicyShape(null).ok).toBe(true);
  expect(validateBookingPolicyShape({ close: { minutesBefore: -5 } }).ok).toBe(false);
  expect(validateBookingPolicyShape({ open: { daysBefore: 2, time: '25:00' } }).ok).toBe(false);
  expect(validateBookingPolicyShape({ open: { daysBefore: 2 } }).ok).toBe(false);
  expect(validateBookingPolicyShape({ nonsense: 1 }).ok).toBe(false);
  expect(validateBookingPolicyShape('문자열').ok).toBe(false);

  // API 경계
  const res = await request.patch(api('/class-readiness'), {
    headers: authHdr(F.ownerToken),
    data: {
      classId: F.cUntagged.id,
      bookingPolicy: { open: { daysBefore: 2, time: '이십오시' } },
    },
  });
  expect(res.status()).toBe(400);
  const body = await res.json();
  expect(body.code).toBe('INVALID_BOOKING_POLICY');
  expect(Array.isArray(body.detail)).toBe(true);

  // 거절됐으니 DB 값은 그대로여야 한다
  const { data } = await svc
    .from('classes')
    .select('booking_policy')
    .eq('id', F.cUntagged.id)
    .single();
  expect(data.booking_policy).toEqual({ open: null, close: { minutesBefore: 0 } });
});

test('B5 다른 학원의 그룹으로는 태깅할 수 없다', async ({ request }) => {
  const other = await ins('academies', {
    name_kr: `T8타학원-${stamp}`,
    slug: `t8-bi-other-${stamp}`,
    is_active: true,
  });
  academyIds.push(other.id);
  const otherGroup = await ins('class_groups', {
    academy_id: other.id,
    key: 'normal',
    name: '정규',
    is_special: false,
  });

  const res = await request.patch(api('/class-readiness'), {
    headers: authHdr(F.ownerToken),
    data: { classId: F.cUntagged.id, classGroupId: otherGroup.id },
  });
  expect(res.status()).toBe(404);
  expect((await res.json()).code).toBe('CLASS_GROUP_NOT_FOUND');
});

test('B6 일괄 태깅은 동작하고 멱등하다', async ({ request }) => {
  // 일정툴이 새 학기에 수업을 무더기로 만든 상황 재현 (12컬럼 고정 insert)
  const made: string[] = [];
  for (let i = 0; i < 3; i++) {
    const c = await ins('classes', {
      academy_id: F.academy.id,
      title: `보드일괄-${stamp}-${i}`,
      class_type: 'regular',
      instructor_name: '보드강사',
      status: '정상',
      base_salary: 0,
      price: 0,
      max_students: 0,
      is_active: true,
    });
    made.push(c.id);
  }
  F.bulkIds = made;

  const before = await listNotReadyClasses(svc, F.academy.id);
  expect(made.every((id) => before.classes.some((c) => c.id === id))).toBe(true);

  const res = await request.post(api('/class-readiness/bulk'), {
    headers: authHdr(F.ownerToken),
    data: { classIds: made, classGroupId: F.group.id },
  });
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.requested).toBe(3);
  expect(body.updated).toBe(3);
  expect(body.unchanged).toBe(0);
  expect(body.skipped).toHaveLength(0);

  // 재실행 = 멱등: 아무것도 바뀌지 않고 전부 unchanged 로 흡수된다
  const again = await request.post(api('/class-readiness/bulk'), {
    headers: authHdr(F.ownerToken),
    data: { classIds: made, classGroupId: F.group.id },
  });
  expect(again.status()).toBe(200);
  const body2 = await again.json();
  expect(body2.updated).toBe(0);
  expect(body2.unchanged).toBe(3);

  const after = await listNotReadyClasses(svc, F.academy.id);
  expect(made.some((id) => after.classes.some((c) => c.id === id))).toBe(false);
});

test('B7 비직원은 어떤 엔드포인트도 쓸 수 없다', async ({ request }) => {
  const targets: [string, 'get' | 'patch' | 'post'][] = [
    ['/class-readiness', 'get'],
    ['/class-readiness', 'patch'],
    ['/class-readiness/bulk', 'post'],
  ];

  for (const [p, method] of targets) {
    const data = { classId: F.cUntagged.id, classIds: [F.cUntagged.id], classGroupId: F.group.id };

    // 학생 토큰 → 403
    const student =
      method === 'get'
        ? await request.get(api(p), { headers: authHdr(F.studentToken) })
        : method === 'patch'
          ? await request.patch(api(p), { headers: authHdr(F.studentToken), data })
          : await request.post(api(p), { headers: authHdr(F.studentToken), data });
    expect(student.status(), `${method} ${p} 학생`).toBe(403);

    // 무인증 → 401
    const anon =
      method === 'get'
        ? await request.get(api(p))
        : method === 'patch'
          ? await request.patch(api(p), { data })
          : await request.post(api(p), { data });
    expect(anon.status(), `${method} ${p} 익명`).toBe(401);
  }
});

// ===========================================================================
// C. 이벤트 지연 — 자주 도는 처리기
// ===========================================================================

test('C1 자주 도는 처리기가 대기 이벤트를 처리한다', async ({ request }) => {
  // 이벤트를 **바로 직전에** 만든다. 앞선 테스트가 남긴 이벤트에 기대면
  // 그 사이 다른 경로가 큐를 비웠을 때 이 테스트가 무의미해진다.
  const { data: sched, error } = await svc
    .from('schedules')
    .insert({
      class_id: F.cTagged.id,
      start_time: isoInHours(200),
      end_time: isoInHours(201),
      max_students: 10,
    })
    .select('id')
    .single();
  expect(error).toBeNull();
  F.c1Schedule = sched.id;

  const pending = await eventsFor(sched.id, 'SCHEDULE_CREATED');
  expect(pending).toHaveLength(1);
  expect(pending[0].status).toBe('PENDING');

  const { count: knownPending } = await svc
    .from('booking_events')
    .select('id', { count: 'exact', head: true })
    .eq('academy_id', F.academy.id)
    .eq('status', 'PENDING');

  const res = await request.get('/api/cron/process-booking-events', { headers: cronHdr() });
  expect(res.status()).toBe(200);
  const body = await res.json();
  const dump = JSON.stringify(body);

  expect(body.success, dump).toBe(true);
  expect(body.idle, dump).toBe(false);

  // 회귀 가드: Next 의 Data Cache(디스크 영속)가 켜져 있으면 이 프로브가 **방금 쓴 행을
  // 못 보거나 이미 지워진 행을 본다**. 실제로 그래서 처리기가 아무것도 안 하는 버그가 있었다.
  // 프로브는 최소한 이 학원의 대기 건수만큼은 봐야 한다.
  expect(body.pending_probe, dump).toBeGreaterThanOrEqual(knownPending ?? 1);
  expect(body.probe_error, dump).toBeNull();
  // 두 프로세서가 독립 concern 으로 돌았다
  expect(body.concerns.map((c: any) => c.name), dump).toEqual([
    'fixed_weekly_backfill',
    'class_cancel_propagation',
    'class_cancel_notifications',
  ]);
  expect(body.concerns.every((c: any) => c.ok), dump).toBe(true);

  // 프로세서가 스스로 보고한 처리 건수 — 같은 커넥션에서 나온 값이라 이게 정본이다
  const fw = body.concerns.find((c: any) => c.name === 'fixed_weekly_backfill');
  expect(fw.detail.processed, dump).toBeGreaterThan(0);
  expect(fw.detail.failed, dump).toBe(0);

  // 방금 만든 그 이벤트가 실제로 소비됐는가 — 이게 지연 문제의 본질이다.
  // `for update skip locked` + 읽기 지연 때문에 한 번에 안 잡힐 수 있어 짧게 수렴을 기다린다.
  // (cron 은 5분마다 돌고 멱등이므로 재시도는 실제 운영 동작과 같다.)
  const settled = await waitForNotPending(sched.id, 'SCHEDULE_CREATED', request);
  expect(settled, dump).not.toBe('PENDING');

  const pendingAfter = await waitForAcademyQueueDrained(F.academy.id, request);
  expect(pendingAfter, dump).toBe(0);
});

test('C2 큐가 비면 no-op 이고 프로세서를 아예 건너뛴다', async ({ request }) => {
  // C1 이 이 학원 이벤트를 비웠다. 다른 학원 이벤트가 남아있을 수 있으므로
  // idle 단정은 전역 PENDING 이 0 일 때만 한다.
  const { count } = await svc
    .from('booking_events')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'PENDING');

  const res = await request.get('/api/cron/process-booking-events', { headers: cronHdr() });
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.success).toBe(true);

  // 두 갈래 모두 단정한다 — 한쪽이 조용히 건너뛰면 검증이 아니게 된다.
  const names = body.concerns.map((c: any) => c.name);
  if ((count ?? 0) === 0) {
    expect(body.idle).toBe(true);
    // 빈 큐면 이벤트 프로세서를 부르지 않는다 — 알림 concern 하나만 남는다
    expect(names).toEqual(['class_cancel_notifications']);
    // 인덱스 조회 2번이 전부라 빨라야 한다
    expect(body.duration_ms).toBeLessThan(5000);
  } else {
    // 다른 학원의 대기 이벤트가 남아 있던 경우 — 그때는 반드시 처리 경로를 타야 한다
    expect(body.idle).toBe(false);
    expect(names).toEqual([
      'fixed_weekly_backfill',
      'class_cancel_propagation',
      'class_cancel_notifications',
    ]);
  }
});

test('C3 재실행해도 결과가 달라지지 않는다 (멱등)', async ({ request }) => {
  const snapshot = async () => {
    const { data } = await svc
      .from('booking_events')
      .select('id, status')
      .eq('academy_id', F.academy.id)
      .order('id');
    return JSON.stringify(data);
  };

  const before = await snapshot();
  const res = await request.get('/api/cron/process-booking-events', { headers: cronHdr() });
  expect(res.status()).toBe(200);
  expect(await snapshot()).toBe(before);
});

test('C4 일 1회 스윕은 여전히 5개 concern 을 독립적으로 돌린다', async ({ request }) => {
  const res = await request.get('/api/cron/expire-tickets', { headers: cronHdr() });
  expect([200, 207]).toContain(res.status());
  const body = await res.json();
  expect(body.concerns.map((c: any) => c.name)).toEqual([
    'tickets',
    'memberships',
    'bank_holds',
    'fixed_weekly_backfill',
    'class_cancel_propagation',
  ]);
  // 한 concern 이 실패해도 나머지가 돈다는 계약: 전부 결과 객체를 갖는다
  for (const c of body.concerns) {
    expect(c).toHaveProperty('ok');
    expect(c).toHaveProperty('detail');
  }
});
