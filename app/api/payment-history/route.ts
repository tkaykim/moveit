import { NextResponse } from 'next/server';
import { getAuthenticatedUser, getAuthenticatedSupabase } from '@/lib/supabase/server-auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/payment-history
 * 사용자 결제/수강권 구매 내역 조회 (쿠키 또는 Authorization: Bearer 토큰)
 */
export async function GET(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);

    if (!user) {
      return NextResponse.json(
        { error: '로그인이 필요합니다.', data: [] },
        { status: 401 }
      );
    }

    const userId = user.id;
    const supabase = await getAuthenticatedSupabase(request);

    // revenue_transactions: 수강권 구매 결제 (환불 건 포함)
    const { data: transactions, error: txError } = await (supabase as any)
      .from('revenue_transactions')
      .select(`
        id,
        ticket_name,
        ticket_type_snapshot,
        quantity,
        valid_days,
        final_price,
        payment_method,
        payment_status,
        transaction_date,
        created_at,
        academy_id,
        user_ticket_id,
        academies (name_kr, name_en),
        user_tickets (
          id,
          remaining_count,
          status,
          start_date,
          expiry_date
        )
      `)
      .eq('user_id', userId)
      .in('payment_status', ['COMPLETED', 'REFUNDED', 'PARTIALLY_REFUNDED'])
      .order('transaction_date', { ascending: false })
      .limit(100);

    if (txError) {
      console.error('revenue_transactions error:', txError);
      return NextResponse.json(
        { error: '결제 내역 조회에 실패했습니다.', data: [] },
        { status: 500 }
      );
    }

    // bookings: 수강권 사용(예약) - payment_status로 결제 유형 구분
    const { data: bookings, error: bookError } = await (supabase as any)
      .from('bookings')
      .select(`
        id,
        status,
        payment_status,
        created_at,
        classes (
          title,
          academies (name_kr, name_en)
        ),
        schedules (
          start_time,
          classes (
            title,
            academies (name_kr, name_en)
          )
        )
      `)
      .eq('user_id', userId)
      .in('status', ['CONFIRMED', 'COMPLETED'])
      .order('created_at', { ascending: false })
      .limit(100);

    if (bookError) {
      console.error('bookings error:', bookError);
    }

    // 통합 목록 구성: 결제(수강권 구매) + 수강권 사용(예약)
    const payments: Array<{
      id: string;
      type: 'PURCHASE' | 'BOOKING';
      date: string;
      title: string;
      academy_name: string;
      amount: number;
      status: string;
      payment_method?: string;
      ticket_type?: string;
      quantity?: number;
      valid_days?: number;
      remaining_count?: number | null;
      ticket_status?: string;
      expiry_date?: string;
    }> = [];

    (transactions || []).forEach((t: any) => {
      const academy = t.academies;
      const ut = t.user_tickets;
      const typeStr = (t.ticket_type_snapshot || '').toUpperCase();
      payments.push({
        id: t.id,
        type: 'PURCHASE',
        date: t.transaction_date || t.created_at,
        title: t.ticket_name || '수강권',
        academy_name: academy?.name_kr || academy?.name_en || '-',
        amount: t.final_price || 0,
        status: t.payment_status || 'COMPLETED',
        payment_method: t.payment_method,
        ticket_type: typeStr === 'COUNT' ? 'COUNT' : 'PERIOD',
        quantity: t.quantity || 1,
        valid_days: t.valid_days,
        remaining_count: ut?.remaining_count ?? null,
        ticket_status: ut?.status ?? null,
        expiry_date: ut?.expiry_date ?? null,
      });
    });

    (bookings || []).forEach((b: any) => {
      const classes = b.schedules?.classes || b.classes;
      const academy = classes?.academies;
      payments.push({
        id: `booking-${b.id}`,
        type: 'BOOKING',
        date: b.schedules?.start_time || b.created_at,
        title: classes?.title || '클래스',
        academy_name: academy?.name_kr || academy?.name_en || '-',
        amount: 0, // 수강권 사용
        status: b.status === 'COMPLETED' ? 'COMPLETED' : b.payment_status || 'PAID',
      });
    });

    // 날짜 내림차순 정렬
    payments.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return NextResponse.json({
      data: payments.slice(0, 100),
    });
  } catch (error: any) {
    console.error('Error in GET /api/payment-history:', error);
    return NextResponse.json(
      { error: '결제 내역 조회에 실패했습니다.', data: [] },
      { status: 500 }
    );
  }
}
