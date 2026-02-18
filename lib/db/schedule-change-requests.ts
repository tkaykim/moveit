import { createClient } from '@/lib/supabase/server';

export type ScheduleChangeRequestType = 'SUBSTITUTE' | 'CANCEL';
export type ScheduleChangeRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface ScheduleChangeRequestInsert {
  schedule_id: string;
  academy_id: string;
  request_type: ScheduleChangeRequestType;
  requested_by_instructor_id: string;
  reason: string;
  requested_instructor_id?: string | null;
  requested_instructor_name?: string | null;
  status?: ScheduleChangeRequestStatus;
}

/**
 * 동일 스케줄·동일 타입으로 PENDING인 요청이 있는지 확인
 */
export async function hasPendingRequest(scheduleId: string, requestType: ScheduleChangeRequestType): Promise<boolean> {
  const supabase = await createClient() as any;
  const { data, error } = await supabase
    .from('schedule_change_requests')
    .select('id')
    .eq('schedule_id', scheduleId)
    .eq('request_type', requestType)
    .eq('status', 'PENDING')
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return !!data;
}

/**
 * 강사 대강/취소 신청 생성
 */
export async function createScheduleChangeRequest(row: ScheduleChangeRequestInsert) {
  const supabase = await createClient() as any;
  const { data, error } = await supabase
    .from('schedule_change_requests')
    .insert({
      schedule_id: row.schedule_id,
      academy_id: row.academy_id,
      request_type: row.request_type,
      requested_by_instructor_id: row.requested_by_instructor_id,
      reason: row.reason,
      requested_instructor_id: row.requested_instructor_id ?? null,
      requested_instructor_name: row.requested_instructor_name ?? null,
      status: row.status ?? 'PENDING',
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}
