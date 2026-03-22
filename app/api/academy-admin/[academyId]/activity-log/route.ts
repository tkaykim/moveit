/**
 * GET /api/academy-admin/[academyId]/activity-log
 * 활동 로그 목록 (검색, 필터, 페이지네이션 지원)
 *
 * POST /api/academy-admin/[academyId]/activity-log
 * 클라이언트에서 활동 로그 기록 요청
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
  ATTENDANCE_CHECKED: '출석 체크',
  TICKET_EXHAUSTED: '수강권 소진',
  TICKET_EXPIRED: '수강권 만료',
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
    const search = (request.nextUrl.searchParams.get('search') || '').trim();
    const offset = (page - 1) * limit;

    const supabase = createServiceClient() as any;

    let matchedUserIds: string[] | null = null;

    if (search) {
      const { data: matchedUsers } = await supabase
        .from('users')
        .select('id')
        .or(`name.ilike.%${search}%,nickname.ilike.%${search}%,phone.ilike.%${search}%,email.ilike.%${search}%`);
      matchedUserIds = (matchedUsers || []).map((u: any) => u.id);
    }

    let query = supabase
      .from('enrollment_activity_log')
      .select('*', { count: 'exact' })
      .eq('academy_id', academyId)
      .order('created_at', { ascending: false });

    if (actionFilter && Object.keys(ACTION_LABELS).includes(actionFilter)) {
      query = query.eq('action', actionFilter);
    }

    if (search) {
      const orFilters = [`note.ilike.%${search}%`];
      if (matchedUserIds && matchedUserIds.length > 0) {
        orFilters.push(`user_id.in.(${matchedUserIds.join(',')})`);
      }
      query = query.or(orFilters.join(','));
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

    let userMap: Record<string, { name?: string; nickname?: string; email?: string }> = {};
    if (allIds.length > 0) {
      const { data: usersData } = await supabase
        .from('users')
        .select('id, name, nickname, email')
        .in('id', allIds);
      if (usersData) {
        userMap = Object.fromEntries(usersData.map((u: any) => [u.id, u]));
      }
    }

    const items = list.map((r: any) => {
      let userName = '-';
      if (r.user_id) {
        const u = userMap[r.user_id];
        userName = u?.name || u?.nickname || u?.email || '-';
      } else if (r.payload?.guest_name) {
        userName = `${r.payload.guest_name} (비회원)`;
      }
      return {
        ...r,
        action_label: ACTION_LABELS[r.action] || r.action,
        user_name: userName,
        actor_name: r.actor_user_id
          ? (userMap[r.actor_user_id]?.name || userMap[r.actor_user_id]?.nickname || '-')
          : null,
      };
    });

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
    const { action, user_id, user_ticket_id, booking_id, extension_request_id, payload, note } = body;

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
        note: note ?? null,
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
