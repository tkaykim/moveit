import { createClient } from '@/lib/supabase/server';

export interface StudentWithTickets {
  id: string;
  name?: string | null;
  nickname?: string | null;
  email?: string | null;
  phone?: string | null;
  profile_image?: string | null;
  created_at: string;
  user_tickets?: Array<{
    id: string;
    remaining_count: number;
    expiry_date?: string | null;
    status: string;
    tickets: {
      id: string;
      name: string;
      ticket_type: string;
    };
  }>;
  bookings?: Array<{
    id: string;
    status: string;
    created_at: string;
    schedules: {
      id: string;
      start_time: string;
      classes: {
        id: string;
        title: string;
      };
    };
  }>;
}

export async function getStudents(academyId: string, searchTerm?: string) {
  const supabase = await createClient() as any;
  
  // 해당 학원의 수강권을 가진 학생들 조회
  const { data: tickets } = await supabase
    .from('tickets')
    .select('id')
    .eq('academy_id', academyId);

  const ticketIds = tickets?.map((t: any) => t.id) || [];

  let query = supabase
    .from('users')
    .select(`
      *,
      user_tickets!inner (
        id,
        remaining_count,
        expiry_date,
        status,
        tickets (
          id,
          name,
          ticket_type
        )
      ),
      bookings (
        id,
        status,
        created_at,
        schedules (
          id,
          start_time,
          classes (
            id,
            title
          )
        )
      )
    `)
    .in('user_tickets.ticket_id', ticketIds);

  if (searchTerm) {
    query = query.or(`name.ilike.%${searchTerm}%,phone.ilike.%${searchTerm}%,nickname.ilike.%${searchTerm}%`);
  }

  const { data, error } = await query.order('created_at', { ascending: false });

  if (error) throw error;
  return data as StudentWithTickets[];
}

export async function createStudent(student: {
  name?: string;
  nickname?: string;
  email?: string;
  phone?: string;
}) {
  const supabase = await createClient() as any;
  const { data, error } = await supabase
    .from('users')
    .insert([student])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateStudent(id: string, updates: Partial<StudentWithTickets>) {
  const supabase = await createClient() as any;
  const { data, error } = await supabase
    .from('users')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}







