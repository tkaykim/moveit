import { createClient } from '@/lib/supabase/server';
import { Branch } from '@/lib/supabase/types';

export async function getBranches(academyId?: string) {
  const supabase = await createClient();
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
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('branches')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
}

export async function createBranch(branch: {
  academy_id: string;
  name: string;
  address_primary: string;
  address_detail?: string;
  contact_number?: string;
  is_active?: boolean;
}) {
  const supabase = await createClient();
  const { data, error } = await (supabase as any)
    .from('branches')
    .insert(branch)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateBranch(id: string, updates: Partial<Branch>) {
  const supabase = await createClient();
  const { data, error } = await (supabase as any)
    .from('branches')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

