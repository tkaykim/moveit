import { createClient } from '@/lib/supabase/server';
import { Booking } from '@/lib/supabase/types';
import { Database } from '@/types/database';

export async function getBookings(userId?: string) {
  const supabase = await createClient() as any;
  let query = supabase
    .from('bookings')
    .select(`
      *,
      schedules (
        *,
        classes (
          *,
          academies (*)
        ),
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
  const supabase = await createClient() as any;
  const { data, error } = await supabase
    .from('bookings')
    .select(`
      *,
      schedules (
        *,
        classes (
          *,
          academies (*)
        ),
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

export async function createBooking(booking: Database['public']['Tables']['bookings']['Insert']) {
  const supabase = await createClient() as any;
  const { data, error } = await supabase
    .from('bookings')
    .insert(booking)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateBooking(id: string, updates: Database['public']['Tables']['bookings']['Update']) {
  const supabase = await createClient() as any;
  const { data, error } = await supabase
    .from('bookings')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * 신청인원 목록 조회 (필터링 지원)
 */
export async function getEnrollments(filters?: {
  search?: string;
  status?: string;
  class_id?: string;
  schedule_id?: string;
  instructor_id?: string;
  academy_id?: string;
  start_date?: string;
  end_date?: string;
  limit?: number;
  offset?: number;
  order_by?: string;
  order_direction?: 'asc' | 'desc';
}) {
  const supabase = await createClient() as any;
  let query = supabase
    .from('bookings')
    .select(`
      *,
      users (*),
      schedules (
        *,
        classes (
          *,
          academies (*)
        ),
        instructors (*),
        halls (*)
      ),
      user_tickets (
        *,
        tickets (*)
      )
    `);

  // 필터 적용
  if (filters?.schedule_id) {
    query = query.eq('schedule_id', filters.schedule_id);
  }
  if (filters?.class_id) {
    query = query.eq('class_id', filters.class_id);
  }
  if (filters?.status) {
    query = query.eq('status', filters.status);
  }
  if (filters?.instructor_id) {
    query = query.eq('schedules.instructor_id', filters.instructor_id);
  }
  if (filters?.academy_id) {
    query = query.eq('schedules.classes.academy_id', filters.academy_id);
  }
  if (filters?.start_date) {
    query = query.gte('schedules.start_time', filters.start_date);
  }
  if (filters?.end_date) {
    query = query.lte('schedules.start_time', filters.end_date);
  }

  // 검색어 필터 (신청인 이름, 연락처, 이메일, 수업명, 강사명)
  if (filters?.search) {
    const searchTerm = filters.search.toLowerCase();
    query = query.or(`users.name.ilike.%${searchTerm}%,users.email.ilike.%${searchTerm}%,users.phone.ilike.%${searchTerm}%,schedules.classes.title.ilike.%${searchTerm}%,schedules.instructors.name_kr.ilike.%${searchTerm}%,schedules.instructors.name_en.ilike.%${searchTerm}%`);
  }

  // 정렬
  const orderBy = filters?.order_by || 'created_at';
  const orderDirection = filters?.order_direction || 'desc';
  query = query.order(orderBy, { ascending: orderDirection === 'asc' });

  // 페이지네이션
  if (filters?.limit) {
    query = query.limit(filters.limit);
  }
  if (filters?.offset) {
    query = query.range(filters.offset, filters.offset + (filters.limit || 10) - 1);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

/**
 * 수업별 현황 요약 조회
 */
export async function getScheduleEnrollmentSummary(scheduleId: string) {
  const supabase = await createClient() as any;
  
  // 스케줄 정보 조회
  const { data: schedule, error: scheduleError } = await supabase
    .from('schedules')
    .select(`
      *,
      classes (
        *,
        academies (*)
      ),
      instructors (*),
      halls (*)
    `)
    .eq('id', scheduleId)
    .single();

  if (scheduleError) throw scheduleError;
  if (!schedule) return null;

  // 신청인원 통계 조회
  const { data: bookings, error: bookingsError } = await supabase
    .from('bookings')
    .select('status')
    .eq('schedule_id', scheduleId);

  if (bookingsError) throw bookingsError;

  const confirmedCount = bookings?.filter((b: any) => b.status === 'CONFIRMED').length || 0;
  const pendingCount = bookings?.filter((b: any) => b.status === 'PENDING').length || 0;
  const cancelledCount = bookings?.filter((b: any) => b.status === 'CANCELLED').length || 0;
  const completedCount = bookings?.filter((b: any) => b.status === 'COMPLETED').length || 0;
  const totalEnrollments = bookings?.length || 0;
  const maxStudents = schedule.max_students || 0;
  const remainingSpots = Math.max(0, maxStudents - confirmedCount);

  return {
    schedule,
    total_enrollments: totalEnrollments,
    confirmed_count: confirmedCount,
    pending_count: pendingCount,
    cancelled_count: cancelledCount,
    completed_count: completedCount,
    max_students: maxStudents,
    remaining_spots: remainingSpots,
  };
}

/**
 * 여러 스케줄의 신청인원 통계 조회
 */
export async function getScheduleEnrollmentStats(scheduleIds: string[]) {
  const supabase = await createClient() as any;
  
  if (scheduleIds.length === 0) return {};

  const { data: bookings, error } = await supabase
    .from('bookings')
    .select('schedule_id, status')
    .in('schedule_id', scheduleIds);

  if (error) throw error;

  const stats: Record<string, { confirmed: number; pending: number }> = {};
  
  scheduleIds.forEach(id => {
    stats[id] = { confirmed: 0, pending: 0 };
  });

  bookings?.forEach((booking: any) => {
    const scheduleId = booking.schedule_id;
    if (stats[scheduleId]) {
      if (booking.status === 'CONFIRMED') {
        stats[scheduleId].confirmed++;
      } else if (booking.status === 'PENDING') {
        stats[scheduleId].pending++;
      }
    }
  });

  return stats;
}