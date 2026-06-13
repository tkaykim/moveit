/**
 * POST /api/errors/report
 * 클라이언트/런타임 오류 수집 엔드포인트.
 * - 인증 불필요(오류는 비로그인 상태에서도 발생). 단 service-role로 기록(RLS 우회).
 * - 절대 throw 하지 않음(에러 리포터가 또 에러를 내면 안 됨). 실패해도 204.
 * - 같은 fingerprint는 10분 내 occurrences++로 디듀프(report_error_log RPC).
 */
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getAuthenticatedUser } from '@/lib/supabase/server-auth';

export const dynamic = 'force-dynamic';

function fingerprintOf(source: string, message: string, url?: string): string {
  let path = '';
  try { path = url ? new URL(url).pathname : ''; } catch { path = url || ''; }
  const msg = (message || '').slice(0, 120);
  return `${source}|${msg}|${path}`;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const {
      level, source, message, stack, url, statusCode, context, academyId,
    } = body as {
      level?: string; source?: string; message?: string; stack?: string;
      url?: string; statusCode?: number; context?: Record<string, unknown>; academyId?: string;
    };

    // 메시지 없는 잡음은 무시
    if (!message || typeof message !== 'string' || !source) {
      return new NextResponse(null, { status: 204 });
    }

    // 로그인 사용자는 best-effort로 식별(없어도 진행)
    let userId: string | null = null;
    try {
      const u = await getAuthenticatedUser(request);
      userId = u?.id ?? null;
    } catch { /* ignore */ }

    const userAgent = request.headers.get('user-agent') || null;
    const fp = fingerprintOf(source, message, url);

    const supabase = createServiceClient() as any;
    await supabase.rpc('report_error_log', {
      p_level: (level === 'warning' || level === 'fatal') ? level : 'error',
      p_source: String(source).slice(0, 60),
      p_message: message,
      p_stack: stack ? String(stack) : null,
      p_url: url ? String(url).slice(0, 500) : null,
      p_user_agent: userAgent,
      p_user_id: userId,
      p_academy_id: (typeof academyId === 'string' && academyId.length === 36) ? academyId : null,
      p_status_code: typeof statusCode === 'number' ? statusCode : null,
      p_context: context ?? null,
      p_fingerprint: fp,
    });

    return new NextResponse(null, { status: 204 });
  } catch (e) {
    // 리포터 자체는 절대 사용자 흐름을 깨면 안 됨
    console.error('[errors/report] failed:', e);
    return new NextResponse(null, { status: 204 });
  }
}
