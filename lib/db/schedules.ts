import { createClient, createServiceClient } from '@/lib/supabase/server';
import { Schedule } from '@/lib/supabase/types';
import { Database } from '@/types/database';
import { createBookingsForNewSchedule } from '@/lib/db/period-ticket-bookings';

export async function getSchedules(filters?: {
  class_id?: string;
  academy_id?: string;
  instructor_id?: string;
  hall_id?: string;
  start_date?: string;
  end_date?: string;
}) {
  const supabase = await createClient() as any;
  let query = supabase
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
    .eq('is_canceled', false)
    .order('start_time', { ascending: true });

  if (filters?.class_id) {
    query = query.eq('class_id', filters.class_id);
  }
  if (filters?.academy_id) {
    // classes를 통해 academy_id 필터링
    query = query.eq('classes.academy_id', filters.academy_id);
  }
  if (filters?.instructor_id) {
    query = query.eq('instructor_id', filters.instructor_id);
  }
  if (filters?.hall_id) {
    query = query.eq('hall_id', filters.hall_id);
  }
  if (filters?.start_date) {
    query = query.gte('start_time', filters.start_date);
  }
  if (filters?.end_date) {
    query = query.lte('start_time', filters.end_date);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function getScheduleById(id: string) {
  const supabase = await createClient() as any;
  const { data, error } = await supabase
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
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
}

export async function createSchedule(schedule: Database['public']['Tables']['schedules']['Insert']) {
  const supabase = await createClient() as any;
  const { data, error } = await supabase
    .from('schedules')
    .insert(schedule)
    .select()
    .single();

  if (error) throw error;
  
  // 생성된 스케줄에 대해 기존 기간권 보유자 자동 예약 생성
  if (data && data.class_id && data.start_time) {
    try {
      await createBookingsForNewSchedule(
        data.id,
        data.class_id,
        new Date(data.start_time)
      );
    } catch (bookingError) {
      console.error('기간권 보유자 자동 예약 생성 오류:', bookingError);
      // 자동 예약 실패해도 스케줄 생성은 성공으로 처리
    }
  }
  
  return data;
}

export async function updateSchedule(id: string, updates: Database['public']['Tables']['schedules']['Update']) {
  const supabase = await createClient() as any;
  const { data, error } = await supabase
    .from('schedules')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * 학원의 스케줄(세션) 목록 조회 - 달력 뷰용
 */
export async function getSchedulesByAcademy(
  academyId: string,
  startDate: string,
  endDate: string
) {
  const supabase = await createClient() as any;
  
  // 먼저 해당 학원의 활성화된 클래스 ID 목록을 가져옵니다
  const { data: classes, error: classError } = await supabase
    .from('classes')
    .select('id')
    .eq('academy_id', academyId)
    .eq('is_canceled', false)
    .or('is_active.is.null,is_active.eq.true');
  
  if (classError) throw classError;
  
  const classIds = classes?.map((c: any) => c.id) || [];
  
  if (classIds.length === 0) {
    return [];
  }
  
  const { data, error } = await supabase
    .from('schedules')
    .select(`
      *,
      classes (
        id,
        title,
        genre,
        difficulty_level,
        card_color,
        access_config,
        class_type
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
    .in('class_id', classIds)
    .eq('is_canceled', false)
    .gte('start_time', startDate)
    .lte('start_time', endDate)
    .order('start_time', { ascending: true });

  if (error) throw error;
  return data || [];
}

/**
 * 세션 취소
 */
export async function cancelSchedule(id: string) {
  const supabase = await createClient() as any;
  const { data, error } = await supabase
    .from('schedules')
    .update({ is_canceled: true })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * 세션 삭제 (연관된 예약도 함께 삭제)
 *
 * 중요: 예약을 하드 삭제하기 전에, 아직 진행되지 않은(CONFIRMED/PENDING) 예약이 소비한
 * 횟수권 차감분을 회원에게 복구한다. (출석완료(COMPLETED) 예약은 실제로 수업을 받았으므로 복구 안 함)
 * 복구 없이 삭제하면 회원이 결제한 횟수가 영구 소실된다. restore_ticket_count RPC 는
 * 기간권(remaining_count=null)에는 자동 no-op.
 */
export async function deleteSchedule(id: string) {
  const supabase = await createClient() as any;

  // 0) 복구 대상 예약 조회 (미래/대기 예약 + 수강권 연결)
  const { data: toRestore } = await supabase
    .from('bookings')
    .select('id, user_ticket_id')
    .eq('schedule_id', id)
    .in('status', ['CONFIRMED', 'PENDING'])
    .not('user_ticket_id', 'is', null);

  // T0 잠금: restore_ticket_count 는 service_role 전용이 되었다.
  // 쿠키(anon) 클라이언트로는 호출할 수 없으므로 서비스 클라이언트로 복구한다.
  const restoreClient = createServiceClient() as any;
  for (const b of (toRestore || [])) {
    if (b.user_ticket_id) {
      await restoreClient.rpc('restore_ticket_count', { p_user_ticket_id: b.user_ticket_id, p_count: 1 }).then(() => {}, () => {});
    }
  }

  // 1) 연관된 예약 삭제
  const { error: bookingsError } = await supabase
    .from('bookings')
    .delete()
    .eq('schedule_id', id);

  if (bookingsError) throw bookingsError;

  // 2) 스케줄 삭제
  const { error } = await supabase
    .from('schedules')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

/**
 * 단일 세션(팝업/특강) 생성
 */
export async function createSingleSession(data: {
  class_id: string;
  start_time: string;
  end_time: string;
  hall_id?: string | null;
  instructor_id?: string | null;
  max_students?: number;
}) {
  const supabase = await createClient() as any;
  const { data: result, error } = await supabase
    .from('schedules')
    .insert({
      class_id: data.class_id,
      start_time: data.start_time,
      end_time: data.end_time,
      hall_id: data.hall_id || null,
      instructor_id: data.instructor_id || null,
      max_students: data.max_students || 20,
      current_students: 0,
      is_canceled: false,
      recurring_schedule_id: null, // 단일 세션은 반복 규칙 없음
    })
    .select()
    .single();

  if (error) throw error;
  
  // 생성된 스케줄에 대해 기존 기간권 보유자 자동 예약 생성
  if (result && result.class_id && result.start_time) {
    try {
      await createBookingsForNewSchedule(
        result.id,
        result.class_id,
        new Date(result.start_time)
      );
    } catch (bookingError) {
      console.error('기간권 보유자 자동 예약 생성 오류:', bookingError);
      // 자동 예약 실패해도 스케줄 생성은 성공으로 처리
    }
  }
  
  return result;
}
