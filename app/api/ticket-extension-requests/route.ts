import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

/**
 * POST: 사용자 연장/일시정지 신청
 * GET: ?academyId=xxx → 해당 학원 신청 목록(관리자), 없으면 현재 사용자 신청 목록
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient() as any;
    // 쿠키 기반 세션을 먼저 확인(클라이언트와 동기화). 없으면 서버 검증 시도
    const { data: { session } } = await supabase.auth.getSession();
    let authUser = session?.user ?? null;
    if (!authUser) {
      const { data: { user } } = await supabase.auth.getUser();
      authUser = user;
    }
    if (!authUser) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const body = await request.json();
    const { user_ticket_id, request_type, absent_start_date, absent_end_date } = body;
    if (!user_ticket_id || !request_type || !absent_start_date || !absent_end_date) {
      return NextResponse.json(
        { error: 'user_ticket_id, request_type, absent_start_date, absent_end_date 가 필요합니다.' },
        { status: 400 }
      );
    }
    if (!['EXTENSION', 'PAUSE'].includes(request_type)) {
      return NextResponse.json({ error: 'request_type는 EXTENSION 또는 PAUSE 여야 합니다.' }, { status: 400 });
    }

    const start = new Date(absent_start_date);
    const end = new Date(absent_end_date);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) {
      return NextResponse.json({ error: '유효한 absent 기간(시작일~종료일)을 입력해주세요.' }, { status: 400 });
    }

    const { data: userTicket, error: utError } = await supabase
      .from('user_tickets')
      .select('id, user_id, ticket_id, expiry_date, tickets(academy_id)')
      .eq('id', user_ticket_id)
      .single();
    if (utError || !userTicket) {
      return NextResponse.json({ error: '수강권을 찾을 수 없습니다.' }, { status: 404 });
    }
    if (userTicket.user_id !== authUser.id) {
      return NextResponse.json({ error: '본인 수강권에만 신청할 수 있습니다.' }, { status: 403 });
    }

    const academyId = userTicket.tickets?.academy_id;
    if (request_type === 'EXTENSION' && academyId) {
      const { data: academy } = await supabase
        .from('academies')
        .select('max_extension_days')
        .eq('id', academyId)
        .single();
      const maxDays = academy?.max_extension_days;
      if (maxDays != null && typeof maxDays === 'number') {
        const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        if (days > maxDays) {
          return NextResponse.json(
            { error: `연장 신청은 최대 ${maxDays}일까지 가능합니다.` },
            { status: 400 }
          );
        }
      }
    }

    const { data: inserted, error: insertError } = await supabase
      .from('ticket_extension_requests')
      .insert({
        user_ticket_id,
        request_type,
        absent_start_date: absent_start_date,
        absent_end_date: absent_end_date,
        status: 'PENDING',
      })
      .select()
      .single();
    if (insertError) {
      console.error(insertError);
      return NextResponse.json({ error: '신청 저장에 실패했습니다.' }, { status: 500 });
    }
    return NextResponse.json({ data: inserted });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e.message || '서버 오류' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const supabase = await createClient() as any;
    const { data: { session } } = await supabase.auth.getSession();
    let authUser = session?.user ?? null;
    if (!authUser) {
      const { data: { user } } = await supabase.auth.getUser();
      authUser = user;
    }
    if (!authUser) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const academyId = searchParams.get('academyId');

    if (academyId) {
      const { data: list, error } = await supabase
        .from('ticket_extension_requests')
        .select(`
          *,
          user_tickets (
            id,
            user_id,
            expiry_date,
            start_date,
            remaining_count,
            tickets (
              id,
              name,
              academy_id,
              ticket_type
            )
          )
        `)
        .order('created_at', { ascending: false });
      if (error) throw error;
      const rows = (list || []).filter(
        (r: any) => r.user_tickets?.tickets?.academy_id === academyId
      );
      return NextResponse.json({ data: rows });
    }

    const { data: myTickets } = await supabase
      .from('user_tickets')
      .select('id')
      .eq('user_id', authUser.id);
    const ids = (myTickets || []).map((t: any) => t.id);
    if (ids.length === 0) {
      return NextResponse.json({ data: [] });
    }
    const { data: list, error } = await supabase
      .from('ticket_extension_requests')
      .select(`
        *,
        user_tickets (
          id,
          expiry_date,
          start_date,
          tickets ( id, name, ticket_type )
        )
      `)
      .in('user_ticket_id', ids)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return NextResponse.json({ data: list || [] });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e.message || '서버 오류' }, { status: 500 });
  }
}
