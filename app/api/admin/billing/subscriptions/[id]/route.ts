import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/supabase/admin-auth';
import { createServiceClient } from '@/lib/supabase/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireSuperAdmin(request);
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { id } = await params;
    const supabase = createServiceClient();

    const { data: subscription, error } = await supabase
      .from('academy_subscriptions')
      .select(`
        *,
        billing_plans (*),
        academies (id, name_kr, name_en, contact_number)
      `)
      .eq('id', id)
      .single();

    if (error || !subscription) {
      return NextResponse.json({ error: '구독을 찾을 수 없습니다.' }, { status: 404 });
    }

    const { data: payments } = await supabase
      .from('subscription_payments')
      .select('*')
      .eq('subscription_id', id)
      .order('created_at', { ascending: false })
      .limit(20);

    return NextResponse.json({ subscription, payments: payments ?? [] });
  } catch (error) {
    console.error('[admin/billing/subscriptions/[id]] GET Error:', error);
    return NextResponse.json({ error: '구독 정보를 불러오지 못했습니다.' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireSuperAdmin(request);
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { id } = await params;
    const body = await request.json();
    const {
      planId,
      billingCycle,
      status,
      trialEndsAt,
      cancelAtPeriodEnd,
      currentPeriodEnd,
      gracePeriodEnd,
    } = body;

    const supabase = createServiceClient();

    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (planId !== undefined) updateData.plan_id = planId;
    if (billingCycle !== undefined) updateData.billing_cycle = billingCycle;
    if (status !== undefined) updateData.status = status;
    if (trialEndsAt !== undefined) updateData.trial_ends_at = trialEndsAt;
    if (cancelAtPeriodEnd !== undefined) updateData.cancel_at_period_end = cancelAtPeriodEnd;
    if (currentPeriodEnd !== undefined) updateData.current_period_end = currentPeriodEnd;
    if (gracePeriodEnd !== undefined) updateData.grace_period_end = gracePeriodEnd;

    const { error } = await supabase
      .from('academy_subscriptions')
      .update(updateData)
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[admin/billing/subscriptions/[id]] PATCH Error:', error);
    return NextResponse.json({ error: '구독 수정에 실패했습니다.' }, { status: 500 });
  }
}
