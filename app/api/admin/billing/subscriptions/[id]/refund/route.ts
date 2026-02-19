import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/supabase/admin-auth';
import { createServiceClient } from '@/lib/supabase/server';

// Admin: 구독 결제 건 환불 (토스 결제 취소 API 호출 후 subscription_payments refunded 처리)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireSuperAdmin(request);
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { id: subscriptionId } = await params;
    const body = await request.json();
    const { paymentId, amount, cancelReason } = body as {
      paymentId: string;
      amount?: number;
      cancelReason?: string;
    };

    if (!paymentId) {
      return NextResponse.json(
        { error: 'paymentId(결제 ID)가 필요합니다.' },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();
    const { data: payment, error: payErr } = await supabase
      .from('subscription_payments')
      .select('id, subscription_id, academy_id, toss_payment_key, amount, status')
      .eq('id', paymentId)
      .eq('subscription_id', subscriptionId)
      .single();

    if (payErr || !payment) {
      return NextResponse.json(
        { error: '해당 구독의 결제 건을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    if ((payment as any).status !== 'completed') {
      return NextResponse.json(
        { error: '완료된 결제만 환불할 수 있습니다.' },
        { status: 400 }
      );
    }

    const paymentKey = (payment as any).toss_payment_key;
    if (!paymentKey) {
      return NextResponse.json(
        { error: '결제 키가 없어 토스 환불을 요청할 수 없습니다.' },
        { status: 400 }
      );
    }

    const secretKey = process.env.TOSS_SECRET_KEY;
    if (!secretKey) {
      return NextResponse.json(
        { error: '결제 설정이 없습니다.' },
        { status: 500 }
      );
    }

    const cancelBody: { cancelReason: string; cancelAmount?: number } = {
      cancelReason: cancelReason ?? '관리자 환불',
    };
    if (amount != null && amount > 0) {
      cancelBody.cancelAmount = amount;
    }

    const tossRes = await fetch(
      `https://api.tosspayments.com/v1/payments/${paymentKey}/cancel`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(secretKey + ':').toString('base64')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(cancelBody),
      }
    );

    if (!tossRes.ok) {
      const errData = await tossRes.json();
      return NextResponse.json(
        { error: errData.message ?? '토스 결제 취소 실패' },
        { status: 400 }
      );
    }

    await supabase
      .from('subscription_payments')
      .update({
        status: 'refunded',
        paid_at: null,
      })
      .eq('id', paymentId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[admin/billing/subscriptions/[id]/refund] Error:', error);
    return NextResponse.json(
      { error: '환불 처리에 실패했습니다.' },
      { status: 500 }
    );
  }
}
