/**
 * E2E 테스트 계정 시드 (멱등).
 * - e2e-moveit-owner@modoogoods.com  : 원장 (온보딩 위저드 E2E용)
 * - e2e-moveit-student@modoogoods.com: 수강생 (구매·예약 E2E용)
 * 실행: node scripts/seed-e2e-accounts.mjs
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

// .env.local 로드 (dotenv 없이)
const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.includes('=') && !l.startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
);

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const ACCOUNTS = [
  { email: 'e2e-moveit-owner@modoogoods.com', password: 'Test1234!e2e', name: 'E2E원장', role: 'USER' },
  { email: 'e2e-moveit-student@modoogoods.com', password: 'Test1234!e2e', name: 'E2E수강생', role: 'USER' },
];

for (const acc of ACCOUNTS) {
  // 이미 있으면 재사용
  const { data: list } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const existing = list?.users?.find((u) => u.email === acc.email);
  let userId = existing?.id;

  if (!existing) {
    const { data, error } = await supabase.auth.admin.createUser({
      email: acc.email,
      password: acc.password,
      email_confirm: true,
      user_metadata: { name: acc.name },
    });
    if (error) {
      console.error(`[FAIL] ${acc.email}:`, error.message);
      process.exitCode = 1;
      continue;
    }
    userId = data.user.id;
  } else {
    // 비밀번호 통일 (기존 계정 재사용 대비)
    await supabase.auth.admin.updateUserById(userId, { password: acc.password, email_confirm: true });
  }

  // public.users 프로필 upsert
  const { error: upsertErr } = await supabase
    .from('users')
    .upsert({ id: userId, email: acc.email, name: acc.name, role: acc.role }, { onConflict: 'id' });
  if (upsertErr) console.warn(`[WARN] users upsert ${acc.email}:`, upsertErr.message);

  console.log(`[OK] ${acc.email} → ${userId}${existing ? ' (기존 재사용)' : ' (신규)'}`);
}
