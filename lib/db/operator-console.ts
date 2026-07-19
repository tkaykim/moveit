/**
 * 운영 콘솔 데이터 계층 (T9)
 *
 * 원장·인포데스크가 쓰는 세 화면의 조회를 담당한다.
 *
 * ⚠ 설계 규율 — N+1 금지.
 *   모든 함수는 "학생 수 / 예약 수"와 무관하게 **고정된 개수의 쿼리**만 쏜다.
 *   목록을 돌면서 한 건씩 조회하는 코드를 여기 추가하지 말 것.
 *   (수강생 200명인 학원에서 200번 왕복하면 인포데스크는 이 화면을 안 쓴다.)
 *
 * 판정 로직은 각 도메인 모듈(T3 멤버십 / T5 주문 / T6 고정주1회 / T8 준비큐)이
 * 이미 정본으로 갖고 있다. 여기서는 그 결과를 **읽어서 합칠 뿐** 다시 판정하지 않는다.
 */
import { kstToday, type DateString } from '@/lib/date/kst';

type Client = any;

/** KST 하루의 UTC 경계 [start, end) */
export function kstDayRangeUtc(date: DateString): { startUtc: string; endUtc: string } {
  const start = new Date(Date.parse(`${date}T00:00:00+09:00`));
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { startUtc: start.toISOString(), endUtc: end.toISOString() };
}

/** 빈 배열에 .in() 을 쏘면 supabase 가 이상하게 동작하므로 명시적으로 막는다 */
function uniq<T>(xs: (T | null | undefined)[]): T[] {
  return Array.from(new Set(xs.filter((x): x is T => x != null && x !== '')));
}

function byId<T extends { id: string }>(rows: T[] | null): Map<string, T> {
  return new Map((rows ?? []).map((r) => [r.id, r]));
}

/* ------------------------------------------------------------------ */
/* 1. 수업별 예약자 명단                                                 */
/* ------------------------------------------------------------------ */

export type DeductionState = 'DEDUCTED' | 'NOT_DEDUCTED' | 'REFUNDED' | 'NONE';
export type AttendanceState = 'ATTENDED' | 'BOOKED' | 'CANCELLED' | 'PENDING';

export interface RosterStudent {
  booking_id: string;
  user_id: string | null;
  student_name: string;
  contact: string | null;
  ticket_name: string | null;
  ticket_type: string | null;
  user_ticket_id: string | null;
  remaining_count: number | null;
  deduction_state: DeductionState;
  deduction_label: string;
  attendance_state: AttendanceState;
  attendance_label: string;
  /** 미입금(홀드) 주문에서 넘어온 예약인가 */
  from_held_order: boolean;
  held_order_id: string | null;
  hold_expires_at: string | null;
  is_admin_added: boolean;
}

export interface RosterOccurrence {
  schedule_id: string;
  class_id: string;
  class_title: string;
  instructor_name: string | null;
  start_time: string;
  end_time: string | null;
  is_canceled: boolean;
  max_students: number | null;
  booked_count: number;
  attended_count: number;
  held_count: number;
  students: RosterStudent[];
}

const ATTENDANCE_LABEL: Record<AttendanceState, string> = {
  ATTENDED: '출석',
  BOOKED: '예약',
  CANCELLED: '취소',
  PENDING: '대기',
};

const DEDUCTION_LABEL: Record<DeductionState, string> = {
  DEDUCTED: '차감됨',
  NOT_DEDUCTED: '차감 전',
  REFUNDED: '반환됨',
  NONE: '수강권 없음',
};

function attendanceOf(status: string | null): AttendanceState {
  switch ((status ?? '').toUpperCase()) {
    case 'COMPLETED':
      return 'ATTENDED';
    case 'CANCELLED':
      return 'CANCELLED';
    case 'PENDING':
      return 'PENDING';
    default:
      return 'BOOKED';
  }
}

function deductionOf(
  attendance: AttendanceState,
  userTicketId: string | null,
  ticketStatus: string | null
): DeductionState {
  if (!userTicketId) return 'NONE';
  if ((ticketStatus ?? '').toUpperCase() === 'REFUNDED') return 'REFUNDED';
  if (attendance === 'CANCELLED') return 'REFUNDED';
  if (attendance === 'PENDING') return 'NOT_DEDUCTED';
  return 'DEDUCTED';
}

/**
 * 특정 날짜(KST)의 회차별 예약자 명단.
 * 쿼리 수: 6회 고정 (수업 → 회차 → 예약 → 학생 → 수강권 → 수강권상품/주문).
 */
export async function getRoster(
  client: Client,
  academyId: string,
  date: DateString
): Promise<{ date: DateString; occurrences: RosterOccurrence[] }> {
  const { startUtc, endUtc } = kstDayRangeUtc(date);

  // (1) 이 학원의 수업
  const { data: classes } = await client
    .from('classes')
    .select('id, title, instructor_name')
    .eq('academy_id', academyId);
  const classIds = uniq((classes ?? []).map((c: any) => c.id as string));
  if (classIds.length === 0) return { date, occurrences: [] };
  const classMap = byId<any>(classes);

  // (2) 그 날의 회차
  const { data: schedules } = await client
    .from('schedules')
    .select('id, class_id, start_time, end_time, max_students, is_canceled, instructor_name_text')
    .in('class_id', classIds)
    .gte('start_time', startUtc)
    .lt('start_time', endUtc)
    .order('start_time', { ascending: true });
  const scheduleIds = uniq((schedules ?? []).map((s: any) => s.id as string));
  if (scheduleIds.length === 0) return { date, occurrences: [] };

  // (3) 예약
  const { data: bookings } = await client
    .from('bookings')
    .select(
      'id, schedule_id, class_id, user_id, user_ticket_id, status, payment_status, guest_name, guest_phone, is_admin_added, order_group_id, hold_expires_at, created_at'
    )
    .in('schedule_id', scheduleIds)
    .order('created_at', { ascending: true });

  const rows = bookings ?? [];

  // (4~6) 부가 정보 — 전부 한 번씩만
  const [usersRes, userTicketsRes, orderGroupsRes] = await Promise.all([
    (async () => {
      const ids = uniq(rows.map((b: any) => b.user_id));
      if (!ids.length) return { data: [] };
      return client.from('users').select('id, name, nickname, phone, email').in('id', ids);
    })(),
    (async () => {
      const ids = uniq(rows.map((b: any) => b.user_ticket_id));
      if (!ids.length) return { data: [] };
      return client
        .from('user_tickets')
        .select('id, ticket_id, remaining_count, status, expiry_date')
        .in('id', ids);
    })(),
    (async () => {
      const ids = uniq(rows.map((b: any) => b.order_group_id));
      if (!ids.length) return { data: [] };
      return client.from('order_groups').select('id, status, method, expires_at').in('id', ids);
    })(),
  ]);

  const userMap = byId<any>(usersRes.data);
  const utMap = byId<any>(userTicketsRes.data);
  const ogMap = byId<any>(orderGroupsRes.data);

  // 수강권 상품명 (한 번 더 — 여전히 고정 횟수)
  const ticketIds = uniq((userTicketsRes.data ?? []).map((t: any) => t.ticket_id));
  const ticketMap = ticketIds.length
    ? byId<any>(
        (await client.from('tickets').select('id, name, ticket_type').in('id', ticketIds)).data
      )
    : new Map<string, any>();

  const bySchedule = new Map<string, RosterStudent[]>();
  for (const b of rows) {
    const attendance = attendanceOf(b.status);
    const ut = b.user_ticket_id ? utMap.get(b.user_ticket_id) : null;
    const tk = ut?.ticket_id ? ticketMap.get(ut.ticket_id) : null;
    const og = b.order_group_id ? ogMap.get(b.order_group_id) : null;
    const u = b.user_id ? userMap.get(b.user_id) : null;
    const deduction = deductionOf(attendance, b.user_ticket_id ?? null, ut?.status ?? null);

    // 미입금 홀드: 주문이 아직 확정 전이거나, 예약 자체에 홀드 만료가 걸려 있다
    // order_groups.status: DRAFT | PENDING_PAYMENT | PAYMENT_APPROVED | CONFIRMED | FULFILLMENT_FAILED | CANCELED | EXPIRED
    const orderPending = !!og && String(og.status) !== 'CONFIRMED';
    const fromHeld = orderPending || (!!b.hold_expires_at && attendance === 'PENDING');

    const entry: RosterStudent = {
      booking_id: b.id,
      user_id: b.user_id ?? null,
      student_name: u?.name || u?.nickname || b.guest_name || '이름 없음',
      contact: u?.phone || b.guest_phone || u?.email || null,
      ticket_name: tk?.name ?? null,
      ticket_type: tk?.ticket_type ?? null,
      user_ticket_id: b.user_ticket_id ?? null,
      remaining_count: ut?.remaining_count ?? null,
      deduction_state: deduction,
      deduction_label: DEDUCTION_LABEL[deduction],
      attendance_state: attendance,
      attendance_label: ATTENDANCE_LABEL[attendance],
      from_held_order: fromHeld,
      held_order_id: fromHeld ? (b.order_group_id ?? null) : null,
      hold_expires_at: b.hold_expires_at ?? og?.expires_at ?? null,
      is_admin_added: !!b.is_admin_added,
    };
    const list = bySchedule.get(b.schedule_id) ?? [];
    list.push(entry);
    bySchedule.set(b.schedule_id, list);
  }

  const occurrences: RosterOccurrence[] = (schedules ?? []).map((s: any) => {
    const students = bySchedule.get(s.id) ?? [];
    const live = students.filter((x) => x.attendance_state !== 'CANCELLED');
    return {
      schedule_id: s.id,
      class_id: s.class_id,
      class_title: classMap.get(s.class_id)?.title ?? '이름 없는 수업',
      instructor_name: s.instructor_name_text || classMap.get(s.class_id)?.instructor_name || null,
      start_time: s.start_time,
      end_time: s.end_time ?? null,
      is_canceled: !!s.is_canceled,
      max_students: s.max_students ?? null,
      booked_count: live.length,
      attended_count: students.filter((x) => x.attendance_state === 'ATTENDED').length,
      held_count: live.filter((x) => x.from_held_order).length,
      students,
    };
  });

  return { date, occurrences };
}

/* ------------------------------------------------------------------ */
/* 2. 수강생 목록 (보유 수강권 + 현재 멤버십)                             */
/* ------------------------------------------------------------------ */

export interface StudentTicketSummary {
  user_ticket_id: string;
  ticket_name: string;
  ticket_type: string | null;
  remaining_count: number | null;
  start_date: string | null;
  expiry_date: string | null;
  status: string | null;
  /** 아직 시작 안 한 수강권 (start_date 가 미래이거나 비어 있음) */
  not_started: boolean;
}

export interface StudentOverviewRow {
  user_id: string;
  name: string;
  contact: string | null;
  tickets: StudentTicketSummary[];
  active_ticket_count: number;
  membership_name: string | null;
  membership_status: string | null;
  membership_end_date: string | null;
  student_membership_id: string | null;
}

/**
 * 학원 수강생 + 보유 수강권 + 현재 멤버십.
 * 쿼리 수: 5회 고정 — 학생 수와 무관하다. (여기서 학생별 조회를 도는 순간 결함이다)
 */
export async function getStudentOverview(
  client: Client,
  academyId: string,
  opts: { today?: DateString } = {}
): Promise<{ students: StudentOverviewRow[] }> {
  const today = opts.today ?? kstToday();

  // (1) 이 학원 소속 수강생 후보 = 멤버십 보유자 ∪ 이 학원 수강권 보유자
  const [smRes, ticketRes] = await Promise.all([
    client
      .from('student_memberships')
      .select('id, user_id, membership_id, status, start_date, end_date')
      .eq('academy_id', academyId),
    client.from('tickets').select('id, name, ticket_type').eq('academy_id', academyId),
  ]);

  const academyTickets = byId<any>(ticketRes.data);
  const academyTicketIds = Array.from(academyTickets.keys());

  // (2) 이 학원 수강권을 보유한 user_tickets
  const { data: userTickets } = academyTicketIds.length
    ? await client
        .from('user_tickets')
        .select('id, user_id, ticket_id, remaining_count, start_date, expiry_date, status')
        .in('ticket_id', academyTicketIds)
    : { data: [] as any[] };

  const userIds = uniq([
    ...(smRes.data ?? []).map((r: any) => r.user_id as string),
    ...(userTickets ?? []).map((r: any) => r.user_id as string),
  ]);
  if (userIds.length === 0) return { students: [] };

  // (3) 학생 신상 + (4) 멤버십 정의 — 각 1회
  const [usersRes, membershipsRes] = await Promise.all([
    client.from('users').select('id, name, nickname, phone, email').in('id', userIds),
    client.from('memberships').select('id, name').eq('academy_id', academyId),
  ]);
  const userMap = byId<any>(usersRes.data);
  const membershipMap = byId<any>(membershipsRes.data);

  // 학생별 수강권 묶기
  const ticketsByUser = new Map<string, StudentTicketSummary[]>();
  for (const ut of userTickets ?? []) {
    const tk = academyTickets.get(ut.ticket_id);
    const list = ticketsByUser.get(ut.user_id) ?? [];
    list.push({
      user_ticket_id: ut.id,
      ticket_name: tk?.name ?? '이름 없는 수강권',
      ticket_type: tk?.ticket_type ?? null,
      remaining_count: ut.remaining_count ?? null,
      start_date: ut.start_date ?? null,
      expiry_date: ut.expiry_date ?? null,
      status: ut.status ?? null,
      not_started: !ut.start_date || ut.start_date > today,
    });
    ticketsByUser.set(ut.user_id, list);
  }

  // 학생별 현재 멤버십 — ACTIVE 우선, 없으면 가장 최근 것
  const smByUser = new Map<string, any>();
  for (const sm of smRes.data ?? []) {
    const prev = smByUser.get(sm.user_id);
    if (!prev) {
      smByUser.set(sm.user_id, sm);
      continue;
    }
    const better = sm.status === 'ACTIVE' && prev.status !== 'ACTIVE';
    if (better) smByUser.set(sm.user_id, sm);
  }

  const students: StudentOverviewRow[] = userIds.map((uid) => {
    const u = userMap.get(uid);
    const sm = smByUser.get(uid);
    const tickets = ticketsByUser.get(uid) ?? [];
    return {
      user_id: uid,
      name: u?.name || u?.nickname || '이름 없음',
      contact: u?.phone || u?.email || null,
      tickets,
      active_ticket_count: tickets.filter(
        (t) => (t.status ?? '').toUpperCase() === 'ACTIVE' || t.not_started
      ).length,
      membership_name: sm ? (membershipMap.get(sm.membership_id)?.name ?? null) : null,
      membership_status: sm?.status ?? null,
      membership_end_date: sm?.end_date ?? null,
      student_membership_id: sm?.id ?? null,
    };
  });

  students.sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  return { students };
}

/* ------------------------------------------------------------------ */
/* 3. 재처리 대시보드 — 다섯 갈래                                        */
/* ------------------------------------------------------------------ */

export interface ReprocessLists {
  stuckOrders: any[];
  failedEvents: any[];
  placementIssues: any[];
  expiredMembershipBookings: any[];
  notReadyClasses: any[];
}

/**
 * "조용히 썩는 것이 없어야 한다" 화면의 다섯 목록을 한 번에.
 * 각 목록은 이미 존재하는 정본(RPC/테이블)에서 읽는다 — 판정을 여기서 새로 하지 않는다.
 */
export async function getReprocessLists(
  client: Client,
  academyId: string,
  helpers: {
    reviewQueue: () => Promise<any[]>;
    notReadyClasses: () => Promise<any[]>;
  }
): Promise<ReprocessLists> {
  const [stuck, events, issues, queue, notReady] = await Promise.all([
    client.rpc('list_stuck_orders', { p_academy_id: academyId, p_limit: 200 }),
    client
      .from('booking_events')
      .select('id, event_type, schedule_id, status, attempts, last_error, created_at, processed_at')
      .eq('academy_id', academyId)
      .eq('status', 'FAILED')
      .order('created_at', { ascending: false })
      .limit(200),
    client
      .from('fixed_weekly_placement_issues')
      .select(
        'id, user_id, user_ticket_id, class_id, schedule_id, occurrence_date, reason, shortfall, detail, source, created_at'
      )
      .eq('academy_id', academyId)
      .is('resolved_at', null)
      .order('created_at', { ascending: false })
      .limit(200),
    helpers.reviewQueue().catch(() => []),
    helpers.notReadyClasses().catch(() => []),
  ]);

  return {
    stuckOrders: stuck?.data ?? [],
    failedEvents: events?.data ?? [],
    placementIssues: issues?.data ?? [],
    expiredMembershipBookings: queue ?? [],
    notReadyClasses: Array.isArray(notReady) ? notReady : ((notReady as any)?.classes ?? []),
  };
}
