/**
 * GET /api/academy-admin/[academyId]/push/scenario-data
 * 학원 관리자용 시나리오 테스트 데이터 (해당 학원 범위로 한정)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/supabase/server-auth';
import { createServiceClient } from '@/lib/supabase/server';

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

    const supabase = createServiceClient();

    // 학원 관리자 권한 확인 (SUPER_ADMIN도 허용)
    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    const isSuperAdmin = userData?.role === 'SUPER_ADMIN';

    if (!isSuperAdmin) {
      const { data: roleData, error: roleError } = await supabase
        .from('academy_user_roles')
        .select('role')
        .eq('academy_id', academyId)
        .eq('user_id', user.id)
        .single();

      if (roleError || !roleData || !['ACADEMY_OWNER', 'ACADEMY_MANAGER'].includes(roleData.role)) {
        return NextResponse.json({ error: '학원 관리자 권한이 필요합니다.' }, { status: 403 });
      }
    }

    const url = new URL(request.url);
    const userId = url.searchParams.get('user_id');

    // 1. 학원 정보
    const { data: academy } = await supabase
      .from('academies')
      .select('id, name_kr, name_en')
      .eq('id', academyId)
      .single();

    // 2. 해당 학원의 수강생 목록 (활성 수강권 보유자)
    const { data: studentTickets } = await supabase
      .from('user_tickets')
      .select('user_id, tickets!inner(academy_id)')
      .eq('tickets.academy_id', academyId)
      .in('status', ['ACTIVE', 'EXPIRING_SOON']);

    const studentIds = [...new Set((studentTickets || []).map((s: any) => s.user_id))];

    let studentList: any[] = [];
    if (studentIds.length > 0) {
      const { data: students } = await supabase
        .from('users')
        .select('id, name, email, phone, role')
        .in('id', studentIds)
        .order('name');

      // 토큰 보유 여부 확인
      const { data: tokenUsers } = await supabase
        .from('device_tokens')
        .select('user_id')
        .in('user_id', studentIds)
        .eq('is_active', true);

      const tokenUserIds = new Set((tokenUsers || []).map((t: any) => t.user_id));

      studentList = (students || []).map((u: any) => ({
        ...u,
        has_token: tokenUserIds.has(u.id),
      }));
    }

    // 3. 해당 학원의 수업 목록
    const { data: classes } = await supabase
      .from('classes')
      .select('id, title')
      .eq('academy_id', academyId)
      .eq('is_active', true)
      .order('title');

    const classList = (classes || []).map((c: any) => ({
      id: c.id,
      title: c.title,
      academy_id: academyId,
      academy_name: academy?.name_kr || '',
    }));

    // 4. 해당 학원의 향후 스케줄
    const now = new Date().toISOString();
    const { data: schedules } = await supabase
      .from('schedules')
      .select('id, start_time, end_time, class_id, classes!inner(title, academy_id)')
      .eq('classes.academy_id', academyId)
      .gte('start_time', now)
      .eq('is_canceled', false)
      .order('start_time')
      .limit(50);

    const scheduleList = (schedules || []).map((s: any) => ({
      id: s.id,
      start_time: s.start_time,
      end_time: s.end_time,
      class_id: s.class_id,
      class_title: s.classes?.title,
      academy_name: academy?.name_kr || '',
      academy_id: academyId,
    }));

    // 5. 특정 유저 선택 시: 해당 학원 범위의 예약/수강권만
    let userBookings: any[] = [];
    let userTickets: any[] = [];

    if (userId) {
      // 해당 학원의 수업에 대한 예약만
      const { data: bookings } = await supabase
        .from('bookings')
        .select(`
          id, status, created_at,
          classes!inner(id, title, academy_id),
          schedules(id, start_time, end_time)
        `)
        .eq('user_id', userId)
        .eq('classes.academy_id', academyId)
        .in('status', ['CONFIRMED', 'COMPLETED'])
        .order('created_at', { ascending: false })
        .limit(20);

      userBookings = (bookings || []).map((b: any) => ({
        id: b.id,
        status: b.status,
        class_title: b.classes?.title,
        academy_name: academy?.name_kr || '',
        academy_id: academyId,
        schedule_id: b.schedules?.id,
        start_time: b.schedules?.start_time,
        end_time: b.schedules?.end_time,
      }));

      // 해당 학원의 수강권만
      const { data: tickets } = await supabase
        .from('user_tickets')
        .select(`
          id, status, remaining_count, expiry_date, created_at,
          tickets!inner(id, name, ticket_type, academy_id)
        `)
        .eq('user_id', userId)
        .eq('tickets.academy_id', academyId)
        .in('status', ['ACTIVE', 'EXPIRING_SOON'])
        .order('expiry_date');

      userTickets = (tickets || []).map((t: any) => ({
        id: t.id,
        status: t.status,
        remaining_count: t.remaining_count,
        expiry_date: t.expiry_date,
        ticket_name: t.tickets?.name,
        ticket_type: t.tickets?.ticket_type,
        academy_name: academy?.name_kr || '',
        academy_id: academyId,
      }));
    }

    return NextResponse.json({
      academy,
      users: studentList,
      classes: classList,
      schedules: scheduleList,
      user_bookings: userBookings,
      user_tickets: userTickets,
    });
  } catch (error: any) {
    console.error('Academy push scenario-data error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
