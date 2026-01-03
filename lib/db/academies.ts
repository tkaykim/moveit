import { createClient } from '@/lib/supabase/server';
import { Academy } from '@/lib/supabase/types';
import { Database } from '@/types/database';

export async function getAcademies() {
  const supabase = await createClient() as any;
  const { data, error } = await supabase
    .from('academies')
    .select(`
      *,
      classes (*),
      halls (*)
    `)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

export async function getAcademyById(id: string) {
  const supabase = await createClient() as any;
  const { data, error } = await supabase
    .from('academies')
    .select(`
      *,
      classes (*),
      halls (*)
    `)
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
}

export async function createAcademy(academy: Database['public']['Tables']['academies']['Insert']) {
  const supabase = await createClient() as any;
  const { data, error } = await supabase
    .from('academies')
    .insert(academy)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateAcademy(id: string, updates: Database['public']['Tables']['academies']['Update']) {
  const supabase = await createClient() as any;
  const { data, error } = await supabase
    .from('academies')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteAcademy(id: string) {
  const supabase = await createClient() as any;
  const { error } = await supabase
    .from('academies')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

