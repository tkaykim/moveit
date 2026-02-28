/**
 * POST /api/me/link-guest-bookings
 * 로그인/회원가입 후 비회원 시절 예약을 현재 사용자에 매핑.
 * - 전화번호는 숫자만 추출해 비교 (010-1234-5678 vs 01012345678 동일 처리).
 * - bookings: user_id IS NULL AND normalize(guest_phone) = normalize(user.phone) → user_id = user.id
 * - bank_transfer_orders: 동일 기준으로 orderer_phone 매핑.
 * 중복 호출해도 safe (이미 매핑된 행은 조건 불일치로 무시).
 */
import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/supabase/server-auth';
import { createServiceClient } from '@/lib/supabase/server';

/** 연락처에서 숫자만 추출 (하이픈·공백 제거). 빈 문자열이면 매칭 제외. */
function normalizePhone(value: string | null | undefined): string {
  if (value == null || typeof value !== 'string') return '';
  const digits = value.replace(/\D/g, '');
  return digits.length >= 9 ? digits : ''; // 최소 유효 자릿수
}

export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const supabase = createServiceClient() as any;

    const { data: profile } = await supabase
      .from('users')
      .select('phone, email')
      .eq('id', user.id)
      .single();

    const rawPhone = typeof profile?.phone === 'string' ? profile.phone.trim() : '';
    const normalizedProfilePhone = normalizePhone(rawPhone);
    const profileEmail = (typeof profile?.email === 'string' ? profile.email : (user as { email?: string }).email ?? '')
      .trim().toLowerCase();

    const linkedBookingIds = new Set<string>();

    // 1) 연락처 기준: 정확 일치 후 정규화 일치
    if (normalizedProfilePhone) {
      const { data: exactBookings, error: exactErr } = await supabase
        .from('bookings')
        .update({ user_id: user.id })
        .is('user_id', null)
        .eq('guest_phone', rawPhone)
        .select('id');

      if (exactErr) {
        console.error('[link-guest-bookings] bookings exact update error:', exactErr);
        return NextResponse.json({ error: '예약 매핑에 실패했습니다.' }, { status: 500 });
      }
      (exactBookings || []).forEach((b: { id: string }) => linkedBookingIds.add(b.id));

      const { data: guestBookings, error: fetchErr } = await supabase
        .from('bookings')
        .select('id, guest_phone')
        .is('user_id', null)
        .not('guest_phone', 'is', null);

      if (!fetchErr && guestBookings) {
        const toLink = guestBookings.filter(
          (b: { id: string; guest_phone: string | null }) =>
            !linkedBookingIds.has(b.id) && normalizePhone(b.guest_phone) === normalizedProfilePhone
        );
        for (const b of toLink) {
          const { error: upErr } = await supabase.from('bookings').update({ user_id: user.id }).eq('id', b.id);
          if (!upErr) linkedBookingIds.add(b.id);
        }
      }
    }

    // 2) bank_transfer_orders: 연락처 기준
    if (normalizedProfilePhone) {
      const { data: exactOrders } = await supabase
        .from('bank_transfer_orders')
        .update({ user_id: user.id })
        .is('user_id', null)
        .eq('orderer_phone', rawPhone)
        .select('id');

      const { data: guestOrders } = await supabase
        .from('bank_transfer_orders')
        .select('id, orderer_phone')
        .is('user_id', null)
        .not('orderer_phone', 'is', null);

      if (guestOrders) {
        const exactOrderIds = new Set((exactOrders || []).map((o: { id: string }) => o.id));
        for (const o of guestOrders) {
          if (!exactOrderIds.has(o.id) && normalizePhone(o.orderer_phone) === normalizedProfilePhone) {
            await supabase.from('bank_transfer_orders').update({ user_id: user.id }).eq('id', o.id);
          }
        }
      }
    }

    // 3) 이메일 기준 매칭 (guest_email / orderer_email)
    if (profileEmail) {
      const { data: emailBookings } = await supabase
        .from('bookings')
        .update({ user_id: user.id })
        .is('user_id', null)
        .ilike('guest_email', profileEmail)
        .select('id');
      (emailBookings || []).forEach((b: { id: string }) => linkedBookingIds.add(b.id));

      await supabase
        .from('bank_transfer_orders')
        .update({ user_id: user.id })
        .is('user_id', null)
        .ilike('orderer_email', profileEmail);
    }

    return NextResponse.json({ linked: linkedBookingIds.size });
  } catch (e: any) {
    console.error('[link-guest-bookings] error:', e);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
