import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/supabase/server-auth';
import { createServiceClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    const body = await request.json();
    const { academyId, reason } = body as { academyId: string; reason?: string };

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
        .in('role', ['ACADEMY_OWNER'])
        .single();
      if (!academyRole) {
        return NextResponse.json({ error: '구독 취소 권한이 없습니다. 학원 소유자만 취소할 수 있습니다.' }, { status: 403 });
      }
    }

    const { data: subscription } = await supabase
      .from('academy_subscriptions')
      .select('id, status')
      .eq('academy_id', academyId)
      .maybeSingle();

    if (!subscription) {
      return NextResponse.json({ error: '활성 구독이 없습니다.' }, { status: 404 });
    }

    if (['canceled', 'expired'].includes((subscription as any).status)) {
      return NextResponse.json({ error: '이미 취소된 구독입니다.' }, { status: 400 });
    }

    // 기간 말 취소 설정 (즉시 취소 아님 - 현재 기간 종료 시 취소)
    await supabase
      .from('academy_subscriptions')
      .update({
        cancel_at_period_end: true,
        cancellation_reason: reason ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', (subscription as any).id);

    return NextResponse.json({ success: true, message: '구독이 현재 결제 기간 종료 시 취소됩니다.' });
  } catch (error) {
    console.error('[billing/cancel] Error:', error);
    return NextResponse.json({ error: '구독 취소 처리 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
