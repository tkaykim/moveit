/**
 * MID 시드 되돌리기 (T11) — seed-mid.mjs 가 UPDATE 한 컬럼만 복원한다.
 *
 * 실행:
 *   node scripts/revert-mid-seed.mjs --dry-run   # 무엇을 되돌릴지만 출력 (기본 권장)
 *   node scripts/revert-mid-seed.mjs --confirm   # 실제 복원
 *   node scripts/revert-mid-seed.mjs --slug=xxx --confirm
 *
 * 복원 범위 (딱 이 둘):
 *   - classes.class_group_id  → 스냅샷의 이전 값
 *   - academies.booking_policy → 스냅샷의 이전 값
 *
 * ⛔ 이 스크립트는 시드가 INSERT 한 행(class_groups / tickets / ticket_coverage /
 *    memberships / membership_discounts)을 **삭제하지 않는다**. DELETE 는 금지되어
 *    있고, 그 행들은 참조하는 곳이 없으면 무해하다. 정말 지워야 한다면 사람이
 *    직접 판단해서 수행해야 한다 (그 사이 학생 구매가 붙었을 수 있다).
 *
 * ⚠ class_group_id 를 null 로 되돌리면 그 수업은 다시 예약 불가가 된다
 *    (lib/booking/coverage.ts 불변 규칙 0). 그것이 시드 이전 상태이므로 의도된 결과다.
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

import { canonical } from './mid-seed-config.mjs';

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

const args = process.argv.slice(2);
const CONFIRM = args.includes('--confirm');
const SLUG = (args.find((a) => a.startsWith('--slug=')) ?? '--slug=mid').split('=')[1];
const snapshotPath = path.join(process.cwd(), 'scripts', '.mid-seed-snapshots', `${SLUG}-latest.json`);

const svc = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  if (!existsSync(snapshotPath)) {
    throw new Error(`스냅샷이 없습니다: ${snapshotPath}\n(seed-mid.mjs 를 먼저 실행해야 생깁니다.)`);
  }
  const snap = JSON.parse(readFileSync(snapshotPath, 'utf8'));
  console.log(`스냅샷: ${snapshotPath}`);
  console.log(`  기록 시각: ${snap.takenAt}`);
  console.log(`  학원: ${snap.academySlug} (${snap.academyId})`);
  console.log(`  복원 대상 수업: ${snap.classesBefore.length}건`);
  console.log(`  booking_policy 이전 값: ${JSON.stringify(snap.bookingPolicyBefore)}`);

  // 현재 값과 비교해 실제로 되돌릴 것만 추린다
  const ids = snap.classesBefore.map((c) => c.id);
  const current = new Map();
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await svc
      .from('classes')
      .select('id, class_group_id')
      .in('id', ids.slice(i, i + 200));
    if (error) throw new Error(`classes 조회 실패: ${error.message}`);
    for (const r of data ?? []) current.set(r.id, r.class_group_id ?? null);
  }

  const toRevert = snap.classesBefore.filter(
    (c) => current.has(c.id) && current.get(c.id) !== c.class_group_id_before
  );
  console.log(`\n실제로 되돌릴 수업: ${toRevert.length}건 (나머지는 이미 이전 값)`);

  const { data: acad } = await svc
    .from('academies')
    .select('booking_policy, is_active')
    .eq('id', snap.academyId)
    .single();
  // jsonb 키 순서 재정렬에 무관하게 비교 (아니면 매번 "다르다"고 나온다)
  const policyDiffers = canonical(acad?.booking_policy ?? null) !== canonical(snap.bookingPolicyBefore);
  console.log(`booking_policy 되돌림 필요: ${policyDiffers}`);
  console.log(`is_active 현재값: ${acad?.is_active}`);

  if (!CONFIRM) {
    console.log('\n--confirm 없이 실행되었습니다. 아무것도 쓰지 않고 종료합니다.');
    return;
  }

  // class_group_id 복원 — 이전 값이 같은 것끼리 묶어 UPDATE
  const byPrev = new Map();
  for (const c of toRevert) {
    const k = c.class_group_id_before ?? '__null__';
    if (!byPrev.has(k)) byPrev.set(k, []);
    byPrev.get(k).push(c.id);
  }
  let reverted = 0;
  for (const [k, group] of byPrev) {
    const value = k === '__null__' ? null : k;
    const { data, error } = await svc
      .from('classes')
      .update({ class_group_id: value })
      .in('id', group)
      .eq('academy_id', snap.academyId)
      .select('id');
    if (error) throw new Error(`복원 실패: ${error.message}`);
    reverted += (data ?? []).length;
  }

  if (policyDiffers) {
    const { error } = await svc
      .from('academies')
      .update({ booking_policy: snap.bookingPolicyBefore })
      .eq('id', snap.academyId);
    if (error) throw new Error(`booking_policy 복원 실패: ${error.message}`);
  }

  const { data: after } = await svc
    .from('academies')
    .select('is_active')
    .eq('id', snap.academyId)
    .single();

  console.log(`\n복원 완료: classes ${reverted}건, booking_policy ${policyDiffers ? '복원됨' : '변경없음'}`);
  console.log(`is_active (복원 후): ${after?.is_active}`);
  console.log('참고: 시드가 INSERT 한 행은 설계상 삭제하지 않습니다.');
}

main().catch((e) => {
  console.error('\n실패:', e.message);
  process.exit(1);
});
