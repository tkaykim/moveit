import { createClient } from '@/lib/supabase/server';
import { Database } from '@/types/database';

type BookingInsert = Database['public']['Tables']['bookings']['Insert'];

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
        .gte('start_time', `${startDate}T00:00:00`)
        .lte('start_time', `${endDate}T23:59:59`)
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
    .gte('start_time', `${startDate}T00:00:00`)
    .lte('start_time', `${endDate}T23:59:59`)
    .order('start_time', { ascending: true });

  if (schError) throw schError;
  return schedules || [];
}

/**
 * 기간권 구매 시 일괄 예약 생성
 * @param userId 사용자 ID
 * @param userTicketId user_tickets.id
 * @param ticketId tickets.id
 * @param startDate 시작일 (YYYY-MM-DD)
 * @param endDate 종료일 (YYYY-MM-DD)
 * @returns 생성된 예약 수와 스킵된 예약 수
 */
export async function createBookingsForPeriodTicket(
  userId: string,
  userTicketId: string,
  ticketId: string,
  startDate: string,
  endDate: string
): Promise<{ created: number; skipped: number; scheduleIds: string[] }> {
  const supabase = await createClient() as any;

  // 1. 해당 기간 내 스케줄 조회
  const schedules = await getSchedulesForPeriodTicket(ticketId, startDate, endDate);

  if (schedules.length === 0) {
    return { created: 0, skipped: 0, scheduleIds: [] };
  }

  const scheduleIds = schedules.map((s: any) => s.id);

  // 2. 이미 존재하는 예약 확인 (중복 방지)
  const { data: existingBookings, error: existError } = await supabase
    .from('bookings')
    .select('schedule_id')
    .eq('user_id', userId)
    .in('schedule_id', scheduleIds);

  if (existError) throw existError;

  const existingScheduleIds = new Set(
    (existingBookings || []).map((b: any) => b.schedule_id)
  );

  // 3. 새로 예약할 스케줄 필터링
  const schedulesToBook = schedules.filter(
    (s: any) => !existingScheduleIds.has(s.id)
  );

  if (schedulesToBook.length === 0) {
    return { 
      created: 0, 
      skipped: schedules.length, 
      scheduleIds: [] 
    };
  }

  // 4. 예약 데이터 생성
  const bookingsToInsert: BookingInsert[] = schedulesToBook.map((schedule: any) => ({
    user_id: userId,
    class_id: schedule.class_id,
    schedule_id: schedule.id,
    user_ticket_id: userTicketId,
    status: 'CONFIRMED',
    payment_status: 'PAID', // 기간권은 이미 결제 완료
  }));

  // 5. 일괄 삽입
  const { data: insertedBookings, error: insertError } = await supabase
    .from('bookings')
    .insert(bookingsToInsert)
    .select('id, schedule_id');

  if (insertError) throw insertError;

  // 6. 각 스케줄의 current_students 증가
  for (const schedule of schedulesToBook) {
    await supabase
      .from('schedules')
      .update({ 
        current_students: (schedule.current_students || 0) + 1 
      })
      .eq('id', schedule.id);
  }

  return {
    created: insertedBookings?.length || 0,
    skipped: existingScheduleIds.size,
    scheduleIds: (insertedBookings || []).map((b: any) => b.schedule_id),
  };
}

/**
 * 새 스케줄에 대해 기존 기간권 보유자 예약 생성
 * 스케줄 생성 후 호출하여 해당 클래스의 기간권 보유자들에게 자동 예약 생성
 * @param scheduleId 새로 생성된 스케줄 ID
 * @param classId 클래스 ID
 * @param scheduleStartTime 스케줄 시작 시간
 * @returns 생성된 예약 수
 */
export async function createBookingsForNewSchedule(
  scheduleId: string,
  classId: string,
  scheduleStartTime: Date
): Promise<{ created: number }> {
  const supabase = await createClient() as any;

  const scheduleDate = scheduleStartTime.toISOString().split('T')[0]; // YYYY-MM-DD

  // 1. 해당 클래스와 연결된 ticket_id들 조회
  const { data: ticketClasses, error: tcError } = await supabase
    .from('ticket_classes')
    .select('ticket_id')
    .eq('class_id', classId);

  if (tcError) throw tcError;

  // 2. 클래스의 학원 정보 조회 (is_general 수강권 처리용)
  const { data: classData } = await supabase
    .from('classes')
    .select('academy_id, class_type')
    .eq('id', classId)
    .single();

  const academyId = classData?.academy_id;
  const classType = classData?.class_type || 'regular';

  // Regular 클래스가 아니면 기간권 자동 예약 대상 아님
  if (classType !== 'regular') {
    return { created: 0 };
  }

  let ticketIds = (ticketClasses || []).map((tc: any) => tc.ticket_id);

  // 3. is_general 수강권도 포함 (해당 학원의)
  if (academyId) {
    const { data: generalTickets } = await supabase
      .from('tickets')
      .select('id')
      .eq('academy_id', academyId)
      .eq('is_general', true)
      .eq('ticket_type', 'PERIOD');

    if (generalTickets && generalTickets.length > 0) {
      const generalTicketIds = generalTickets.map((t: any) => t.id);
      ticketIds = [...new Set([...ticketIds, ...generalTicketIds])];
    }
  }

  if (ticketIds.length === 0) {
    return { created: 0 };
  }

  // 4. 해당 ticket_id들의 활성 user_tickets 조회 (기간 내인 것만)
  const { data: userTickets, error: utError } = await supabase
    .from('user_tickets')
    .select(`
      id,
      user_id,
      ticket_id,
      start_date,
      expiry_date,
      tickets!inner (
        ticket_type
      )
    `)
    .in('ticket_id', ticketIds)
    .eq('status', 'ACTIVE')
    .eq('tickets.ticket_type', 'PERIOD')
    .lte('start_date', scheduleDate)
    .gte('expiry_date', scheduleDate);

  if (utError) throw utError;

  if (!userTickets || userTickets.length === 0) {
    return { created: 0 };
  }

  // 5. 각 user_ticket에 대해 예약 생성 (중복 체크)
  const userIds = userTickets.map((ut: any) => ut.user_id);

  // 이미 이 스케줄에 예약한 사용자 확인
  const { data: existingBookings } = await supabase
    .from('bookings')
    .select('user_id')
    .eq('schedule_id', scheduleId)
    .in('user_id', userIds);

  const existingUserIds = new Set(
    (existingBookings || []).map((b: any) => b.user_id)
  );

  // 새로 예약할 user_tickets
  const ticketsToBook = userTickets.filter(
    (ut: any) => !existingUserIds.has(ut.user_id)
  );

  if (ticketsToBook.length === 0) {
    return { created: 0 };
  }

  // 6. 예약 데이터 생성
  const bookingsToInsert: BookingInsert[] = ticketsToBook.map((ut: any) => ({
    user_id: ut.user_id,
    class_id: classId,
    schedule_id: scheduleId,
    user_ticket_id: ut.id,
    status: 'CONFIRMED',
    payment_status: 'PAID',
  }));

  // 7. 일괄 삽입
  const { data: insertedBookings, error: insertError } = await supabase
    .from('bookings')
    .insert(bookingsToInsert)
    .select('id');

  if (insertError) throw insertError;

  // 8. 스케줄의 current_students 증가
  const { data: currentSchedule } = await supabase
    .from('schedules')
    .select('current_students')
    .eq('id', scheduleId)
    .single();

  if (currentSchedule) {
    await supabase
      .from('schedules')
      .update({ 
        current_students: (currentSchedule.current_students || 0) + (insertedBookings?.length || 0)
      })
      .eq('id', scheduleId);
  }

  return { created: insertedBookings?.length || 0 };
}

/**
 * 여러 스케줄에 대해 기존 기간권 보유자 예약 일괄 생성
 * @param schedules 스케줄 정보 배열
 * @returns 총 생성된 예약 수
 */
export async function createBookingsForNewSchedules(
  schedules: Array<{ id: string; class_id: string; start_time: string }>
): Promise<{ totalCreated: number }> {
  let totalCreated = 0;

  for (const schedule of schedules) {
    try {
      const result = await createBookingsForNewSchedule(
        schedule.id,
        schedule.class_id,
        new Date(schedule.start_time)
      );
      totalCreated += result.created;
    } catch (error) {
      console.error(`Error creating bookings for schedule ${schedule.id}:`, error);
    }
  }

  return { totalCreated };
}
