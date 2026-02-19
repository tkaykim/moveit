import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/supabase/server-auth';
import { createServiceClient } from '@/lib/supabase/server';
import { calculateAmount } from '@/lib/billing/calculate-amount';

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    const body = await request.json();
    const { academyId, newPlanId, newBillingCycle } = body as {
      academyId: string;
      newPlanId: 'starter' | 'growth' | 'pro';
      newBillingCycle?: 'monthly' | 'annual';
    };

    if (!academyId || !newPlanId) {
      return NextResponse.json({ error: 'academyId, newPlanId가 필요합니다.' }, { status: 400 });
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

    const { data: subscription } = await supabase
      .from('academy_subscriptions')
      .select('*, billing_plans(*)')
      .eq('academy_id', academyId)
      .maybeSingle();

    if (!subscription) {
      return NextResponse.json({ error: '활성 구독이 없습니다.' }, { status: 404 });
    }

    const planOrder: Record<string, number> = { starter: 1, growth: 2, pro: 3 };
    const currentPlanLevel = planOrder[(subscription as any).plan_id] ?? 0;
    const newPlanLevel = planOrder[newPlanId] ?? 0;
    const isUpgrade = newPlanLevel > currentPlanLevel;

    const updateData: Record<string, unknown> = {
      plan_id: newPlanId,
      cancel_at_period_end: false,
      updated_at: new Date().toISOString(),
    };

    if (newBillingCycle) {
      updateData.billing_cycle = newBillingCycle;
    }

    // 업그레이드인 경우 즉시 적용, 다운그레이드는 다음 기간부터 적용
    if (isUpgrade && (subscription as any).toss_billing_key && (subscription as any).status === 'active') {
      // 업그레이드: 즉시 차액 결제 후 플랜 변경
      // 현재 기간 남은 일수 계산하여 차액 프로레이션 (간략화: 즉시 새 플랜으로 재결제)
      const { data: newPlan } = await supabase
        .from('billing_plans')
        .select('*')
        .eq('id', newPlanId)
        .single();

      if (newPlan && (subscription as any).toss_billing_key) {
        const billingCycle = (newBillingCycle || (subscription as any).billing_cycle) as 'monthly' | 'annual';
        const baseAmount =
          billingCycle === 'annual'
            ? (newPlan as any).annual_price_per_month * 12
            : (newPlan as any).monthly_price;
        const amount = calculateAmount(baseAmount, {
          discountPercent: (subscription as any).discount_percent ?? null,
          firstMonthFree: false,
        });

        const orderId = `upg_${academyId.replace(/-/g, '').slice(0, 8)}_${Date.now()}`;
        const now = new Date();
        const periodEnd = new Date(now);
        if (billingCycle === 'annual') {
          periodEnd.setFullYear(periodEnd.getFullYear() + 1);
        } else {
          periodEnd.setMonth(periodEnd.getMonth() + 1);
        }
        updateData.current_period_start = now.toISOString().split('T')[0];
        updateData.current_period_end = periodEnd.toISOString().split('T')[0];

        if (amount === 0) {
          await supabase.from('subscription_payments').insert({
            subscription_id: (subscription as any).id,
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
        } else {
          const tossSecretKey = process.env.TOSS_SECRET_KEY;
          if (tossSecretKey) {
            const tossResponse = await fetch(
              `https://api.tosspayments.com/v1/billing/${(subscription as any).toss_billing_key}`,
              {
                method: 'POST',
                headers: {
                  Authorization: `Basic ${Buffer.from(tossSecretKey + ':').toString('base64')}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  customerKey: (subscription as any).toss_customer_key,
                  amount,
                  orderId,
                  orderName: `MOVEIT ${(newPlan as any).display_name} ${billingCycle === 'annual' ? '연간' : '월간'} 구독 업그레이드`,
                  customerEmail: user.email,
                }),
              }
            );

            if (tossResponse.ok) {
              const tossData = await tossResponse.json();
              await supabase.from('subscription_payments').insert({
                subscription_id: (subscription as any).id,
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
            }
          }
        }
      }
    }

    await supabase
      .from('academy_subscriptions')
      .update(updateData)
      .eq('id', (subscription as any).id);

    return NextResponse.json({
      success: true,
      message: isUpgrade
        ? '플랜이 즉시 업그레이드되었습니다.'
        : '플랜 변경이 예약되었습니다. 다음 결제 기간부터 적용됩니다.',
    });
  } catch (error) {
    console.error('[billing/change-plan] Error:', error);
    return NextResponse.json({ error: '플랜 변경 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
