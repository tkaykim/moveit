import { createClient } from '@/lib/supabase/server';
import { Instructor } from '@/lib/supabase/types';

export async function getInstructors() {
  const supabase = await createClient();
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
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('instructors')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
}

export async function createInstructor(instructor: {
  user_id?: string;
  name_kr: string;
  name_en?: string;
  bio?: string;
  instagram_url?: string;
  specialties?: string;
  profile_image_url?: string;
}) {
  const supabase = await createClient();
  const { data, error } = await (supabase as any)
    .from('instructors')
    .insert(instructor)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateInstructor(id: string, updates: Partial<Instructor>) {
  const supabase = await createClient();
  const { data, error } = await (supabase as any)
    .from('instructors')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteInstructor(id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from('instructors')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

