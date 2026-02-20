import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { calculateAmount } from '@/lib/billing/calculate-amount';

// Vercel Cron: 매일 KST 자정 (UTC 15:00) 실행
// vercel.json: { "crons": [{ "path": "/api/cron/auto-charge", "schedule": "0 15 * * *" }] }
export async function GET(request: NextRequest) {
  // CRON_SECRET 검증
  const secret = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && secret !== `Bearer ${cronSecret}`) {
    // Vercel Cron은 VERCEL_CRON_SECRET 헤더를 자동으로 추가함
    // 개발 환경에서는 CRON_SECRET이 없을 수 있음
    const isVercelCron = request.headers.get('x-vercel-cron') === '1';
    if (!isVercelCron) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const supabase = createServiceClient();
  const today = new Date().toISOString().split('T')[0];
  const results = { charged: 0, failed: 0, trialExpired: 0, errors: [] as string[] };

  try {
    // 1. 오늘 만료되는 활성 구독 자동결제
    const { data: dueSubscriptions } = await supabase
      .from('academy_subscriptions')
      .select('*, billing_plans(*), academies(name_kr, name_en)')
      .eq('status', 'active')
      .lte('current_period_end', today)
      .not('toss_billing_key', 'is', null);

    const tossSecretKey = process.env.TOSS_SECRET_KEY;

    for (const sub of dueSubscriptions ?? []) {
      const s = sub as any;
      try {
        const billingCycle = s.billing_cycle as 'monthly' | 'annual';
        const baseAmount =
          billingCycle === 'annual'
            ? s.billing_plans.annual_price_per_month * 12
            : s.billing_plans.monthly_price;

        const { count: completedCount } = await supabase
          .from('subscription_payments')
          .select('id', { count: 'exact', head: true })
          .eq('subscription_id', s.id)
          .eq('status', 'completed');
        const firstMonthFree =
          (s.first_month_free === true && (completedCount ?? 0) === 0);
        const amount = calculateAmount(baseAmount, {
          discountPercent: s.discount_percent ?? null,
          firstMonthFree,
        });

        const academyName = s.academies?.name_kr || s.academies?.name_en || '학원';
        const orderId = `auto_${s.academy_id.replace(/-/g, '').slice(0, 8)}_${Date.now()}`;
        const now = new Date();
        const newPeriodStart = today;
        const newPeriodEnd = new Date(today);
        if (billingCycle === 'annual') {
          newPeriodEnd.setFullYear(newPeriodEnd.getFullYear() + 1);
        } else {
          newPeriodEnd.setMonth(newPeriodEnd.getMonth() + 1);
        }
        const newPeriodEndStr = newPeriodEnd.toISOString().split('T')[0];

        if (amount === 0) {
          if (s.cancel_at_period_end) {
            await supabase
              .from('academy_subscriptions')
              .update({
                status: 'canceled',
                canceled_at: now.toISOString(),
                updated_at: now.toISOString(),
              })
              .eq('id', s.id);
          } else {
            await supabase
              .from('academy_subscriptions')
              .update({
                current_period_start: newPeriodStart,
                current_period_end: newPeriodEndStr,
                grace_period_end: null,
                updated_at: now.toISOString(),
              })
              .eq('id', s.id);
          }
          await supabase.from('subscription_payments').insert({
            subscription_id: s.id,
            academy_id: s.academy_id,
            amount: 0,
            billing_cycle: billingCycle,
            period_start: newPeriodStart,
            period_end: newPeriodEndStr,
            toss_payment_key: null,
            toss_order_id: orderId,
            status: 'completed',
            paid_at: now.toISOString(),
          });
          results.charged++;
          continue;
        }

        if (!tossSecretKey) {
          results.errors.push(`No TOSS_SECRET_KEY for sub ${s.id}`);
          continue;
        }

        const tossResponse = await fetch(
          `https://api.tosspayments.com/v1/billing/${s.toss_billing_key}`,
          {
            method: 'POST',
            headers: {
              Authorization: `Basic ${Buffer.from(tossSecretKey + ':').toString('base64')}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              customerKey: s.toss_customer_key,
              amount,
              orderId,
              orderName: `MOVEIT ${s.billing_plans.display_name} ${billingCycle === 'annual' ? '연간' : '월간'} 구독`,
              customerName: academyName,
            }),
          }
        );

        const nowLoop = new Date();
        if (tossResponse.ok) {
          const tossData = await tossResponse.json();

          if (s.cancel_at_period_end) {
            await supabase
              .from('academy_subscriptions')
              .update({
                status: 'canceled',
                canceled_at: nowLoop.toISOString(),
                updated_at: nowLoop.toISOString(),
              })
              .eq('id', s.id);
          } else {
            await supabase
              .from('academy_subscriptions')
              .update({
                current_period_start: newPeriodStart,
                current_period_end: newPeriodEndStr,
                grace_period_end: null,
                updated_at: nowLoop.toISOString(),
              })
              .eq('id', s.id);
          }

          await supabase.from('subscription_payments').insert({
            subscription_id: s.id,
            academy_id: s.academy_id,
            amount,
            billing_cycle: billingCycle,
            period_start: newPeriodStart,
            period_end: newPeriodEndStr,
            toss_payment_key: tossData.paymentKey,
            toss_order_id: orderId,
            status: 'completed',
            paid_at: nowLoop.toISOString(),
          });

          results.charged++;
        } else {
          const errorData = await tossResponse.json();
          const retryAt = new Date(nowLoop);
          retryAt.setDate(retryAt.getDate() + 3);
          const graceEnd = new Date(nowLoop);
          graceEnd.setDate(graceEnd.getDate() + 7);
          const graceEndStr = graceEnd.toISOString().split('T')[0];

          await supabase
            .from('academy_subscriptions')
            .update({
              status: 'past_due',
              grace_period_end: graceEndStr,
              updated_at: nowLoop.toISOString(),
            })
            .eq('id', s.id);

          await supabase.from('subscription_payments').insert({
            subscription_id: s.id,
            academy_id: s.academy_id,
            amount,
            billing_cycle: billingCycle,
            toss_order_id: orderId,
            status: 'failed',
            failure_code: errorData.code,
            failure_message: errorData.message,
            retry_count: 0,
            next_retry_at: retryAt.toISOString(),
          });

          results.failed++;
        }
      } catch (err) {
        results.errors.push(`Sub ${s.id}: ${String(err)}`);
        results.failed++;
      }
    }

    // 2. 만료된 trial 구독: 첫 결제 시도 (성공 시 active, 실패 시 past_due). completed 건 0개인 경우만
    const { data: expiredTrials } = await supabase
      .from('academy_subscriptions')
      .select('id, academy_id, plan_id, billing_cycle, toss_billing_key, toss_customer_key, discount_percent, first_month_free')
      .eq('status', 'trial')
      .lte('trial_ends_at', today)
      .not('toss_billing_key', 'is', null);

    for (const trial of expiredTrials ?? []) {
      const t = trial as any;
      const { count: completedCount } = await supabase
        .from('subscription_payments')
        .select('id', { count: 'exact', head: true })
        .eq('subscription_id', t.id)
        .eq('status', 'completed');
      if ((completedCount ?? 0) > 0) {
        await supabase
          .from('academy_subscriptions')
          .update({ status: 'expired', updated_at: new Date().toISOString() })
          .eq('id', t.id);
        results.trialExpired++;
        continue;
      }

      const { data: planRow } = await supabase
        .from('billing_plans')
        .select('monthly_price, annual_price_per_month, display_name')
        .eq('id', t.plan_id)
        .single();
      const { data: academyRow } = await supabase
        .from('academies')
        .select('name_kr, name_en')
        .eq('id', t.academy_id)
        .single();

      const billingCycle = (t.billing_cycle || 'monthly') as 'monthly' | 'annual';
      const baseAmount =
        billingCycle === 'annual'
          ? (planRow as any)?.annual_price_per_month * 12
          : (planRow as any)?.monthly_price ?? 0;
      const amount = calculateAmount(baseAmount, {
        discountPercent: t.discount_percent ?? null,
        firstMonthFree: t.first_month_free ?? false,
      });

      const orderId = `trial_${t.academy_id.replace(/-/g, '').slice(0, 8)}_${Date.now()}`;
      const nowLoop = new Date();
      const newPeriodStart = today;
      const newPeriodEnd = new Date(today);
      if (billingCycle === 'annual') {
        newPeriodEnd.setFullYear(newPeriodEnd.getFullYear() + 1);
      } else {
        newPeriodEnd.setMonth(newPeriodEnd.getMonth() + 1);
      }
      const newPeriodEndStr = newPeriodEnd.toISOString().split('T')[0];
      const academyName = (academyRow as any)?.name_kr || (academyRow as any)?.name_en || '학원';
      const planName = (planRow as any)?.display_name ?? '';

      if (!tossSecretKey) {
        results.errors.push(`No TOSS_SECRET_KEY for trial sub ${t.id}`);
        await supabase
          .from('academy_subscriptions')
          .update({ status: 'expired', updated_at: nowLoop.toISOString() })
          .eq('id', t.id);
        results.trialExpired++;
        continue;
      }

      try {
        const tossResponse = await fetch(
          `https://api.tosspayments.com/v1/billing/${t.toss_billing_key}`,
          {
            method: 'POST',
            headers: {
              Authorization: `Basic ${Buffer.from(tossSecretKey + ':').toString('base64')}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              customerKey: t.toss_customer_key,
              amount,
              orderId,
              orderName: `MOVEIT ${planName} ${billingCycle === 'annual' ? '연간' : '월간'} 구독`,
              customerName: academyName,
            }),
          }
        );

        if (tossResponse.ok) {
          const tossData = await tossResponse.json();
          await supabase
            .from('academy_subscriptions')
            .update({
              status: 'active',
              current_period_start: newPeriodStart,
              current_period_end: newPeriodEndStr,
              grace_period_end: null,
              updated_at: nowLoop.toISOString(),
            })
            .eq('id', t.id);
          await supabase.from('subscription_payments').insert({
            subscription_id: t.id,
            academy_id: t.academy_id,
            amount,
            billing_cycle: billingCycle,
            period_start: newPeriodStart,
            period_end: newPeriodEndStr,
            toss_payment_key: tossData.paymentKey,
            toss_order_id: orderId,
            status: 'completed',
            paid_at: nowLoop.toISOString(),
          });
          results.charged++;
        } else {
          const errorData = await tossResponse.json();
          const retryAt = new Date(nowLoop);
          retryAt.setDate(retryAt.getDate() + 3);
          const graceEnd = new Date(nowLoop);
          graceEnd.setDate(graceEnd.getDate() + 7);
          const graceEndStr = graceEnd.toISOString().split('T')[0];
          await supabase
            .from('academy_subscriptions')
            .update({
              status: 'past_due',
              grace_period_end: graceEndStr,
              updated_at: nowLoop.toISOString(),
            })
            .eq('id', t.id);
          await supabase.from('subscription_payments').insert({
            subscription_id: t.id,
            academy_id: t.academy_id,
            amount,
            billing_cycle: billingCycle,
            toss_order_id: orderId,
            status: 'failed',
            failure_code: errorData.code,
            failure_message: errorData.message,
            retry_count: 0,
            next_retry_at: retryAt.toISOString(),
          });
          results.failed++;
        }
      } catch (err) {
        results.errors.push(`Trial sub ${t.id}: ${String(err)}`);
        await supabase
          .from('academy_subscriptions')
          .update({ status: 'expired', updated_at: nowLoop.toISOString() })
          .eq('id', t.id);
        results.trialExpired++;
      }
    }

    // 3. past_due 재시도: 가장 최근 실패 건 중 next_retry_at <= now(), retry_count < 3
    const nowIso = new Date().toISOString();
    const { data: retryPayments } = await supabase
      .from('subscription_payments')
      .select('id, subscription_id, academy_id, amount, billing_cycle, retry_count, next_retry_at')
      .eq('status', 'failed')
      .lte('next_retry_at', nowIso)
      .lt('retry_count', 3)
      .order('created_at', { ascending: false });

    const seenSubIds = new Set<string>();
    const retryList: { paymentId: string; subscription_id: string; academy_id: string; amount: number; billing_cycle: string }[] = [];
    for (const p of retryPayments ?? []) {
      const pm = p as { subscription_id: string; id: string; academy_id: string; amount: number; billing_cycle: string };
      if (seenSubIds.has(pm.subscription_id)) continue;
      seenSubIds.add(pm.subscription_id);
      retryList.push({
        paymentId: pm.id,
        subscription_id: pm.subscription_id,
        academy_id: pm.academy_id,
        amount: pm.amount,
        billing_cycle: pm.billing_cycle,
      });
    }

    for (const item of retryList) {
      if (!tossSecretKey) continue;
      const { data: sub } = await supabase
        .from('academy_subscriptions')
        .select('*, billing_plans(*), academies(name_kr, name_en)')
        .eq('id', item.subscription_id)
        .not('toss_billing_key', 'is', null)
        .single();
      if (!sub) continue;
      const s = sub as any;
      const orderId = `retry_${item.academy_id.replace(/-/g, '').slice(0, 8)}_${Date.now()}`;
      const now = new Date();

      try {
        const tossResponse = await fetch(
          `https://api.tosspayments.com/v1/billing/${s.toss_billing_key}`,
          {
            method: 'POST',
            headers: {
              Authorization: `Basic ${Buffer.from(tossSecretKey + ':').toString('base64')}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              customerKey: s.toss_customer_key,
              amount: item.amount,
              orderId,
              orderName: `MOVEIT ${s.billing_plans?.display_name ?? ''} 구독 재결제`,
              customerName: s.academies?.name_kr || s.academies?.name_en || '학원',
            }),
          }
        );

        if (tossResponse.ok) {
          const tossData = await tossResponse.json();
          const newPeriodEnd = new Date(today);
          if (item.billing_cycle === 'annual') {
            newPeriodEnd.setFullYear(newPeriodEnd.getFullYear() + 1);
          } else {
            newPeriodEnd.setMonth(newPeriodEnd.getMonth() + 1);
          }
          const newPeriodEndStr = newPeriodEnd.toISOString().split('T')[0];

          await supabase
            .from('academy_subscriptions')
            .update({
              status: 'active',
              current_period_start: today,
              current_period_end: newPeriodEndStr,
              grace_period_end: null,
              updated_at: now.toISOString(),
            })
            .eq('id', item.subscription_id);

          await supabase.from('subscription_payments').insert({
            subscription_id: item.subscription_id,
            academy_id: item.academy_id,
            amount: item.amount,
            billing_cycle: item.billing_cycle,
            period_start: today,
            period_end: newPeriodEndStr,
            toss_payment_key: tossData.paymentKey,
            toss_order_id: orderId,
            status: 'completed',
            paid_at: now.toISOString(),
          });

          results.charged++;
        } else {
          const errorData = await tossResponse.json();
          const retryAt = new Date(now);
          retryAt.setDate(retryAt.getDate() + 3);
          const { data: cur } = await supabase
            .from('subscription_payments')
            .select('retry_count')
            .eq('id', item.paymentId)
            .single();
          const nextCount = ((cur as any)?.retry_count ?? 0) + 1;
          await supabase
            .from('subscription_payments')
            .update({
              retry_count: nextCount,
              next_retry_at: retryAt.toISOString(),
              failure_code: errorData.code,
              failure_message: errorData.message,
            })
            .eq('id', item.paymentId);
        }
      } catch (_) {
        // 재시도 예외 시 해당 payment의 next_retry_at만 갱신해 다음 cron에서 재시도
        const retryAt = new Date(now);
        retryAt.setDate(retryAt.getDate() + 3);
        const { data: cur } = await supabase
          .from('subscription_payments')
          .select('retry_count')
          .eq('id', item.paymentId)
          .single();
        const nextCount = ((cur as any)?.retry_count ?? 0) + 1;
        await supabase
          .from('subscription_payments')
          .update({
            retry_count: nextCount,
            next_retry_at: retryAt.toISOString(),
          })
          .eq('id', item.paymentId);
      }
    }

    console.log('[cron/auto-charge] Done:', results);
    return NextResponse.json({ success: true, ...results });
  } catch (error) {
    console.error('[cron/auto-charge] Error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
