import { createClient } from '@/lib/supabase/server';
import { Hall } from '@/lib/supabase/types';

export async function getHalls(branchId?: string) {
  const supabase = await createClient();
  let query = supabase
    .from('halls')
    .select('*')
    .order('name', { ascending: true });

  if (branchId) {
    query = query.eq('branch_id', branchId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function createHall(hall: {
  branch_id: string;
  name: string;
  capacity?: number;
  floor_info?: string;
}) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('halls')
    .insert(hall)
    .select()
    .single();

  if (error) throw error;
  return data;
}

