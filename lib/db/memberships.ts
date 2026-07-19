/**
 * 멤버십 도메인 DB 계층 (T3)
 *
 * 쓰기(부여/정지/재개/연장)는 전부 DB 함수(RPC)를 통한다 — 원자성과 권한 검사가
 * 함수 안에 있기 때문에 여기서 테이블을 직접 INSERT 하지 않는다.
 *
 * 혜택 제거는 항상 소프트 삭제(is_active = false). DELETE 하지 않는다.
 */
import { kstToday, type DateString } from '@/lib/date/kst';
import {
  resolveDiscount,
  type DiscountTarget,
  type LegacyDiscountRow,
  type MembershipDiscountRow,
  type MembershipStatus,
  type ResolvedDiscount,
  NO_DISCOUNT,
} from '@/lib/membership/discount';
import type { StudentMembershipRow } from '@/lib/membership/eligibility';

type Client = any;

export interface TicketCoverageRow {
  id: string;
  ticket_id: string;
  class_group_id: string;
  is_active: boolean;
  created_at: string;
}

export interface MembershipDefinition {
  id: string;
  academy_id: string;
  key: string;
  name: string;
  visibility: 'hidden' | 'locked';
  is_active: boolean;
  bundled_ticket_id: string | null;
  perks_text: string[] | null;
  description: string | null;
  created_at: string;
}

/** 도메인 에러 — API 라우트가 상태코드로 변환한다 */
export class MembershipError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = 'MembershipError';
  }
}

const ERROR_MESSAGES: Record<string, string> = {
  NOT_AUTHENTICATED: '로그인이 필요합니다.',
  NOT_AUTHORIZED: '권한이 없습니다.',
  NOT_ACADEMY_STAFF: '학원 관리자 권한이 필요합니다.',
  MEMBERSHIP_NOT_FOUND: '멤버십을 찾을 수 없습니다.',
  MEMBERSHIP_ACADEMY_MISMATCH: '해당 학원의 멤버십이 아닙니다.',
  MEMBERSHIP_INACTIVE: '비활성 멤버십은 부여할 수 없습니다.',
  STUDENT_MEMBERSHIP_NOT_FOUND: '학생 멤버십을 찾을 수 없습니다.',
  ALREADY_ACTIVE_MEMBERSHIP: '이미 이 학원에서 유효한 멤버십을 보유하고 있습니다.',
  BUNDLED_TICKET_INVALID: '멤버십에 연결된 수강권이 올바르지 않습니다.',
  INVALID_STATE_TRANSITION: '허용되지 않는 상태 변경입니다.',
  INVALID_DATE_RANGE: '종료일은 시작일보다 빠를 수 없습니다.',
  INVALID_ARGUMENT: '요청 값이 올바르지 않습니다.',
};

/** Postgres 에러를 도메인 에러로 정규화 */
export function toMembershipError(error: { message?: string } | null): MembershipError {
  const raw = error?.message ?? '';
  const code = Object.keys(ERROR_MESSAGES).find((c) => raw.includes(c));
  if (code) return new MembershipError(code, ERROR_MESSAGES[code]);
  return new MembershipError('UNKNOWN', raw || '알 수 없는 오류가 발생했습니다.');
}

/** supabase-js 결과에서 data 를 꺼내되 error 는 도메인 에러로 변환한다 */
function unwrap<T>(res: { data: unknown; error: { message?: string } | null }): T {
  if (res.error) throw toMembershipError(res.error);
  return res.data as T;
}

/* ------------------------------------------------------------------ */
/* 멤버십 정의 CRUD                                                     */
/* ------------------------------------------------------------------ */

export async function listMemberships(
  client: Client,
  academyId: string,
  opts: { includeInactive?: boolean } = {}
): Promise<MembershipDefinition[]> {
  let q = client.from('memberships').select('*').eq('academy_id', academyId);
  if (!opts.includeInactive) q = q.eq('is_active', true);
  return unwrap<MembershipDefinition[]>(await q.order('created_at', { ascending: true })) ?? [];
}

export async function getMembership(
  client: Client,
  academyId: string,
  membershipId: string
): Promise<MembershipDefinition | null> {
  const rows = unwrap<MembershipDefinition[]>(
    await client
      .from('memberships')
      .select('*')
      .eq('academy_id', academyId)
      .eq('id', membershipId)
      .limit(1)
  );
  return rows?.[0] ?? null;
}

export async function createMembership(
  client: Client,
  academyId: string,
  input: {
    key: string;
    name: string;
    visibility?: 'hidden' | 'locked';
    bundled_ticket_id?: string | null;
    perks_text?: string[] | null;
    description?: string | null;
  }
): Promise<MembershipDefinition> {
  if (input.bundled_ticket_id) {
    const t = unwrap<Array<{ id: string; academy_id: string | null }>>(
      await client.from('tickets').select('id, academy_id').eq('id', input.bundled_ticket_id).limit(1)
    );
    if (!t?.[0] || t[0].academy_id !== academyId) {
      throw new MembershipError('BUNDLED_TICKET_INVALID', ERROR_MESSAGES.BUNDLED_TICKET_INVALID);
    }
  }
  const rows = unwrap<MembershipDefinition[]>(
    await client
      .from('memberships')
      .insert({
        academy_id: academyId,
        key: input.key,
        name: input.name,
        visibility: input.visibility ?? 'hidden',
        bundled_ticket_id: input.bundled_ticket_id ?? null,
        perks_text: input.perks_text ?? null,
        description: input.description ?? null,
      })
      .select('*')
  );
  return rows[0];
}

export async function updateMembership(
  client: Client,
  academyId: string,
  membershipId: string,
  patch: Partial<Pick<MembershipDefinition,
    'name' | 'visibility' | 'bundled_ticket_id' | 'perks_text' | 'description' | 'is_active'>>
): Promise<MembershipDefinition> {
  const rows = unwrap<MembershipDefinition[]>(
    await client
      .from('memberships')
      .update(patch)
      .eq('academy_id', academyId)
      .eq('id', membershipId)
      .select('*')
  );
  if (!rows?.[0]) throw new MembershipError('MEMBERSHIP_NOT_FOUND', ERROR_MESSAGES.MEMBERSHIP_NOT_FOUND);
  return rows[0];
}

/* ------------------------------------------------------------------ */
/* 혜택: membership_discounts / ticket_coverage — 제거는 항상 소프트      */
/* ------------------------------------------------------------------ */

export async function listMembershipDiscounts(
  client: Client,
  membershipId: string,
  opts: { includeInactive?: boolean } = {}
): Promise<MembershipDiscountRow[]> {
  let q = client.from('membership_discounts').select('*').eq('membership_id', membershipId);
  if (!opts.includeInactive) q = q.eq('is_active', true);
  return unwrap<MembershipDiscountRow[]>(await q.order('percent', { ascending: false })) ?? [];
}

export async function upsertMembershipDiscount(
  client: Client,
  membershipId: string,
  input: { class_group_id?: string | null; ticket_id?: string | null; percent: number }
): Promise<MembershipDiscountRow> {
  const hasGroup = !!input.class_group_id;
  const hasTicket = !!input.ticket_id;
  if (hasGroup === hasTicket) {
    throw new MembershipError('INVALID_ARGUMENT', '대상은 수업 그룹 또는 수강권 중 정확히 하나여야 합니다.');
  }
  if (!Number.isInteger(input.percent) || input.percent < 1 || input.percent > 100) {
    throw new MembershipError('INVALID_ARGUMENT', '할인율은 1~100 사이 정수여야 합니다.');
  }
  const rows = unwrap<MembershipDiscountRow[]>(
    await client
      .from('membership_discounts')
      .insert({
        membership_id: membershipId,
        class_group_id: input.class_group_id ?? null,
        ticket_id: input.ticket_id ?? null,
        percent: input.percent,
        is_active: true,
      })
      .select('*')
  );
  return rows[0];
}

/** 소프트 제거 — 행은 남기고 is_active 만 내린다 */
export async function setMembershipDiscountActive(
  client: Client,
  membershipId: string,
  discountId: string,
  isActive: boolean
): Promise<MembershipDiscountRow> {
  const rows = unwrap<MembershipDiscountRow[]>(
    await client
      .from('membership_discounts')
      .update({ is_active: isActive })
      .eq('membership_id', membershipId)
      .eq('id', discountId)
      .select('*')
  );
  if (!rows?.[0]) throw new MembershipError('NOT_FOUND', '할인 규칙을 찾을 수 없습니다.');
  return rows[0];
}

export async function listTicketCoverage(
  client: Client,
  ticketId: string,
  opts: { includeInactive?: boolean } = {}
) {
  let q = client.from('ticket_coverage').select('*').eq('ticket_id', ticketId);
  if (!opts.includeInactive) q = q.eq('is_active', true);
  return unwrap<TicketCoverageRow[]>(await q) ?? [];
}

export async function upsertTicketCoverage(
  client: Client,
  ticketId: string,
  classGroupId: string
) {
  const rows = unwrap<TicketCoverageRow[]>(
    await client
      .from('ticket_coverage')
      .upsert(
        { ticket_id: ticketId, class_group_id: classGroupId, is_active: true },
        { onConflict: 'ticket_id,class_group_id' }
      )
      .select('*')
  );
  return rows[0];
}

/** 소프트 제거 */
export async function setTicketCoverageActive(
  client: Client,
  coverageId: string,
  isActive: boolean
) {
  const rows = unwrap<TicketCoverageRow[]>(
    await client.from('ticket_coverage').update({ is_active: isActive }).eq('id', coverageId).select('*')
  );
  if (!rows?.[0]) throw new MembershipError('NOT_FOUND', '커버리지 규칙을 찾을 수 없습니다.');
  return rows[0];
}

/* ------------------------------------------------------------------ */
/* 학생 멤버십 — 부여 / 상태 전이 (전부 RPC)                             */
/* ------------------------------------------------------------------ */

export async function listStudentMemberships(
  client: Client,
  academyId: string,
  opts: { userId?: string; status?: MembershipStatus } = {}
): Promise<Array<StudentMembershipRow & Record<string, unknown>>> {
  let q = client
    .from('student_memberships')
    .select('*, memberships(id, key, name, bundled_ticket_id)')
    .eq('academy_id', academyId);
  if (opts.userId) q = q.eq('user_id', opts.userId);
  if (opts.status) q = q.eq('status', opts.status);
  return unwrap<Array<StudentMembershipRow & Record<string, unknown>>>(await q.order('created_at', { ascending: false })) ?? [];
}

export async function grantStudentMembership(
  client: Client,
  input: {
    academyId: string;
    userId: string;
    membershipId: string;
    startDate?: DateString | null;
    endDate?: DateString | null;
    note?: string | null;
    remainingCount?: number | null;
  }
) {
  const res = await client.rpc('grant_student_membership', {
    p_academy_id: input.academyId,
    p_user_id: input.userId,
    p_membership_id: input.membershipId,
    p_start_date: input.startDate ?? null,
    p_end_date: input.endDate ?? null,
    p_note: input.note ?? null,
    p_remaining_count: input.remainingCount ?? null,
  });
  if (res.error) throw toMembershipError(res.error);
  return res.data;
}

export async function suspendStudentMembership(client: Client, id: string, note?: string | null) {
  const res = await client.rpc('suspend_student_membership', {
    p_student_membership_id: id,
    p_note: note ?? null,
  });
  if (res.error) throw toMembershipError(res.error);
  return res.data;
}

export async function resumeStudentMembership(client: Client, id: string, note?: string | null) {
  const res = await client.rpc('resume_student_membership', {
    p_student_membership_id: id,
    p_note: note ?? null,
  });
  if (res.error) throw toMembershipError(res.error);
  return res.data;
}

export async function extendStudentMembership(
  client: Client,
  id: string,
  endDate: DateString | null,
  opts: { reactivate?: boolean; note?: string | null } = {}
) {
  const res = await client.rpc('extend_student_membership', {
    p_student_membership_id: id,
    p_end_date: endDate,
    p_reactivate: opts.reactivate ?? false,
    p_note: opts.note ?? null,
  });
  if (res.error) throw toMembershipError(res.error);
  return res.data;
}

/** 만료 스윕 (cron 전용 — service client 필요) */
export async function expireStudentMemberships(client: Client, academyId?: string | null) {
  const res = await client.rpc('expire_student_memberships', { p_academy_id: academyId ?? null });
  if (res.error) throw toMembershipError(res.error);
  return res.data as { ok: boolean; sweep_date: string; expired: number; ids: string[] };
}

/* ------------------------------------------------------------------ */
/* 자격                                                                */
/* ------------------------------------------------------------------ */

/** 이 학생이 멤버십 전용 수업에 접근 가능한가 (SQL 정본 위임) */
export async function hasActiveMembership(
  client: Client,
  userId: string,
  membershipId: string,
  onDate?: DateString
): Promise<boolean> {
  const res = await client.rpc('has_active_membership', {
    p_user_id: userId,
    p_membership_id: membershipId,
    p_on_date: onDate ?? null,
  });
  if (res.error) throw toMembershipError(res.error);
  return res.data === true;
}

/* ------------------------------------------------------------------ */
/* 할인 해석 (§3)                                                       */
/* ------------------------------------------------------------------ */

export interface DiscountResolutionInput {
  academyId: string;
  userId: string;
  target: DiscountTarget;
  basePrice: number;
  today?: DateString;
}

/**
 * (학생, 학원, 대상) → 적용될 할인 1건.
 * ACTIVE 멤버십에서만, membership_discounts.is_active 인 행만, 최고 percent 하나,
 * 그리고 레거시 discounts 와 중첩하지 않고 더 큰 쪽 하나만.
 */
export async function resolveDiscountForStudent(
  client: Client,
  input: DiscountResolutionInput
): Promise<ResolvedDiscount> {
  const today = input.today ?? kstToday();

  const smRows = unwrap<StudentMembershipRow[]>(
    await client
      .from('student_memberships')
      .select('id, academy_id, user_id, membership_id, status, start_date, end_date')
      .eq('academy_id', input.academyId)
      .eq('user_id', input.userId)
      .eq('status', 'ACTIVE')
      .lte('start_date', today)
      .limit(1)
  ) as StudentMembershipRow[] | null;

  const active = (smRows ?? []).find((r) => !r.end_date || r.end_date >= today) ?? null;

  let membershipDiscounts: MembershipDiscountRow[] = [];
  if (active) {
    membershipDiscounts = await listMembershipDiscounts(client, active.membership_id);
  }

  const legacyDiscounts = (unwrap<LegacyDiscountRow[]>(
    await client
      .from('discounts')
      .select('id, name, discount_type, discount_value, is_active, valid_from, valid_until')
      .eq('academy_id', input.academyId)
      .eq('is_active', true)
  ) ?? []) as LegacyDiscountRow[];

  if (!active && legacyDiscounts.length === 0) return NO_DISCOUNT;

  return resolveDiscount({
    membershipStatus: (active?.status as MembershipStatus) ?? null,
    membershipId: active?.membership_id ?? null,
    membershipDiscounts,
    legacyDiscounts,
    target: input.target,
    basePrice: input.basePrice,
    today,
  });
}

/* ------------------------------------------------------------------ */
/* 만료 멤버십 검토 큐 (§5)                                             */
/* ------------------------------------------------------------------ */

export interface ReviewQueueRow {
  student_membership_id: string;
  user_id: string;
  student_name: string | null;
  membership_id: string;
  membership_name: string;
  membership_end_date: string | null;
  booking_id: string;
  booking_status: string;
  class_id: string;
  class_title: string | null;
  schedule_id: string;
  schedule_start_time: string;
  user_ticket_id: string | null;
  ticket_name: string | null;
  ticket_expiry_date: string | null;
  last_action: string | null;
  last_handled_at: string | null;
  last_handled_by: string | null;
}

export async function getExpiredMembershipReviewQueue(
  client: Client,
  academyId: string,
  opts: { includeHandled?: boolean } = {}
): Promise<ReviewQueueRow[]> {
  const res = await client.rpc('membership_expiry_review_queue', {
    p_academy_id: academyId,
    p_include_handled: opts.includeHandled ?? false,
  });
  if (res.error) throw toMembershipError(res.error);
  return (res.data ?? []) as ReviewQueueRow[];
}

export type ReviewActionType = 'ACKNOWLEDGED' | 'CONTACTED' | 'RESOLVED' | 'DISMISSED';

export async function recordReviewAction(
  client: Client,
  input: {
    academyId: string;
    studentMembershipId: string;
    bookingId?: string | null;
    action: ReviewActionType;
    note?: string | null;
    handledBy: string;
  }
) {
  const rows = unwrap<Array<Record<string, unknown>>>(
    await client
      .from('membership_review_actions')
      .insert({
        academy_id: input.academyId,
        student_membership_id: input.studentMembershipId,
        booking_id: input.bookingId ?? null,
        action: input.action,
        note: input.note ?? null,
        handled_by: input.handledBy,
      })
      .select('*')
  );
  return rows[0];
}
