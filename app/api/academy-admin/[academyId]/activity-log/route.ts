/**
 * GET /api/academy-admin/[academyId]/activity-log
 * 수강신청/취소/환불/연장 등 활동 로그 목록 (활동로그 탭용)
 *
 * POST /api/academy-admin/[academyId]/activity-log
 * 클라이언트 사이드(관리자 판매 등)에서 활동 로그 기록 요청
 */
import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/supabase/server-auth';
import { createServiceClient } from '@/lib/supabase/server';
import { assertAcademyAdmin } from '@/lib/supabase/academy-admin-auth';
import { insertEnrollmentActivityLog, type EnrollmentActivityAction } from '@/lib/db/enrollment-activity-log';

export const dynamic = 'force-dynamic';

const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 100;

const ACTION_LABELS: Record<string, string> = {
  ENROLL: '수강신청',
  CANCEL: '예약 취소',
  REFUND: '환불',
  EXTENSION_APPROVED: '연장/일시정지 승인',
  COUNT_DEDUCT: '횟수 차감',
  COUNT_RESTORE: '횟수 복구',
  TICKET_ISSUED: '수강권 발급',
  EXTENSION_REQUESTED: '연장/일시정지 신청',
  ADMIN_EXTEND: '관리자 연장',
  ADMIN_ENROLL: '관리자 수기 추가',
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ academyId: string }> }
) {
  try {
    const { academyId } = await params;
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }
    await assertAcademyAdmin(academyId, user.id);

    const page = Math.max(1, parseInt(request.nextUrl.searchParams.get('page') || '1', 10));
    const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(request.nextUrl.searchParams.get('limit') || String(DEFAULT_LIMIT), 10)));
    const actionFilter = request.nextUrl.searchParams.get('action') || '';
    const offset = (page - 1) * limit;

    const supabase = createServiceClient() as any;

    let query = supabase
      .from('enrollment_activity_log')
      .select('*', { count: 'exact' })
      .eq('academy_id', academyId)
      .order('created_at', { ascending: false });

    if (actionFilter && Object.keys(ACTION_LABELS).includes(actionFilter)) {
      query = query.eq('action', actionFilter);
    }

    const { data: rows, error, count } = await query.range(offset, offset + limit - 1);

    if (error) {
      console.error('[GET activity-log]', error);
      return NextResponse.json({ error: '활동 로그 조회에 실패했습니다.' }, { status: 500 });
    }

    const list = rows || [];
    const total = typeof count === 'number' ? count : 0;
    const userIds = [...new Set(list.map((r: any) => r.user_id).filter(Boolean))];
    const actorIds = [...new Set(list.map((r: any) => r.actor_user_id).filter(Boolean))];
    const allIds = [...new Set([...userIds, ...actorIds])];

    let profiles: Record<string, { name_kr?: string; name_en?: string; email?: string }> = {};
    if (allIds.length > 0) {
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, name_kr, name_en, email')
        .in('id', allIds);
      if (profilesData) {
        profiles = Object.fromEntries(profilesData.map((p: any) => [p.id, p]));
      }
    }

    const items = list.map((r: any) => ({
      ...r,
      action_label: ACTION_LABELS[r.action] || r.action,
      user_name: r.user_id ? (profiles[r.user_id]?.name_kr || profiles[r.user_id]?.name_en || profiles[r.user_id]?.email || '-') : '-',
      actor_name: r.actor_user_id ? (profiles[r.actor_user_id]?.name_kr || profiles[r.actor_user_id]?.name_en || '-') : null,
    }));

    return NextResponse.json({
      data: items,
      total,
      page,
      limit,
      action_labels: ACTION_LABELS,
    });
  } catch (e: unknown) {
    if (e && typeof e === 'object' && 'message' in e && (e as Error).message === '학원 관리자 권한이 필요합니다.') {
      return NextResponse.json({ error: (e as Error).message }, { status: 403 });
    }
    console.error('activity-log GET error:', e);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

const ALLOWED_CLIENT_ACTIONS: EnrollmentActivityAction[] = ['TICKET_ISSUED', 'ADMIN_ENROLL'];

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ academyId: string }> }
) {
  try {
    const { academyId } = await params;
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }
    await assertAcademyAdmin(academyId, user.id);

    const body = await request.json();
    const { action, user_id, user_ticket_id, booking_id, extension_request_id, payload } = body;

    if (!action || !ALLOWED_CLIENT_ACTIONS.includes(action)) {
      return NextResponse.json({ error: '허용되지 않은 액션입니다.' }, { status: 400 });
    }

    const supabase = createServiceClient() as any;
    await insertEnrollmentActivityLog(
      {
        academy_id: academyId,
        user_id: user_id ?? null,
        user_ticket_id: user_ticket_id ?? null,
        booking_id: booking_id ?? null,
        extension_request_id: extension_request_id ?? null,
        action,
        payload: payload ?? null,
        actor_user_id: user.id,
      },
      supabase
    );

    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    if (e && typeof e === 'object' && 'message' in e && (e as Error).message === '학원 관리자 권한이 필요합니다.') {
      return NextResponse.json({ error: (e as Error).message }, { status: 403 });
    }
    console.error('activity-log POST error:', e);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
