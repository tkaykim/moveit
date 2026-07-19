/**
 * POST /api/academy-admin/[academyId]/refund-proposals   — 환불 "제안" 생성 (dry-run, 돈 안 움직임)
 * GET  /api/academy-admin/[academyId]/refund-proposals   — 제안 목록
 *
 * ⚠ 안전 게이트 (T7): 이 단계에서 실제 환불은 자동 집행되지 않는다.
 *   여기서는 계산 결과와 근거만 refund_proposals 에 남긴다(status=PROPOSED).
 *   실제 집행은 직원이 /refund-proposals/[proposalId]/confirm 로 확인한 뒤,
 *   기존 /ticket-refund 라우트를 통해서만 일어난다.
 *
 * 계산은 lib/refund/calc.ts 단일 소스에 위임하고, 적용 규칙은
 * lib/refund/presets.ts 의 법적 우선순위(강행법규 > 고지약관 > 학원설정 > 직원조정)로 결정한다.
 */
import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/supabase/server-auth';
import { createServiceClient } from '@/lib/supabase/server';
import { assertAcademyAdmin } from '@/lib/supabase/academy-admin-auth';
import { computeRefund } from '@/lib/refund/calc';
import {
  resolveRefundPreset,
  presetFromLegacyPolicy,
  REFUND_PRESETS,
  type RefundPresetKey,
  type BusinessCategory,
} from '@/lib/refund/presets';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ academyId: string }> }
) {
  try {
    const { academyId } = await params;
    const user = await getAuthenticatedUser(request);
    if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    await assertAcademyAdmin(academyId, user.id);

    const supabase = createServiceClient() as never as {
      from: (t: string) => any;
    };
    const { data } = await supabase
      .from('refund_proposals')
      .select('*')
      .eq('academy_id', academyId)
      .order('created_at', { ascending: false })
      .limit(200);

    return NextResponse.json({ proposals: data ?? [] });
  } catch (e: unknown) {
    if (e && typeof e === 'object' && 'message' in e && e.message === '학원 관리자 권한이 필요합니다.') {
      return NextResponse.json({ error: (e as Error).message }, { status: 403 });
    }
    console.error('[refund-proposals GET] error:', e);
    return NextResponse.json({ error: '조회에 실패했습니다.' }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ academyId: string }> }
) {
  try {
    const { academyId } = await params;
    const user = await getAuthenticatedUser(request);
    if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    await assertAcademyAdmin(academyId, user.id);

    const body = await request.json().catch(() => ({}));
    const {
      revenueTransactionId,
      businessCategory,
      publishedTermsPreset,
    } = body as {
      revenueTransactionId?: string;
      businessCategory?: BusinessCategory;
      publishedTermsPreset?: RefundPresetKey | null;
    };

    if (!revenueTransactionId) {
      return NextResponse.json({ error: 'revenueTransactionId 가 필요합니다.' }, { status: 400 });
    }

    const supabase = createServiceClient() as never as { from: (t: string) => any };

    const { data: rev } = await supabase
      .from('revenue_transactions')
      .select(
        'id, academy_id, user_id, user_ticket_id, ticket_id, original_price, final_price, quantity, valid_days, ticket_type_snapshot, ticket_name'
      )
      .eq('id', revenueTransactionId)
      .eq('academy_id', academyId)
      .maybeSingle();

    if (!rev) {
      return NextResponse.json({ error: '결제 내역을 찾을 수 없습니다.' }, { status: 404 });
    }

    let ticketCategory: string | null = null;
    let legacyPolicy: any = null;
    if (rev.ticket_id) {
      const { data: tk } = await supabase
        .from('tickets')
        .select('ticket_category, refund_policy')
        .eq('id', rev.ticket_id)
        .maybeSingle();
      ticketCategory = tk?.ticket_category ?? null;
      legacyPolicy = tk?.refund_policy ?? null;
    }

    let utRow: any = null;
    let attendedCount: number | null = null;
    if (rev.user_ticket_id) {
      const { data } = await supabase
        .from('user_tickets')
        .select('id, remaining_count, status, expiry_date, start_date')
        .eq('id', rev.user_ticket_id)
        .maybeSingle();
      utRow = data;
      const { count } = await supabase
        .from('bookings')
        .select('id', { count: 'exact', head: true })
        .eq('user_ticket_id', rev.user_ticket_id)
        .eq('status', 'COMPLETED');
      attendedCount = count ?? 0;
    }

    // 법적 우선순위로 적용 규칙 결정. 대상 학원은 '학원' 등록 사업자이므로 기본 ACADEMY.
    const resolution = resolveRefundPreset({
      businessCategory: businessCategory ?? 'ACADEMY',
      publishedTerms: publishedTermsPreset ?? null,
      configuredPreset: presetFromLegacyPolicy(legacyPolicy),
    });

    const calc = computeRefund({
      ticketTypeSnapshot: rev.ticket_type_snapshot,
      ticketCategory,
      customPolicy: legacyPolicy,
      quantity: rev.quantity,
      remainingCount: utRow?.remaining_count ?? null,
      attendedCount,
      startDate: utRow?.start_date ?? null,
      expiryDate: utRow?.expiry_date ?? null,
      validDays: rev.valid_days,
      ticketStatus: utRow?.status ?? null,
      originalPrice: rev.original_price,
      finalPrice: rev.final_price,
      nowISO: new Date().toISOString(),
      preset: resolution.preset,
    });

    const { data: proposal, error: insErr } = await supabase
      .from('refund_proposals')
      .insert({
        academy_id: academyId,
        revenue_transaction_id: rev.id,
        user_ticket_id: rev.user_ticket_id,
        user_id: rev.user_id,
        preset_key: resolution.preset,
        preset_source: resolution.source,
        paid_amount: calc.paidAmount,
        computed_amount: calc.suggestedRefund,
        basis: calc.basis,
        breakdown: calc.breakdown,
        status: 'PROPOSED',
      })
      .select()
      .single();

    if (insErr) {
      console.error('[refund-proposals] insert failed:', insErr);
      return NextResponse.json({ error: '환불 제안 기록에 실패했습니다.' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      // 이 응답은 "제안"이다. 어떤 금전 이동도 일어나지 않았다.
      executed: false,
      proposal,
      preset: {
        ...REFUND_PRESETS[resolution.preset],
        source: resolution.source,
        note: resolution.note,
      },
      paidAmount: calc.paidAmount,
      computedAmount: calc.suggestedRefund,
      basis: calc.basis,
      breakdown: calc.breakdown,
      ticketName: rev.ticket_name,
    });
  } catch (e: unknown) {
    if (e && typeof e === 'object' && 'message' in e && e.message === '학원 관리자 권한이 필요합니다.') {
      return NextResponse.json({ error: (e as Error).message }, { status: 403 });
    }
    console.error('[refund-proposals POST] error:', e);
    return NextResponse.json({ error: '환불 제안 생성에 실패했습니다.' }, { status: 500 });
  }
}
