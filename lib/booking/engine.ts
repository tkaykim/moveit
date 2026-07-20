/**
 * 예약 엔진 조립층 (T2)
 *
 * 순수 모듈(kst / policy / coverage / selection)에 DB 컨텍스트를 붙여
 * "사전 판정(preflight)"을 만든다.
 *
 * ⚠ preflight 는 **UX 용 사전검사일 뿐** 이다. 실제 확정은 반드시 DB 함수
 *    create_booking_tx 가 스케줄 행 락 아래에서 전부 재검증한 뒤 수행한다.
 *    여기서 통과했다고 해서 예약이 보장되지 않는다.
 */
import { scheduleKstDate, type DateString } from '@/lib/date/kst';
import {
  resolveBookingPolicy,
  evaluateBookingWindow,
  type BookingPolicy,
  type BookingWindowState,
} from '@/lib/booking/policy';
import type { CoverageClassContext, CoverageTicketContext } from '@/lib/booking/coverage';
import {
  selectUserTicket,
  type SelectableUserTicket,
  type SelectionResult,
} from '@/lib/booking/selection';

type AnyClient = any;

export interface BookingContext {
  scheduleId: string;
  scheduleStart: string;
  isCanceled: boolean;
  maxStudents: number | null;
  classDate: DateString;
  klass: CoverageClassContext;
  audienceMembershipId: string | null;
  policy: BookingPolicy;
  /**
   * 이 학원이 class_groups 를 도입했는가.
   * false 면 T2 엔진 규칙을 강제하지 않고 기존(레거시) 예약 경로를 그대로 쓴다.
   * — 아직 그룹을 설정하지 않은 기존 학원의 예약이 깨지지 않도록 하는 스위치.
   */
  academyUsesGroups: boolean;
}

export async function loadBookingContext(
  client: AnyClient,
  scheduleId: string
): Promise<BookingContext | null> {
  const { data: sched } = await client
    .from('schedules')
    .select(
      `id, start_time, is_canceled, max_students, class_id,
       classes ( id, academy_id, class_group_id, audience_membership_id, booking_policy )`
    )
    .eq('id', scheduleId)
    .maybeSingle();

  if (!sched || !sched.classes) return null;
  const c = sched.classes;

  let groupIsSpecial = false;
  if (c.class_group_id) {
    const { data: grp } = await client
      .from('class_groups')
      .select('is_special')
      .eq('id', c.class_group_id)
      .maybeSingle();
    groupIsSpecial = grp?.is_special === true;
  }

  const { data: academy } = await client
    .from('academies')
    .select('booking_policy')
    .eq('id', c.academy_id)
    .maybeSingle();

  const { count: groupCount } = await client
    .from('class_groups')
    .select('id', { count: 'exact', head: true })
    .eq('academy_id', c.academy_id);

  return {
    scheduleId: sched.id,
    scheduleStart: sched.start_time,
    isCanceled: sched.is_canceled === true,
    maxStudents: sched.max_students ?? null,
    classDate: scheduleKstDate(sched.start_time),
    klass: {
      id: c.id,
      academyId: c.academy_id,
      classGroupId: c.class_group_id ?? null,
      groupIsSpecial,
    },
    audienceMembershipId: c.audience_membership_id ?? null,
    policy: resolveBookingPolicy(academy?.booking_policy ?? null, c.booking_policy ?? null),
    academyUsesGroups: (groupCount ?? 0) > 0,
  };
}

/** 이 사용자의 선택 후보 수강권을 커버리지 판정에 필요한 형태로 적재 */
export async function loadSelectableTickets(
  client: AnyClient,
  userId: string,
  academyId: string
): Promise<SelectableUserTicket[]> {
  const { data: rows } = await client
    .from('user_tickets')
    .select(
      `id, status, remaining_count, start_date, expiry_date, fixed_class_id, ticket_id,
       tickets ( id, academy_id, is_general, class_id, ticket_type, start_mode )`
    )
    .eq('user_id', userId)
    .eq('status', 'ACTIVE');

  const list = (rows || []).filter((r: any) => r.tickets);
  if (list.length === 0) return [];

  const ticketIds = Array.from(new Set(list.map((r: any) => r.tickets.id)));

  const [{ data: tcRows }, { data: tvRows }] = await Promise.all([
    client.from('ticket_classes').select('ticket_id, class_id').in('ticket_id', ticketIds),
    client
      .from('ticket_coverage')
      .select('ticket_id, class_group_id')
      .in('ticket_id', ticketIds)
      .eq('is_active', true),
  ]);

  const mapped = new Map<string, string[]>();
  for (const r of tcRows || []) {
    if (!mapped.has(r.ticket_id)) mapped.set(r.ticket_id, []);
    mapped.get(r.ticket_id)!.push(r.class_id);
  }
  const covered = new Map<string, string[]>();
  for (const r of tvRows || []) {
    if (!covered.has(r.ticket_id)) covered.set(r.ticket_id, []);
    covered.get(r.ticket_id)!.push(r.class_group_id);
  }

  return list.map((r: any): SelectableUserTicket => {
    const t = r.tickets;
    const ticket: CoverageTicketContext = {
      id: t.id,
      academyId: t.academy_id ?? null,
      isGeneral: t.is_general === true,
      classId: t.class_id ?? null,
      mappedClassIds: mapped.get(t.id) || [],
      coveredClassGroupIds: covered.get(t.id) || [],
    };
    void academyId;
    return {
      id: r.id,
      status: r.status,
      remainingCount: r.remaining_count,
      startDate: r.start_date,
      expiryDate: r.expiry_date,
      fixedClassId: r.fixed_class_id ?? null,
      startMode: t.start_mode ?? null,
      ticketType: t.ticket_type ?? null,
      ticket,
    };
  });
}

export type PreflightFailure =
  | 'SCHEDULE_NOT_FOUND'
  | 'SCHEDULE_CANCELED'
  | 'CLASS_NOT_BOOKABLE'
  | 'AUDIENCE_NOT_ELIGIBLE'
  | 'BOOKING_NOT_YET_OPEN'
  | 'BOOKING_CLOSED'
  | 'NO_USABLE_TICKET';

export interface PreflightResult {
  ok: boolean;
  failure: PreflightFailure | null;
  window: BookingWindowState | null;
  selection: SelectionResult | null;
  context: BookingContext | null;
}

export async function preflightBooking(
  client: AnyClient,
  params: {
    userId: string;
    scheduleId: string;
    designatedUserTicketId?: string | null;
    now?: Date;
  }
): Promise<PreflightResult> {
  const now = params.now ?? new Date();
  const ctx = await loadBookingContext(client, params.scheduleId);
  if (!ctx) {
    return { ok: false, failure: 'SCHEDULE_NOT_FOUND', window: null, selection: null, context: null };
  }
  const base = { window: null as BookingWindowState | null, selection: null, context: ctx };

  if (ctx.isCanceled) return { ok: false, failure: 'SCHEDULE_CANCELED', ...base };
  if (!ctx.klass.classGroupId) return { ok: false, failure: 'CLASS_NOT_BOOKABLE', ...base };

  if (ctx.audienceMembershipId) {
    const { data: sm } = await client
      .from('student_memberships')
      .select('id, start_date, end_date')
      .eq('user_id', params.userId)
      .eq('membership_id', ctx.audienceMembershipId)
      .eq('status', 'ACTIVE')
      .lte('start_date', ctx.classDate);
    const eligible = (sm || []).some(
      (r: any) => r.end_date === null || r.end_date >= ctx.classDate
    );
    if (!eligible) return { ok: false, failure: 'AUDIENCE_NOT_ELIGIBLE', ...base };
  }

  const window = evaluateBookingWindow(ctx.scheduleStart, ctx.policy, now);
  if (window === 'NOT_YET_OPEN') {
    return { ok: false, failure: 'BOOKING_NOT_YET_OPEN', window, selection: null, context: ctx };
  }
  if (window === 'CLOSED') {
    return { ok: false, failure: 'BOOKING_CLOSED', window, selection: null, context: ctx };
  }

  const candidates = await loadSelectableTickets(client, params.userId, ctx.klass.academyId);
  const selection = selectUserTicket({
    candidates,
    klass: ctx.klass,
    classDate: ctx.classDate,
    designatedUserTicketId: params.designatedUserTicketId ?? null,
  });

  if (!selection.selected) {
    return { ok: false, failure: 'NO_USABLE_TICKET', window, selection, context: ctx };
  }
  return { ok: true, failure: null, window, selection, context: ctx };
}

/** DB 에러 코드 → 사용자 메시지 (단일 정본) */
export const BOOKING_ERROR_MESSAGES: Record<string, string> = {
  SCHEDULE_NOT_FOUND: '스케줄 정보를 찾을 수 없습니다.',
  CLASS_NOT_FOUND: '클래스 정보를 찾을 수 없습니다.',
  SCHEDULE_CANCELED: '취소된 수업에는 예약할 수 없습니다.',
  CLASS_NOT_BOOKABLE: '이 수업은 예약할 수 없습니다.',
  AUDIENCE_NOT_ELIGIBLE: '이 수업을 예약할 수 있는 대상이 아닙니다.',
  BOOKING_NOT_YET_OPEN: '아직 예약 오픈 전입니다.',
  BOOKING_CLOSED: '예약이 마감되었습니다.',
  SPECIAL_CLASS_NOT_COVERED: '보유하신 수강권으로는 예약할 수 없는 수업입니다.',
  TICKET_NOT_COVERED: '이 수업에 사용할 수 없는 수강권입니다.',
  FIXED_CLASS_MISMATCH: '이 수강권은 지정된 수업에서만 사용할 수 있습니다.',
  TICKET_NOT_STARTED: '아직 사용 시작 전인 수강권입니다.',
  TICKET_EXPIRED: '수업일 기준으로 만료된 수강권입니다.',
  TICKET_NOT_ACTIVE: '사용할 수 없는 상태의 수강권입니다.',
  DUPLICATE_BOOKING: '이미 예약된 수업입니다.',
  SCHEDULE_FULL: '정원이 마감되었습니다.',
  NO_USABLE_TICKET: '이 수업에 사용 가능한 수강권이 없습니다.',
  USER_TICKET_NOT_FOUND: '수강권을 찾을 수 없습니다.',
  INSUFFICIENT_TICKET_COUNT: '수강권 잔여 횟수가 부족합니다.',
  NOT_AUTHENTICATED: '로그인이 필요합니다.',
  NOT_BOOKING_OWNER: '권한이 없습니다.',
};

const CONFLICT_CODES = new Set(['DUPLICATE_BOOKING', 'SCHEDULE_FULL']);

export function mapBookingError(raw: unknown): { code: string; message: string; status: number } {
  const text = typeof raw === 'string' ? raw : (raw as any)?.message || '';
  const code = Object.keys(BOOKING_ERROR_MESSAGES).find((k) => text.includes(k));
  if (!code) {
    return { code: 'UNKNOWN', message: '예약 생성에 실패했습니다.', status: 500 };
  }
  const status = CONFLICT_CODES.has(code)
    ? 409
    : code === 'NOT_AUTHENTICATED'
      ? 401
      : code === 'NOT_BOOKING_OWNER' || code === 'AUDIENCE_NOT_ELIGIBLE'
        ? 403
        : 400;
  return { code, message: BOOKING_ERROR_MESSAGES[code], status };
}
