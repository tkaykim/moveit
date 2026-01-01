import { createClient } from '@/lib/supabase/server';
import { Academy } from '@/lib/supabase/types';

export async function getAcademies() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('academies')
    .select(`
      *,
      branches (*),
      classes (*)
    `)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

export async function getAcademyById(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('academies')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
}

export async function createAcademy(academy: {
  name: string;
  owner_id: string;
  business_registration_number?: string;
  logo_url?: string;
}) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('academies')
    .insert(academy)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateAcademy(id: string, updates: Partial<Academy>) {
  const supabase = await createClient();
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
  const supabase = await createClient();
  const { error } = await supabase
    .from('academies')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

