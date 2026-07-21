/**
 * GET /api/a/[academyId]/pro  — 라이트 어드민 "전문반(멤버십)" 탭 조회 묶음
 *
 * 한 번의 요청으로:
 *   - memberships : 이 학원 멤버십 정의 (숨김 포함 — 스태프는 다 본다) + 소속 인원수
 *   - members     : 학생 멤버십 (학생 이름·기간·상태). 멤버십별로 묶어 쓴다.
 *   - reviewQueue : 만료 처리 큐 (정본 RPC membership_expiry_review_queue)
 *
 * 순수 조회. 부여/연장/정지/재개/처리기록은 기존 검증된 라우트(academy-admin/memberships/*)를 쓴다.
 */
import { NextRequest } from 'next/server';
import { listMemberships, getExpiredMembershipReviewQueue } from '@/lib/db/memberships';
import { withStaff } from '../_shared';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ academyId: string }> }
) {
  const { academyId } = await params;
  return withStaff(request, academyId, async ({ supabase }) => {
    const [memberships, smRes, reviewQueue] = await Promise.all([
      listMemberships(supabase, academyId, { includeInactive: true }),
      supabase
        .from('student_memberships')
        .select('id, user_id, membership_id, status, start_date, end_date, created_at')
        .eq('academy_id', academyId)
        .order('created_at', { ascending: false }),
      getExpiredMembershipReviewQueue(supabase, academyId, { includeHandled: false }).catch(() => []),
    ]);

    const sm = smRes.data ?? [];
    const userIds = Array.from(new Set(sm.map((r: any) => r.user_id).filter(Boolean)));
    const { data: users } = userIds.length
      ? await supabase.from('users').select('id, name, nickname, phone').in('id', userIds)
      : { data: [] as any[] };
    const userMap = new Map<string, any>((users ?? []).map((u: any) => [u.id, u]));

    const members = sm.map((r: any) => ({
      id: r.id,
      user_id: r.user_id,
      membership_id: r.membership_id,
      status: r.status,
      start_date: r.start_date,
      end_date: r.end_date,
      student_name: userMap.get(r.user_id)?.name || userMap.get(r.user_id)?.nickname || '이름 없음',
      contact: userMap.get(r.user_id)?.phone ?? null,
    }));

    const activeCount = new Map<string, number>();
    for (const m of members) {
      if ((m.status ?? '').toUpperCase() === 'ACTIVE') {
        activeCount.set(m.membership_id, (activeCount.get(m.membership_id) ?? 0) + 1);
      }
    }

    return {
      memberships: memberships.map((m) => ({
        id: m.id,
        name: m.name,
        visibility: m.visibility,
        is_active: m.is_active,
        bundled_ticket_id: m.bundled_ticket_id,
        member_count: activeCount.get(m.id) ?? 0,
      })),
      members,
      reviewQueue,
    };
  });
}
