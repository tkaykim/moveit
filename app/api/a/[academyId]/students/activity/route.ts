/**
 * GET /api/a/[academyId]/students/activity?user_id=...  — 한 학생의 최근 활동
 *
 * 발급/차감/복구/출석 등 최근 이력 ~10건을 운영자 언어로 돌려준다.
 * 순수 조회 — enrollment_activity_log 를 그 학생·이 학원으로만 읽는다 (판정 없음).
 */
import { NextRequest } from 'next/server';
import { withStaff, badRequest } from '../../_shared';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

const ACTION_LABELS: Record<string, string> = {
  ENROLL: '수강신청',
  CANCEL: '예약 취소',
  REFUND: '환불',
  EXTENSION_APPROVED: '연장/일시정지 승인',
  COUNT_DEDUCT: '횟수 차감',
  COUNT_RESTORE: '횟수 복구',
  TICKET_ISSUED: '수강권 발급',
  EXTENSION_REQUESTED: '연장/일시정지 신청',
  ADMIN_EXTEND: '관리자 연장',
  ADMIN_ENROLL: '관리자 수기 추가',
  ATTENDANCE_CHECKED: '출석 체크',
  TICKET_EXHAUSTED: '수강권 소진',
  TICKET_EXPIRED: '수강권 만료',
  ABSENT_MARKED: '결석 처리',
  ABSENT_CLEARED: '결석 취소',
  MAKEUP: '보강 배정',
  CLASS_CANCELED_RESTORE: '휴강 복구',
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ academyId: string }> }
) {
  const { academyId } = await params;
  return withStaff(request, academyId, async ({ supabase }) => {
    const userId = new URL(request.url).searchParams.get('user_id') ?? '';
    if (!userId) badRequest('user_id 가 필요합니다.');

    const { data: rows } = await supabase
      .from('enrollment_activity_log')
      .select('id, action, payload, note, created_at, actor_user_id, user_ticket_id')
      .eq('academy_id', academyId)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10);

    const actorIds = Array.from(new Set((rows ?? []).map((r: any) => r.actor_user_id).filter(Boolean)));
    const { data: actors } = actorIds.length
      ? await supabase.from('users').select('id, name, nickname').in('id', actorIds)
      : { data: [] as any[] };
    const actorMap = new Map<string, any>((actors ?? []).map((u: any) => [u.id, u]));

    return {
      activity: (rows ?? []).map((r: any) => ({
        id: r.id,
        action: r.action,
        action_label: ACTION_LABELS[r.action] ?? r.action,
        note: r.note ?? null,
        delta: r.payload?.delta ?? null,
        reason: r.payload?.reason ?? null,
        created_at: r.created_at,
        actor_name: r.actor_user_id
          ? actorMap.get(r.actor_user_id)?.name || actorMap.get(r.actor_user_id)?.nickname || '스태프'
          : '시스템',
      })),
    };
  });
}
