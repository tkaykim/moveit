/**
 * GET /api/academy-admin/[academyId]/bank-transfer-orders?status=PENDING|CONFIRMED
 * 계좌이체 주문 목록 (수동 입금확인 페이지용)
 */
import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/supabase/server-auth';
import { createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

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
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }
    await assertAcademyAdmin(academyId, user.id);

    const status = request.nextUrl.searchParams.get('status') || undefined;

    const supabase = createServiceClient() as any;
    let query = supabase
      .from('bank_transfer_orders')
      .select(`
        id,
        user_id,
        ticket_id,
        schedule_id,
        amount,
        order_name,
        status,
        created_at,
        confirmed_at,
        tickets ( id, name ),
        schedules ( id, start_time, end_time, classes ( id, title ) )
      `)
      .eq('academy_id', academyId)
      .order('created_at', { ascending: false });

    if (status && ['PENDING', 'CONFIRMED', 'CANCELLED'].includes(status)) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[GET bank-transfer-orders]', error);
      return NextResponse.json({ error: '목록 조회에 실패했습니다.' }, { status: 500 });
    }

    // user_id로 프로필 이름/연락처 조회 (profiles 또는 users)
    const userIds = [...new Set((data || []).map((o: any) => o.user_id))];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, name, phone')
      .in('id', userIds.length ? userIds : ['']);

    type ProfileRow = { id: string; name?: string | null; phone?: string | null };
    const profileMap = new Map<string, ProfileRow>(
      (profiles || []).map((p: ProfileRow) => [p.id, p])
    );

    const list = (data || []).map((o: any) => ({
      ...o,
      user_name: profileMap.get(o.user_id)?.name ?? null,
      user_phone: profileMap.get(o.user_id)?.phone ?? null,
    }));

    return NextResponse.json({ data: list });
  } catch (e: any) {
    if (e.message === '학원 관리자 권한이 필요합니다.') {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    console.error('[GET bank-transfer-orders]', e);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
