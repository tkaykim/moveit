/**
 * PATCH .../memberships/students/[studentMembershipId]
 *   { action: 'suspend' | 'resume' | 'extend', end_date?, reactivate?, note? }
 *
 * 정지/만료해도 번들 수강권은 회수되지 않는다(DB 함수가 손대지 않는다).
 */
import { NextRequest } from 'next/server';
import {
  suspendStudentMembership,
  resumeStudentMembership,
  extendStudentMembership,
  MembershipError,
} from '@/lib/db/memberships';
import { withStaff, badRequest } from '../../_shared';

export const dynamic = 'force-dynamic';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ academyId: string; studentMembershipId: string }> }
) {
  const { academyId, studentMembershipId } = await params;
  return withStaff(request, academyId, async ({ supabase }) => {
    const body = await request.json().catch(() => ({}));

    // 다른 학원의 행을 건드리지 못하게 소유권 확인
    const { data } = await supabase
      .from('student_memberships')
      .select('id, academy_id')
      .eq('id', studentMembershipId)
      .limit(1);
    if (!data?.[0] || data[0].academy_id !== academyId) {
      throw new MembershipError('STUDENT_MEMBERSHIP_NOT_FOUND', '학생 멤버십을 찾을 수 없습니다.');
    }

    switch (body.action) {
      case 'suspend':
        return { result: await suspendStudentMembership(supabase, studentMembershipId, body.note) };
      case 'resume':
        return { result: await resumeStudentMembership(supabase, studentMembershipId, body.note) };
      case 'extend':
        if (body.end_date !== null && typeof body.end_date !== 'string') {
          badRequest('end_date 는 YYYY-MM-DD 문자열 또는 null 이어야 합니다.');
        }
        return {
          result: await extendStudentMembership(supabase, studentMembershipId, body.end_date, {
            reactivate: body.reactivate === true,
            note: body.note,
          }),
        };
      default:
        return badRequest("action 은 'suspend' | 'resume' | 'extend' 중 하나여야 합니다.");
    }
  });
}
