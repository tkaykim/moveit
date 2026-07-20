import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import {
  processClassCanceledEvents,
  dispatchClassCancelNotifications,
} from '@/lib/booking/class-cancel';

/**
 * GET /api/cron/process-booking-events — **자주 도는** 이벤트 처리기 (T8)
 *
 * 왜 분리했는가:
 *   T6(SCHEDULE_CREATED) · T7(CLASS_CANCELED) 는 원래 하루 한 번 도는 만료 스윕
 *   (/api/cron/expire-tickets, 15:00 UTC) 에 얹혀 있었다. 그 결과 **휴강이 학생의
 *   횟수로 되돌아오기까지 최대 ~24시간**이 걸렸다 — 운영상 못 쓴다.
 *   이벤트 처리는 만료 스윕과 성격이 다르다(만료는 날짜 경계 작업, 이벤트는 반응
 *   작업). 그래서 스케줄을 쪼갠다. 일 단위 concern 은 기존 라우트에 그대로 둔다.
 *
 * 안전성: 두 프로세서 모두 멱등이다(이벤트 status 가드 · 복구 UNIQUE · 알림 원자 스탬프).
 *   따라서 얼마나 자주 돌든, 앞 실행과 겹쳐 돌든 결과가 달라지지 않는다.
 *
 * 빈 큐일 때 싸야 한다(5분마다 도니까):
 *   1) booking_events(status, created_at) 인덱스로 PENDING 1건만 head 조회 → 없으면 프로세서 skip
 *   2) 알림은 별도 큐(부분 인덱스 idx_ccr_pending_notify WHERE notified_at IS NULL)라
 *      이벤트가 없어도 남아있을 수 있다(이전 실행이 처리는 했는데 발송에 실패한 경우).
 *      단일 인덱스 조회 1회라 비어 있으면 사실상 공짜다.
 *   전체 스캔은 어느 경로에서도 하지 않는다.
 */

export const dynamic = 'force-dynamic';
/**
 * ⚠ 필수. Next 의 Data Cache 는 서버에서 나가는 fetch(=supabase-js 의 REST 호출)를
 *   디스크(.next/cache)에 캐시하고 **서버를 재시작해도 살아남는다**.
 *   그대로 두면 이 라우트가 몇 분 전(심지어 이미 삭제된) 큐 상태를 보고 판단한다.
 *   force-dynamic 만으로는 막히지 않는 경로가 있어 fetchCache 를 명시한다.
 *   (실제로 이 설정 없이 pending_probe 가 존재하지 않는 행 8건을 보고했다)
 */
export const fetchCache = 'force-no-store';

const EVENT_LIMIT = 500;
const NOTIFY_LIMIT = 500;

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
    return { name, ok: true, detail: await fn(), error: null };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[cron/events] concern "${name}" failed:`, msg);
    return { name, ok: false, detail: {}, error: msg };
  }
}

export async function GET(request: NextRequest) {
  // expire-tickets / auto-charge 와 동일한 인증 패턴
  const secret = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && secret !== `Bearer ${cronSecret}`) {
    const isVercelCron = request.headers.get('x-vercel-cron') === '1';
    if (!isVercelCron) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const supabase = createServiceClient() as any;
  const startedAt = Date.now();

  // --- 빈 큐 조기 종료 ------------------------------------------------------
  // status='PENDING' 은 booking_events_status_created_idx 의 선두 컬럼이다.
  // head:true 라 본문(행)을 전혀 실어오지 않는다 — 인덱스만 읽고 개수만 센다.
  //
  // ⚠ 여기에 .limit(1) 을 붙이면 안 된다. head+count 조합에서 Range 헤더가 덮여
  //    실제로 대기 이벤트가 있어도 count 가 0 으로 돌아온다. 그러면 이 라우트는
  //    영원히 idle 로 판단해 **아무것도 처리하지 않는다**(테스트 C1 이 잡은 실제 버그).
  let pendingProbe = 0;
  let probeError: string | null = null;
  try {
    const { count, error } = await supabase
      .from('booking_events')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'PENDING');
    if (error) throw new Error(error.message);
    pendingProbe = count ?? 0;
  } catch (e: unknown) {
    // 프로브가 실패했다고 처리를 건너뛰면 이벤트가 영영 안 돈다 → 그냥 돌린다.
    probeError = e instanceof Error ? e.message : String(e);
    pendingProbe = 1;
  }

  const concerns: ConcernResult[] = [];

  if (pendingProbe > 0) {
    // --- concern 1: 신규 회차 고정 주1회 백필 (SCHEDULE_CREATED, T6) ---------
    concerns.push(
      await runConcern('fixed_weekly_backfill', async () => {
        const { data, error } = await supabase.rpc('process_schedule_created_events', {
          p_limit: EVENT_LIMIT,
        });
        if (error) throw new Error(`신규 회차 백필 실패: ${error.message}`);
        return (data ?? {}) as Record<string, unknown>;
      })
    );

    // --- concern 2: 휴강 전파 (CLASS_CANCELED, T7) — concern 1 과 독립 -------
    concerns.push(
      await runConcern('class_cancel_propagation', async () => {
        const res = await processClassCanceledEvents(supabase as never, EVENT_LIMIT);
        return res as unknown as Record<string, unknown>;
      })
    );
  }

  // --- concern 3: 휴강 알림 발송 (앞의 concern 들과 독립) ---------------------
  // 이벤트 큐가 비어 있어도 미발송 복구 건은 남아 있을 수 있으므로 항상 시도한다.
  concerns.push(
    await runConcern('class_cancel_notifications', async () => {
      const res = await dispatchClassCancelNotifications(supabase as never, NOTIFY_LIMIT);
      return { sent: res.sent, failed: res.failed };
    })
  );

  const allOk = concerns.every((c) => c.ok);

  return NextResponse.json(
    {
      success: allOk,
      // 빈 큐였는지 — 모니터링에서 "자주 도는데 싼가"를 눈으로 확인하는 지표
      idle: pendingProbe === 0,
      pending_probe: pendingProbe,
      probe_error: probeError,
      duration_ms: Date.now() - startedAt,
      concerns,
    },
    { status: allOk ? 200 : 207 }
  );
}
