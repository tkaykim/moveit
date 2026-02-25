/**
 * GET /api/academy-admin/[academyId]/bank-transfer-orders?status=PENDING|CONFIRMED
 * 계좌이체 주문 목록 (수동 입금확인 페이지용)
 */
import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/supabase/server-auth';
import { createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
  Pragma: 'no-cache',
} as const;

async function assertAcademyAdmin(academyId: string, userId: string) {
  const supabase = createServiceClient();
  const { data: userData } = await (supabase as any)
    .from('users')
    .select('role')
    .eq('id', userId)
    .single();
  const isSuperAdmin = userData?.role === 'SUPER_ADMIN';
  if (isSuperAdmin) return;
  const { data: roleData, error: roleError } = await (supabase as any)
    .from('academy_user_roles')
    .select('role')
    .eq('academy_id', academyId)
    .eq('user_id', userId)
    .single();
  if (roleError || !roleData || !['ACADEMY_OWNER', 'ACADEMY_MANAGER'].includes(roleData.role)) {
    throw new Error('학원 관리자 권한이 필요합니다.');
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ academyId: string }> }
) {
  try {
    const { academyId } = await params;
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401, headers: NO_CACHE_HEADERS });
    }
    await assertAcademyAdmin(academyId, user.id);

    const status = request.nextUrl.searchParams.get('status') || undefined;

    const supabase = createServiceClient() as any;

    // 1) 주문만 조회 (orderer_* 포함 — 목록 표시용)
    let query = supabase
      .from('bank_transfer_orders')
      .select('id, user_id, ticket_id, schedule_id, amount, order_name, orderer_name, orderer_phone, orderer_email, status, created_at, confirmed_at')
      .eq('academy_id', academyId)
      .order('created_at', { ascending: false });

    if (status && ['PENDING', 'CONFIRMED', 'CANCELLED'].includes(status)) {
      query = query.eq('status', status);
    }

    const { data: orders, error: ordersError } = await query;

    if (ordersError) {
      console.error('[GET bank-transfer-orders]', ordersError);
      return NextResponse.json({ error: '목록 조회에 실패했습니다.' }, { status: 500, headers: NO_CACHE_HEADERS });
    }

    const list = orders || [];
    if (list.length === 0) {
      return NextResponse.json({ data: [] }, { headers: NO_CACHE_HEADERS });
    }

    const userIds = [...new Set(list.map((o: any) => o.user_id).filter(Boolean))];
    const ticketIds = [...new Set(list.map((o: any) => o.ticket_id).filter(Boolean))];
    const scheduleIds = [...new Set(list.map((o: any) => o.schedule_id).filter(Boolean))];

    // 2) 로그인 회원일 때만 users에서 이름/연락처 보조 (orderer_* 없을 때 사용)
    type UserRow = { id: string; name?: string | null; name_en?: string | null; phone?: string | null; email?: string | null };
    let userMap = new Map<string, UserRow>();
    if (userIds.length > 0) {
      const { data: users } = await supabase
        .from('users')
        .select('id, name, name_en, phone, email')
        .in('id', userIds);
      userMap = new Map((users || []).map((u: UserRow) => [u.id, u]));
    }

    // 3) 수강권명
    const { data: tickets } = ticketIds.length
      ? await supabase.from('tickets').select('id, name').in('id', ticketIds)
      : { data: [] };
    const ticketMap = new Map((tickets || []).map((t: any) => [t.id, t]));

    // 4) 스케줄 + 클래스명 (schedule_id 있는 경우)
    let scheduleMap = new Map<string, { start_time: string; end_time: string; class_title: string }>();
    if (scheduleIds.length > 0) {
      const { data: scheduleRows } = await supabase
        .from('schedules')
        .select('id, start_time, end_time, class_id')
        .in('id', scheduleIds);
      const classIds = [...new Set((scheduleRows || []).map((s: any) => s.class_id).filter(Boolean))];
      const { data: classRows } = classIds.length
        ? await supabase.from('classes').select('id, title').in('id', classIds)
        : { data: [] };
      const classMap = new Map((classRows || []).map((c: any) => [c.id, c.title]));
      scheduleMap = new Map(
        (scheduleRows || []).map((s: any) => [
          s.id,
          {
            start_time: s.start_time,
            end_time: s.end_time,
            class_title: classMap.get(s.class_id) ?? '',
          },
        ])
      );
    }

    const result = list.map((o: any) => {
      const schedule = o.schedule_id ? scheduleMap.get(o.schedule_id) : null;
      const u = o.user_id ? userMap.get(o.user_id) : null;
      const displayName = o.orderer_name?.trim() || (u ? (u.name || u.name_en || null) : null);
      const displayPhone = o.orderer_phone?.trim() || (u?.phone ?? null);
      const displayEmail = o.orderer_email?.trim() || (u?.email ?? null);
      return {
        ...o,
        user_name: displayName,
        user_phone: displayPhone,
        user_email: displayEmail,
        tickets: o.ticket_id ? ticketMap.get(o.ticket_id) ?? null : null,
        schedules: schedule && o.schedule_id
          ? {
              id: o.schedule_id,
              start_time: schedule.start_time,
              end_time: schedule.end_time,
              classes: { id: null, title: schedule.class_title },
            }
          : null,
      };
    });

    return NextResponse.json({ data: result }, { headers: NO_CACHE_HEADERS });
  } catch (e: any) {
    if (e.message === '학원 관리자 권한이 필요합니다.') {
      return NextResponse.json({ error: e.message }, { status: 403, headers: NO_CACHE_HEADERS });
    }
    console.error('[GET bank-transfer-orders]', e);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500, headers: NO_CACHE_HEADERS });
  }
}
