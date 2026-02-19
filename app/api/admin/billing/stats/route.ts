import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/supabase/admin-auth';
import { createServiceClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireSuperAdmin(request);
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const supabase = createServiceClient();

    // 전체 구독 목록 조회 (통계용)
    const { data: subscriptions, error } = await supabase
      .from('academy_subscriptions')
      .select('status, plan_id, billing_cycle, billing_plans(monthly_price, annual_price_per_month)');

    if (error) throw error;

    const subs = subscriptions ?? [];
    const byStatus = { trial: 0, active: 0, past_due: 0, canceled: 0, expired: 0 };
    const byPlan: Record<string, number> = { starter: 0, growth: 0, pro: 0 };
    const byCycle = { monthly: 0, annual: 0 };
    let mrr = 0;

    for (const sub of subs) {
      const s = sub as any;
      if (s.status in byStatus) byStatus[s.status as keyof typeof byStatus]++;
      if (s.plan_id in byPlan) byPlan[s.plan_id]++;
      if (s.billing_cycle in byCycle) byCycle[s.billing_cycle as keyof typeof byCycle]++;

      // MRR 계산: 활성 구독만
      if (s.status === 'active' && s.billing_plans) {
        if (s.billing_cycle === 'monthly') {
          mrr += s.billing_plans.monthly_price;
        } else {
          mrr += s.billing_plans.annual_price_per_month;
        }
      }
    }

    // 최근 결제 10건
    const { data: recentPayments } = await supabase
      .from('subscription_payments')
      .select('*, academies(name_kr, name_en)')
      .order('created_at', { ascending: false })
      .limit(10);

    return NextResponse.json({
      total_subscriptions: subs.length,
      active_subscriptions: byStatus.active,
      trial_subscriptions: byStatus.trial,
      past_due_subscriptions: byStatus.past_due,
      canceled_subscriptions: byStatus.canceled,
      expired_subscriptions: byStatus.expired,
      mrr,
      arr: mrr * 12,
      by_plan: byPlan,
      by_cycle: byCycle,
      recent_payments: recentPayments ?? [],
    });
  } catch (error) {
    console.error('[admin/billing/stats] Error:', error);
    return NextResponse.json({ error: '통계를 불러오지 못했습니다.' }, { status: 500 });
  }
}
