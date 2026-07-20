/**
 * 스위트 전체 실행 후 잔재 감사 (T12).
 *
 * 왜 스펙 안이 아니라 스크립트인가:
 *   스펙 하나가 "다른 스펙의 잔재"를 검사하면, 자기보다 **뒤에 도는** 스펙은 볼 수 없다
 *   (Playwright 는 파일명 순서로 돈다). 전체 감사는 전체가 끝난 뒤에만 정확하다.
 *
 * 실행: node scripts/verify-no-test-leftovers.mjs
 * 종료코드: 0 = 깨끗함 / 1 = 잔재 있음
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
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

const svc = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/** 각 스펙이 쓰는 테스트 학원 slug 접두사 */
const TEST_SLUG_PREFIXES = [
  't12-',              // e2e-scenarios
  't10-mini-',         // miniapp-checkout
  't9-console-',       // admin-console
  't8-',               // board-integration / readiness
  't7-',               // refund-closure
  't6-',                // fixed-weekly
  't5-',               // payments
  't4-',               // orders
  't3-',               // membership
  't2-engine-test-',   // booking-engine
];

/** 실제 운영 학원 — 절대 변하면 안 된다 */
const REAL_ACADEMY_SLUG = 'mid';

let failed = false;
const fail = (msg) => {
  console.error(`[LEFTOVER] ${msg}`);
  failed = true;
};

// 1) 테스트 학원 잔재
for (const prefix of TEST_SLUG_PREFIXES) {
  const { data, error } = await svc.from('academies').select('id, slug').like('slug', `${prefix}%`);
  if (error) {
    fail(`academies 조회 실패(${prefix}): ${error.message}`);
    continue;
  }
  if (data.length) {
    fail(`테스트 학원 ${data.length}건 남음 (${prefix}): ${data.map((a) => a.slug).join(', ')}`);
  }
}

// 2) 테스트 합성 사용자 잔재
const { data: users } = await svc
  .from('users')
  .select('id, email')
  .or('email.like.t12-conc-%,email.like.e2e-t12-staffb-%');
if (users?.length) {
  fail(`테스트 사용자 ${users.length}건 남음: ${users.map((u) => u.email).join(', ')}`);
}

// 3) 실제 학원은 다크런치(is_active=false) 상태 그대로여야 한다
const { data: real, error: realErr } = await svc
  .from('academies')
  .select('id, slug, is_active')
  .eq('slug', REAL_ACADEMY_SLUG)
  .maybeSingle();
if (realErr || !real) {
  fail(`실제 학원(${REAL_ACADEMY_SLUG}) 조회 실패: ${realErr?.message ?? 'not found'}`);
} else if (real.is_active !== false) {
  fail(`실제 학원 is_active 가 ${real.is_active} 다 — 다크런치(false)여야 한다`);
} else {
  console.log(`[OK] 실제 학원(${REAL_ACADEMY_SLUG}) is_active=false 유지`);
}

if (failed) {
  console.error('\n결과: 잔재 있음 — 스위트를 반복 실행하면 DB 가 오염된다.');
  process.exit(1);
}
console.log('결과: 깨끗함 — 테스트 학원·합성 사용자 잔재 없음.');
