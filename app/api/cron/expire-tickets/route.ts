import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { logTicketEvent } from '@/lib/db/enrollment-activity-log';
import { getKSTTodayString } from '@/lib/utils/kst-time';
import { expireStudentMemberships } from '@/lib/db/memberships';

/**
 * GET /api/cron/expire-tickets
 *
 * 매일 KST 자정에 실행되는 만료 스윕. **서로 독립적인 concern 여러 개**를 순서대로 돌린다.
 *   1) tickets      : 만료일이 지난 ACTIVE user_tickets → EXPIRED
 *   2) memberships  : end_date 가 지난 ACTIVE|SUSPENDED student_memberships → EXPIRED
 *   3) bank_holds   : 24시간 입금 대기가 지난 BANK 주문 → EXPIRED + 잡고 있던 좌석 반납
 *
 * 불변 규칙:
 *   - 한 concern 이 실패해도 나머지는 계속 돈다. 각 concern 의 성패는 개별로 기록된다.
 *   - 멤버십이 만료돼도 번들 수강권은 회수하지 않는다(자기 만료일을 따른다).
 *     학생의 미래 예약도 자동 취소하지 않는다 → 운영자 검토 큐로 넘어간다.
 *   - bank_holds 는 이미 CONFIRMED 된 주문을 절대 건드리지 않는다. 결제 확정과
 *     경합하므로 DB 함수가 주문 행을 잠그고 상태를 재확인한 뒤에만 만료시킨다.
 *
 * Idempotent — 각 concern 이 상태 가드(`WHERE status=...`)를 쓴다.
 * vercel.json 등록 예시:
 *   { "crons": [{ "path": "/api/cron/expire-tickets", "schedule": "0 15 * * *" }] }
 */

interface ConcernResult {
  name: string;
  ok: boolean;
  detail: Record<string, unknown>;
  error: string | null;
}

async function runConcern(
  name: string,
  fn: () => Promise<Record<string, unknown>>
): Promise<ConcernResult> {
  try {
    const detail = await fn();
    return { name, ok: true, detail, error: null };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[cron/expire] concern "${name}" failed:`, msg);
    return { name, ok: false, detail: {}, error: msg };
  }
}

export async function GET(request: NextRequest) {
  // CRON_SECRET 검증 (auto-charge 와 동일 패턴)
  const secret = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && secret !== `Bearer ${cronSecret}`) {
    const isVercelCron = request.headers.get('x-vercel-cron') === '1';
    if (!isVercelCron) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const supabase = createServiceClient() as any;
  // KST 기준 오늘 (UTC 자정 cron 실행 시 전날로 계산되던 off-by-one 방지)
  const today = getKSTTodayString();

  // --- concern 1: 수강권 만료 ---------------------------------------------
  const ticketConcern = await runConcern('tickets', async () => {
    const results = { expired: 0, skipped: 0, errors: [] as string[] };

    const { data: candidates, error: fetchErr } = await supabase
      .from('user_tickets')
      .select('id, user_id, ticket_id, expiry_date, status, tickets(academy_id, name, ticket_type)')
      .eq('status', 'ACTIVE')
      .lt('expiry_date', today);

    if (fetchErr) throw new Error(`후보 조회 실패: ${fetchErr.message}`);

    for (const row of candidates ?? []) {
      const r = row as any;
      try {
        // 동시성 가드: ACTIVE 였던 행만 EXPIRED 로 전환 (idempotent)
        const { data: updated } = await supabase
          .from('user_tickets')
          .update({ status: 'EXPIRED' })
          .eq('id', r.id)
          .eq('status', 'ACTIVE')
          .select('id')
          .maybeSingle();

        if (!updated) {
          results.skipped += 1;
          continue;
        }

        await logTicketEvent(
          {
            academy_id: r.tickets?.academy_id,
            user_id: r.user_id ?? null,
            user_ticket_id: r.id,
            action: 'TICKET_EXPIRED',
            before: { status: 'ACTIVE', expiry_date: r.expiry_date },
            after: { status: 'EXPIRED', expiry_date: r.expiry_date },
            via: 'auto_expiry_cron',
            context: {
              ticket_id: r.ticket_id,
              ticket_name: r.tickets?.name ?? null,
              ticket_type: r.tickets?.ticket_type ?? null,
              sweep_date: today,
            },
          },
          supabase
        ).catch(() => {});

        results.expired += 1;
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'unknown';
        console.error('[cron/expire] ticket row error', r.id, msg);
        results.errors.push(`${r.id}: ${msg}`);
      }
    }

    return results as unknown as Record<string, unknown>;
  });

  // --- concern 2: 멤버십 만료 (수강권 concern 과 독립) -----------------------
  const membershipConcern = await runConcern('memberships', async () => {
    const res = await expireStudentMemberships(supabase, null);
    return { expired: res.expired, sweep_date: res.sweep_date, ids: res.ids };
  });

  // --- concern 3: BANK 좌석 홀드 만료 (앞의 concern 들과 독립) ---------------
  // 좌석을 반납해야 다른 학생이 예약할 수 있으므로 하루 한 번이 아니라
  // 더 자주 도는 스케줄에 물려도 안전하도록 idempotent 하게 설계돼 있다.
  const bankHoldConcern = await runConcern('bank_holds', async () => {
    const { data, error } = await supabase.rpc('expire_pending_bank_orders');
    if (error) throw new Error(`홀드 만료 실패: ${error.message}`);
    return (data ?? {}) as Record<string, unknown>;
  });

  const concerns = [ticketConcern, membershipConcern, bankHoldConcern];
  const allOk = concerns.every((c) => c.ok);

  return NextResponse.json(
    {
      success: allOk,
      sweep_date: today,
      concerns,
      // 하위 호환: 기존 소비자가 읽던 최상위 필드 유지
      expired: (ticketConcern.detail.expired as number) ?? 0,
      skipped: (ticketConcern.detail.skipped as number) ?? 0,
      errors: (ticketConcern.detail.errors as string[]) ?? [],
    },
    { status: allOk ? 200 : 207 }
  );
}
