import { createClient } from '@/lib/supabase/server';

export interface OperationNote {
  id: string;
  academy_id: string;
  note_date: string;
  content: string;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
}

export async function getOperationNote(academyId: string, date: string) {
  const supabase = await createClient() as any;
  const { data, error } = await supabase
    .from('operation_notes')
    .select('*')
    .eq('academy_id', academyId)
    .eq('note_date', date)
    .single();

  if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows returned
  return data as OperationNote | null;
}

export async function upsertOperationNote(note: Omit<OperationNote, 'id' | 'created_at' | 'updated_at'>) {
  const supabase = await createClient() as any;
  const { data, error } = await supabase
    .from('operation_notes')
    .upsert(
      {
        ...note,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: 'academy_id,note_date',
      }
    )
    .select()
    .single();

  if (error) throw error;
  return data as OperationNote;
}










