import { createClient } from '@/lib/supabase/server';
import { Class } from '@/lib/supabase/types';

export async function getClasses(academyId?: string) {
  const supabase = await createClient();
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
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('classes')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
}

export async function createClass(classData: {
  academy_id: string;
  title: string;
  description?: string;
  difficulty_level?: string;
  genre?: string;
  class_type: string;
  thumbnail_url?: string;
}) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('classes')
    .insert(classData)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateClass(id: string, updates: Partial<Class>) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('classes')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

