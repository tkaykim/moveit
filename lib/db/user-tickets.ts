import { createClient } from '@/lib/supabase/server';
import { Database } from '@/types/database';

type SupabaseClientAny = any;

export async function getUserTickets(userId: string, client?: SupabaseClientAny) {
  const supabase = client || (await createClient());
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
          name_en,
          max_extension_days
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
 * 사용자의 전체 수강권 조회 (상태 무관: ACTIVE, USED, EXPIRED 포함)
 * TicketsView 등 전체 목록 표시용
 */
export async function getAllUserTickets(userId: string, client?: SupabaseClientAny) {
  const supabase = (client || (await createClient())) as any;
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
          name_en,
          max_extension_days
        )
      )
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
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
  allowCoupon: boolean = false,
  client?: SupabaseClientAny
) {
  const supabase = (client || (await createClient())) as any;
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  // 기간권(remaining_count IS NULL) 또는 횟수권(remaining_count > 0) 모두 조회
  // expiry_date는 쿼리 후 필터: NULL(무기한)이거나 오늘 이상만 포함 (.gte만 쓰면 NULL이 제외됨)
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
    .or('remaining_count.gt.0,remaining_count.is.null')
    .order('created_at', { ascending: false });

  const { data: rawData, error } = await query;

  if (error) throw error;

  if (!rawData) return [];

  // expiry_date: null(무기한)이거나 오늘 이상인 수강권만 포함
  // start_date: null이거나 오늘 이전인 수강권만 포함 (아직 시작 안 된 수강권 제외)
  const data = rawData.filter((row: any) => {
    const exp = row.expiry_date;
    const start = row.start_date;
    const expValid = exp == null || exp >= today;
    const startValid = start == null || start <= today;
    return expValid && startValid;
  });

  // classId가 제공된 경우: ticket_classes 테이블에서 연결된 수강권만 필터링
  if (classId) {
    // ticket_classes에서 해당 classId와 연결된 ticket_id 목록 가져오기
    const { data: ticketClassesData, error: tcError } = await supabase
      .from('ticket_classes')
      .select('ticket_id')
      .eq('class_id', classId);

    if (tcError) {
      console.error('ticket_classes 조회 오류 (classId:', classId, '):', tcError);
    }

    const linkedTicketIds = new Set((ticketClassesData || []).map((tc: any) => tc.ticket_id));

    // classId에 해당하는 학원 ID 조회 (academy 필터용)
    let classAcademyId: string | null = null;
    if (academyId) {
      classAcademyId = academyId;
    } else {
      // 클래스의 학원 ID를 직접 조회
      const { data: classData } = await supabase
        .from('classes')
        .select('academy_id')
        .eq('id', classId)
        .single();
      classAcademyId = classData?.academy_id || null;
    }

    return data.filter((item: any) => {
      const ticket = item.tickets;
      if (!ticket) return false;

      const ticketId = ticket.id;
      const isCoupon = ticket.is_coupon === true;
      const isGeneral = ticket.is_general === true;
      const ticketAcademyId = ticket.academy_id;

      // 다른 학원의 수강권은 제외 (학원 ID 일치 확인)
      if (classAcademyId && ticketAcademyId && ticketAcademyId !== classAcademyId) {
        return false;
      }

      // ticket_classes에 연결된 수강권(팝업 포함)은 해당 수업에서 사용 가능
      if (linkedTicketIds.has(ticketId)) {
        return true;
      }

      // is_general 수강권은 같은 학원이면 모든 클래스에서 사용 가능
      if (isGeneral) {
        return true;
      }

      // 쿠폰(팝업 등)인 경우: allowCoupon이 true일 때만 표시 (클래스에서 허용 시)
      if (isCoupon) {
        return allowCoupon;
      }

      // 그 외는 사용 불가
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
      const isGeneral = ticket.is_general === true;

      // is_general 수강권은 같은 학원이면 허용
      if (isGeneral && ticketAcademyId === academyId) return true;

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
 * @param classId 사용할 클래스 ID (선택사항, 제공 시 ticket_classes 연결 검증)
 * @param count 차감할 횟수 (기본 1)
 */
export async function consumeUserTicket(userTicketId: string, classId?: string, count: number = 1) {
  const supabase = await createClient() as any;

  // 현재 수강권 정보 조회 (ticket_type, is_general 확인을 위해 tickets 조인)
  const { data: currentTicket, error: fetchError } = await supabase
    .from('user_tickets')
    .select(`
      remaining_count, 
      status,
      expiry_date,
      start_date,
      ticket_id,
      tickets (
        id,
        ticket_type,
        is_general,
        is_coupon,
        academy_id
      )
    `)
    .eq('id', userTicketId)
    .single();

  if (fetchError) throw fetchError;
  if (!currentTicket) throw new Error('수강권을 찾을 수 없습니다.');

  // 1. ACTIVE 상태 검증
  if (currentTicket.status !== 'ACTIVE') {
    throw new Error(`수강권이 사용 가능한 상태가 아닙니다. (현재: ${currentTicket.status})`);
  }

  // 2. 유효기간 검증 (모든 수강권 공통)
  const today = new Date().toISOString().split('T')[0];
  if (currentTicket.expiry_date && currentTicket.expiry_date < today) {
    // 만료 상태 자동 업데이트
    await supabase
      .from('user_tickets')
      .update({ status: 'EXPIRED' })
      .eq('id', userTicketId);
    throw new Error('수강권 유효기간이 만료되었습니다.');
  }

  // 3. 시작일 검증 (시작일 이전에는 사용 불가)
  if (currentTicket.start_date && currentTicket.start_date > today) {
    throw new Error(`수강권 사용 시작일(${currentTicket.start_date})이 아직 도래하지 않았습니다.`);
  }

  // 4. 클래스 연결 검증 (classId가 제공된 경우)
  if (classId && currentTicket.tickets) {
    const ticket = currentTicket.tickets;
    const isGeneral = ticket.is_general === true;

    if (!isGeneral) {
      // is_general이 아닌 경우 ticket_classes에 연결되어 있는지 확인
      const { data: ticketClassLink } = await supabase
        .from('ticket_classes')
        .select('id')
        .eq('ticket_id', ticket.id)
        .eq('class_id', classId)
        .single();

      // ticket_classes에 연결도 없고 쿠폰도 아닌 경우 사용 불가
      if (!ticketClassLink && !ticket.is_coupon) {
        throw new Error('이 수강권은 해당 수업에 사용할 수 없습니다.');
      }
    }
  }

  const ticketType = currentTicket.tickets?.ticket_type;
  const isPeriodTicket = ticketType === 'PERIOD';

  // 5. 기간권(PERIOD)인 경우: 횟수 차감 없이 반환
  if (isPeriodTicket || currentTicket.remaining_count === null) {
    return currentTicket;
  }

  // 6. 횟수권(COUNT)인 경우: remaining_count 차감
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
    .eq('status', 'ACTIVE') // 동시성 보호: ACTIVE 상태인 경우에만 업데이트
    .select()
    .single();

  if (error) throw error;
  if (!data) throw new Error('수강권 차감에 실패했습니다. 다시 시도해주세요.');
  return data;
}

/**
 * 사용자 수강권 개수 조회 (전체/학원별 구분)
 * @param userId 사용자 ID
 * @param academyId 학원 ID (선택사항)
 * @returns 전체 수강권 개수 및 학원별 수강권 개수
 */
export async function getUserTicketCounts(userId: string, academyId?: string, client?: SupabaseClientAny) {
  const supabase = (client || (await createClient())) as any;
  const today = new Date().toISOString().split('T')[0];

  // 기간권(remaining_count IS NULL) 또는 횟수권(remaining_count > 0) 모두 조회
  const { data: rawData, error } = await supabase
    .from('user_tickets')
    .select(`
      remaining_count,
      expiry_date,
      tickets (
        ticket_type,
        is_general,
        academy_id
      )
    `)
    .eq('user_id', userId)
    .eq('status', 'ACTIVE')
    .or('remaining_count.gt.0,remaining_count.is.null');

  if (error) throw error;

  // expiry_date: null(무기한)이거나 오늘 이상인 수강권만 포함
  const data = (rawData || []).filter((row: any) => {
    const exp = row.expiry_date;
    return exp == null || exp >= today;
  });

  let totalCount = 0;
  let academySpecificCount = 0;

  data.forEach((item: any) => {
    // 기간권(PERIOD): 1개로 카운트, 횟수권(COUNT): remaining_count 합산
    const count = item.remaining_count == null ? 1 : (item.remaining_count || 0);
    const ticket = item.tickets;
    const ticketAcademyId = ticket?.academy_id;
    const isGeneral = ticket?.is_general;

    totalCount += count;

    if (academyId) {
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
