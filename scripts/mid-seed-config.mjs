/**
 * MID 학원(slug='mid') 시드 — 설정 정본 + 멱등 적용 로직 (T11)
 *
 * 이 파일은 "무엇을 만들 것인가"(CONFIG)와 "어떻게 멱등하게 만드는가"(applySeed)만 담는다.
 * 실제 실행 진입점은 scripts/seed-mid.mjs, 되돌리기는 scripts/revert-mid-seed.mjs.
 *
 * ⛔ 안전 규칙 (이 시드는 라이브 운영 DB 를 건드린다)
 *   - DELETE / DROP / TRUNCATE 를 절대 하지 않는다.
 *   - INSERT 는 신규 행(class_groups / tickets / ticket_coverage / memberships /
 *     membership_discounts)만.
 *   - UPDATE 는 딱 두 컬럼만: academies.booking_policy, classes.class_group_id.
 *   - academies.is_active 는 읽기만 한다. 다크런치이므로 false 를 유지해야 한다.
 *   - classes 의 다른 컬럼, schedules / recurring_schedules / instructors /
 *     schedule_meta / users / bookings / user_tickets 는 읽지도 쓰지도 않는다
 *     (스냅샷 목적의 SELECT 제외).
 *
 * ⚠ 외부 일정툴(mid-class-board / MID_WORK)이 service_role 로 이 DB 의 classes·
 *   schedules 를 계속 쓴다. 그 툴은 class_group_id / booking_policy 를 절대 쓰지
 *   않으므로 여기서 세팅하는 컬럼과 충돌하지 않는다.
 *
 * 멱등성 설계:
 *   - class_groups   : UNIQUE(academy_id, key)  → key 로 조회 후 없으면 INSERT
 *   - tickets        : 고유 제약이 없다 → (academy_id, name) 으로 조회 후 없으면 INSERT
 *   - ticket_coverage: UNIQUE(ticket_id, class_group_id) → 조회 후 없으면 INSERT
 *   - memberships    : UNIQUE(academy_id, key) → key 로 조회 후 없으면 INSERT
 *   - membership_discounts : (membership_id, 대상) 조합으로 조회 후 없으면 INSERT
 *   - academies.booking_policy / classes.class_group_id : 값이 이미 같으면 UPDATE 하지 않는다
 *   두 번째 실행은 모든 카운터가 0(created=0, updated=0)이어야 한다.
 */

// ---------------------------------------------------------------------------
// 수업 그룹 (4개)
// ---------------------------------------------------------------------------
// 포에잇쉐어(class_type='share')는 현재 운영하지 않는 프로그램이므로 그룹을 만들지 않는다.
// 따라서 그 수업들은 태깅되지 않고 운영자의 "예약 준비 안 됨" 큐에 남는다 — 의도된 동작.
export const CLASS_GROUPS = [
  { key: 'regular', name: '정규', is_special: false, display_order: 1 },
  { key: 'popup', name: '팝업', is_special: false, display_order: 2 },
  { key: 'cszz', name: '춤숨찐', is_special: true, display_order: 3 },
  { key: 'workshop', name: '워크샵', is_special: true, display_order: 4 },
];

// ---------------------------------------------------------------------------
// class_type → class_group.key 매핑 (운영자의 명시적 결정)
// ---------------------------------------------------------------------------
// lib/booking/readiness.ts 는 의도적으로 class_type 을 자동 해석하지 않는다.
// 자동 매핑은 앱 코드가 아니라 이 시드(=사람이 내린 1회성 결정)에서만 이뤄진다.
//
// 여기 없는 class_type 은 **추측하지 않고 그대로 둔다**. 태깅되지 않은 수업은
// 예약이 열리지 않고 운영 콘솔의 "예약 준비 안 됨" 큐에 뜬다 — 잘못 넣는 것보다 낫다.
export const CLASS_TYPE_TO_GROUP = {
  regular: 'regular',
  popup: 'popup',
  cszz: 'cszz',
  workshop: 'workshop',
  // share (포에잇쉐어) : 운영하지 않는 프로그램 → 의도적으로 미매핑
};

// ---------------------------------------------------------------------------
// 상품 (7행 — 워크샵은 회차별 개별 가격이라 tickets 행을 만들지 않는다)
// ---------------------------------------------------------------------------
// coverage: 이 수강권이 커버하는 class_group.key 목록.
//   ticket_coverage 행이 하나라도 있으면 커버리지 판정은 이 계층에서 끝난다
//   (lib/booking/coverage.ts 계층 ②). 즉 여기 없는 그룹은 절대 커버되지 않는다.
//   → ALL PASS 가 춤숨찐/워크샵을 못 여는 것이 바로 이 분리의 핵심.
//
// is_general 은 전부 false 로 둔다. 레거시 계층(③)으로 새는 경로를 원천 차단하기
// 위해서다. 커버리지 행이 사라지면 "아무것도 예약 불가"로 안전하게 실패한다.
export const TICKETS = [
  {
    name: '쿠폰 1장',
    ticket_type: 'COUNT',
    total_count: 1,
    // 당일만 유효: lib/date/kst.ts inclusiveExpiry(start, 1) === start
    valid_days: 1,
    valid_months: null,
    price: 30000,
    is_fixed_weekly: false,
    start_mode: 'IMMEDIATE',
    coverage: ['regular', 'popup'],
    description: '당일 1회 수강 (구매 확정일 당일만 유효 · 사용 후 환불 불가 · 양도 가능)',
  },
  {
    name: '쿠폰 5장',
    ticket_type: 'COUNT',
    total_count: 5,
    valid_days: 30,
    valid_months: null,
    price: 130000,
    is_fixed_weekly: false,
    start_mode: 'IMMEDIATE',
    coverage: ['regular', 'popup'],
    description: '30일간 5회 수강 (양도 불가)',
  },
  {
    name: '쿠폰 10장',
    ticket_type: 'COUNT',
    total_count: 10,
    valid_days: 30,
    valid_months: null,
    price: 250000,
    is_fixed_weekly: false,
    start_mode: 'IMMEDIATE',
    coverage: ['regular', 'popup'],
    description: '30일간 10회 수강 (양도 불가)',
  },
  {
    name: '월등록',
    ticket_type: 'COUNT',
    total_count: 4,
    valid_days: 31,
    valid_months: null,
    price: 120000,
    is_fixed_weekly: true,
    start_mode: 'IMMEDIATE',
    // 고정 주1회: 학생이 고른 정규 수업 1개에만 쓸 수 있다.
    // 실제 "그 수업만" 제약은 user_tickets.fixed_class_id 가 건다
    // (lib/booking/selection.ts ④ FIXED_CLASS_MISMATCH).
    // ticket_coverage 는 그 고정 수업이 속할 수 있는 그룹(정규)만 연다.
    coverage: ['regular'],
    description: '한 달 4회, 등록한 고정 수업 수강',
  },
  {
    name: '3개월 등록',
    ticket_type: 'COUNT',
    total_count: 12,
    valid_days: null,
    valid_months: 3,
    price: 320000,
    is_fixed_weekly: true,
    start_mode: 'IMMEDIATE',
    coverage: ['regular'],
    description: '3개월 12회, 등록한 고정 수업 수강',
  },
  {
    name: 'ALL PASS',
    ticket_type: 'PERIOD',
    total_count: null,
    valid_days: 30,
    valid_months: null,
    price: 500000,
    is_fixed_weekly: false,
    // 첫 예약 시점에 유효기간이 시작된다.
    start_mode: 'FIRST_BOOKING',
    // 정규 + 팝업 "만". 춤숨찐/워크샵은 커버하지 않는다 — 이 분리가 핵심 요구사항.
    coverage: ['regular', 'popup'],
    description: '첫 예약일부터 30일간 정규·팝업 무제한',
  },
  {
    name: '춤숨찐 티켓',
    ticket_type: 'COUNT',
    total_count: 1,
    valid_days: 30,
    valid_months: null,
    price: 20000,
    is_fixed_weekly: false,
    start_mode: 'IMMEDIATE',
    // 춤숨찐 전용. 정규/팝업에는 쓸 수 없다.
    coverage: ['cszz'],
    description: '춤숨찐 수업 1회',
  },
];

// ---------------------------------------------------------------------------
// 멤버십 (2개) — 둘 다 hidden
// ---------------------------------------------------------------------------
// visibility='hidden' : 학생에게 가격·혜택·멤버 전용 수업이 보이지 않는다.
export const MEMBERSHIPS = [
  {
    key: 'pro',
    name: '전문반',
    visibility: 'hidden',
    bundled_ticket_name: 'ALL PASS',
    perks_text: ['연습실 자유이용', '개인사물함', '월평가'],
    discounts: [
      { kind: 'ticket', ticket_name: '춤숨찐 티켓', percent: 50 },
      { kind: 'class_group', group_key: 'workshop', percent: 50 },
    ],
  },
  {
    key: 'exam',
    name: '입시반',
    visibility: 'hidden',
    // 스켈레톤만. 혜택은 추후 직원이 운영 콘솔에서 설정한다.
    bundled_ticket_name: null,
    perks_text: null,
    discounts: [],
  },
];

// ---------------------------------------------------------------------------
// 학원 기본 예약 정책
// ---------------------------------------------------------------------------
// 전일 17:00 오픈 / 시작 시각까지 예약 가능 / 시작 시각까지 취소 가능.
// 값은 데이터다 — 이 학원을 위한 코드 분기는 어디에도 없다.
export const BOOKING_POLICY = {
  open: { daysBefore: 1, time: '17:00' },
  close: { minutesBefore: 0 },
  cancelUntil: { minutesBefore: 0 },
};

// ===========================================================================
// 멱등 적용
// ===========================================================================

/**
 * 키 순서에 무관한 정규화 직렬화.
 *
 * ⚠ 필수: Postgres 는 jsonb 를 저장할 때 키 순서를 재정렬한다
 *   ({"open":{"daysBefore":1,"time":"17:00"}} → {"open":{"time":"17:00","daysBefore":1}}).
 *   순진한 JSON.stringify 비교는 항상 "다르다"고 판정해서 매 실행마다 UPDATE 를
 *   날리게 된다 — 즉 멱등성이 깨진다.
 */
export function canonical(v) {
  if (v === null || v === undefined) return 'null';
  if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`;
  if (typeof v === 'object') {
    const keys = Object.keys(v).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${canonical(v[k])}`).join(',')}}`;
  }
  return JSON.stringify(v);
}

function eq(a, b) {
  return canonical(a) === canonical(b);
}

/**
 * CONFIG 를 한 학원에 멱등하게 적용한다.
 *
 * @param svc          service_role supabase 클라이언트
 * @param academyId    대상 학원 id
 * @param opts.tagClasses  true 면 class_type 매핑으로 기존 수업을 태깅한다
 * @returns 무엇을 바꿨는지에 대한 리포트 (2회차 실행에서는 전부 0 이어야 한다)
 */
export async function applySeed(svc, academyId, opts = {}) {
  const tagClasses = opts.tagClasses !== false;
  const report = {
    academyId,
    groups: { created: 0, existing: 0, byKey: {} },
    tickets: { created: 0, existing: 0, byName: {} },
    coverage: { created: 0, existing: 0 },
    memberships: { created: 0, existing: 0, updated: 0, byKey: {} },
    discounts: { created: 0, existing: 0 },
    bookingPolicy: { updated: false, alreadyCorrect: false },
    classTagging: { updated: 0, unchanged: 0, leftUntagged: 0, byType: {} },
    changedRows: 0,
  };

  // --- 1. class_groups ---
  for (const g of CLASS_GROUPS) {
    const { data: found, error: selErr } = await svc
      .from('class_groups')
      .select('id, key, name, is_special, display_order')
      .eq('academy_id', academyId)
      .eq('key', g.key)
      .maybeSingle();
    if (selErr) throw new Error(`class_groups 조회 실패(${g.key}): ${selErr.message}`);

    if (found) {
      report.groups.existing += 1;
      report.groups.byKey[g.key] = found.id;
      continue;
    }
    const { data: ins, error } = await svc
      .from('class_groups')
      .insert({ academy_id: academyId, ...g })
      .select('id')
      .single();
    if (error) throw new Error(`class_groups 생성 실패(${g.key}): ${error.message}`);
    report.groups.created += 1;
    report.changedRows += 1;
    report.groups.byKey[g.key] = ins.id;
  }

  // --- 2. tickets ---
  for (const t of TICKETS) {
    const { coverage, ...cols } = t;
    const { data: found, error: selErr } = await svc
      .from('tickets')
      .select('id')
      .eq('academy_id', academyId)
      .eq('name', t.name)
      .maybeSingle();
    if (selErr) throw new Error(`tickets 조회 실패(${t.name}): ${selErr.message}`);

    let ticketId;
    if (found) {
      report.tickets.existing += 1;
      ticketId = found.id;
    } else {
      const { data: ins, error } = await svc
        .from('tickets')
        .insert({
          academy_id: academyId,
          ...cols,
          // 레거시 계층(③)으로 새지 않도록 명시적으로 닫는다.
          is_general: false,
          class_id: null,
          is_on_sale: true,
          is_public: true,
        })
        .select('id')
        .single();
      if (error) throw new Error(`tickets 생성 실패(${t.name}): ${error.message}`);
      report.tickets.created += 1;
      report.changedRows += 1;
      ticketId = ins.id;
    }
    report.tickets.byName[t.name] = ticketId;

    // --- 3. ticket_coverage ---
    for (const key of coverage) {
      const groupId = report.groups.byKey[key];
      if (!groupId) throw new Error(`커버리지 대상 그룹 없음: ${key}`);
      const { data: cov, error: covSelErr } = await svc
        .from('ticket_coverage')
        .select('id')
        .eq('ticket_id', ticketId)
        .eq('class_group_id', groupId)
        .maybeSingle();
      if (covSelErr) throw new Error(`ticket_coverage 조회 실패: ${covSelErr.message}`);
      if (cov) {
        report.coverage.existing += 1;
        continue;
      }
      const { error } = await svc
        .from('ticket_coverage')
        .insert({ ticket_id: ticketId, class_group_id: groupId, is_active: true });
      if (error) throw new Error(`ticket_coverage 생성 실패(${t.name}/${key}): ${error.message}`);
      report.coverage.created += 1;
      report.changedRows += 1;
    }
  }

  // --- 4. memberships ---
  for (const m of MEMBERSHIPS) {
    const bundledId = m.bundled_ticket_name ? report.tickets.byName[m.bundled_ticket_name] : null;
    if (m.bundled_ticket_name && !bundledId) {
      throw new Error(`번들 수강권을 찾을 수 없음: ${m.bundled_ticket_name}`);
    }

    const { data: found, error: selErr } = await svc
      .from('memberships')
      .select('id, visibility, bundled_ticket_id, perks_text')
      .eq('academy_id', academyId)
      .eq('key', m.key)
      .maybeSingle();
    if (selErr) throw new Error(`memberships 조회 실패(${m.key}): ${selErr.message}`);

    let membershipId;
    if (found) {
      report.memberships.existing += 1;
      membershipId = found.id;
      // 번들 수강권만은 재수렴시킨다 (수강권이 나중에 생긴 순서 문제 대비).
      // visibility 는 절대 덮어쓰지 않는다 — 직원이 바꿨을 수 있다.
      if (bundledId && found.bundled_ticket_id !== bundledId) {
        const { error } = await svc
          .from('memberships')
          .update({ bundled_ticket_id: bundledId })
          .eq('id', membershipId);
        if (error) throw new Error(`memberships 갱신 실패(${m.key}): ${error.message}`);
        report.memberships.updated += 1;
        report.changedRows += 1;
      }
    } else {
      const { data: ins, error } = await svc
        .from('memberships')
        .insert({
          academy_id: academyId,
          key: m.key,
          name: m.name,
          visibility: m.visibility,
          is_active: true,
          bundled_ticket_id: bundledId,
          perks_text: m.perks_text,
        })
        .select('id')
        .single();
      if (error) throw new Error(`memberships 생성 실패(${m.key}): ${error.message}`);
      report.memberships.created += 1;
      report.changedRows += 1;
      membershipId = ins.id;
    }
    report.memberships.byKey[m.key] = membershipId;

    // --- 5. membership_discounts ---
    for (const d of m.discounts) {
      const target =
        d.kind === 'ticket'
          ? { ticket_id: report.tickets.byName[d.ticket_name], class_group_id: null }
          : { class_group_id: report.groups.byKey[d.group_key], ticket_id: null };
      const targetId = target.ticket_id ?? target.class_group_id;
      if (!targetId) throw new Error(`할인 대상을 찾을 수 없음: ${JSON.stringify(d)}`);

      let q = svc
        .from('membership_discounts')
        .select('id')
        .eq('membership_id', membershipId);
      q = d.kind === 'ticket' ? q.eq('ticket_id', targetId) : q.eq('class_group_id', targetId);
      const { data: dis, error: disSelErr } = await q.maybeSingle();
      if (disSelErr) throw new Error(`membership_discounts 조회 실패: ${disSelErr.message}`);

      if (dis) {
        report.discounts.existing += 1;
        continue;
      }
      const { error } = await svc
        .from('membership_discounts')
        .insert({ membership_id: membershipId, ...target, percent: d.percent, is_active: true });
      if (error) throw new Error(`membership_discounts 생성 실패(${m.key}): ${error.message}`);
      report.discounts.created += 1;
      report.changedRows += 1;
    }
  }

  // --- 6. academies.booking_policy ---
  const { data: acad, error: acadErr } = await svc
    .from('academies')
    .select('id, booking_policy, is_active')
    .eq('id', academyId)
    .single();
  if (acadErr) throw new Error(`academies 조회 실패: ${acadErr.message}`);

  if (eq(acad.booking_policy, BOOKING_POLICY)) {
    report.bookingPolicy.alreadyCorrect = true;
  } else {
    const { error } = await svc
      .from('academies')
      .update({ booking_policy: BOOKING_POLICY })
      .eq('id', academyId);
    if (error) throw new Error(`booking_policy 갱신 실패: ${error.message}`);
    report.bookingPolicy.updated = true;
    report.changedRows += 1;
  }

  // --- 7. classes.class_group_id 태깅 ---
  if (tagClasses) {
    const { data: classes, error: clsErr } = await svc
      .from('classes')
      .select('id, class_type, class_group_id')
      .eq('academy_id', academyId);
    if (clsErr) throw new Error(`classes 조회 실패: ${clsErr.message}`);

    // class_type 별로 묶어서 그룹당 1 UPDATE
    const byGroup = new Map();
    for (const c of classes ?? []) {
      const type = c.class_type ?? '(null)';
      const stat = (report.classTagging.byType[type] ??= {
        total: 0,
        mappedTo: CLASS_TYPE_TO_GROUP[type] ?? null,
        updated: 0,
        unchanged: 0,
        leftUntagged: 0,
      });
      stat.total += 1;

      const groupKey = CLASS_TYPE_TO_GROUP[type];
      if (!groupKey) {
        // 매핑이 없는 class_type — 추측하지 않는다. 운영자 큐에 남는다.
        stat.leftUntagged += 1;
        report.classTagging.leftUntagged += 1;
        continue;
      }
      const groupId = report.groups.byKey[groupKey];
      if (c.class_group_id === groupId) {
        stat.unchanged += 1;
        report.classTagging.unchanged += 1;
        continue;
      }
      if (!byGroup.has(groupId)) byGroup.set(groupId, []);
      byGroup.get(groupId).push({ id: c.id, type });
    }

    for (const [groupId, rows] of byGroup) {
      const { data, error } = await svc
        .from('classes')
        .update({ class_group_id: groupId })
        .in('id', rows.map((r) => r.id))
        // 경합 방어: 학원 밖 수업은 절대 건드리지 않는다.
        .eq('academy_id', academyId)
        .select('id');
      if (error) throw new Error(`classes 태깅 실패: ${error.message}`);
      const n = (data ?? []).length;
      report.classTagging.updated += n;
      report.changedRows += n;
      for (const r of rows) report.classTagging.byType[r.type].updated += 1;
    }
  }

  report.isActiveAfter = acad.is_active;
  return report;
}
