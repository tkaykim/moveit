import { createClient } from '@/lib/supabase/server';
import { Database } from '@/types/database';

export async function getUserTickets(userId: string) {
  const supabase = await createClient() as any;
  const { data, error } = await supabase
    .from('user_tickets')
    .select(`
      *,
      tickets (
        name,
        is_general,
        academy_id,
        academies (
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
 * @param academyId 학원 ID (선택사항, 제공 시 해당 학원 전용 수강권 + 전체 수강권 반환)
 * @returns 사용 가능한 수강권 목록
 */
export async function getAvailableUserTickets(userId: string, academyId?: string) {
  const supabase = await createClient() as any;
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  let query = supabase
    .from('user_tickets')
    .select(`
      *,
      tickets (
        name,
        is_general,
        academy_id,
        academies (
          name_kr,
          name_en
        )
      )
    `)
    .eq('user_id', userId)
    .eq('status', 'ACTIVE')
    .gt('remaining_count', 0)
    .gte('expiry_date', today)
    .order('created_at', { ascending: false });

  const { data, error } = await query;

  if (error) throw error;

  // academyId가 제공된 경우: 해당 학원 전용 수강권 + 전체 수강권(is_general=true 또는 academy_id IS NULL) 필터링
  if (academyId && data) {
    return data.filter((item: any) => {
      const ticket = item.tickets;
      const ticketAcademyId = ticket?.academy_id;
      const isGeneral = ticket?.is_general;
      // 전체 수강권(is_general=true 또는 academy_id가 null) 또는 해당 학원 수강권
      return isGeneral || ticketAcademyId === null || ticketAcademyId === academyId;
    });
  }

  return data || [];
}

/**
 * 수강권 사용 (remaining_count 차감)
 * @param userTicketId user_tickets.id
 * @param count 차감할 횟수 (기본 1)
 */
export async function consumeUserTicket(userTicketId: string, count: number = 1) {
  const supabase = await createClient() as any;

  // 현재 수강권 정보 조회
  const { data: currentTicket, error: fetchError } = await supabase
    .from('user_tickets')
    .select('remaining_count, status')
    .eq('id', userTicketId)
    .single();

  if (fetchError) throw fetchError;
  if (!currentTicket) throw new Error('수강권을 찾을 수 없습니다.');

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
        name,
        is_general,
        academy_id,
        academies (
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
