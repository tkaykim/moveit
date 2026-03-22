/**
 * POST /api/academy-admin/[academyId]/activity-log-backfill
 * 기존 bookings, user_tickets, revenue_transactions 데이터를 참조하여
 * 누락된 활동 로그를 백필 생성합니다. (한 번만 실행)
 */
import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/supabase/server-auth';
import { createServiceClient } from '@/lib/supabase/server';
import { assertAcademyAdmin } from '@/lib/supabase/academy-admin-auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

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

    const supabase = createServiceClient() as any;
    const stats = {
      attendance_checked: 0,
      ticket_exhausted: 0,
      ticket_issued: 0,
      enroll: 0,
      cancel: 0,
      skipped: 0,
    };

    // 1) 출석 체크 백필: COMPLETED 상태의 bookings 중 ATTENDANCE_CHECKED 로그가 없는 건
    const { data: completedBookings } = await supabase
      .from('bookings')
      .select('id, user_id, user_ticket_id, class_id, schedule_id, updated_at, created_at, classes!inner(academy_id)')
      .eq('status', 'COMPLETED')
      .eq('classes.academy_id', academyId);

    if (completedBookings?.length) {
      const bookingIds = completedBookings.map((b: any) => b.id);
      const { data: existingLogs } = await supabase
        .from('enrollment_activity_log')
        .select('booking_id')
        .eq('academy_id', academyId)
        .eq('action', 'ATTENDANCE_CHECKED')
        .in('booking_id', bookingIds);

      const existingBookingIds = new Set((existingLogs || []).map((l: any) => l.booking_id));

      const toInsert = completedBookings
        .filter((b: any) => !existingBookingIds.has(b.id))
        .map((b: any) => ({
          academy_id: academyId,
          user_id: b.user_id,
          user_ticket_id: b.user_ticket_id ?? null,
          booking_id: b.id,
          action: 'ATTENDANCE_CHECKED',
          payload: { via: 'backfill' },
          actor_user_id: null,
          created_at: b.updated_at || b.created_at,
        }));

      if (toInsert.length > 0) {
        const batchSize = 100;
        for (let i = 0; i < toInsert.length; i += batchSize) {
          const batch = toInsert.slice(i, i + batchSize);
          const { error } = await supabase.from('enrollment_activity_log').insert(batch);
          if (error) {
            console.error('[backfill] ATTENDANCE_CHECKED insert error:', error);
          } else {
            stats.attendance_checked += batch.length;
          }
        }
      }
    }

    // 2) 수강권 소진 백필: USED 상태의 user_tickets 중 TICKET_EXHAUSTED 로그가 없는 건
    const { data: usedTickets } = await supabase
      .from('user_tickets')
      .select('id, user_id, ticket_id, updated_at, created_at, tickets!inner(academy_id)')
      .eq('status', 'USED')
      .eq('tickets.academy_id', academyId);

    if (usedTickets?.length) {
      const ticketIds = usedTickets.map((t: any) => t.id);
      const { data: existingLogs } = await supabase
        .from('enrollment_activity_log')
        .select('user_ticket_id')
        .eq('academy_id', academyId)
        .eq('action', 'TICKET_EXHAUSTED')
        .in('user_ticket_id', ticketIds);

      const existingTicketIds = new Set((existingLogs || []).map((l: any) => l.user_ticket_id));

      const toInsert = usedTickets
        .filter((t: any) => !existingTicketIds.has(t.id))
        .map((t: any) => ({
          academy_id: academyId,
          user_id: t.user_id,
          user_ticket_id: t.id,
          action: 'TICKET_EXHAUSTED',
          payload: { via: 'backfill' },
          actor_user_id: null,
          created_at: t.updated_at || t.created_at,
        }));

      if (toInsert.length > 0) {
        const batchSize = 100;
        for (let i = 0; i < toInsert.length; i += batchSize) {
          const batch = toInsert.slice(i, i + batchSize);
          const { error } = await supabase.from('enrollment_activity_log').insert(batch);
          if (error) {
            console.error('[backfill] TICKET_EXHAUSTED insert error:', error);
          } else {
            stats.ticket_exhausted += batch.length;
          }
        }
      }
    }

    // 3) 수강권 발급 백필: revenue_transactions 중 TICKET_ISSUED 로그가 없는 건
    const { data: revTransactions } = await supabase
      .from('revenue_transactions')
      .select('id, user_id, user_ticket_id, ticket_id, payment_method, ticket_name, created_at')
      .eq('academy_id', academyId)
      .eq('payment_status', 'COMPLETED');

    if (revTransactions?.length) {
      const revUserTicketIds = revTransactions
        .map((r: any) => r.user_ticket_id)
        .filter(Boolean);

      if (revUserTicketIds.length > 0) {
        const { data: existingLogs } = await supabase
          .from('enrollment_activity_log')
          .select('user_ticket_id')
          .eq('academy_id', academyId)
          .eq('action', 'TICKET_ISSUED')
          .in('user_ticket_id', revUserTicketIds);

        const existingTicketIds = new Set((existingLogs || []).map((l: any) => l.user_ticket_id));

        const toInsert = revTransactions
          .filter((r: any) => r.user_ticket_id && !existingTicketIds.has(r.user_ticket_id))
          .map((r: any) => ({
            academy_id: academyId,
            user_id: r.user_id,
            user_ticket_id: r.user_ticket_id,
            action: 'TICKET_ISSUED',
            payload: {
              via: 'backfill',
              payment_method: r.payment_method,
              ticket_name: r.ticket_name,
            },
            actor_user_id: null,
            created_at: r.created_at,
          }));

        if (toInsert.length > 0) {
          const batchSize = 100;
          for (let i = 0; i < toInsert.length; i += batchSize) {
            const batch = toInsert.slice(i, i + batchSize);
            const { error } = await supabase.from('enrollment_activity_log').insert(batch);
            if (error) {
              console.error('[backfill] TICKET_ISSUED insert error:', error);
            } else {
              stats.ticket_issued += batch.length;
            }
          }
        }
      }
    }

    // 4) 수강신청 백필: bookings 중 ENROLL 로그가 없는 건 (CANCELLED 제외)
    const { data: allBookings } = await supabase
      .from('bookings')
      .select('id, user_id, user_ticket_id, class_id, schedule_id, created_at, status, classes!inner(academy_id)')
      .eq('classes.academy_id', academyId)
      .in('status', ['CONFIRMED', 'COMPLETED', 'PENDING']);

    if (allBookings?.length) {
      const allBookingIds = allBookings.map((b: any) => b.id);
      const { data: existingLogs } = await supabase
        .from('enrollment_activity_log')
        .select('booking_id')
        .eq('academy_id', academyId)
        .eq('action', 'ENROLL')
        .in('booking_id', allBookingIds);

      const existingBookingIds = new Set((existingLogs || []).map((l: any) => l.booking_id));

      const toInsert = allBookings
        .filter((b: any) => !existingBookingIds.has(b.id))
        .map((b: any) => ({
          academy_id: academyId,
          user_id: b.user_id,
          user_ticket_id: b.user_ticket_id ?? null,
          booking_id: b.id,
          action: 'ENROLL',
          payload: {
            via: 'backfill',
            class_id: b.class_id,
            schedule_id: b.schedule_id,
          },
          actor_user_id: null,
          created_at: b.created_at,
        }));

      if (toInsert.length > 0) {
        const batchSize = 100;
        for (let i = 0; i < toInsert.length; i += batchSize) {
          const batch = toInsert.slice(i, i + batchSize);
          const { error } = await supabase.from('enrollment_activity_log').insert(batch);
          if (error) {
            console.error('[backfill] ENROLL insert error:', error);
          } else {
            stats.enroll += batch.length;
          }
        }
      }
    }

    // 5) 예약 취소 백필: CANCELLED 상태의 bookings 중 CANCEL 로그가 없는 건
    const { data: cancelledBookings } = await supabase
      .from('bookings')
      .select('id, user_id, user_ticket_id, class_id, schedule_id, updated_at, created_at, classes!inner(academy_id)')
      .eq('status', 'CANCELLED')
      .eq('classes.academy_id', academyId);

    if (cancelledBookings?.length) {
      const cancelledIds = cancelledBookings.map((b: any) => b.id);
      const { data: existingLogs } = await supabase
        .from('enrollment_activity_log')
        .select('booking_id')
        .eq('academy_id', academyId)
        .eq('action', 'CANCEL')
        .in('booking_id', cancelledIds);

      const existingBookingIds = new Set((existingLogs || []).map((l: any) => l.booking_id));

      const toInsert = cancelledBookings
        .filter((b: any) => !existingBookingIds.has(b.id))
        .map((b: any) => ({
          academy_id: academyId,
          user_id: b.user_id,
          user_ticket_id: b.user_ticket_id ?? null,
          booking_id: b.id,
          action: 'CANCEL',
          payload: { via: 'backfill' },
          actor_user_id: null,
          created_at: b.updated_at || b.created_at,
        }));

      if (toInsert.length > 0) {
        const batchSize = 100;
        for (let i = 0; i < toInsert.length; i += batchSize) {
          const batch = toInsert.slice(i, i + batchSize);
          const { error } = await supabase.from('enrollment_activity_log').insert(batch);
          if (error) {
            console.error('[backfill] CANCEL insert error:', error);
          } else {
            stats.cancel += batch.length;
          }
        }
      }
    }

    const total = stats.attendance_checked + stats.ticket_exhausted + stats.ticket_issued + stats.enroll + stats.cancel;
    return NextResponse.json({
      success: true,
      message: `백필 완료: ${total}건의 로그가 생성되었습니다.`,
      stats,
    });
  } catch (e: unknown) {
    if (e && typeof e === 'object' && 'message' in e && (e as Error).message === '학원 관리자 권한이 필요합니다.') {
      return NextResponse.json({ error: (e as Error).message }, { status: 403 });
    }
    console.error('activity-log-backfill error:', e);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
