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

  // 이번 달 총 매출
  const { data: revenueData } = await supabase
    .from('revenue_transactions')
    .select('final_price')
    .eq('academy_id', academyId)
    .eq('payment_status', 'COMPLETED')
    .gte('transaction_date', startOfMonth);

  const totalRevenue = revenueData?.reduce((sum: number, t: any) => sum + (t.final_price || 0), 0) || 0;

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

  // 오늘 예정 수업
  const { count: todaySchedules } = await supabase
    .from('schedules')
    .select('id', { count: 'exact', head: true })
    .eq('is_canceled', false)
    .gte('start_time', today)
    .lt('start_time', tomorrow)
    .in('class_id', 
      supabase
        .from('classes')
        .select('id')
        .eq('academy_id', academyId)
    );

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


