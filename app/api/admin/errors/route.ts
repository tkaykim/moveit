/**
 * GET  /api/admin/errors      — 수집된 오류 목록 (슈퍼관리자)
 * PATCH /api/admin/errors      — { id, resolved } 오류 해결 처리
 * Query: level, resolved(true/false/all), q(검색), limit
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/supabase/admin-auth';
import { createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
// 운영 화면은 절대 캐시된 DB 읽기를 보면 안 된다 (Next Data Cache 는 디스크에 남는다)
export const fetchCache = 'force-no-store';

export async function GET(request: NextRequest) {
  const auth = await requireSuperAdmin(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const sp = request.nextUrl.searchParams;
  const level = sp.get('level');
  const resolved = sp.get('resolved') || 'false';
  const q = (sp.get('q') || '').trim();
  const limit = Math.min(200, Math.max(1, parseInt(sp.get('limit') || '100', 10) || 100));

  const supabase = createServiceClient() as any;
  let query = supabase
    .from('error_logs')
    .select('id, created_at, last_seen_at, level, source, message, url, status_code, user_id, academy_id, occurrences, resolved, fingerprint')
    .order('last_seen_at', { ascending: false })
    .limit(limit);

  if (level && level !== 'all') query = query.eq('level', level);
  if (resolved === 'true') query = query.eq('resolved', true);
  else if (resolved === 'false') query = query.eq('resolved', false);
  if (q) query = query.ilike('message', `%${q.replace(/[%_\\]/g, '\\$&')}%`);

  const { data, error } = await query;
  if (error) {
    console.error('[admin/errors] list error:', error);
    return NextResponse.json({ error: '오류 목록 조회 실패' }, { status: 500 });
  }

  // 미해결 총계(배지용)
  const { count: unresolvedCount } = await supabase
    .from('error_logs')
    .select('id', { count: 'exact', head: true })
    .eq('resolved', false);

  return NextResponse.json({ data: data || [], unresolvedCount: unresolvedCount || 0 });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireSuperAdmin(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await request.json().catch(() => ({}));
  const { id, resolved } = body as { id?: string; resolved?: boolean };
  if (!id) return NextResponse.json({ error: 'id가 필요합니다.' }, { status: 400 });

  const supabase = createServiceClient() as any;
  const { error } = await supabase
    .from('error_logs')
    .update({
      resolved: resolved !== false,
      resolved_at: resolved !== false ? new Date().toISOString() : null,
      resolved_by: resolved !== false ? auth.user?.id ?? null : null,
    })
    .eq('id', id);

  if (error) {
    console.error('[admin/errors] resolve error:', error);
    return NextResponse.json({ error: '처리 실패' }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
