/**
 * MID 학원(slug='mid') 시드 실행기 (T11) — 멱등.
 *
 * 실행:
 *   node scripts/seed-mid.mjs                 # 실제 학원(mid)에 적용
 *   node scripts/seed-mid.mjs --dry-run       # 아무것도 쓰지 않고 현재 상태만 출력
 *   node scripts/seed-mid.mjs --slug=xxx      # 임시(throwaway) 학원에 같은 설정 적용
 *
 * 종료코드: 0 = 성공, 1 = 실패
 *
 * 안전 장치 (실행 순서대로):
 *   1. 대상 학원을 slug 로 확정한다.
 *   2. slug='mid' 이면 is_active 가 false 인지 **먼저 확인**한다. true 면 즉시 중단
 *      — 다크런치 전제가 깨진 상태이므로 사람이 판단해야 한다.
 *   3. 되돌리기용 스냅샷(변경 대상 classes 의 이전 class_group_id + 이전
 *      booking_policy)을 파일로 남긴다. 스냅샷 저장 실패 시 아무것도 쓰지 않는다.
 *   4. 시드를 적용한다.
 *   5. is_active 가 여전히 false 인지 다시 확인한다.
 *
 * 이 스크립트는 DELETE / DROP / TRUNCATE 를 하지 않는다.
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

import { applySeed, CLASS_TYPE_TO_GROUP, BOOKING_POLICY, canonical } from './mid-seed-config.mjs';

// --- .env.local 로드 (dotenv 없이) ---
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

const URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !SERVICE_KEY) {
  console.error('.env.local 에 NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 가 필요합니다.');
  process.exit(1);
}

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const SLUG = (args.find((a) => a.startsWith('--slug=')) ?? '--slug=mid').split('=')[1];
const SNAPSHOT_DIR = path.join(process.cwd(), 'scripts', '.mid-seed-snapshots');

const svc = createClient(URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function log(...a) {
  console.log(...a);
}

async function countRows(table, filter) {
  let q = svc.from(table).select('id', { count: 'exact', head: true });
  for (const [k, v] of Object.entries(filter)) q = q.eq(k, v);
  const { count, error } = await q;
  if (error) throw new Error(`${table} count 실패: ${error.message}`);
  return count ?? 0;
}

/** 이 학원에 걸린 행 수 (시드가 건드리는 테이블 전부) */
async function tableCounts(academyId) {
  const groups = await countRows('class_groups', { academy_id: academyId });
  const tickets = await countRows('tickets', { academy_id: academyId });
  const memberships = await countRows('memberships', { academy_id: academyId });

  const { data: tRows } = await svc.from('tickets').select('id').eq('academy_id', academyId);
  const ticketIds = (tRows ?? []).map((r) => r.id);
  let coverage = 0;
  if (ticketIds.length > 0) {
    const { count } = await svc
      .from('ticket_coverage')
      .select('id', { count: 'exact', head: true })
      .in('ticket_id', ticketIds);
    coverage = count ?? 0;
  }

  const { data: mRows } = await svc.from('memberships').select('id').eq('academy_id', academyId);
  const membershipIds = (mRows ?? []).map((r) => r.id);
  let discounts = 0;
  if (membershipIds.length > 0) {
    const { count } = await svc
      .from('membership_discounts')
      .select('id', { count: 'exact', head: true })
      .in('membership_id', membershipIds);
    discounts = count ?? 0;
  }

  const { data: classes } = await svc
    .from('classes')
    .select('id, class_group_id')
    .eq('academy_id', academyId);
  const classesTotal = (classes ?? []).length;
  const classesTagged = (classes ?? []).filter((c) => c.class_group_id).length;

  return {
    class_groups: groups,
    tickets,
    ticket_coverage: coverage,
    memberships,
    membership_discounts: discounts,
    classes_total: classesTotal,
    classes_tagged: classesTagged,
    classes_untagged: classesTotal - classesTagged,
  };
}

async function main() {
  // --- 1. 대상 학원 ---
  const { data: academy, error: acadErr } = await svc
    .from('academies')
    .select('id, slug, name_kr, is_active, booking_policy')
    .eq('slug', SLUG)
    .maybeSingle();
  if (acadErr) throw new Error(`academies 조회 실패: ${acadErr.message}`);
  if (!academy) throw new Error(`slug='${SLUG}' 학원을 찾을 수 없습니다.`);

  log(`대상 학원: ${academy.name_kr} (slug=${academy.slug}, id=${academy.id})`);
  log(`is_active (시드 전): ${academy.is_active}`);

  // --- 2. 다크런치 전제 확인 (실제 mid 에 한해) ---
  const isRealMid = academy.slug === 'mid';
  if (isRealMid && academy.is_active !== false) {
    throw new Error(
      `중단: mid 학원의 is_active 가 ${academy.is_active} 입니다. ` +
        '다크런치 전제(is_active=false)가 깨졌습니다. 사람이 확인해야 합니다.'
    );
  }

  // --- before 스냅샷 ---
  const before = await tableCounts(academy.id);
  log('\n[시드 전 행 수]');
  console.table(before);

  const { data: classesBefore, error: cbErr } = await svc
    .from('classes')
    .select('id, title, class_type, class_group_id')
    .eq('academy_id', academy.id);
  if (cbErr) throw new Error(`classes 스냅샷 실패: ${cbErr.message}`);

  const willTouch = (classesBefore ?? []).filter((c) => CLASS_TYPE_TO_GROUP[c.class_type ?? '']);
  const willLeave = (classesBefore ?? []).filter((c) => !CLASS_TYPE_TO_GROUP[c.class_type ?? '']);

  log(`\nclass_type 분포 / 매핑 계획:`);
  const dist = {};
  for (const c of classesBefore ?? []) {
    const t = c.class_type ?? '(null)';
    dist[t] ??= { count: 0, mapsTo: CLASS_TYPE_TO_GROUP[t] ?? '— (미태깅: 운영자 큐로)' };
    dist[t].count += 1;
  }
  console.table(dist);
  log(`태깅 대상 ${willTouch.length}건 / 미태깅 유지 ${willLeave.length}건`);

  if (DRY_RUN) {
    log('\n--dry-run: 아무것도 쓰지 않고 종료합니다.');
    return;
  }

  // --- 3. 되돌리기 스냅샷 저장 (쓰기 전에) ---
  mkdirSync(SNAPSHOT_DIR, { recursive: true });
  const snapshotPath = path.join(SNAPSHOT_DIR, `${academy.slug}-latest.json`);
  const snapshot = {
    takenAt: new Date().toISOString(),
    academyId: academy.id,
    academySlug: academy.slug,
    isActiveBefore: academy.is_active,
    bookingPolicyBefore: academy.booking_policy ?? null,
    // 되돌릴 때 필요한 것: 건드릴 수업의 이전 class_group_id
    classesBefore: willTouch.map((c) => ({
      id: c.id,
      class_type: c.class_type,
      class_group_id_before: c.class_group_id ?? null,
    })),
    countsBefore: before,
  };
  writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2), 'utf8');
  log(`\n되돌리기 스냅샷 저장: ${snapshotPath}`);

  // --- 4. 시드 적용 ---
  const report = await applySeed(svc, academy.id, { tagClasses: true });

  log('\n[시드 결과]');
  console.table({
    'class_groups': `생성 ${report.groups.created} / 기존 ${report.groups.existing}`,
    'tickets': `생성 ${report.tickets.created} / 기존 ${report.tickets.existing}`,
    'ticket_coverage': `생성 ${report.coverage.created} / 기존 ${report.coverage.existing}`,
    'memberships': `생성 ${report.memberships.created} / 기존 ${report.memberships.existing} / 갱신 ${report.memberships.updated}`,
    'membership_discounts': `생성 ${report.discounts.created} / 기존 ${report.discounts.existing}`,
    'booking_policy': report.bookingPolicy.updated ? '갱신됨' : '이미 일치',
    'classes 태깅': `갱신 ${report.classTagging.updated} / 이미맞음 ${report.classTagging.unchanged} / 미태깅 ${report.classTagging.leftUntagged}`,
  });

  log('\nclass_type 별 태깅 결과:');
  console.table(report.classTagging.byType);

  // --- 5. is_active 재확인 ---
  const { data: after, error: afterErr } = await svc
    .from('academies')
    .select('is_active, booking_policy')
    .eq('id', academy.id)
    .single();
  if (afterErr) throw new Error(`시드 후 academies 조회 실패: ${afterErr.message}`);

  log(`\nis_active (시드 후): ${after.is_active}`);
  if (isRealMid && after.is_active !== false) {
    throw new Error(`치명적: 시드 후 mid 의 is_active 가 ${after.is_active} 입니다. 즉시 확인 필요.`);
  }
  // jsonb 는 키 순서가 재정렬되므로 정규화 비교해야 한다.
  if (canonical(after.booking_policy) !== canonical(BOOKING_POLICY)) {
    throw new Error(
      `booking_policy 가 기대값과 다릅니다: ${JSON.stringify(after.booking_policy)}`
    );
  }

  const afterCounts = await tableCounts(academy.id);
  log('\n[시드 후 행 수]');
  console.table(afterCounts);

  log(`\n총 변경 행 수: ${report.changedRows}`);
  if (report.changedRows === 0) {
    log('변경 없음 — 이미 시드된 상태입니다 (멱등).');
  }
}

main().catch((e) => {
  console.error('\n실패:', e.message);
  process.exit(1);
});
