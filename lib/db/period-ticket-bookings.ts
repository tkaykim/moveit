import { createClient, createServiceClient } from '@/lib/supabase/server';
import {
  placeFixedWeeklyBookings,
  type FixedWeeklyPlacementResult,
} from '@/lib/booking/fixed-weekly';

/**
 * 기간권에 연결된 클래스의 스케줄 조회
 * @param ticketId 수강권 ID
 * @param startDate 시작일 (YYYY-MM-DD)
 * @param endDate 종료일 (YYYY-MM-DD)
 * @returns 해당 기간 내의 스케줄 목록
 */
export async function getSchedulesForPeriodTicket(
  ticketId: string,
  startDate: string,
  endDate: string
) {
  const supabase = await createClient() as any;

  // 1. ticket_classes에서 연결된 class_id들 조회
  const { data: ticketClasses, error: tcError } = await supabase
    .from('ticket_classes')
    .select('class_id')
    .eq('ticket_id', ticketId);

  if (tcError) throw tcError;

  // 연결된 클래스가 없으면 빈 배열 반환
  if (!ticketClasses || ticketClasses.length === 0) {
    // is_general 수강권인지 확인
    const { data: ticket } = await supabase
      .from('tickets')
      .select('is_general, academy_id')
      .eq('id', ticketId)
      .single();

    if (ticket?.is_general && ticket?.academy_id) {
      // is_general이면 해당 학원의 모든 Regular 클래스 스케줄 조회
      const { data: schedules, error } = await supabase
        .from('schedules')
        .select(`
          id,
          class_id,
          start_time,
          end_time,
          max_students,
          current_students,
          is_canceled,
          classes!inner (
            id,
            academy_id,
            class_type
          )
        `)
        .eq('classes.academy_id', ticket.academy_id)
        .eq('classes.class_type', 'regular')
        .eq('is_canceled', false)
        .gte('start_time', `${startDate}T00:00:00+09:00`)
        .lte('start_time', `${endDate}T23:59:59+09:00`)
        .order('start_time', { ascending: true });

      if (error) throw error;
      return schedules || [];
    }

    return [];
  }

  const classIds = ticketClasses.map((tc: any) => tc.class_id);

  // 2. 해당 클래스들의 기간 내 스케줄 조회
  const { data: schedules, error: schError } = await supabase
    .from('schedules')
    .select(`
      id,
      class_id,
      start_time,
      end_time,
      max_students,
      current_students,
      is_canceled
    `)
    .in('class_id', classIds)
    .eq('is_canceled', false)
    .gte('start_time', `${startDate}T00:00:00+09:00`)
    .lte('start_time', `${endDate}T23:59:59+09:00`)
    .order('start_time', { ascending: true });

  if (schError) throw schError;
  return schedules || [];
}

/**
 * 고정 주1회 수강권 자동 예약 (구 createBookingsForPeriodTicket)
 *
 * ⚠ 이 함수는 예전에 is_general PERIOD 수강권에 대해 **학원의 모든 regular 수업**을
 *   자동 예약했다. ALL PASS(무제한권)가 도입되면 구매자 한 명이 30일치 전 수업에
 *   자동 등록된다. 그래서 이제 자동 예약 대상은
 *     tickets.is_fixed_weekly = true  AND  user_tickets.fixed_class_id IS NOT NULL
 *   인 경우로만 좁혔다.
 *
 * 판정은 여기서 하지 않는다 — place_fixed_weekly_bookings() 가 물리적 정본이다.
 * 조건을 앱에도 두면 언젠가 두 곳이 갈라진다. ALL PASS / 일반 PERIOD 가 들어오면
 * eligible=false 로 돌아오고 예약은 **한 건도** 생성되지 않는다.
 *
 * 배치는 예약 오픈시각을 면제받되 정원은 준수한다. 자리를 못 잡으면 스킵하고
 * 횟수는 학생에게 남으며, 스킵 내역은 운영자 큐에 남는다.
 */
export async function createFixedWeeklyBookings(
  userTicketId: string
): Promise<FixedWeeklyPlacementResult> {
  // RPC 는 service_role 전용이다 (학생 세션으로는 실행 불가).
  const supabase = createServiceClient() as any;
  return placeFixedWeeklyBookings(supabase, userTicketId);
}
