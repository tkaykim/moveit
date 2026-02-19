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
    if (!academyId) {
      return NextResponse.json({ error: 'academyId가 필요합니다.' }, { status: 400 });
    }

    const supabase = createServiceClient();

    // 권한 확인: SUPER_ADMIN이거나 해당 학원의 OWNER/MANAGER인지
    const { data: profile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: '프로필을 찾을 수 없습니다.' }, { status: 404 });
    }

    const isSuperAdmin = (profile as any).role === 'SUPER_ADMIN';
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

    // 구독 정보 조회
    const { data: subscription, error } = await supabase
      .from('academy_subscriptions')
      .select(`
        *,
        billing_plans (*)
      `)
      .eq('academy_id', academyId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    return NextResponse.json(subscription);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    const isMissingTable = /relation .* does not exist|no such table/i.test(message);
    console.error('[billing/subscription] Error:', error);
    if (isMissingTable) {
      console.error('[billing/subscription] billing 테이블이 없을 수 있습니다. supabase/migrations/20250219000000_billing.sql 적용 여부를 확인하세요.');
    }
    return NextResponse.json(
      { error: isMissingTable ? '구독 정보를 불러올 수 없습니다. billing DB 마이그레이션이 적용되었는지 확인하세요.' : '구독 정보를 불러오지 못했습니다.' },
      { status: 500 }
    );
  }
}
