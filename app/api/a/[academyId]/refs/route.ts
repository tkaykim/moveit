/**
 * GET /api/a/[academyId]/refs
 *
 * 라이트 어드민 "수업 추가/수정" 폼의 선택 상자를 채우는 참조 목록.
 * 수업군(class_groups) / 홀(halls) / 멤버십(memberships) 을 한 번에 준다.
 */
import { NextRequest } from 'next/server';
import { withStaff } from '../_shared';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ academyId: string }> }
) {
  const { academyId } = await params;
  return withStaff(request, academyId, async ({ supabase }) => {
    const [groups, halls, memberships] = await Promise.all([
      supabase
        .from('class_groups')
        .select('id, key, name, is_special')
        .eq('academy_id', academyId)
        .order('display_order', { ascending: true }),
      supabase
        .from('halls')
        .select('id, name, capacity')
        .eq('academy_id', academyId)
        .order('name', { ascending: true }),
      supabase
        .from('memberships')
        .select('id, name, is_active')
        .eq('academy_id', academyId)
        .eq('is_active', true)
        .order('name', { ascending: true }),
    ]);
    return {
      classGroups: groups.data ?? [],
      halls: halls.data ?? [],
      memberships: memberships.data ?? [],
    };
  });
}
