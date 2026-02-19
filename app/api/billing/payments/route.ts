import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/supabase/server-auth';
import { createServiceClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const academyId = searchParams.get('academyId');
    const page = parseInt(searchParams.get('page') ?? '1', 10);
    const limit = parseInt(searchParams.get('limit') ?? '10', 10);

    if (!academyId) {
      return NextResponse.json({ error: 'academyId가 필요합니다.' }, { status: 400 });
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

    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data, error, count } = await supabase
      .from('subscription_payments')
      .select('*', { count: 'exact' })
      .eq('academy_id', academyId)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) throw error;

    return NextResponse.json({ data: data ?? [], total: count ?? 0, page, limit });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    const isMissingTable = /relation .* does not exist|no such table/i.test(message);
    console.error('[billing/payments] Error:', error);
    if (isMissingTable) {
      console.error('[billing/payments] subscription_payments 테이블이 없습니다. supabase/migrations/20250219000000_billing.sql 적용하세요.');
    }
    return NextResponse.json(
      { error: isMissingTable ? '결제 이력을 불러올 수 없습니다. billing DB 마이그레이션이 적용되었는지 확인하세요.' : '결제 이력을 불러오지 못했습니다.' },
      { status: 500 }
    );
  }
}
