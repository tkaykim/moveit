import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/supabase/server-auth';
import { createServiceClient } from '@/lib/supabase/server';
import { calculateAmount } from '@/lib/billing/calculate-amount';

function getNextPeriodEnd(start: Date, cycle: 'monthly' | 'annual'): Date {
  const end = new Date(start);
  if (cycle === 'monthly') {
    end.setMonth(end.getMonth() + 1);
  } else {
    end.setFullYear(end.getFullYear() + 1);
  }
  return end;
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    const body = await request.json();
    const { academyId, planId, billingCycle } = body as {
      academyId: string;
      planId: 'starter' | 'growth' | 'pro';
      billingCycle: 'monthly' | 'annual';
    };

    if (!academyId || !planId || !billingCycle) {
      return NextResponse.json({ error: 'academyId, planId, billingCycle이 필요합니다.' }, { status: 400 });
    }

    const supabase = createServiceClient();

    // 권한 확인
    const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single();
    const isSuperAdmin = (profile as any)?.role === 'SUPER_ADMIN';
    if (!isSuperAdmin) {
      const { data: academyRole } = await supabase
        .from('academy_user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('academy_id', academyId)
        .single();
      if (!academyRole) {
        return NextResponse.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
      }
    }

    // 현재 구독 & 플랜 정보 조회
    const { data: subscription } = await supabase
      .from('academy_subscriptions')
      .select('*, billing_plans(*)')
      .eq('academy_id', academyId)
      .maybeSingle();

    if (!subscription?.toss_billing_key) {
      return NextResponse.json({ error: '등록된 결제 수단이 없습니다. 먼저 카드를 등록해주세요.' }, { status: 400 });
    }

    const { data: plan } = await supabase
      .from('billing_plans')
      .select('*')
      .eq('id', planId)
      .single();

    if (!plan) {
      return NextResponse.json({ error: '유효하지 않은 플랜입니다.' }, { status: 400 });
    }

    const baseAmount =
      billingCycle === 'annual'
        ? (plan as any).annual_price_per_month * 12
        : (plan as any).monthly_price;
    const amount = calculateAmount(baseAmount, {
      discountPercent: (subscription as any).discount_percent ?? null,
      firstMonthFree: (subscription as any).first_month_free ?? false,
    });

    const { data: academy } = await supabase
      .from('academies')
      .select('name_kr, name_en')
      .eq('id', academyId)
      .single();

    const academyName = (academy as any)?.name_kr || (academy as any)?.name_en || '학원';
    const planName = (plan as any).display_name;
    const cycleName = billingCycle === 'annual' ? '연간' : '월간';

    const orderId = `sub_${academyId.replace(/-/g, '').slice(0, 8)}_${Date.now()}`;
    const orderName = `MOVEIT ${planName} ${cycleName} 구독`;

    const now = new Date();
    const periodEnd = getNextPeriodEnd(now, billingCycle);

    if (amount === 0) {
      // 프로모 적용으로 0원: 토스 호출 없이 구독 시작
      await supabase
        .from('academy_subscriptions')
        .update({
          plan_id: planId,
          billing_cycle: billingCycle,
          status: 'active',
          current_period_start: now.toISOString().split('T')[0],
          current_period_end: periodEnd.toISOString().split('T')[0],
          cancel_at_period_end: false,
          updated_at: now.toISOString(),
        })
        .eq('id', subscription.id);

      await supabase.from('subscription_payments').insert({
        subscription_id: subscription.id,
        academy_id: academyId,
        amount: 0,
        billing_cycle: billingCycle,
        period_start: now.toISOString().split('T')[0],
        period_end: periodEnd.toISOString().split('T')[0],
        toss_payment_key: null,
        toss_order_id: orderId,
        status: 'completed',
        paid_at: now.toISOString(),
      });

      return NextResponse.json({ success: true, periodEnd: periodEnd.toISOString().split('T')[0] });
    }

    const tossSecretKey = process.env.TOSS_SECRET_KEY;
    if (!tossSecretKey) {
      return NextResponse.json({ error: '결제 설정이 완료되지 않았습니다.' }, { status: 500 });
    }

    const tossResponse = await fetch(
      `https://api.tosspayments.com/v1/billing/${subscription.toss_billing_key}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(tossSecretKey + ':').toString('base64')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customerKey: subscription.toss_customer_key,
          amount,
          orderId,
          orderName,
          customerEmail: user.email,
          customerName: academyName,
        }),
      }
    );

    if (tossResponse.ok) {
      const tossData = await tossResponse.json();

      await supabase
        .from('academy_subscriptions')
        .update({
          plan_id: planId,
          billing_cycle: billingCycle,
          status: 'active',
          current_period_start: now.toISOString().split('T')[0],
          current_period_end: periodEnd.toISOString().split('T')[0],
          cancel_at_period_end: false,
          updated_at: now.toISOString(),
        })
        .eq('id', subscription.id);

      await supabase.from('subscription_payments').insert({
        subscription_id: subscription.id,
        academy_id: academyId,
        amount,
        billing_cycle: billingCycle,
        period_start: now.toISOString().split('T')[0],
        period_end: periodEnd.toISOString().split('T')[0],
        toss_payment_key: tossData.paymentKey,
        toss_order_id: orderId,
        status: 'completed',
        paid_at: now.toISOString(),
      });

      return NextResponse.json({ success: true, periodEnd: periodEnd.toISOString().split('T')[0] });
    } else {
      const errorData = await tossResponse.json();
      console.error('[billing/subscribe] Toss payment failed:', errorData);

      await supabase
        .from('academy_subscriptions')
        .update({ status: 'past_due', updated_at: now.toISOString() })
        .eq('id', subscription.id);

      const retryAt = new Date(now);
      retryAt.setDate(retryAt.getDate() + 3);
      await supabase.from('subscription_payments').insert({
        subscription_id: subscription.id,
        academy_id: academyId,
        amount,
        billing_cycle: billingCycle,
        toss_order_id: orderId,
        status: 'failed',
        failure_code: errorData.code,
        failure_message: errorData.message,
        retry_count: 0,
        next_retry_at: retryAt.toISOString(),
      });

      return NextResponse.json(
        { error: errorData.message || '결제에 실패했습니다.' },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('[billing/subscribe] Error:', error);
    return NextResponse.json({ error: '구독 처리 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
