import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { logTicketEvent } from '@/lib/db/enrollment-activity-log';

/**
 * GET /api/cron/expire-tickets
 *
 * 매일 KST 자정에 실행되어 만료일이 지난 ACTIVE user_tickets 를 EXPIRED 로 전환하고
 * enrollment_activity_log 에 TICKET_EXPIRED 를 기록한다.
 *
 * Idempotent — `WHERE status='ACTIVE'` 가드를 통해 동일 행이 두 번 처리되지 않는다.
 * vercel.json 등록 예시:
 *   { "crons": [{ "path": "/api/cron/expire-tickets", "schedule": "0 15 * * *" }] }
 */
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
  const today = new Date().toISOString().split('T')[0];
  const results = { expired: 0, skipped: 0, errors: [] as string[] };

  try {
    // 1) 후보 조회 — ACTIVE && expiry_date < today
    const { data: candidates, error: fetchErr } = await supabase
      .from('user_tickets')
      .select('id, user_id, ticket_id, expiry_date, status, tickets(academy_id, name, ticket_type)')
      .eq('status', 'ACTIVE')
      .lt('expiry_date', today);

    if (fetchErr) {
      console.error('[expire-tickets] fetch error', fetchErr);
      return NextResponse.json({ error: '후보 조회 실패' }, { status: 500 });
    }

    for (const row of candidates ?? []) {
      const r = row as any;
      try {
        // 2) 동시성 가드: ACTIVE 였던 행만 EXPIRED 로 전환 (idempotent)
        const { data: updated } = await supabase
          .from('user_tickets')
          .update({ status: 'EXPIRED' })
          .eq('id', r.id)
          .eq('status', 'ACTIVE')
          .select('id')
          .maybeSingle();

        if (!updated) {
          // 다른 프로세스가 이미 처리했거나 race condition
          results.skipped += 1;
          continue;
        }

        // 3) 활동 로그 기록
        await logTicketEvent({
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
        }, supabase).catch(() => {});

        results.expired += 1;
      } catch (e: any) {
        console.error('[expire-tickets] row error', r.id, e?.message);
        results.errors.push(`${r.id}: ${e?.message || 'unknown'}`);
      }
    }

    return NextResponse.json({
      success: true,
      sweep_date: today,
      ...results,
    });
  } catch (e: any) {
    console.error('[expire-tickets] fatal error', e?.message);
    return NextResponse.json({ error: e?.message || '서버 오류' }, { status: 500 });
  }
}
