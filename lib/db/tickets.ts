import { createClient } from '@/lib/supabase/server';
import { Database } from '@/types/database';

/**
 * 판매 중인 티켓 목록 조회
 * @param academyId 학원 ID (선택사항, 제공 시 해당 학원 수강권만 조회)
 */
export async function getTicketsOnSale(academyId?: string) {
  const supabase = await createClient() as any;
  let query = supabase
    .from('tickets')
    .select(`
      *,
      academies (*)
    `)
    .eq('is_on_sale', true)
    .order('created_at', { ascending: false });

  if (academyId) {
    // 특정 학원의 수강권만 조회
    query = query.eq('academy_id', academyId);
  } else {
    // 전체 수강권만 조회 (is_general=true)
    query = query.eq('is_general', true);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

/**
 * 티켓 상세 조회
 */
export async function getTicketById(id: string) {
  const supabase = await createClient() as any;
  const { data, error } = await supabase
    .from('tickets')
    .select(`
      *,
      academies (*)
    `)
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
}

