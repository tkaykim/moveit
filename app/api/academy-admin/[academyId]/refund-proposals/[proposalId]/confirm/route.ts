/**
 * POST /api/academy-admin/[academyId]/refund-proposals/[proposalId]/confirm
 * Body: { adjustedAmount?, reason, decision?: 'CONFIRM' | 'REJECT' }
 *
 * 직원 확인 게이트 (T7). 계산된 제안을 직원이 확인/조정한다.
 * ⚠ 이 라우트도 돈을 움직이지 않는다. 확인 사실과 근거만 감사 기록으로 남긴다.
 *   실제 집행은 별도 승인 아래 기존 /ticket-refund 라우트가 담당한다.
 *
 * 감사 기록에 반드시 남는 것: 누가(confirmed_by) · 언제(confirmed_at) ·
 * 엔진 산출값(computed_amount) vs 직원 최종값(adjusted_amount) · 사유(reason).
 */
import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/supabase/server-auth';
import { createServiceClient } from '@/lib/supabase/server';
import { assertAcademyAdmin } from '@/lib/supabase/academy-admin-auth';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ academyId: string; proposalId: string }> }
) {
  try {
    const { academyId, proposalId } = await params;
    const user = await getAuthenticatedUser(request);
    if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    await assertAcademyAdmin(academyId, user.id);

    const body = await request.json().catch(() => ({}));
    const { adjustedAmount, reason, decision } = body as {
      adjustedAmount?: number;
      reason?: string;
      decision?: 'CONFIRM' | 'REJECT';
    };

    const trimmedReason = (reason ?? '').toString().trim();
    if (!trimmedReason) {
      return NextResponse.json(
        { error: '확인 사유를 입력해 주세요. (감사 기록에 남습니다)' },
        { status: 400 }
      );
    }

    const supabase = createServiceClient() as never as { from: (t: string) => any };

    const { data: proposal } = await supabase
      .from('refund_proposals')
      .select('*')
      .eq('id', proposalId)
      .eq('academy_id', academyId)
      .maybeSingle();

    if (!proposal) {
      return NextResponse.json({ error: '환불 제안을 찾을 수 없습니다.' }, { status: 404 });
    }
    if (proposal.status !== 'PROPOSED') {
      return NextResponse.json(
        { error: `이미 처리된 제안입니다. (현재 상태: ${proposal.status})` },
        { status: 409 }
      );
    }

    const isReject = decision === 'REJECT';
    // 조정값은 결제액을 넘을 수 없다. 미입력이면 엔진 산출값을 그대로 승인한 것으로 본다.
    const finalAmount = isReject
      ? null
      : Math.max(
          0,
          Math.min(
            adjustedAmount != null ? Math.round(adjustedAmount) : proposal.computed_amount,
            proposal.paid_amount
          )
        );

    // 상태 가드로 동시 확인(더블클릭)을 막는다.
    const { data: updated, error: updErr } = await supabase
      .from('refund_proposals')
      .update({
        status: isReject ? 'REJECTED' : 'CONFIRMED',
        adjusted_amount: finalAmount,
        reason: trimmedReason.slice(0, 500),
        confirmed_by: user.id,
        confirmed_at: new Date().toISOString(),
      })
      .eq('id', proposalId)
      .eq('status', 'PROPOSED')
      .select();

    if (updErr) {
      console.error('[refund-proposal confirm] update failed:', updErr);
      return NextResponse.json({ error: '확인 기록에 실패했습니다.' }, { status: 500 });
    }
    if (!updated || updated.length === 0) {
      return NextResponse.json({ error: '이미 처리된 제안입니다.' }, { status: 409 });
    }

    const row = updated[0];
    return NextResponse.json({
      success: true,
      // 확인은 집행이 아니다.
      executed: false,
      proposal: row,
      computedAmount: row.computed_amount,
      adjustedAmount: row.adjusted_amount,
      adjustmentDelta:
        row.adjusted_amount != null ? row.adjusted_amount - row.computed_amount : null,
      message: isReject
        ? '환불 제안을 반려했습니다.'
        : '환불 제안을 확인했습니다. 실제 환불 집행은 별도 승인 후 진행됩니다.',
    });
  } catch (e: unknown) {
    if (e && typeof e === 'object' && 'message' in e && e.message === '학원 관리자 권한이 필요합니다.') {
      return NextResponse.json({ error: (e as Error).message }, { status: 403 });
    }
    console.error('[refund-proposal confirm] error:', e);
    return NextResponse.json({ error: '확인 처리에 실패했습니다.' }, { status: 500 });
  }
}
