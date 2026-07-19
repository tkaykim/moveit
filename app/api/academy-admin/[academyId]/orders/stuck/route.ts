/**
 * GET /api/academy-admin/[academyId]/orders/stuck  (T5)
 *
 * 결제는 됐는데 이행이 안 끝난 주문 목록 (PAYMENT_APPROVED / FULFILLMENT_FAILED).
 * 운영 대시보드는 이후 과제이지만, 그 데이터는 지금부터 조회 가능해야 한다 —
 * 승인된 결제가 조용히 묻히는 일을 만들지 않기 위해서.
 */
import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getAuthenticatedUser } from '@/lib/supabase/server-auth';
import { assertAcademyAdmin } from '@/lib/supabase/academy-admin-auth';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ academyId: string }> }
) {
  const { academyId } = await params;

  const user = await getAuthenticatedUser(request);
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }
  try {
    await assertAcademyAdmin(academyId, user.id);
  } catch {
    return NextResponse.json({ error: '학원 관리자 권한이 필요합니다.' }, { status: 403 });
  }

  const supabase = createServiceClient() as any;
  const { data, error } = await supabase.rpc('list_stuck_orders', {
    p_academy_id: academyId,
    p_limit: 200,
  });

  if (error) {
    console.error('[academy-admin/orders/stuck]', error.message);
    return NextResponse.json({ error: '조회에 실패했습니다.' }, { status: 500 });
  }

  return NextResponse.json({ orders: data ?? [], count: (data ?? []).length });
}
