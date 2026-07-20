import { test, expect } from '@playwright/test';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

/**
 * T0 — 핵심 권한 잠금 회귀 테스트
 *
 * 라이브 Supabase 프로젝트에 대해 anon 키 / 실제 학생 JWT 로 직접 검증한다.
 * (소스코드 문자열 검사가 아니라, 실제 RLS·GRANT 가 막는지를 확인)
 *
 * 검증 항목
 *  1) anon 은 user_tickets 에 INSERT 할 수 없다
 *  2) 로그인한 학생도 user_tickets 에 INSERT 할 수 없다
 *  3) 학생은 자기 예약을 COMPLETED / ABSENT / CONFIRMED 로 UPDATE 할 수 없다
 *  4) 학생은 restore_ticket_count / consume_ticket_count 를 호출할 수 없다
 *  5) audience_membership_id 가 NOT NULL 인 수업은 anon 에게 보이지 않는다
 *  6) anon 은 여전히 일반(audience NULL) 수업·스케줄을 볼 수 있다
 */

// --- .env.local 로딩 (테스트 러너가 Next 환경을 거치지 않으므로 직접 파싱) ---
function loadEnvLocal(): Record<string, string> {
  const envPath = path.join(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) {
    throw new Error(`.env.local 을 찾을 수 없습니다: ${envPath}`);
  }
  const out: Record<string, string> = {};
  for (const rawLine of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

const env = loadEnvLocal();
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

const STUDENT_EMAIL = 'e2e-moveit-student@modoogoods.com';
const E2E_PASSWORD = 'Test1234!e2e';

// 하네스가 준비되지 않았다면 조용히 통과시키지 않고 명시적으로 실패시킨다.
// (실행되지 못한 단언은 통과가 아니라 실패로 취급한다)
test.beforeAll(() => {
  expect(SUPABASE_URL, 'NEXT_PUBLIC_SUPABASE_URL 누락').toBeTruthy();
  expect(ANON_KEY, 'NEXT_PUBLIC_SUPABASE_ANON_KEY 누락').toBeTruthy();
  expect(SERVICE_KEY, 'SUPABASE_SERVICE_ROLE_KEY 누락 (테스트 픽스처 생성/정리에 필요)').toBeTruthy();
});

const anonClient = (): SupabaseClient =>
  createClient(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

const serviceClient = (): SupabaseClient =>
  createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

async function studentClient(): Promise<{ client: SupabaseClient; userId: string }> {
  const client = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await client.auth.signInWithPassword({
    email: STUDENT_EMAIL,
    password: E2E_PASSWORD,
  });
  expect(error, `학생 계정 로그인 실패: ${error?.message}`).toBeNull();
  expect(data.session?.access_token, '학생 JWT 없음').toBeTruthy();
  return { client, userId: data.user!.id };
}

test.describe('T0 권한 잠금 회귀 (라이브 RLS/GRANT)', () => {
  test('anon 은 user_tickets 에 INSERT 할 수 없다', async () => {
    const svc = serviceClient();
    const { data: ticket } = await svc.from('tickets').select('id').limit(1).single();
    expect(ticket?.id, '테스트용 ticket 이 없습니다').toBeTruthy();

    const { data, error } = await anonClient()
      .from('user_tickets')
      .insert({
        user_id: '00000000-0000-0000-0000-000000000000',
        ticket_id: ticket!.id,
        status: 'ACTIVE',
        remaining_count: 999,
      })
      .select();

    expect(error, 'anon INSERT 가 차단되지 않았습니다').not.toBeNull();
    expect(data).toBeNull();
  });

  test('로그인한 학생은 user_tickets 에 자기 수강권을 INSERT 할 수 없다', async () => {
    const svc = serviceClient();
    const { client, userId } = await studentClient();
    const { data: ticket } = await svc.from('tickets').select('id').limit(1).single();
    expect(ticket?.id).toBeTruthy();

    const { data, error } = await client
      .from('user_tickets')
      .insert({
        user_id: userId, // 본인 명의 = 구 ut_insert 정책이 허용하던 케이스
        ticket_id: ticket!.id,
        status: 'ACTIVE',
        remaining_count: 999,
      })
      .select();

    expect(error, '학생 self-INSERT 가 차단되지 않았습니다 (ut_insert 정책이 남아있는지 확인)').not.toBeNull();
    expect(data).toBeNull();

    // 방어적 정리: 혹시 삽입되었다면 즉시 제거 (이 테스트가 생성한 행에 한함)
    if (data && Array.isArray(data) && data.length > 0) {
      await svc.from('user_tickets').delete().eq('id', (data[0] as any).id);
    }
  });

  for (const targetStatus of ['COMPLETED', 'ABSENT', 'CONFIRMED']) {
    test(`학생은 자기 예약을 ${targetStatus} 로 UPDATE 할 수 없다`, async () => {
      const svc = serviceClient();
      const { client, userId } = await studentClient();

      const { data: booking } = await svc
        .from('bookings')
        .select('id, status')
        .eq('user_id', userId)
        .limit(1)
        .single();
      expect(booking?.id, '학생 소유 예약이 없어 검증할 수 없습니다').toBeTruthy();

      const originalStatus = booking!.status;

      const { data } = await client
        .from('bookings')
        .update({ status: targetStatus })
        .eq('id', booking!.id)
        .select();

      // RLS UPDATE 차단은 보통 "에러 없이 0행 영향"으로 나타난다.
      expect(data ?? [], 'RLS 가 학생 UPDATE 를 막지 못했습니다').toHaveLength(0);

      // 서비스 롤로 실제 상태가 그대로인지 확인 (진짜 no-op 인지 증명)
      const { data: after } = await svc
        .from('bookings')
        .select('status')
        .eq('id', booking!.id)
        .single();
      expect(after?.status, '예약 상태가 실제로 변경되었습니다').toBe(originalStatus);

      // 안전망: 만에 하나 변경되었다면 원복
      if (after?.status !== originalStatus) {
        await svc.from('bookings').update({ status: originalStatus }).eq('id', booking!.id);
      }
    });
  }

  test('학생은 restore_ticket_count 를 호출할 수 없다', async () => {
    const svc = serviceClient();
    const { client, userId } = await studentClient();

    const { data: ut } = await svc
      .from('user_tickets')
      .select('id, remaining_count')
      .eq('user_id', userId)
      .limit(1)
      .single();
    expect(ut?.id, '학생 소유 수강권이 없어 검증할 수 없습니다').toBeTruthy();

    const before = ut!.remaining_count;

    const { error } = await client.rpc('restore_ticket_count', {
      p_user_ticket_id: ut!.id,
      p_count: 1,
    });
    expect(error, 'restore_ticket_count 가 학생에게 노출되어 있습니다').not.toBeNull();

    const { data: after } = await svc
      .from('user_tickets')
      .select('remaining_count')
      .eq('id', ut!.id)
      .single();
    expect(after?.remaining_count, '잔여 횟수가 학생 호출로 변경되었습니다').toBe(before);
  });

  test('학생은 consume_ticket_count 를 호출할 수 없다', async () => {
    const svc = serviceClient();
    const { client, userId } = await studentClient();

    const { data: ut } = await svc
      .from('user_tickets')
      .select('id, remaining_count')
      .eq('user_id', userId)
      .limit(1)
      .single();
    expect(ut?.id).toBeTruthy();

    const before = ut!.remaining_count;

    const { error } = await client.rpc('consume_ticket_count', {
      p_user_ticket_id: ut!.id,
      p_count: 1,
    });
    expect(error, 'consume_ticket_count 가 학생에게 노출되어 있습니다').not.toBeNull();

    const { data: after } = await svc
      .from('user_tickets')
      .select('remaining_count')
      .eq('id', ut!.id)
      .single();
    expect(after?.remaining_count).toBe(before);
  });

  test('audience_membership_id 가 있는 수업은 anon 에게 보이지 않는다', async () => {
    const svc = serviceClient();

    // 기존 수업을 참고해 학원 ID 확보 (기존 행은 수정하지 않는다)
    const { data: sample } = await svc
      .from('classes')
      .select('id, academy_id')
      .limit(1)
      .single();
    expect(sample?.academy_id, '참고할 수업이 없습니다').toBeTruthy();

    // T1 에서 classes.audience_membership_id 에 FK 가 붙었으므로
    // 더 이상 가짜 UUID 를 쓸 수 없다 → 임시 멤버십을 실제로 만들고 정리한다.
    let createdMembershipId: string | null = null;
    let createdClassId: string | null = null;

    try {
      const { data: membership, error: membershipError } = await svc
        .from('memberships')
        .insert({
          academy_id: sample!.academy_id,
          key: `__t0probe_${Date.now()}`,
          name: 'E2E T0 audience lockdown probe membership',
          visibility: 'hidden',
          is_active: false,
        })
        .select('id')
        .single();
      expect(membershipError, `임시 멤버십 생성 실패: ${membershipError?.message}`).toBeNull();
      createdMembershipId = membership!.id;

      // 이 테스트가 직접 만든 임시 수업 (정리 시 이 한 행만 삭제)
      const { data: created, error: createError } = await svc
        .from('classes')
        .insert({
          academy_id: sample!.academy_id,
          title: 'E2E T0 audience lockdown probe',
          audience_membership_id: createdMembershipId,
        })
        .select('id')
        .single();
      expect(createError, `임시 수업 생성 실패: ${createError?.message}`).toBeNull();
      createdClassId = created!.id;

      // anon 에게는 보이지 않아야 한다
      const { data: anonView } = await anonClient()
        .from('classes')
        .select('id')
        .eq('id', createdClassId);
      expect(anonView ?? [], 'audience 제한 수업이 anon 에게 노출되었습니다').toHaveLength(0);

      // 서비스 롤로는 당연히 보인다 (테스트 픽스처가 실제로 존재함을 증명)
      const { data: svcView } = await svc.from('classes').select('id').eq('id', createdClassId);
      expect(svcView ?? []).toHaveLength(1);
    } finally {
      // 이 테스트가 생성한 행만 정리 (FK 역순)
      if (createdClassId) {
        await svc.from('classes').delete().eq('id', createdClassId);
      }
      if (createdMembershipId) {
        await svc.from('memberships').delete().eq('id', createdMembershipId);
      }
    }
  });

  test('anon 은 일반(audience NULL) 수업과 스케줄을 여전히 볼 수 있다', async () => {
    const anon = anonClient();

    const { data: classes, error: classError } = await anon
      .from('classes')
      .select('id')
      .limit(5);
    expect(classError, `anon classes 조회 실패: ${classError?.message}`).toBeNull();
    expect((classes ?? []).length, 'anon 이 일반 수업을 볼 수 없게 되었습니다').toBeGreaterThan(0);

    const { data: schedules, error: scheduleError } = await anon
      .from('schedules')
      .select('id')
      .limit(5);
    expect(scheduleError, `anon schedules 조회 실패: ${scheduleError?.message}`).toBeNull();
    expect((schedules ?? []).length, 'anon 이 일반 스케줄을 볼 수 없게 되었습니다').toBeGreaterThan(0);
  });
});
