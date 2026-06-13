import { createClient } from '@/lib/supabase/server';

export interface DashboardStats {
  totalRevenue: number;
  activeStudents: number;
  todaySchedules: number;
  pendingConsultations: number;
}

export async function getDashboardStats(academyId: string) {
  const supabase = await createClient() as any;
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const today = now.toISOString().split('T')[0];
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  // 이번 달 총 매출 (순매출 = 결제액 − 환불액. 부분환불도 번 돈은 집계)
  const { data: revenueData } = await supabase
    .from('revenue_transactions')
    .select('final_price, refunded_amount')
    .eq('academy_id', academyId)
    .in('payment_status', ['COMPLETED', 'PARTIALLY_REFUNDED'])
    .gte('transaction_date', startOfMonth);

  const totalRevenue = revenueData?.reduce(
    (sum: number, t: any) => sum + ((t.final_price || 0) - (t.refunded_amount || 0)),
    0
  ) || 0;

  // 활성 수강생 (수강권이 있는 학생)
  const { data: tickets } = await supabase
    .from('tickets')
    .select('id')
    .eq('academy_id', academyId);

  const ticketIds = tickets?.map((t: any) => t.id) || [];
  
  const { count: activeStudents } = await supabase
    .from('user_tickets')
    .select('user_id', { count: 'exact', head: true })
    .in('ticket_id', ticketIds)
    .eq('status', 'ACTIVE')
    .gt('remaining_count', 0);

  // 오늘 예정 수업 — 해당 학원의 class_id 목록을 먼저 구해 배열로 .in() 한다.
  // (supabase-js 2.x 빌더는 .in()에 서브쿼리 빌더를 받지 못함 — 배열 필수)
  const { data: academyClasses } = await supabase
    .from('classes')
    .select('id')
    .eq('academy_id', academyId);
  const classIdList = (academyClasses || []).map((c: any) => c.id);

  const { count: todaySchedules } = classIdList.length
    ? await supabase
        .from('schedules')
        .select('id', { count: 'exact', head: true })
        .eq('is_canceled', false)
        .gte('start_time', today)
        .lt('start_time', tomorrow)
        .in('class_id', classIdList)
    : { count: 0 };

  // 미처리 상담
  const { count: pendingConsultations } = await supabase
    .from('consultations')
    .select('id', { count: 'exact', head: true })
    .eq('academy_id', academyId)
    .eq('status', 'NEW');

  return {
    totalRevenue,
    activeStudents: activeStudents || 0,
    todaySchedules: todaySchedules || 0,
    pendingConsultations: pendingConsultations || 0,
  } as DashboardStats;
}










