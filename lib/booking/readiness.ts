/**
 * 예약 준비 상태(readiness) — "아직 예약을 열 수 없는 수업" 큐 (T8)
 *
 * 왜 필요한가:
 *   외부 일정툴이 service_role 로 classes 를 계속 새로 만든다. 그 툴은 예약 도메인을
 *   전혀 모르므로 class_group_id 없이 행을 남긴다. T2 규칙상 그런 수업은 예약이
 *   막힌다 — 즉 **가만히 두면 새 수업은 영원히 예약 불가**다.
 *   이 모듈은 그 상태를 이 앱 안에서 보이게 하고, 직원이 직접 고칠 수 있게 한다.
 *
 * ⛔ class_type 같은 문자열을 파싱해 자동 매핑하지 않는다.
 *    그건 한 학원(MID)의 명명 관습을 코드에 박는 짓이다. 태깅은 **운영자의 명시적
 *    결정**이다. 자동화가 필요하면 학원별 기본 규칙을 데이터로 저장해야 한다.
 *
 * ⛔ 이 모듈은 C:\MID_WORK 나 외부 일정툴에 아무것도 쓰지 않는다. 순수 DB 전용이다.
 */
import { validateBookingPolicyShape } from '@/lib/booking/policy';

type AnyClient = any;

/** 수업이 예약 가능해지기 전에 통과해야 하는 관문들 */
export type ReadinessGate =
  | 'MISSING_CLASS_GROUP'
  | 'CLASS_GROUP_FOREIGN'
  | 'INVALID_BOOKING_POLICY'
  | 'AUDIENCE_MEMBERSHIP_FOREIGN';

export const READINESS_GATE_MESSAGES: Record<ReadinessGate, string> = {
  MISSING_CLASS_GROUP: '수업 그룹이 지정되지 않았습니다.',
  CLASS_GROUP_FOREIGN: '다른 학원의 수업 그룹이 지정되어 있습니다.',
  INVALID_BOOKING_POLICY: '예약 정책의 형식이 올바르지 않습니다.',
  AUDIENCE_MEMBERSHIP_FOREIGN: '다른 학원의 멤버십이 대상으로 지정되어 있습니다.',
};

export interface NotReadyClass {
  id: string;
  title: string | null;
  class_type: string | null;
  is_active: boolean;
  created_at: string | null;
  class_group_id: string | null;
  audience_membership_id: string | null;
  booking_policy: unknown;
  gates: ReadinessGate[];
  /** 예정된(미래) 회차 수 — 급한 것부터 처리하라는 신호 */
  upcoming_schedule_count: number;
}

export interface NotReadyQueue {
  academy_id: string;
  /** 이 학원이 class_groups 를 도입했는가. false 면 아직 레거시 경로다. */
  academy_uses_groups: boolean;
  total: number;
  classes: NotReadyClass[];
}

/**
 * 이 학원에서 아직 예약을 열 수 없는 수업 목록.
 *
 * academy_uses_groups=false 인 학원은 T2 상 레거시 경로를 그대로 쓰므로
 * 큐를 비워서 돌려준다 — 아직 그룹을 도입하지 않은 학원에 "전부 고장났다"고
 * 보고하면 큐가 노이즈가 되어 아무도 안 본다.
 */
export async function listNotReadyClasses(
  client: AnyClient,
  academyId: string,
  opts: { includeInactive?: boolean; limit?: number } = {}
): Promise<NotReadyQueue> {
  const limit = opts.limit ?? 500;

  const { count: groupCount, error: gcErr } = await client
    .from('class_groups')
    .select('id', { count: 'exact', head: true })
    .eq('academy_id', academyId);
  if (gcErr) throw new Error(`수업 그룹 조회 실패: ${gcErr.message}`);

  const usesGroups = (groupCount ?? 0) > 0;
  if (!usesGroups) {
    return { academy_id: academyId, academy_uses_groups: false, total: 0, classes: [] };
  }

  let q = client
    .from('classes')
    .select(
      'id, title, class_type, is_active, created_at, class_group_id, audience_membership_id, booking_policy'
    )
    .eq('academy_id', academyId);
  if (!opts.includeInactive) q = q.eq('is_active', true);

  const { data: rows, error } = await q;
  if (error) throw new Error(`수업 조회 실패: ${error.message}`);

  const all = (rows ?? []) as Record<string, any>[];
  if (all.length === 0) {
    return { academy_id: academyId, academy_uses_groups: true, total: 0, classes: [] };
  }

  // 학원 경계 확인용 참조 집합 (각각 1쿼리)
  const groupIds = new Set<string>();
  {
    const { data } = await client.from('class_groups').select('id').eq('academy_id', academyId);
    for (const r of data ?? []) groupIds.add((r as any).id);
  }
  const membershipIds = new Set<string>();
  {
    const { data } = await client.from('memberships').select('id').eq('academy_id', academyId);
    for (const r of data ?? []) membershipIds.add((r as any).id);
  }

  const flagged: Record<string, any>[] = [];
  const gatesById = new Map<string, ReadinessGate[]>();

  for (const c of all) {
    const gates: ReadinessGate[] = [];
    if (!c.class_group_id) gates.push('MISSING_CLASS_GROUP');
    else if (!groupIds.has(c.class_group_id)) gates.push('CLASS_GROUP_FOREIGN');

    if (!validateBookingPolicyShape(c.booking_policy).ok) gates.push('INVALID_BOOKING_POLICY');

    if (c.audience_membership_id && !membershipIds.has(c.audience_membership_id)) {
      gates.push('AUDIENCE_MEMBERSHIP_FOREIGN');
    }

    if (gates.length > 0) {
      flagged.push(c);
      gatesById.set(c.id, gates);
    }
  }

  // 미래 회차 수는 걸린 수업에 대해서만 센다 (전체 스캔 회피)
  const counts = new Map<string, number>();
  if (flagged.length > 0) {
    const { data: sched } = await client
      .from('schedules')
      .select('class_id')
      .in(
        'class_id',
        flagged.map((c) => c.id)
      )
      .eq('is_canceled', false)
      .gte('start_time', new Date().toISOString());
    for (const s of sched ?? []) {
      const k = (s as any).class_id;
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
  }

  const classes: NotReadyClass[] = flagged
    .map((c) => ({
      id: c.id,
      title: c.title ?? null,
      class_type: c.class_type ?? null,
      is_active: c.is_active !== false,
      created_at: c.created_at ?? null,
      class_group_id: c.class_group_id ?? null,
      audience_membership_id: c.audience_membership_id ?? null,
      booking_policy: c.booking_policy ?? null,
      gates: gatesById.get(c.id) ?? [],
      upcoming_schedule_count: counts.get(c.id) ?? 0,
    }))
    // 임박한 회차가 많은 수업부터
    .sort((a, b) => b.upcoming_schedule_count - a.upcoming_schedule_count);

  return {
    academy_id: academyId,
    academy_uses_groups: true,
    total: classes.length,
    classes: classes.slice(0, limit),
  };
}

// ---------------------------------------------------------------------------
// 태깅 (직원의 명시적 결정)
// ---------------------------------------------------------------------------

export interface TagInput {
  /** undefined = 건드리지 않음. null 은 class_group_id 에는 허용하지 않는다. */
  classGroupId?: string | null;
  audienceMembershipId?: string | null;
  bookingPolicy?: unknown;
}

export class ReadinessError extends Error {
  code: string;
  status: number;
  detail: unknown;
  constructor(code: string, message: string, status = 400, detail: unknown = null) {
    super(message);
    this.code = code;
    this.status = status;
    this.detail = detail;
  }
}

/**
 * 태깅 입력을 검증하고 실제 UPDATE 에 넣을 patch 를 만든다.
 * 학원 경계(그룹·멤버십이 이 학원 것인지)를 여기서 강제한다.
 */
async function buildPatch(
  client: AnyClient,
  academyId: string,
  input: TagInput
): Promise<Record<string, unknown>> {
  const patch: Record<string, unknown> = {};

  if (input.classGroupId !== undefined) {
    if (input.classGroupId === null) {
      throw new ReadinessError(
        'CLASS_GROUP_REQUIRED',
        'class_group_id 는 null 로 되돌릴 수 없습니다. 예약이 막힙니다.'
      );
    }
    const { data } = await client
      .from('class_groups')
      .select('id')
      .eq('id', input.classGroupId)
      .eq('academy_id', academyId)
      .maybeSingle();
    if (!data) {
      throw new ReadinessError('CLASS_GROUP_NOT_FOUND', '이 학원의 수업 그룹이 아닙니다.', 404);
    }
    patch.class_group_id = input.classGroupId;
  }

  if (input.audienceMembershipId !== undefined) {
    if (input.audienceMembershipId === null) {
      patch.audience_membership_id = null;
    } else {
      const { data } = await client
        .from('memberships')
        .select('id')
        .eq('id', input.audienceMembershipId)
        .eq('academy_id', academyId)
        .maybeSingle();
      if (!data) {
        throw new ReadinessError('MEMBERSHIP_NOT_FOUND', '이 학원의 멤버십이 아닙니다.', 404);
      }
      patch.audience_membership_id = input.audienceMembershipId;
    }
  }

  if (input.bookingPolicy !== undefined) {
    const v = validateBookingPolicyShape(input.bookingPolicy);
    if (!v.ok) {
      throw new ReadinessError(
        'INVALID_BOOKING_POLICY',
        '예약 정책의 형식이 올바르지 않습니다.',
        400,
        v.errors
      );
    }
    patch.booking_policy = input.bookingPolicy ?? null;
  }

  if (Object.keys(patch).length === 0) {
    throw new ReadinessError('NOTHING_TO_UPDATE', '변경할 항목이 없습니다.');
  }
  return patch;
}

/** 수업 1건 태깅. 학원 경계 밖 수업은 건드리지 않는다. */
export async function tagClass(
  client: AnyClient,
  academyId: string,
  classId: string,
  input: TagInput
): Promise<Record<string, any>> {
  const patch = await buildPatch(client, academyId, input);

  const { data: before } = await client
    .from('classes')
    .select('id, academy_id, class_group_id, audience_membership_id, booking_policy')
    .eq('id', classId)
    .maybeSingle();
  if (!before) throw new ReadinessError('CLASS_NOT_FOUND', '수업을 찾을 수 없습니다.', 404);
  if (before.academy_id !== academyId) {
    throw new ReadinessError('CLASS_FOREIGN', '이 학원의 수업이 아닙니다.', 403);
  }

  const { data, error } = await client
    .from('classes')
    .update(patch)
    .eq('id', classId)
    .eq('academy_id', academyId) // 경합 방어: 학원이 바뀐 사이라면 아무것도 안 바꾼다
    .select('id, class_group_id, audience_membership_id, booking_policy')
    .maybeSingle();
  if (error) throw new ReadinessError('UPDATE_FAILED', `태깅 실패: ${error.message}`, 500);
  if (!data) throw new ReadinessError('CLASS_NOT_FOUND', '수업을 찾을 수 없습니다.', 404);

  return { before, after: data };
}

export interface BulkTagResult {
  requested: number;
  updated: number;
  /** 이미 같은 값이라 실질 변화가 없었던 건 (재실행 시 여기로 흡수된다) */
  unchanged: number;
  skipped: { classId: string; code: string }[];
}

/**
 * 여러 수업을 한 그룹으로 한꺼번에 태깅 — 흔한 케이스.
 *
 * 멱등: 같은 입력으로 두 번 돌려도 최종 상태가 같고, 두 번째 실행은 전부
 * unchanged 로 집계된다. 부분 실패해도 성공한 건은 유지된다(운영 큐이므로
 * 전부 롤백하는 것보다 진행된 만큼 남는 편이 낫다).
 */
export async function bulkTagClasses(
  client: AnyClient,
  academyId: string,
  classIds: string[],
  input: TagInput
): Promise<BulkTagResult> {
  const ids = Array.from(new Set(classIds));
  if (ids.length === 0) throw new ReadinessError('NO_CLASSES', '수업이 지정되지 않았습니다.');
  if (ids.length > 500) throw new ReadinessError('TOO_MANY', '한 번에 500개까지만 가능합니다.');

  const patch = await buildPatch(client, academyId, input);

  const { data: existing, error: exErr } = await client
    .from('classes')
    .select('id, academy_id, class_group_id, audience_membership_id, booking_policy')
    .in('id', ids);
  if (exErr) throw new ReadinessError('UPDATE_FAILED', `조회 실패: ${exErr.message}`, 500);

  const byId = new Map<string, any>((existing ?? []).map((r: any) => [r.id, r]));
  const skipped: { classId: string; code: string }[] = [];
  const targets: string[] = [];
  let unchanged = 0;

  for (const id of ids) {
    const row = byId.get(id);
    if (!row) {
      skipped.push({ classId: id, code: 'CLASS_NOT_FOUND' });
      continue;
    }
    if (row.academy_id !== academyId) {
      skipped.push({ classId: id, code: 'CLASS_FOREIGN' });
      continue;
    }
    const same = Object.entries(patch).every(
      ([k, v]) => JSON.stringify(row[k] ?? null) === JSON.stringify(v ?? null)
    );
    if (same) {
      unchanged += 1;
      continue;
    }
    targets.push(id);
  }

  let updated = 0;
  if (targets.length > 0) {
    const { data, error } = await client
      .from('classes')
      .update(patch)
      .in('id', targets)
      .eq('academy_id', academyId)
      .select('id');
    if (error) throw new ReadinessError('UPDATE_FAILED', `일괄 태깅 실패: ${error.message}`, 500);
    updated = (data ?? []).length;
  }

  return { requested: ids.length, updated, unchanged, skipped };
}
