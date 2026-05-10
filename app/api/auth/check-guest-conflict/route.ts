import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { normalizeGuestEmail, normalizeGuestPhone } from '@/lib/utils/guest-normalize';

/**
 * 2026-05-10: 비회원 결제 폼에서 이름/이메일/전화 입력 후 "다음" 클릭 시
 * 즉시 정식 회원과 충돌하는지 사전 검사하기 위한 endpoint.
 *
 * 기존 흐름은 입금자명 drawer 또는 토스 위젯까지 진입한 뒤 서버 POST 응답
 * (409 EMAIL/PHONE_BELONGS_TO_MEMBER) 으로만 충돌을 알려서, 사용자가 한참
 * 진행한 뒤 "이미 가입된 계정" 안내를 받게 되는 UX 결함이 있었음.
 *
 * 이 endpoint 는 결제 행위가 일어나기 전 단순 lookup 만 수행하므로 사이드
 * 이펙트(주문/유저 생성) 가 없고, 클라이언트가 결과에 따라 즉시 AuthModal
 * 로 분기 가능.
 *
 * Body: { email?, phone? }
 * Response 200: { conflict: boolean, code?: 'EMAIL_BELONGS_TO_MEMBER' |
 *                  'PHONE_BELONGS_TO_MEMBER' | 'EMAIL_OR_PHONE_BELONGS_TO_MEMBER' }
 *
 * 정책: is_guest=true row 는 충돌이 아님(향후 게스트 결제 흐름이 본인 row 를
 * 재사용하므로). is_guest=false 인 회원이 이미 같은 email/phone 을 보유하고
 * 있을 때만 conflict=true.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const email = normalizeGuestEmail(body?.email);
    const phone = normalizeGuestPhone(body?.phone);

    if (!email && !phone) {
      return NextResponse.json({ conflict: false });
    }

    const supabase = createServiceClient() as any;

    let emailMatch: { id: string; is_guest: boolean | null } | null = null;
    if (email) {
      const { data } = await supabase
        .from('users')
        .select('id, is_guest')
        .ilike('email', email)
        .limit(1)
        .maybeSingle();
      emailMatch = data ?? null;
    }

    let phoneMatch: { id: string; is_guest: boolean | null } | null = null;
    if (phone) {
      const { data } = await supabase
        .from('users')
        .select('id, is_guest')
        .eq('phone', phone)
        .limit(1)
        .maybeSingle();
      phoneMatch = data ?? null;
    }

    const emailIsMember = !!emailMatch && emailMatch.is_guest !== true;
    const phoneIsMember = !!phoneMatch && phoneMatch.is_guest !== true;

    if (emailIsMember && phoneIsMember) {
      return NextResponse.json({ conflict: true, code: 'EMAIL_OR_PHONE_BELONGS_TO_MEMBER' });
    }
    if (emailIsMember) {
      return NextResponse.json({ conflict: true, code: 'EMAIL_BELONGS_TO_MEMBER' });
    }
    if (phoneIsMember) {
      return NextResponse.json({ conflict: true, code: 'PHONE_BELONGS_TO_MEMBER' });
    }
    return NextResponse.json({ conflict: false });
  } catch (e) {
    console.error('check-guest-conflict error:', e);
    // 사전 검사 실패는 결제 흐름을 막지 않도록 conflict=false fallback. 진짜 충돌은
    // 후속 결제 endpoint(bank-transfer-order / payment-order) 에서 다시 잡힘.
    return NextResponse.json({ conflict: false });
  }
}
