/**
 * GET /api/academy-admin/[academyId]/console/refs   (T9)
 *
 * 콘솔의 선택 상자를 채우는 참조 목록 — 수강권 상품 / 수업 그룹 / 수업.
 * 화면마다 따로 긁지 않도록 한 번에 준다.
 */
import { NextRequest } from 'next/server';
import { withConsoleStaff } from '../_shared';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ academyId: string }> }
) {
  const { academyId } = await params;
  return withConsoleStaff(request, academyId, async ({ supabase }) => {
    const [tickets, groups, classes] = await Promise.all([
      supabase
        .from('tickets')
        .select('id, name, ticket_type, price')
        .eq('academy_id', academyId)
        .order('name', { ascending: true }),
      supabase
        .from('class_groups')
        .select('id, key, name, is_special')
        .eq('academy_id', academyId)
        .order('display_order', { ascending: true }),
      supabase
        .from('classes')
        .select('id, title, class_group_id, is_active')
        .eq('academy_id', academyId)
        .order('title', { ascending: true }),
    ]);
    return {
      tickets: tickets.data ?? [],
      classGroups: groups.data ?? [],
      classes: classes.data ?? [],
    };
  });
}
