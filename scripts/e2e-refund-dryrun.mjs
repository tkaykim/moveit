/**
 * E2E: 환불 dryRun — tickets.refund_policy(커스텀 규칙)가 권장 환불액 계산에 반영되는지 검증.
 * 사용: node scripts/e2e-refund-dryrun.mjs <academyId> <userTicketId> [baseUrl]
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

const [academyId, userTicketId, baseUrl = 'http://localhost:4310'] = process.argv.slice(2);

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.includes('=') && !l.startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
);

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const { data: auth } = await supabase.auth.signInWithPassword({
  email: 'e2e-moveit-owner@modoogoods.com',
  password: 'Test1234!e2e',
});

const res = await fetch(`${baseUrl}/api/academy-admin/${academyId}/ticket-refund`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.session.access_token}` },
  body: JSON.stringify({ userTicketId, dryRun: true }),
});
console.log('status:', res.status);
console.log(JSON.stringify(await res.json(), null, 2));
