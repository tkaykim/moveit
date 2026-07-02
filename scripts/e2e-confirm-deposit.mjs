/**
 * E2E: 원장 계정으로 입금확인 API 호출 (bank_transfer_orders PENDING → CONFIRMED).
 * 사용: node scripts/e2e-confirm-deposit.mjs <academySlugOrId> <orderId> [baseUrl]
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

const [academyId, orderId, baseUrl = 'http://localhost:4310'] = process.argv.slice(2);
if (!academyId || !orderId) {
  console.error('usage: node scripts/e2e-confirm-deposit.mjs <academyId> <orderId> [baseUrl]');
  process.exit(1);
}

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.includes('=') && !l.startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
);

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const { data: auth, error: authErr } = await supabase.auth.signInWithPassword({
  email: 'e2e-moveit-owner@modoogoods.com',
  password: 'Test1234!e2e',
});
if (authErr) {
  console.error('owner login failed:', authErr.message);
  process.exit(1);
}

const res = await fetch(`${baseUrl}/api/academy-admin/${academyId}/bank-transfer-confirm`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${auth.session.access_token}`,
  },
  body: JSON.stringify({ orderId }),
});
console.log('status:', res.status);
console.log(JSON.stringify(await res.json(), null, 2));
