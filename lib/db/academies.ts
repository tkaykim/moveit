import { createClient } from '@/lib/supabase/server';
import { Academy } from '@/lib/supabase/types';
import { Database } from '@/types/database';
import { isUUID } from '@/lib/utils/slug';

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
  const column = isUUID(id) ? 'id' : 'slug';
  const { data, error } = await supabase
    .from('academies')
    .select(`
      *,
      classes (*),
      halls (*)
    `)
    .eq(column, id)
    .single();

  if (error) throw error;
  return data;
}

/**
 * slug 또는 UUID로 학원의 실제 UUID를 조회.
 * slug인 경우 DB에서 id를 가져오고, UUID인 경우 그대로 반환.
 */
export async function resolveAcademyId(slugOrId: string): Promise<{ id: string; slug: string | null } | null> {
  if (isUUID(slugOrId)) {
    const supabase = await createClient() as any;
    const { data } = await supabase
      .from('academies')
      .select('id, slug')
      .eq('id', slugOrId)
      .single();
    return data ?? null;
  }

  const supabase = await createClient() as any;
  const { data } = await supabase
    .from('academies')
    .select('id, slug')
    .eq('slug', slugOrId)
    .single();
  return data ?? null;
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

