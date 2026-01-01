import { createClient } from '@/lib/supabase/server';
import { UserTicket } from '@/lib/supabase/types';
import { Database } from '@/types/database';

export async function getUserTickets(userId: string) {
  const supabase = await createClient() as any;
  const { data, error } = await supabase
    .from('user_tickets')
    .select(`
      *,
      tickets (*)
    `)
    .eq('user_id', userId)
    .eq('status', 'ACTIVE')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

export async function getUserTicketById(id: string) {
  const supabase = await createClient() as any;
  const { data, error } = await supabase
    .from('user_tickets')
    .select(`
      *,
      tickets (*)
    `)
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
}

export async function createUserTicket(userTicket: Database['public']['Tables']['user_tickets']['Insert']) {
  const supabase = await createClient() as any;
  const { data, error } = await supabase
    .from('user_tickets')
    .insert(userTicket)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateUserTicket(id: string, updates: Database['public']['Tables']['user_tickets']['Update']) {
  const supabase = await createClient() as any;
  const { data, error } = await supabase
    .from('user_tickets')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

