import { createClient } from '@/lib/supabase/server';
import { Database } from '@/types/database';
import { generateSessionDates, combineDateAndTime } from '@/lib/utils/schedule-generator';
import { createBookingsForNewSchedules } from '@/lib/db/period-ticket-bookings';

type RecurringSchedule = Database['public']['Tables']['recurring_schedules']['Row'];
type RecurringScheduleInsert = Database['public']['Tables']['recurring_schedules']['Insert'];
type ScheduleInsert = Database['public']['Tables']['schedules']['Insert'];

/**
 * 학원의 반복 일정 규칙 목록 조회
 */
export async function getRecurringSchedules(academyId: string) {
  const supabase = await createClient() as any;
  const { data, error } = await supabase
    .from('recurring_schedules')
    .select(`
      *,
      classes (
        id,
        title,
        genre,
        difficulty_level,
        access_config
      ),
      instructors (
        id,
        name_kr,
        name_en
      ),
      halls (
        id,
        name
      )
    `)
    .eq('academy_id', academyId)
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

/**
 * 반복 일정 규칙 생성
 */
export async function createRecurringSchedule(
  data: RecurringScheduleInsert
): Promise<RecurringSchedule> {
  const supabase = await createClient() as any;
  const { data: result, error } = await supabase
    .from('recurring_schedules')
    .insert(data)
    .select()
    .single();

  if (error) throw error;
  return result;
}

/**
 * 반복 일정 규칙 수정
 */
export async function updateRecurringSchedule(
  id: string,
  updates: Database['public']['Tables']['recurring_schedules']['Update']
) {
  const supabase = await createClient() as any;
  const { data, error } = await supabase
    .from('recurring_schedules')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * 반복 일정 규칙 삭제 (soft delete - is_active = false)
 */
export async function deleteRecurringSchedule(id: string) {
  const supabase = await createClient() as any;
  const { error } = await supabase
    .from('recurring_schedules')
    .update({ is_active: false })
    .eq('id', id);

  if (error) throw error;
}

/**
 * 반복 규칙에 따라 세션(schedules)을 일괄 생성
 * 
 * @param recurringScheduleId 반복 일정 규칙 ID
 * @param recurringSchedule 반복 일정 규칙 데이터
 * @returns 생성된 세션 수
 */
export async function generateSessionsFromRecurringSchedule(
  recurringScheduleId: string,
  recurringSchedule: {
    class_id: string;
    academy_id: string;
    start_date: string;
    end_date: string;
    start_time: string;
    end_time: string;
    days_of_week: number[];
    interval_weeks?: number | null;
    hall_id?: string | null;
    instructor_id?: string | null;
    max_students?: number | null;
  }
): Promise<number> {
  const supabase = await createClient() as any;
  
  // 날짜 목록 생성
  const dates = generateSessionDates(
    new Date(recurringSchedule.start_date),
    new Date(recurringSchedule.end_date),
    recurringSchedule.days_of_week,
    recurringSchedule.interval_weeks || 1
  );
  
  if (dates.length === 0) {
    return 0;
  }
  
  // 세션 데이터 생성
  const sessions: ScheduleInsert[] = dates.map(date => ({
    class_id: recurringSchedule.class_id,
    recurring_schedule_id: recurringScheduleId,
    start_time: combineDateAndTime(date, recurringSchedule.start_time),
    end_time: combineDateAndTime(date, recurringSchedule.end_time),
    hall_id: recurringSchedule.hall_id || null,
    instructor_id: recurringSchedule.instructor_id || null,
    max_students: recurringSchedule.max_students || 20,
    current_students: 0,
    is_canceled: false,
  }));
  
  // 일괄 삽입
  const { data, error } = await supabase
    .from('schedules')
    .insert(sessions)
    .select('id, class_id, start_time');
  
  if (error) throw error;
  
  const createdCount = data?.length || 0;
  
  // 생성된 스케줄에 대해 기존 기간권 보유자 자동 예약 생성
  if (data && data.length > 0) {
    try {
      const result = await createBookingsForNewSchedules(
        data.map((s: any) => ({
          id: s.id,
          class_id: s.class_id,
          start_time: s.start_time,
        }))
      );
      
      if (result.totalCreated > 0) {
        console.log(`기간권 보유자 자동 예약 ${result.totalCreated}개 생성됨`);
      }
    } catch (bookingError) {
      console.error('기간권 보유자 자동 예약 생성 오류:', bookingError);
      // 자동 예약 실패해도 스케줄 생성은 성공으로 처리
    }
  }
  
  return createdCount;
}

/**
 * 반복 규칙에 연결된 세션 삭제
 */
export async function deleteSessionsByRecurringSchedule(
  recurringScheduleId: string,
  futureOnly: boolean = true
) {
  const supabase = await createClient() as any;
  
  let query = supabase
    .from('schedules')
    .delete()
    .eq('recurring_schedule_id', recurringScheduleId);
  
  if (futureOnly) {
    const now = new Date().toISOString();
    query = query.gte('start_time', now);
  }
  
  const { error } = await query;
  if (error) throw error;
}
