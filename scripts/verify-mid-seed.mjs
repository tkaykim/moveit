/**
 * T11 시드 검증 (라이브 DB 대상, 반복 실행 가능)
 *
 * 실행: node scripts/verify-mid-seed.mjs
 * 종료코드: 0 = 전부 통과, 1 = 하나라도 실패
 *
 * 검증 항목
 *  A) 수업 그룹 4개 (key / name / is_special 정확히)
 *  B) 상품 7행 — 가격·횟수·유효기간·플래그가 명세와 정확히 일치
 *  C) ALL PASS 커버리지 = {정규, 팝업} 정확히 (춤숨찐/워크샵 불포함)
 *  D) 춤숨찐 티켓 커버리지 = {춤숨찐} 정확히
 *  E) 멤버십 2개 존재 + 둘 다 hidden
 *  F) 전문반 = ALL PASS 번들 + 춤숨찐 티켓 50% + 워크샵 그룹 50%
 *  G) academies.booking_policy 가 명세와 일치
 *  H) academies.is_active 가 여전히 false (다크런치 유지)
 *
 * 조회 실패는 통과가 아니라 실패로 간주한다.
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { CLASS_GROUPS, TICKETS, MEMBERSHIPS, BOOKING_POLICY, canonical } from './mid-seed-config.mjs';

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

const SLUG = (process.argv.slice(2).find((a) => a.startsWith('--slug=')) ?? '--slug=mid').split('=')[1];

const svc = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

let passed = 0;
let failed = 0;
function check(label, cond, detail = '') {
  if (cond) {
    passed += 1;
    console.log(`  PASS  ${label}`);
  } else {
    failed += 1;
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}`);
  }
}
function eqSet(a, b) {
  const sa = [...new Set(a)].sort();
  const sb = [...new Set(b)].sort();
  return JSON.stringify(sa) === JSON.stringify(sb);
}

async function main() {
  const { data: academy, error } = await svc
    .from('academies')
    .select('id, slug, name_kr, is_active, booking_policy')
    .eq('slug', SLUG)
    .maybeSingle();
  if (error) throw new Error(`academies 조회 실패: ${error.message}`);
  if (!academy) throw new Error(`slug='${SLUG}' 학원 없음`);
  console.log(`검증 대상: ${academy.name_kr} (${academy.id})\n`);

  // --- A. 수업 그룹 ---
  console.log('A) 수업 그룹');
  const { data: groups, error: gErr } = await svc
    .from('class_groups')
    .select('id, key, name, is_special')
    .eq('academy_id', academy.id);
  if (gErr) throw new Error(`class_groups 조회 실패: ${gErr.message}`);
  check('그룹이 정확히 4개', groups.length === 4, `실제 ${groups.length}개`);
  const byKey = Object.fromEntries(groups.map((g) => [g.key, g]));
  for (const spec of CLASS_GROUPS) {
    const g = byKey[spec.key];
    check(
      `${spec.key} = "${spec.name}" (is_special=${spec.is_special})`,
      !!g && g.name === spec.name && g.is_special === spec.is_special,
      g ? `name=${g.name} is_special=${g.is_special}` : '없음'
    );
  }
  check('share/포에잇쉐어 그룹은 만들지 않았다', !byKey['share'] && !byKey['fore8share']);

  // --- B. 상품 ---
  console.log('\nB) 상품 (7행)');
  const { data: tickets, error: tErr } = await svc
    .from('tickets')
    .select('id, name, ticket_type, price, total_count, valid_days, valid_months, is_fixed_weekly, start_mode, is_general, class_id')
    .eq('academy_id', academy.id);
  if (tErr) throw new Error(`tickets 조회 실패: ${tErr.message}`);
  check('상품이 정확히 7행', tickets.length === 7, `실제 ${tickets.length}행`);
  const byName = Object.fromEntries(tickets.map((t) => [t.name, t]));
  check('워크샵 상품 행은 없다 (회차별 개별 가격)', !byName['워크샵']);

  for (const spec of TICKETS) {
    const t = byName[spec.name];
    if (!t) {
      check(`${spec.name} 존재`, false, '없음');
      continue;
    }
    const mismatches = [];
    if (t.ticket_type !== spec.ticket_type) mismatches.push(`type=${t.ticket_type}`);
    if (t.price !== spec.price) mismatches.push(`price=${t.price}`);
    if ((t.total_count ?? null) !== spec.total_count) mismatches.push(`count=${t.total_count}`);
    if ((t.valid_days ?? null) !== spec.valid_days) mismatches.push(`days=${t.valid_days}`);
    if ((t.valid_months ?? null) !== spec.valid_months) mismatches.push(`months=${t.valid_months}`);
    if (t.is_fixed_weekly !== spec.is_fixed_weekly) mismatches.push(`fixed=${t.is_fixed_weekly}`);
    if (t.start_mode !== spec.start_mode) mismatches.push(`start=${t.start_mode}`);
    check(
      `${spec.name}: ${spec.ticket_type} ${spec.price.toLocaleString()}원 ` +
        `count=${spec.total_count} days=${spec.valid_days} months=${spec.valid_months} ` +
        `fixed=${spec.is_fixed_weekly} start=${spec.start_mode}`,
      mismatches.length === 0,
      mismatches.join(' ')
    );
  }
  // 쿠폰 1장은 "당일만" — inclusiveExpiry(start,1)===start 이므로 valid_days=1 이어야 한다
  check(
    '쿠폰 1장은 당일만 유효 (valid_days=1)',
    byName['쿠폰 1장']?.valid_days === 1,
    `valid_days=${byName['쿠폰 1장']?.valid_days}`
  );

  // --- C/D. 커버리지 ---
  console.log('\nC/D) 커버리지 분리');
  const { data: cov, error: cErr } = await svc
    .from('ticket_coverage')
    .select('ticket_id, class_group_id, is_active')
    .in('ticket_id', tickets.map((t) => t.id));
  if (cErr) throw new Error(`ticket_coverage 조회 실패: ${cErr.message}`);
  const groupKeyById = Object.fromEntries(groups.map((g) => [g.id, g.key]));
  const covByTicket = {};
  for (const c of cov) {
    if (!c.is_active) continue;
    (covByTicket[c.ticket_id] ??= []).push(groupKeyById[c.class_group_id]);
  }

  for (const spec of TICKETS) {
    const t = byName[spec.name];
    if (!t) continue;
    const actual = covByTicket[t.id] ?? [];
    check(
      `${spec.name} 커버리지 = {${spec.coverage.join(', ')}}`,
      eqSet(actual, spec.coverage),
      `실제 {${actual.join(', ')}}`
    );
  }
  // 핵심 분리 규칙을 명시적으로 한 번 더
  const allpassCov = covByTicket[byName['ALL PASS']?.id] ?? [];
  check('ALL PASS 가 춤숨찐을 커버하지 않는다', !allpassCov.includes('cszz'));
  check('ALL PASS 가 워크샵을 커버하지 않는다', !allpassCov.includes('workshop'));
  const cszzCov = covByTicket[byName['춤숨찐 티켓']?.id] ?? [];
  check('춤숨찐 티켓이 정규를 커버하지 않는다', !cszzCov.includes('regular'));
  check('춤숨찐 티켓이 팝업을 커버하지 않는다', !cszzCov.includes('popup'));

  // --- E/F. 멤버십 ---
  console.log('\nE/F) 멤버십');
  const { data: mships, error: mErr } = await svc
    .from('memberships')
    .select('id, key, name, visibility, bundled_ticket_id, perks_text, is_active')
    .eq('academy_id', academy.id);
  if (mErr) throw new Error(`memberships 조회 실패: ${mErr.message}`);
  check('멤버십이 정확히 2개', mships.length === 2, `실제 ${mships.length}개`);
  const mByKey = Object.fromEntries(mships.map((m) => [m.key, m]));
  for (const spec of MEMBERSHIPS) {
    const m = mByKey[spec.key];
    check(`${spec.name}(${spec.key}) 존재`, !!m);
    check(`${spec.name} visibility='hidden'`, m?.visibility === 'hidden', `실제 ${m?.visibility}`);
  }

  const pro = mByKey['pro'];
  check(
    '전문반 번들 = ALL PASS',
    !!pro && pro.bundled_ticket_id === byName['ALL PASS']?.id,
    `bundled=${pro?.bundled_ticket_id}`
  );
  check(
    '전문반 perks = 연습실 자유이용 / 개인사물함 / 월평가',
    eqSet(pro?.perks_text ?? [], ['연습실 자유이용', '개인사물함', '월평가']),
    JSON.stringify(pro?.perks_text)
  );
  check('입시반은 스켈레톤 (번들 없음)', mByKey['exam']?.bundled_ticket_id == null);

  const { data: dis, error: dErr } = await svc
    .from('membership_discounts')
    .select('membership_id, class_group_id, ticket_id, percent, is_active')
    .in('membership_id', mships.map((m) => m.id));
  if (dErr) throw new Error(`membership_discounts 조회 실패: ${dErr.message}`);
  const proDis = dis.filter((d) => d.membership_id === pro?.id && d.is_active);
  check('전문반 할인이 정확히 2건', proDis.length === 2, `실제 ${proDis.length}건`);
  check(
    '전문반: 춤숨찐 티켓 상품 50% 할인',
    proDis.some((d) => d.ticket_id === byName['춤숨찐 티켓']?.id && d.percent === 50)
  );
  check(
    '전문반: 워크샵 수업그룹 50% 할인',
    proDis.some((d) => d.class_group_id === byKey['workshop']?.id && d.percent === 50)
  );
  check('입시반 할인은 아직 없음', dis.filter((d) => d.membership_id === mByKey['exam']?.id).length === 0);

  // --- G. 예약 정책 ---
  console.log('\nG) 예약 정책');
  check(
    'academies.booking_policy 가 명세와 일치',
    // jsonb 키 순서 재정렬에 무관하게 비교
    canonical(academy.booking_policy) === canonical(BOOKING_POLICY),
    JSON.stringify(academy.booking_policy)
  );

  // --- H. 다크런치 ---
  console.log('\nH) 다크런치');
  check('academies.is_active 가 여전히 false', academy.is_active === false, `실제 ${academy.is_active}`);

  // --- 참고: 태깅 현황 ---
  const { data: classes } = await svc
    .from('classes')
    .select('class_type, class_group_id')
    .eq('academy_id', academy.id);
  const tagStat = {};
  for (const c of classes ?? []) {
    const t = c.class_type ?? '(null)';
    tagStat[t] ??= { total: 0, tagged: 0, untagged: 0 };
    tagStat[t].total += 1;
    if (c.class_group_id) tagStat[t].tagged += 1;
    else tagStat[t].untagged += 1;
  }
  console.log('\n[참고] class_type 별 태깅 현황');
  console.table(tagStat);

  console.log(`\n결과: ${passed} 통과 / ${failed} 실패`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error('\n검증 실행 실패:', e.message);
  process.exit(1);
});
