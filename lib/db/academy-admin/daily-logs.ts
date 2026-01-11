import { createClient } from '@/lib/supabase/server';

export interface DailyLog {
  id: string;
  academy_id: string;
  schedule_id: string;
  log_date: string;
  total_students: number;
  present_students: number;
  content?: string | null;
  notes?: string | null;
  status: 'PENDING' | 'COMPLETED';
  created_by?: string | null;
  created_at: string;
  updated_at: string;
}

export async function getDailyLogs(academyId: string, date?: string) {
  const supabase = await createClient() as any;
  let query = supabase
    .from('daily_logs')
    .select(`
      *,
      schedules (
        id,
        start_time,
        end_time,
        classes (
          id,
          title,
          instructors (
            id,
            name_kr,
            name_en
          )
        )
      )
    `)
    .eq('academy_id', academyId);

  if (date) {
    query = query.eq('log_date', date);
  }

  const { data, error } = await query.order('log_date', { ascending: false });

  if (error) throw error;
  return data;
}

export async function createDailyLog(log: Omit<DailyLog, 'id' | 'created_at' | 'updated_at'>) {
  const supabase = await createClient() as any;
  const { data, error } = await supabase
    .from('daily_logs')
    .insert([log])
    .select()
    .single();

  if (error) throw error;
  return data as DailyLog;
}

export async function updateDailyLog(id: string, updates: Partial<DailyLog>) {
  const supabase = await createClient() as any;
  const { data, error } = await supabase
    .from('daily_logs')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as DailyLog;
}










