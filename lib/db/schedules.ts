import { createClient } from '@/lib/supabase/server';
import { Schedule } from '@/lib/supabase/types';
import { Database } from '@/types/database';

export async function getSchedules(filters?: {
  class_id?: string;
  branch_id?: string;
  instructor_id?: string;
  start_date?: string;
  end_date?: string;
}) {
  const supabase = await createClient() as any;
  let query = supabase
    .from('schedules')
    .select(`
      *,
      classes (*),
      branches (*),
      instructors (*),
      halls (*)
    `)
    .eq('is_canceled', false)
    .order('start_time', { ascending: true });

  if (filters?.class_id) {
    query = query.eq('class_id', filters.class_id);
  }
  if (filters?.branch_id) {
    query = query.eq('branch_id', filters.branch_id);
  }
  if (filters?.instructor_id) {
    query = query.eq('instructor_id', filters.instructor_id);
  }
  if (filters?.start_date) {
    query = query.gte('start_time', filters.start_date);
  }
  if (filters?.end_date) {
    query = query.lte('start_time', filters.end_date);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function getScheduleById(id: string) {
  const supabase = await createClient() as any;
  const { data, error } = await supabase
    .from('schedules')
    .select(`
      *,
      classes (*),
      branches (*),
      instructors (*),
      halls (*)
    `)
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
}

export async function createSchedule(schedule: Database['public']['Tables']['schedules']['Insert']) {
  const supabase = await createClient() as any;
  const { data, error } = await supabase
    .from('schedules')
    .insert(schedule)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateSchedule(id: string, updates: Database['public']['Tables']['schedules']['Update']) {
  const supabase = await createClient() as any;
  const { data, error } = await supabase
    .from('schedules')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

