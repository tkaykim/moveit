import { createClient } from '@/lib/supabase/server';

export interface Consultation {
  id: string;
  academy_id: string;
  user_id?: string | null;
  name: string;
  phone?: string | null;
  topic: string;
  status: 'NEW' | 'SCHEDULED' | 'COMPLETED' | 'CANCELLED';
  scheduled_at?: string | null;
  assigned_to?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export async function getConsultations(academyId: string) {
  const supabase = await createClient() as any;
  const { data, error } = await supabase
    .from('consultations')
    .select('*')
    .eq('academy_id', academyId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data as Consultation[];
}

export async function createConsultation(consultation: Omit<Consultation, 'id' | 'created_at' | 'updated_at'>) {
  const supabase = await createClient() as any;
  const { data, error } = await supabase
    .from('consultations')
    .insert([consultation])
    .select()
    .single();

  if (error) throw error;
  return data as Consultation;
}

export async function updateConsultation(id: string, updates: Partial<Consultation>) {
  const supabase = await createClient() as any;
  const { data, error } = await supabase
    .from('consultations')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as Consultation;
}

export async function deleteConsultation(id: string) {
  const supabase = await createClient() as any;
  const { error } = await supabase
    .from('consultations')
    .delete()
    .eq('id', id);

  if (error) throw error;
}



