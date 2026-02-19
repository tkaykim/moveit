import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/supabase/server-auth';
import { createServiceClient } from '@/lib/supabase/server';

// 토스페이먼츠 빌링 키 발급
// 프론트엔드에서 TossPayments.requestBillingAuth() 성공 후 받은 authKey로 서버에서 빌링키를 발급받아 저장
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    const body = await request.json();
    const { authKey, customerKey, academyId } = body;

    if (!authKey || !customerKey || !academyId) {
      return NextResponse.json({ error: 'authKey, customerKey, academyId가 필요합니다.' }, { status: 400 });
    }

    const supabase = createServiceClient();

    // 권한 확인
    const { data: profile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    const isSuperAdmin = (profile as any)?.role === 'SUPER_ADMIN';
    if (!isSuperAdmin) {
      const { data: academyRole } = await supabase
        .from('academy_user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('academy_id', academyId)
        .single();

      if (!academyRole || !['ACADEMY_OWNER', 'ACADEMY_MANAGER'].includes((academyRole as any).role)) {
        return NextResponse.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
      }
    }

    const tossSecretKey = process.env.TOSS_SECRET_KEY;
    if (!tossSecretKey) {
      return NextResponse.json({ error: '결제 설정이 완료되지 않았습니다.' }, { status: 500 });
    }

    // 토스페이먼츠 빌링 키 발급 API 호출
    const tossResponse = await fetch('https://api.tosspayments.com/v1/billing/authorizations/issue', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(tossSecretKey + ':').toString('base64')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ authKey, customerKey }),
    });

    if (!tossResponse.ok) {
      const errorData = await tossResponse.json();
      console.error('[billing/request-billing-auth] Toss API error:', errorData);
      return NextResponse.json(
        { error: errorData.message || '카드 등록에 실패했습니다.' },
        { status: tossResponse.status }
      );
    }

    const tossData = await tossResponse.json();
    const { billingKey, card } = tossData;

    // DB에 저장: 구독이 있으면 카드만 갱신, 없으면 card_only(플랜 미선택)로 생성
    const { data: existingSub } = await supabase
      .from('academy_subscriptions')
      .select('id, status')
      .eq('academy_id', academyId)
      .maybeSingle();

    if (existingSub) {
      await supabase
        .from('academy_subscriptions')
        .update({
          toss_customer_key: customerKey,
          toss_billing_key: billingKey,
          card_company: card?.company ?? null,
          card_number_masked: card?.number ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingSub.id);
    } else {
      // 카드만 등록. 플랜 선택 후 결제 시 구독(trial/active) 시작
      await supabase.from('academy_subscriptions').insert({
        academy_id: academyId,
        plan_id: 'starter',
        billing_cycle: 'monthly',
        status: 'card_only',
        toss_customer_key: customerKey,
        toss_billing_key: billingKey,
        card_company: card?.company ?? null,
        card_number_masked: card?.number ?? null,
      });
    }

    return NextResponse.json({
      success: true,
      card: {
        company: card?.company,
        number: card?.number,
      },
    });
  } catch (error) {
    console.error('[billing/request-billing-auth] Error:', error);
    return NextResponse.json({ error: '카드 등록 처리 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
