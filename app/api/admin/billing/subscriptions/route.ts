import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/supabase/admin-auth';
import { createServiceClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireSuperAdmin(request);
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const planId = searchParams.get('planId');
    const search = searchParams.get('search') ?? '';
    const page = parseInt(searchParams.get('page') ?? '1', 10);
    const limit = parseInt(searchParams.get('limit') ?? '20', 10);

    const supabase = createServiceClient();
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabase
      .from('academy_subscriptions')
      .select(`
        *,
        billing_plans (id, display_name, monthly_price, annual_price_per_month),
        academies (id, name_kr, name_en)
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }
    if (planId && planId !== 'all') {
      query = query.eq('plan_id', planId);
    }
    if (search) {
      // academy name search via join - use ilike on academy name
      query = query.ilike('academies.name_kr', `%${search}%`);
    }

    const { data, error, count } = await query;
    if (error) throw error;

    return NextResponse.json({ data: data ?? [], total: count ?? 0, page, limit });
  } catch (error) {
    console.error('[admin/billing/subscriptions] Error:', error);
    return NextResponse.json({ error: '구독 목록을 불러오지 못했습니다.' }, { status: 500 });
  }
}
