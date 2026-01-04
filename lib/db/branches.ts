import { createClient } from '@/lib/supabase/server';
import { Database } from '@/types/database';

export async function getBranches(academyId?: string) {
  const supabase = await createClient() as any;
  let query = supabase
    .from('branches')
    .select('*')
    .order('created_at', { ascending: false });

  if (academyId) {
    query = query.eq('academy_id', academyId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function getBranchById(id: string) {
  const supabase = await createClient() as any;
  const { data, error } = await supabase
    .from('branches')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
}

export async function createBranch(branch: any) {
  const supabase = await createClient() as any;
  const { data, error } = await supabase
    .from('branches')
    .insert(branch)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateBranch(id: string, updates: any) {
  const supabase = await createClient() as any;
  const { data, error } = await supabase
    .from('branches')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

