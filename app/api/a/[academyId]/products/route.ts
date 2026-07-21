/**
 * GET /api/a/[academyId]/products  — 판매중 수강권 상품 목록 (현장결제 / 수동 발급용)
 *
 * 순수 조회. 가격은 참고 표시용이며, 실제 발급 금액은 주문 조립기(create_order_group)가 권위다.
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
    const { data } = await supabase
      .from('tickets')
      .select('id, name, ticket_type, price, count_options, is_fixed_weekly, is_on_sale')
      .eq('academy_id', academyId)
      .eq('is_on_sale', true)
      .order('price', { ascending: true });
    return { products: data ?? [] };
  });
}
