import { getSupabaseClient } from '@/lib/utils/supabase-client';

export type DeleteScope = 'single' | 'future' | 'all';

export interface DeleteResult {
  deletedSessions: number;
  deletedBookings: number;
}

/**
 * 반복 일정으로 생성된 세션을 삭제한다.
 *
 * - single: 해당 세션 1건만 삭제
 * - future: 같은 recurring_schedule_id 의 세션 중 start_time >= 기준 세션의 start_time 인 모든 세션 삭제
 * - all:    같은 recurring_schedule_id 의 모든 세션 삭제
 *
 * 모든 모드에서 연관된 bookings 도 먼저 삭제한다.
 * 단일 세션(반복 규칙 미연결)인 경우 scope 와 무관하게 single 로 동작한다.
 */
export async function deleteRecurringSessions(params: {
  sessionId: string;
  recurringScheduleId: string | null | undefined;
  startTime: string;
  scope: DeleteScope;
}): Promise<DeleteResult> {
  const { sessionId, recurringScheduleId, startTime, scope } = params;
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error('데이터베이스 연결에 실패했습니다.');
  }

  const effectiveScope: DeleteScope = recurringScheduleId ? scope : 'single';

  // 1) 삭제 대상 세션 ID 목록 산출
  let targetIds: string[] = [sessionId];

  if (effectiveScope !== 'single' && recurringScheduleId) {
    let query = (supabase as any)
      .from('schedules')
      .select('id')
      .eq('recurring_schedule_id', recurringScheduleId);

    if (effectiveScope === 'future') {
      query = query.gte('start_time', startTime);
    }

    const { data, error } = await query;
    if (error) throw error;
    targetIds = (data || []).map((row: any) => row.id);

    // 기준 세션이 결과에 누락된 경우 대비 (예: 시간 정밀도 이슈)
    if (!targetIds.includes(sessionId)) {
      targetIds.push(sessionId);
    }
  }

  if (targetIds.length === 0) {
    return { deletedSessions: 0, deletedBookings: 0 };
  }

  // 2) 연관 예약 카운트 및 삭제
  //    하드 삭제 전, 미래/대기(CONFIRMED/PENDING) 예약이 소비한 횟수권 차감분을 회원에게 복구한다.
  //    (출석완료 예약은 실제 수강했으므로 복구 안 함) — 복구 없이 삭제하면 결제 횟수가 소실됨.
  //    restore_ticket_count 는 기간권(remaining_count=null)에는 자동 no-op.
  const { data: bookings, error: bookingsSelectError } = await (supabase as any)
    .from('bookings')
    .select('id, status, user_ticket_id')
    .in('schedule_id', targetIds);
  if (bookingsSelectError) throw bookingsSelectError;
  const bookingCount = bookings?.length ?? 0;

  if (bookingCount > 0) {
    for (const b of bookings) {
      if (b.user_ticket_id && (b.status === 'CONFIRMED' || b.status === 'PENDING')) {
        // T0 잠금: restore_ticket_count 는 service_role 전용이 되었다.
        // 이 코드는 브라우저(학원 스태프 세션)에서 실행되므로, 학원 소유 검사를 포함한
        // restore_ticket_count_staff 래퍼를 사용한다.
        await (supabase as any)
          .rpc('restore_ticket_count_staff', { p_user_ticket_id: b.user_ticket_id, p_count: 1 })
          .then(() => {}, () => {});
      }
    }

    const { error: bookingsDeleteError } = await (supabase as any)
      .from('bookings')
      .delete()
      .in('schedule_id', targetIds);
    if (bookingsDeleteError) throw bookingsDeleteError;
  }

  // 3) 세션 삭제
  const { error: sessionsDeleteError } = await (supabase as any)
    .from('schedules')
    .delete()
    .in('id', targetIds);
  if (sessionsDeleteError) throw sessionsDeleteError;

  return {
    deletedSessions: targetIds.length,
    deletedBookings: bookingCount,
  };
}

/**
 * 같은 반복 규칙의 세션 수 / 향후 세션 수를 미리 조회 (다이얼로그 표시용)
 */
export async function getRecurringSessionCounts(params: {
  recurringScheduleId: string;
  startTime: string;
}): Promise<{ total: number; future: number }> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { total: 0, future: 0 };
  }

  const { count: totalCount } = await (supabase as any)
    .from('schedules')
    .select('id', { count: 'exact', head: true })
    .eq('recurring_schedule_id', params.recurringScheduleId);

  const { count: futureCount } = await (supabase as any)
    .from('schedules')
    .select('id', { count: 'exact', head: true })
    .eq('recurring_schedule_id', params.recurringScheduleId)
    .gte('start_time', params.startTime);

  return {
    total: totalCount ?? 0,
    future: futureCount ?? 0,
  };
}
