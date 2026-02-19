import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { createServiceClient } from '@/lib/supabase/server';

// 토스페이먼츠 웹훅 처리
// 토스페이먼츠 대시보드에서 웹훅 URL: https://your-domain.com/api/billing/webhook
export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const body = JSON.parse(rawBody) as { eventType?: string; data?: { paymentKey?: string; orderId?: string; status?: string; createdAt?: string }; createdAt?: string };
    const { eventType, data } = body;

    const eventId =
      (body as any).eventId ??
      createHash('sha256').update(rawBody).digest('hex');

    // 서명 검증: TOSS_WEBHOOK_SECRET과 헤더가 모두 있을 때만 검증. 헤더 없으면 기존처럼 처리(토스가 일부 이벤트만 서명 전송할 수 있음).
    const signature = request.headers.get('tosspayments-webhook-signature') ?? request.headers.get('x-webhook-signature');
    if (process.env.TOSS_WEBHOOK_SECRET && signature) {
      const expected = createHash('sha256')
        .update(process.env.TOSS_WEBHOOK_SECRET + rawBody)
        .digest('hex');
      if (signature !== expected) {
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }
    }

    const supabase = createServiceClient();

    const { data: existing } = await supabase
      .from('billing_webhook_events')
      .select('id')
      .eq('event_id', eventId)
      .maybeSingle();
    if (existing) {
      return NextResponse.json({ received: true, duplicate: true });
    }

    console.log('[billing/webhook] Received event:', eventType, data?.paymentKey);

    if (eventType === 'PAYMENT_STATUS_CHANGED' && data) {
      const { paymentKey, orderId, status } = data;
      if (orderId) {
      // orderId로 결제 이력 찾기
      const { data: payment } = await supabase
        .from('subscription_payments')
        .select('id, subscription_id')
        .eq('toss_order_id', orderId)
        .maybeSingle();

      if (payment) {
        const mappedStatus =
          status === 'DONE' ? 'completed'
          : status === 'CANCELED' ? 'refunded'
          : status === 'ABORTED' ? 'failed'
          : null;

        if (mappedStatus) {
          await supabase
            .from('subscription_payments')
            .update({
              status: mappedStatus,
              toss_payment_key: paymentKey,
              paid_at: status === 'DONE' ? new Date().toISOString() : null,
            })
            .eq('id', (payment as any).id);

          // 환불된 경우 구독 상태 업데이트
          if (mappedStatus === 'refunded') {
            await supabase
              .from('academy_subscriptions')
              .update({ status: 'canceled', updated_at: new Date().toISOString() })
              .eq('id', (payment as any).subscription_id);
          }
        }
      }
      }
    }

    if (eventType === 'BILLING_KEY_DELETED' && data) {
      const customerKey = (data as { customerKey?: string }).customerKey;
      if (customerKey) {
        await supabase
          .from('academy_subscriptions')
          .update({
            toss_billing_key: null,
            status: 'past_due',
            updated_at: new Date().toISOString(),
          })
          .eq('toss_customer_key', customerKey);
      }
    }

    await supabase.from('billing_webhook_events').insert({
      event_id: eventId,
      event_type: eventType ?? null,
      payload_snapshot: body?.data ? { paymentKey: (body.data as any).paymentKey, orderId: (body.data as any).orderId, status: (body.data as any).status } : null,
    });

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('[billing/webhook] Error:', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
