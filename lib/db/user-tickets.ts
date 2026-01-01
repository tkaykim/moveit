import { createClient } from '@/lib/supabase/server';
import { UserTicket } from '@/lib/supabase/types';

export async function getUserTickets(userId: string) {
  const supabase = await createClient();
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
  const supabase = await createClient();
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

export async function createUserTicket(userTicket: {
  user_id: string;
  ticket_id: string;
  remaining_count?: number | null;
  start_date?: string | null;
  expiry_date?: string | null;
  status?: string;
}) {
  const supabase = await createClient();
  const { data, error } = await (supabase as any)
    .from('user_tickets')
    .insert(userTicket)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateUserTicket(id: string, updates: Partial<UserTicket>) {
  const supabase = await createClient();
  const { data, error } = await (supabase as any)
    .from('user_tickets')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

