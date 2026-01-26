import { createClient } from '@/lib/supabase/server';
import { Database } from '@/types/database';

export async function getUserTickets(userId: string) {
  const supabase = await createClient() as any;
  const { data, error } = await supabase
    .from('user_tickets')
    .select(`
      *,
      tickets (
        id,
        name,
        ticket_type,
        total_count,
        valid_days,
        is_general,
        is_coupon,
        access_group,
        ticket_category,
        academy_id,
        academies (
          id,
          name_kr,
          name_en
        )
      )
    `)
    .eq('user_id', userId)
    .eq('status', 'ACTIVE')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

/**
 * 사용 가능한 수강권 조회 (만료일 확인, remaining_count > 0)
 * @param userId 사용자 ID
 * @param academyId 학원 ID (선택사항)
 * @param classId 클래스 ID (선택사항, 제공 시 해당 클래스에 사용 가능한 수강권만 반환)
 * @param allowCoupon 쿠폰 허용 여부 (선택사항, 기본값 false)
 * @returns 사용 가능한 수강권 목록
 */
export async function getAvailableUserTickets(
  userId: string,
  academyId?: string,
  classId?: string,
  allowCoupon: boolean = false
) {
  const supabase = await createClient() as any;
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  // 기간권(remaining_count IS NULL) 또는 횟수권(remaining_count > 0) 모두 조회
  let query = supabase
    .from('user_tickets')
    .select(`
      *,
      tickets (
        id,
        name,
        ticket_type,
        total_count,
        valid_days,
        is_general,
        is_coupon,
        access_group,
        ticket_category,
        academy_id,
        class_id,
        academies (
          id,
          name_kr,
          name_en
        )
      )
    `)
    .eq('user_id', userId)
    .eq('status', 'ACTIVE')
    .gte('expiry_date', today)
    .or('remaining_count.gt.0,remaining_count.is.null')
    .order('created_at', { ascending: false });

  const { data, error } = await query;

  if (error) throw error;

  if (!data) return [];

  // classId가 제공된 경우: ticket_classes 테이블에서 연결된 수강권만 필터링
  if (classId) {
    // ticket_classes에서 해당 classId와 연결된 ticket_id 목록 가져오기
    const { data: ticketClassesData } = await supabase
      .from('ticket_classes')
      .select('ticket_id')
      .eq('class_id', classId);

    const linkedTicketIds = new Set((ticketClassesData || []).map((tc: any) => tc.ticket_id));

    return data.filter((item: any) => {
      const ticket = item.tickets;
      if (!ticket) return false;

      const ticketId = ticket.id;
      const isCoupon = ticket.is_coupon === true;
      const isGeneral = ticket.is_general === true;

      // 쿠폰인 경우: allowCoupon이 true일 때만 표시
      if (isCoupon) {
        return allowCoupon;
      }

      // ticket_classes에 연결된 수강권은 사용 가능
      if (linkedTicketIds.has(ticketId)) {
        return true;
      }

      // is_general 수강권은 모든 클래스에서 사용 가능
      if (isGeneral) {
        return true;
      }

      // 그 외의 경우는 ticket_classes에 연결되지 않은 수강권이므로 사용 불가
      return false;
    });
  }

  // academyId만 제공된 경우: 해당 학원의 수강권 필터링
  if (academyId) {
    return data.filter((item: any) => {
      const ticket = item.tickets;
      if (!ticket) return false;

      const ticketAcademyId = ticket.academy_id;
      const isCoupon = ticket.is_coupon === true;

      // 쿠폰 제외 (classId 없이는 쿠폰 사용 불가)
      if (isCoupon) return false;

      // 해당 학원 수강권만
      return ticketAcademyId === academyId;
    });
  }

  return data || [];
}

/**
 * 수강권 사용 (remaining_count 차감)
 * 기간권(PERIOD)은 차감하지 않고, 횟수권(COUNT)만 차감
 * @param userTicketId user_tickets.id
 * @param count 차감할 횟수 (기본 1)
 */
export async function consumeUserTicket(userTicketId: string, count: number = 1) {
  const supabase = await createClient() as any;

  // 현재 수강권 정보 조회 (ticket_type 확인을 위해 tickets 조인)
  const { data: currentTicket, error: fetchError } = await supabase
    .from('user_tickets')
    .select(`
      remaining_count, 
      status,
      expiry_date,
      tickets (
        ticket_type
      )
    `)
    .eq('id', userTicketId)
    .single();

  if (fetchError) throw fetchError;
  if (!currentTicket) throw new Error('수강권을 찾을 수 없습니다.');

  const ticketType = currentTicket.tickets?.ticket_type;
  const isPeriodTicket = ticketType === 'PERIOD';

  // 기간권(PERIOD)인 경우: 횟수 차감 없이 유효기간만 확인
  if (isPeriodTicket || currentTicket.remaining_count === null) {
    // 유효기간 체크
    const today = new Date().toISOString().split('T')[0];
    if (currentTicket.expiry_date && currentTicket.expiry_date < today) {
      throw new Error('수강권 유효기간이 만료되었습니다.');
    }
    // 기간권은 차감 없이 그대로 반환
    return currentTicket;
  }

  // 횟수권(COUNT)인 경우: remaining_count 차감
  const newRemainingCount = (currentTicket.remaining_count || 0) - count;

  if (newRemainingCount < 0) {
    throw new Error('수강권 잔여 횟수가 부족합니다.');
  }

  // remaining_count 차감 및 상태 업데이트
  const updates: Database['public']['Tables']['user_tickets']['Update'] = {
    remaining_count: newRemainingCount,
  };

  // remaining_count가 0이 되면 USED 상태로 변경
  if (newRemainingCount === 0) {
    updates.status = 'USED';
  }

  const { data, error } = await supabase
    .from('user_tickets')
    .update(updates)
    .eq('id', userTicketId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * 사용자 수강권 개수 조회 (전체/학원별 구분)
 * @param userId 사용자 ID
 * @param academyId 학원 ID (선택사항)
 * @returns 전체 수강권 개수 및 학원별 수강권 개수
 */
export async function getUserTicketCounts(userId: string, academyId?: string) {
  const supabase = await createClient() as any;
  const today = new Date().toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('user_tickets')
    .select(`
      remaining_count,
      expiry_date,
      tickets (
        is_general,
        academy_id
      )
    `)
    .eq('user_id', userId)
    .eq('status', 'ACTIVE')
    .gt('remaining_count', 0)
    .gte('expiry_date', today);

  if (error) throw error;

  let totalCount = 0;
  let academySpecificCount = 0;

  (data || []).forEach((item: any) => {
    const count = item.remaining_count || 0;
    const ticket = item.tickets;
    const ticketAcademyId = ticket?.academy_id;
    const isGeneral = ticket?.is_general;

    totalCount += count;

    if (academyId) {
      // academyId가 제공된 경우: 전체 수강권(is_general=true 또는 academy_id IS NULL) 또는 해당 학원 수강권
      if (isGeneral || ticketAcademyId === null || ticketAcademyId === academyId) {
        academySpecificCount += count;
      }
    }
  });

  return {
    total: totalCount,
    academySpecific: academyId ? academySpecificCount : totalCount,
  };
}

export async function getUserTicketById(id: string) {
  const supabase = await createClient() as any;
  const { data, error } = await supabase
    .from('user_tickets')
    .select(`
      *,
      tickets (
        id,
        name,
        ticket_type,
        total_count,
        valid_days,
        is_general,
        is_coupon,
        access_group,
        ticket_category,
        academy_id,
        academies (
          id,
          name_kr,
          name_en
        )
      )
    `)
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
}

export async function createUserTicket(userTicket: Database['public']['Tables']['user_tickets']['Insert']) {
  const supabase = await createClient() as any;
  const { data, error } = await supabase
    .from('user_tickets')
    .insert(userTicket)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateUserTicket(id: string, updates: Database['public']['Tables']['user_tickets']['Update']) {
  const supabase = await createClient() as any;
  const { data, error } = await supabase
    .from('user_tickets')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}
