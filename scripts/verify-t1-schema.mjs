/**
 * T1 스키마 검증 (라이브 DB 대상, 반복 실행 가능)
 *
 * 실행: node scripts/verify-t1-schema.mjs
 * 종료코드: 0 = 전부 통과, 1 = 하나라도 실패(또는 실행 불가)
 *
 * 검증 항목
 *  A) 신규 8개 테이블 존재 + RLS enabled
 *  B) 기존 테이블 확장 컬럼 존재
 *  C) 명세된 CHECK/UNIQUE 제약이 실제로 존재
 *  D) 제약이 실제로 나쁜 값을 거부하는지 (실 INSERT 시도)
 *  E) 명세된 인덱스 전부 존재
 *  F) anon 이 memberships / student_memberships / order_groups 를 SELECT 못 함
 *
 * 실행 불가(예: RPC 호출 실패)는 통과가 아니라 실패로 간주한다.
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import path from 'node:path';

// --- .env.local 로드 (dotenv 없이) ---
const envPath = path.join(process.cwd(), '.env.local');
const env = Object.fromEntries(
  readFileSync(envPath, 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=');
      let v = l.slice(i + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      return [l.slice(0, i).trim(), v];
    }),
);

const URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!URL || !SERVICE_KEY || !ANON_KEY) {
  console.error('FATAL: .env.local 에 SUPABASE URL / SERVICE_ROLE / ANON 키가 필요합니다.');
  process.exit(1);
}

const authOpts = { auth: { autoRefreshToken: false, persistSession: false } };
const svc = createClient(URL, SERVICE_KEY, authOpts);
const anon = createClient(URL, ANON_KEY, authOpts);

let passed = 0;
const failures = [];
function ok(name) {
  passed++;
  console.log(`  PASS  ${name}`);
}
function fail(name, detail) {
  failures.push(`${name} — ${detail}`);
  console.log(`  FAIL  ${name} :: ${detail}`);
}
function assert(cond, name, detail = '조건 불충족') {
  if (cond) ok(name);
  else fail(name, detail);
}

const NEW_TABLES = [
  'class_groups',
  'ticket_coverage',
  'memberships',
  'membership_discounts',
  'student_memberships',
  'order_groups',
  'order_items',
  'booking_events',
];

const REQUIRED_COLUMNS = [
  'academies.booking_policy',
  'classes.booking_policy',
  'tickets.is_fixed_weekly',
  'tickets.start_mode',
  'tickets.valid_months',
  'user_tickets.fixed_class_id',
  'user_tickets.source_membership_id',
  'bookings.order_group_id',
  'bookings.hold_expires_at',
];

const REQUIRED_CONSTRAINTS = [
  'class_groups_academy_key_uniq',
  'ticket_coverage_ticket_group_uniq',
  'memberships_academy_key_uniq',
  'memberships_visibility_chk',
  'membership_discounts_percent_chk',
  'membership_discounts_target_xor_chk',
  'student_memberships_status_chk',
  'order_groups_provider_order_id_uniq',
  'order_groups_method_chk',
  'order_groups_status_chk',
  'order_groups_original_amount_chk',
  'order_groups_discount_amount_chk',
  'order_groups_total_amount_chk',
  'order_groups_amount_math_chk',
  'order_items_item_type_chk',
  'order_items_discount_percent_chk',
  'order_items_ticket_purchase_chk',
  'order_items_schedule_booking_chk',
  'order_items_original_amount_chk',
  'order_items_discount_amount_chk',
  'order_items_final_amount_chk',
  'booking_events_event_type_chk',
  'booking_events_status_chk',
  'tickets_start_mode_chk',
  // T1 에서 부여한 FK
  'classes_audience_membership_id_fkey',
  'user_tickets_fixed_class_id_fkey',
  'user_tickets_source_membership_id_fkey',
  'bookings_order_group_id_fkey',
];

const REQUIRED_INDEXES = [
  'class_groups_academy_key_uniq',
  'ticket_coverage_ticket_group_uniq',
  'ticket_coverage_class_group_id_idx',
  'memberships_academy_key_uniq',
  'student_memberships_active_uniq',
  'student_memberships_membership_status_idx',
  'membership_discounts_membership_id_idx',
  'membership_discounts_class_group_id_idx',
  'membership_discounts_ticket_id_idx',
  'order_groups_user_created_idx',
  'order_groups_academy_status_created_idx',
  'order_groups_provider_order_id_uniq',
  'order_groups_pending_expiry_idx',
  'order_items_order_group_id_idx',
  'order_items_schedule_id_idx',
  'bookings_order_group_id_idx',
  'booking_events_status_created_idx',
];

const cleanup = []; // { table, id }

async function main() {
  // ---------- 스키마 리포트 ----------
  console.log('\n[A/B/C/E] 스키마 introspection');
  const { data: report, error: repErr } = await svc.rpc('t1_schema_report');
  if (repErr || !report) {
    fail('t1_schema_report RPC 호출', repErr?.message ?? '데이터 없음 (검증 실행 불가 = 실패)');
    return;
  }

  for (const t of NEW_TABLES) {
    const rls = report.tables[t];
    if (rls === undefined) fail(`테이블 존재: ${t}`, '테이블 없음');
    else assert(rls === true, `테이블 + RLS enabled: ${t}`, `RLS=${rls}`);
  }

  const cols = new Set(report.columns);
  for (const c of REQUIRED_COLUMNS) assert(cols.has(c), `컬럼 존재: ${c}`, '없음');

  const cons = new Set(report.constraints);
  for (const c of REQUIRED_CONSTRAINTS) assert(cons.has(c), `제약 존재: ${c}`, '없음');

  const idx = new Set(report.indexes);
  for (const i of REQUIRED_INDEXES) assert(idx.has(i), `인덱스 존재: ${i}`, '없음');

  // ---------- 제약 실효성 (실제 INSERT 거부 확인) ----------
  console.log('\n[D] 제약이 실제로 나쁜 값을 거부하는가');

  const { data: academy } = await svc.from('academies').select('id').limit(1).single();
  const { data: user } = await svc.from('users').select('id').limit(1).single();
  const { data: ticket } = await svc.from('tickets').select('id').limit(1).single();
  if (!academy || !user || !ticket) {
    fail('테스트 픽스처 조회', 'academies/users/tickets 에서 참조 행을 얻지 못함 (검증 실행 불가 = 실패)');
    return;
  }

  const tag = `__t1verify_${Date.now()}`;

  // D-1: order_groups total != original - discount → 거부되어야 함
  {
    const { error } = await svc.from('order_groups').insert({
      academy_id: academy.id,
      method: 'BANK',
      status: 'DRAFT',
      original_amount: 10000,
      discount_amount: 1000,
      total_amount: 9999, // 잘못된 값 (9000 이어야 함)
      provider_order_id: `${tag}_bad_math`,
    }).select('id').single();
    assert(!!error, 'order_groups: total != original - discount 거부', '거부되지 않고 INSERT 성공함');
    if (error) console.log(`        (거부 사유: ${error.code} ${error.message.slice(0, 80)})`);
  }

  // 대조군: 올바른 금액은 통과해야 함 (제약이 무조건 거부하는 게 아님을 확인)
  {
    const { data, error } = await svc.from('order_groups').insert({
      academy_id: academy.id,
      method: 'BANK',
      status: 'DRAFT',
      original_amount: 10000,
      discount_amount: 1000,
      total_amount: 9000,
      provider_order_id: `${tag}_good_math`,
    }).select('id').single();
    assert(!error && !!data, 'order_groups: 올바른 금액은 통과(대조군)', error?.message ?? '데이터 없음');
    if (data) cleanup.push({ table: 'order_groups', id: data.id });
  }

  // 임시 membership / class_group 생성 (D-2, D-3 용)
  const { data: mem, error: memErr } = await svc.from('memberships').insert({
    academy_id: academy.id,
    key: tag,
    name: 'T1 검증용 임시 멤버십',
    visibility: 'hidden',
    is_active: false,
  }).select('id').single();
  if (memErr || !mem) {
    fail('임시 membership 생성', memErr?.message ?? '실패 (D-2/D-3 실행 불가 = 실패)');
  } else {
    cleanup.push({ table: 'memberships', id: mem.id });

    const { data: cg, error: cgErr } = await svc.from('class_groups').insert({
      academy_id: academy.id,
      key: tag,
      name: 'T1 검증용 임시 그룹',
    }).select('id').single();
    if (cgErr || !cg) {
      fail('임시 class_group 생성', cgErr?.message ?? '실패 (D-2 실행 불가 = 실패)');
    } else {
      cleanup.push({ table: 'class_groups', id: cg.id });

      // D-2: membership_discounts 에 class_group_id + ticket_id 둘 다 → 거부
      const { error } = await svc.from('membership_discounts').insert({
        membership_id: mem.id,
        class_group_id: cg.id,
        ticket_id: ticket.id,
        percent: 10,
      }).select('id').single();
      assert(!!error, 'membership_discounts: class_group_id + ticket_id 동시 지정 거부', '거부되지 않음');
      if (error) console.log(`        (거부 사유: ${error.code} ${error.message.slice(0, 80)})`);

      // 대조군: 하나만 지정하면 통과
      const { data: okRow, error: okErr } = await svc.from('membership_discounts').insert({
        membership_id: mem.id,
        class_group_id: cg.id,
        percent: 10,
      }).select('id').single();
      assert(!okErr && !!okRow, 'membership_discounts: 하나만 지정 시 통과(대조군)', okErr?.message ?? '데이터 없음');
      if (okRow) cleanup.push({ table: 'membership_discounts', id: okRow.id });
    }

    // D-3: 동일 (academy_id, user_id) 로 ACTIVE 두 건 → 두 번째 거부
    const { data: sm1, error: sm1Err } = await svc.from('student_memberships').insert({
      academy_id: academy.id,
      user_id: user.id,
      membership_id: mem.id,
      status: 'ACTIVE',
      start_date: '2026-01-01',
      note: tag,
    }).select('id').single();

    if (sm1Err || !sm1) {
      // 해당 (academy,user) 에 이미 실제 ACTIVE 행이 있으면 유니크에 걸린다 → 그 자체가 제약 동작 증거
      if (sm1Err?.code === '23505') {
        ok('student_memberships: (academy_id,user_id) ACTIVE 부분 유니크 동작 (기존 행과 충돌로 확인)');
      } else {
        fail('임시 student_membership 생성', sm1Err?.message ?? '실패 (D-3 실행 불가 = 실패)');
      }
    } else {
      cleanup.push({ table: 'student_memberships', id: sm1.id });
      const { data: sm2, error: sm2Err } = await svc.from('student_memberships').insert({
        academy_id: academy.id,
        user_id: user.id,
        membership_id: mem.id,
        status: 'ACTIVE',
        start_date: '2026-02-01',
        note: tag,
      }).select('id').single();
      if (sm2) cleanup.push({ table: 'student_memberships', id: sm2.id });
      assert(!!sm2Err, 'student_memberships: 동일 (academy_id,user_id) ACTIVE 2건 거부', '거부되지 않음');
      if (sm2Err) console.log(`        (거부 사유: ${sm2Err.code} ${sm2Err.message.slice(0, 80)})`);

      // 대조군: EXPIRED 는 부분 유니크에 걸리지 않아야 함
      const { data: sm3, error: sm3Err } = await svc.from('student_memberships').insert({
        academy_id: academy.id,
        user_id: user.id,
        membership_id: mem.id,
        status: 'EXPIRED',
        start_date: '2025-01-01',
        note: tag,
      }).select('id').single();
      if (sm3) cleanup.push({ table: 'student_memberships', id: sm3.id });
      assert(!sm3Err && !!sm3, 'student_memberships: EXPIRED 는 부분 유니크에 안 걸림(대조군)', sm3Err?.message ?? '데이터 없음');
    }
  }

  // ---------- anon 차단 ----------
  console.log('\n[F] anon SELECT 차단');
  for (const t of ['memberships', 'student_memberships', 'order_groups']) {
    const { data, error } = await anon.from(t).select('id').limit(1);
    const blocked = !!error || (Array.isArray(data) && data.length === 0);
    assert(blocked, `anon 은 ${t} 를 읽을 수 없다`, `행 ${data?.length ?? '?'}건이 노출됨`);
  }
}

async function doCleanup() {
  console.log('\n[cleanup] 이 테스트가 생성한 행 삭제');
  // FK 역순으로 삭제
  for (const row of cleanup.reverse()) {
    const { error } = await svc.from(row.table).delete().eq('id', row.id);
    if (error) console.log(`  WARN  ${row.table}:${row.id} 삭제 실패 — ${error.message}`);
    else console.log(`  del   ${row.table}:${row.id}`);
  }
}

try {
  await main();
} catch (e) {
  fail('검증 스크립트 실행', e?.message ?? String(e));
} finally {
  await doCleanup();
}

console.log(`\n=== T1 스키마 검증 결과: ${passed} passed, ${failures.length} failed ===`);
if (failures.length) {
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
process.exit(0);
