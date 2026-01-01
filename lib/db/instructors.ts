import { createClient } from '@/lib/supabase/server';
import { Instructor } from '@/lib/supabase/types';
import { Database } from '@/types/database';

export async function getInstructors() {
  const supabase = await createClient() as any;
  const { data, error } = await supabase
    .from('instructors')
    .select(`
      *,
      classes (*)
    `)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

export async function getInstructorById(id: string) {
  const supabase = await createClient() as any;
  const { data, error } = await supabase
    .from('instructors')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
}

export async function createInstructor(instructor: Database['public']['Tables']['instructors']['Insert']) {
  const supabase = await createClient() as any;
  const { data, error } = await supabase
    .from('instructors')
    .insert(instructor)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateInstructor(id: string, updates: Database['public']['Tables']['instructors']['Update']) {
  const supabase = await createClient() as any;
  const { data, error } = await supabase
    .from('instructors')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteInstructor(id: string) {
  const supabase = await createClient() as any;
  const { error } = await supabase
    .from('instructors')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

