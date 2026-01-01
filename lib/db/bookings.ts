import { createClient } from '@/lib/supabase/server';
import { Booking } from '@/lib/supabase/types';

export async function getBookings(userId?: string) {
  const supabase = await createClient();
  let query = supabase
    .from('bookings')
    .select(`
      *,
      schedules (
        *,
        classes (*),
        branches (*),
        instructors (*),
        halls (*)
      ),
      users (*),
      user_tickets (*)
    `)
    .order('created_at', { ascending: false });

  if (userId) {
    query = query.eq('user_id', userId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function getBookingById(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('bookings')
    .select(`
      *,
      schedules (
        *,
        classes (*),
        branches (*),
        instructors (*),
        halls (*)
      ),
      users (*),
      user_tickets (*)
    `)
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
}

export async function createBooking(booking: {
  user_id: string;
  schedule_id: string;
  user_ticket_id: string;
  status?: string;
}) {
  const supabase = await createClient();
  const { data, error } = await (supabase as any)
    .from('bookings')
    .insert(booking)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateBooking(id: string, updates: Partial<Booking>) {
  const supabase = await createClient();
  const { data, error } = await (supabase as any)
    .from('bookings')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

