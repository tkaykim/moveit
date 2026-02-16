import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { consumeUserTicket, getAvailableUserTickets, updateUserTicket } from '@/lib/db/user-tickets';
import { Database } from '@/types/database';
import { getAuthenticatedUser, getAuthenticatedSupabase } from '@/lib/supabase/server-auth';
import { sendNotification } from '@/lib/notifications';

export const dynamic = 'force-dynamic';

/**
 * GET /api/bookings
 * 사용자의 예약 목록 조회 (쿠키 또는 Authorization: Bearer 토큰)
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

    const supabase = await getAuthenticatedSupabase(request);

    // 예약 목록 조회 (schedules, classes, academies, halls 포함)
    const { data: bookings, error } = await (supabase as any)
      .from('bookings')
      .select(`
        id,
        status,
        created_at,
        class_id,
        schedule_id,
        schedules (
          id,
          start_time,
          end_time,
          class_id,
          hall_id,
          halls (id, name),
          classes (
            id,
            title,
            academy_id,
            instructor_id,
            academies (
              id,
              name_kr,
              name_en,
              logo_url,
              address
            ),
            instructors (id, name_kr, name_en),
            halls (id, name)
          )
        ),
        classes (
          id,
          title,
          start_time,
          end_time,
          academy_id,
          instructor_id,
          academies (
            id,
            name_kr,
            name_en,
            logo_url,
            address
          ),
          instructors (id, name_kr, name_en),
          halls (id, name)
        ),
        halls (id, name)
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching bookings:', error);
      return NextResponse.json(
        { error: '예약 목록 조회에 실패했습니다.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      data: bookings || [],
    });
  } catch (error: any) {
    console.error('Error in GET /api/bookings:', error);
    return NextResponse.json(
      { error: '예약 목록 조회에 실패했습니다.' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/bookings
 * 예약 생성 및 수강권 차감
 * Body: {
 *   classId: string,
 *   scheduleId?: string, // 스케줄 ID (세션 단위 예약 시 필요)
 *   userTicketId?: string, // 사용할 수강권 ID (선택사항, 제공 안 하면 자동 선택)
 * }
 */
export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);

    if (!user) {
      return NextResponse.json(
        { error: '로그인이 필요합니다.' },
        { status: 401 }
      );
    }

    const supabase = await getAuthenticatedSupabase(request);
    const { classId, scheduleId, userTicketId, paymentMethod, paymentStatus } = await request.json();

    if (!classId && !scheduleId) {
      return NextResponse.json(
        { error: 'classId 또는 scheduleId가 필요합니다.' },
        { status: 400 }
      );
    }

    // 즉시 결제인 경우 수강권 없이 예약 생성
    // 카드결제 데모도 포함 (CARD_DEMO는 수강권 구매 후 예약이지만 데모 결제로 처리)
    const isImmediatePayment = paymentMethod === 'card' || paymentMethod === 'account' || paymentMethod === 'CARD_DEMO';
    const isCardDemoPayment = paymentMethod === 'CARD_DEMO' || paymentMethod === 'card';

    let academyId: string;
    let resolvedClassId = classId;

    // scheduleId가 있으면 스케줄에서 classId 가져오기 + 정원/상태 검증
    if (scheduleId) {
      const { data: scheduleData, error: scheduleError } = await (supabase as any)
        .from('schedules')
        .select(`
          id,
          class_id,
          start_time,
          max_students,
          current_students,
          is_canceled,
          classes (
            academy_id
          )
        `)
        .eq('id', scheduleId)
        .single();

      if (scheduleError || !scheduleData) {
        return NextResponse.json(
          { error: '스케줄 정보를 찾을 수 없습니다.' },
          { status: 404 }
        );
      }

      // 취소된 수업 검증
      if (scheduleData.is_canceled) {
        return NextResponse.json(
          { error: '취소된 수업에는 예약할 수 없습니다.' },
          { status: 400 }
        );
      }

      // 이미 종료된 수업 검증
      if (new Date(scheduleData.start_time) < new Date()) {
        return NextResponse.json(
          { error: '이미 종료된 수업에는 예약할 수 없습니다.' },
          { status: 400 }
        );
      }

      // 정원 초과 검증
      const maxStudents = scheduleData.max_students || 20;
      const currentStudents = scheduleData.current_students || 0;
      if (currentStudents >= maxStudents) {
        return NextResponse.json(
          { error: '정원이 마감되었습니다.' },
          { status: 400 }
        );
      }

      // 동일 사용자 중복 예약 방지
      const { data: existingBooking } = await (supabase as any)
        .from('bookings')
        .select('id')
        .eq('schedule_id', scheduleId)
        .eq('user_id', user.id)
        .in('status', ['CONFIRMED', 'PENDING', 'COMPLETED'])
        .single();

      if (existingBooking) {
        return NextResponse.json(
          { error: '이미 예약된 수업입니다.' },
          { status: 400 }
        );
      }

      resolvedClassId = scheduleData.class_id;
      academyId = scheduleData.classes?.academy_id;
    } else {
      // 클래스 정보 조회 (학원 ID 확인용)
      const { data: classData, error: classError } = await (supabase as any)
        .from('classes')
        .select('academy_id')
        .eq('id', classId)
        .single();

      if (classError || !classData) {
        return NextResponse.json(
          { error: '클래스 정보를 찾을 수 없습니다.' },
          { status: 404 }
        );
      }

      academyId = classData.academy_id;
    }

    // 수강권 사용인 경우에만 수강권 처리 (카드결제 데모는 수강권을 사용하지만 결제 상태는 별도 처리)
    let selectedUserTicketId = userTicketId;
    if (!isImmediatePayment || isCardDemoPayment) {
      // 수강권 자동 선택 (userTicketId가 제공되지 않은 경우)
      if (!selectedUserTicketId) {
        // 클래스 ID를 포함하여 해당 클래스에 사용 가능한 수강권만 조회
        const availableTickets = await getAvailableUserTickets(user.id, academyId, resolvedClassId);
        
        if (availableTickets.length === 0) {
          return NextResponse.json(
            { error: '이 수업에 사용 가능한 수강권이 없습니다.' },
            { status: 400 }
          );
        }

        // ticket_classes 테이블에서 해당 클래스와 연결된 수강권 확인
        const supabase = await createClient() as any;
        const { data: ticketClassesData } = await supabase
          .from('ticket_classes')
          .select('ticket_id')
          .eq('class_id', resolvedClassId);
        
        const linkedTicketIds = new Set((ticketClassesData || []).map((tc: any) => tc.ticket_id));
        
        // 클래스 전용 수강권 우선 (ticket_classes에 연결된 수강권), 없으면 전체 수강권 선택
        const classSpecificTicket = availableTickets.find((t: any) => {
          const ticket = t.tickets;
          if (!ticket) return false;
          // ticket_classes에 연결된 수강권이거나 is_general인 경우
          return linkedTicketIds.has(ticket.id) || ticket.is_general;
        });
        
        if (classSpecificTicket) {
          selectedUserTicketId = classSpecificTicket.id;
        } else {
          // 학원 전용 수강권 우선
          const academySpecificTicket = availableTickets.find(
            (t: any) => t.tickets && !t.tickets.is_general && t.tickets.academy_id === academyId
          );
          
          if (academySpecificTicket) {
            selectedUserTicketId = academySpecificTicket.id;
          } else {
            // 전체 수강권 선택 (is_general이 true이거나 academy_id가 null)
            const generalTicket = availableTickets.find(
              (t: any) => t.tickets && (t.tickets.is_general || t.tickets.academy_id === null)
            );
            
            if (generalTicket) {
              selectedUserTicketId = generalTicket.id;
            } else {
              selectedUserTicketId = availableTickets[0].id;
            }
          }
        }
      }

      // 수강권 차감 (카드결제 데모인 경우에도 수강권 차감)
      if (selectedUserTicketId) {
        try {
          await consumeUserTicket(selectedUserTicketId, resolvedClassId, 1);
        } catch (ticketError: any) {
          console.error('Ticket usage error:', ticketError);
          return NextResponse.json(
            { error: ticketError.message || '수강권 차감에 실패했습니다.' },
            { status: 400 }
          );
        }
      }
    }

    // 예약 생성
    // 카드결제 데모인 경우: 수강권을 사용하지만 결제 상태는 COMPLETED로 설정
    const finalPaymentStatus = isCardDemoPayment 
      ? (paymentStatus || 'COMPLETED')  // 카드결제 데모는 즉시 완료
      : isImmediatePayment 
        ? (paymentStatus || 'PENDING') 
        : 'PAID'; // 수강권 사용은 PAID
    
    const bookingData: Database['public']['Tables']['bookings']['Insert'] = {
      user_id: user.id,
      class_id: resolvedClassId,
      schedule_id: scheduleId || null,
      user_ticket_id: isImmediatePayment && !isCardDemoPayment ? null : selectedUserTicketId,
      status: 'CONFIRMED',
      payment_status: finalPaymentStatus,
    };

    const { data: booking, error: bookingError } = await (supabase as any)
      .from('bookings')
      .insert(bookingData)
      .select()
      .single();

    if (bookingError) {
      console.error('Booking creation error:', bookingError);
      // 예약 생성 실패 시 수강권 차감 롤백 (횟수권만, 기간권은 차감하지 않았으므로 롤백 불필요)
      if (!isImmediatePayment && selectedUserTicketId) {
        try {
          const ticketBeforeUse = await (supabase as any)
            .from('user_tickets')
            .select('remaining_count, status')
            .eq('id', selectedUserTicketId)
            .single();

          if (ticketBeforeUse.data && ticketBeforeUse.data.remaining_count != null) {
            // 기간권(remaining_count=null)은 consumeUserTicket에서 차감하지 않았으므로 롤백 제외
            const newRemainingCount = ticketBeforeUse.data.remaining_count + 1;
            const newStatus = newRemainingCount > 0 ? 'ACTIVE' : ticketBeforeUse.data.status;

            await updateUserTicket(selectedUserTicketId, {
              remaining_count: newRemainingCount,
              status: newStatus,
            });
          }
        } catch (rollbackError) {
          console.error('Rollback failed:', rollbackError);
        }
      }

      return NextResponse.json(
        { error: '예약 생성에 실패했습니다.' },
        { status: 500 }
      );
    }

    // 스케줄이 있으면 current_students 재계산 (정확한 수치 보장)
    if (scheduleId) {
      const { data: confirmedBookings } = await (supabase as any)
        .from('bookings')
        .select('id')
        .eq('schedule_id', scheduleId)
        .in('status', ['CONFIRMED', 'COMPLETED']);

      const actualCount = confirmedBookings?.length || 0;
      await (supabase as any)
        .from('schedules')
        .update({ current_students: actualCount })
        .eq('id', scheduleId);
    }

    // 푸시 알림 발송 (비동기, 실패해도 예약은 성공)
    if (user?.id && booking?.id) {
      // 예약 정보 다시 조회 (학원명, 수업명, 시간 포함)
      (supabase as any)
        .from('bookings')
        .select(`
          id,
          classes!inner(title, academy_id, academies!inner(name_kr)),
          schedules(start_time, end_time)
        `)
        .eq('id', booking.id)
        .single()
        .then(({ data: bookingDetail }: any) => {
          if (!bookingDetail) return;
          
          const academyName = bookingDetail.classes?.academies?.name_kr || '학원';
          const classTitle = bookingDetail.classes?.title || '수업';
          const startTime = bookingDetail.schedules?.start_time;
          
          let timeStr = '';
          if (startTime) {
            const d = new Date(startTime);
            timeStr = ` ${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
          }
          
          return sendNotification({
            user_id: user.id,
            type: 'booking_confirmed',
            title: '예약 완료',
            body: `${academyName} ${classTitle} 수업이 예약되었습니다.${timeStr}`,
            data: { booking_id: booking.id, url: '/my/bookings', academy_name: academyName },
            academy_id: bookingDetail.classes?.academy_id,
          });
        })
        .catch((err: any) => console.error('[booking-notification]', err));
    }

    return NextResponse.json({
      data: booking,
      message: '예약이 완료되었습니다.',
    });
  } catch (error: any) {
    console.error('Error in POST /api/bookings:', error);
    return NextResponse.json(
      { error: '예약 생성에 실패했습니다.' },
      { status: 500 }
    );
  }
}
