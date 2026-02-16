/**
 * GET /api/admin/push/scenario-data
 * 시나리오 테스트에 필요한 실제 데이터 조회
 * - 유저 목록 (이름, 이메일)
 * - 학원 목록 (이름)
 * - 수업/스케줄 (학원별)
 * - 유저별 수강권 (만료일 등)
 * - 유저별 예약 (수업/스케줄 정보)
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/supabase/admin-auth';
import { createServiceClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireSuperAdmin(request);
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const supabase = createServiceClient();
    const url = new URL(request.url);
    const userId = url.searchParams.get('user_id');

    // 1. 유저 목록 (토큰 보유 여부 포함)
    const { data: users, error: usersError } = await (supabase as any)
      .from('users')
      .select('id, name, email, phone, role')
      .order('name');
    
    if (usersError) {
      console.error('Users query error:', usersError);
    }

    const { data: tokenUsers } = await (supabase as any)
      .from('device_tokens')
      .select('user_id')
      .eq('is_active', true);

    const tokenUserIds = new Set((tokenUsers || []).map((t: any) => t.user_id));

    const userList = (users || []).map((u: any) => ({
      ...u,
      has_token: tokenUserIds.has(u.id),
    }));

    // 2. 학원 목록
    const { data: academies } = await (supabase as any)
      .from('academies')
      .select('id, name_kr, name_en')
      .order('name_kr');

    // 3. 특정 유저를 선택한 경우 해당 유저의 예약/수강권 데이터 조회
    let userBookings: any[] = [];
    let userTickets: any[] = [];

    if (userId) {
      // 유저의 활성 예약 (수업/스케줄 정보 포함)
      const { data: bookings } = await (supabase as any)
        .from('bookings')
        .select(`
          id, status, created_at,
          classes!inner(id, title, academy_id, academies!inner(name_kr)),
          schedules(id, start_time, end_time)
        `)
        .eq('user_id', userId)
        .in('status', ['CONFIRMED', 'COMPLETED'])
        .order('created_at', { ascending: false })
        .limit(20);

      userBookings = (bookings || []).map((b: any) => ({
        id: b.id,
        status: b.status,
        class_title: b.classes?.title,
        academy_name: b.classes?.academies?.name_kr,
        academy_id: b.classes?.academy_id,
        schedule_id: b.schedules?.id,
        start_time: b.schedules?.start_time,
        end_time: b.schedules?.end_time,
      }));

      // 유저의 수강권 (만료일 포함)
      const { data: tickets } = await (supabase as any)
        .from('user_tickets')
        .select(`
          id, status, remaining_count, expiry_date, created_at,
          tickets!inner(id, name, ticket_type, academy_id, academies!inner(name_kr))
        `)
        .eq('user_id', userId)
        .in('status', ['ACTIVE', 'EXPIRING_SOON'])
        .order('expiry_date');

      userTickets = (tickets || []).map((t: any) => ({
        id: t.id,
        status: t.status,
        remaining_count: t.remaining_count,
        expiry_date: t.expiry_date,
        ticket_name: t.tickets?.name,
        ticket_type: t.tickets?.ticket_type,
        academy_name: t.tickets?.academies?.name_kr,
        academy_id: t.tickets?.academy_id,
      }));
    }

    // 4. 수업 목록 (학원별)
    const { data: classes } = await (supabase as any)
      .from('classes')
      .select('id, title, academy_id, academies!inner(name_kr)')
      .eq('is_active', true)
      .order('title')
      .limit(100);

    const classList = (classes || []).map((c: any) => ({
      id: c.id,
      title: c.title,
      academy_id: c.academy_id,
      academy_name: c.academies?.name_kr,
    }));

    // 5. 향후 스케줄 (오늘 이후)
    const now = new Date().toISOString();
    const { data: schedules } = await (supabase as any)
      .from('schedules')
      .select('id, start_time, end_time, class_id, classes!inner(title, academy_id, academies!inner(name_kr))')
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
      academy_name: s.classes?.academies?.name_kr,
      academy_id: s.classes?.academy_id,
    }));

    return NextResponse.json({
      users: userList,
      academies: academies || [],
      classes: classList,
      schedules: scheduleList,
      user_bookings: userBookings,
      user_tickets: userTickets,
    });
  } catch (error: any) {
    console.error('Admin push scenario-data error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
