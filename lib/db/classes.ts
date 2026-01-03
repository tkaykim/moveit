import { createClient } from '@/lib/supabase/server';
import { Class } from '@/lib/supabase/types';
import { Database } from '@/types/database';

export async function getClasses(academyId?: string) {
  const supabase = await createClient() as any;
  let query = supabase
    .from('classes')
    .select('*')
    .order('created_at', { ascending: false });

  if (academyId) {
    query = query.eq('academy_id', academyId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function getClassById(id: string) {
  const supabase = await createClient() as any;
  const { data, error } = await supabase
    .from('classes')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
}

export async function createClass(classData: Database['public']['Tables']['classes']['Insert']) {
  const supabase = await createClient() as any;
  const { data, error } = await supabase
    .from('classes')
    .insert(classData)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateClass(id: string, updates: Database['public']['Tables']['classes']['Update']) {
  const supabase = await createClient() as any;
  const { data, error } = await supabase
    .from('classes')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getRecentClassVideos(academyId: string, limit: number = 10) {
  const supabase = await createClient() as any;
  const { data, error } = await supabase
    .from('classes')
    .select('id, title, video_url, start_time, thumbnail_url, genre, difficulty_level, instructor_id, instructors(name_kr, name_en)')
    .eq('academy_id', academyId)
    .not('video_url', 'is', null)
    .neq('video_url', '')
    .order('start_time', { ascending: false, nullsLast: true })
    .limit(limit);

  if (error) throw error;
  return data || [];
}

