import { createClient } from '@/lib/supabase/server';
import { Database } from '@/types/database';

export async function getHalls(academyId?: string) {
  const supabase = await createClient() as any;
  let query = supabase
    .from('halls')
    .select('*')
    .order('name', { ascending: true });

  if (academyId) {
    query = query.eq('academy_id', academyId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function getHallById(id: string) {
  const supabase = await createClient() as any;
  const { data, error } = await supabase
    .from('halls')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
}

export async function createHall(hall: Database['public']['Tables']['halls']['Insert']) {
  const supabase = await createClient() as any;
  const { data, error } = await supabase
    .from('halls')
    .insert(hall)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateHall(id: string, updates: Database['public']['Tables']['halls']['Update']) {
  const supabase = await createClient() as any;
  const { data, error } = await supabase
    .from('halls')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteHall(id: string) {
  const supabase = await createClient() as any;
  const { error } = await supabase
    .from('halls')
    .delete()
    .eq('id', id);

  if (error) throw error;
}