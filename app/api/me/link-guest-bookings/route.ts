/**
 * POST /api/me/link-guest-bookings
 * 로그인/회원가입 후 비회원 시절 예약을 현재 사용자에 매핑.
 *
 * Phase 1: guest_phone/guest_email 기준 (user_id IS NULL인 bookings)
 * Phase 2: bank_transfer_orders 매핑
 * Phase 3: purchase-guest가 생성한 게스트 유저 병합 (users 테이블에 있지만 본인이 아닌 유저)
 *
 * 전화번호는 숫자만 추출해 비교 (010-1234-5678 vs 01012345678 동일 처리).
 * 중복 호출해도 safe (이미 매핑된 행은 조건 불일치로 무시).
 */
import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/supabase/server-auth';
import { createServiceClient } from '@/lib/supabase/server';

function normalizePhone(value: string | null | undefined): string {
  if (value == null || typeof value !== 'string') return '';
  const digits = value.replace(/\D/g, '');
  return digits.length >= 9 ? digits : '';
}

/**
 * purchase-guest가 users 테이블에 생성한 게스트 유저를 찾아
 * 해당 유저의 bookings, user_tickets, academy_students 등을 실제 회원으로 이관 후,
 * 고아 게스트 유저 행을 삭제.
 */
async function mergeGuestUsers(
  supabase: any,
  realUserId: string,
  normalizedPhone: string,
  profileEmail: string
) {
  let mergedCount = 0;

  const guestUserIds: string[] = [];

  if (normalizedPhone) {
    const { data: phoneUsers } = await supabase
      .from('users')
      .select('id, phone')
      .eq('is_guest', true)
      .neq('id', realUserId)
      .not('phone', 'is', null);

    if (phoneUsers) {
      for (const u of phoneUsers) {
        if (normalizePhone(u.phone) === normalizedPhone && !guestUserIds.includes(u.id)) {
          guestUserIds.push(u.id);
        }
      }
    }
  }

  if (profileEmail) {
    const { data: emailUsers } = await supabase
      .from('users')
      .select('id')
      .eq('is_guest', true)
      .neq('id', realUserId)
      .ilike('email', profileEmail);

    if (emailUsers) {
      for (const u of emailUsers) {
        if (!guestUserIds.includes(u.id)) {
          guestUserIds.push(u.id);
        }
      }
    }
  }

  if (guestUserIds.length === 0) return mergedCount;

  for (const guestId of guestUserIds) {
    const { data: updatedBookings } = await supabase
      .from('bookings')
      .update({ user_id: realUserId })
      .eq('user_id', guestId)
      .select('id');
    mergedCount += updatedBookings?.length || 0;

    await supabase
      .from('user_tickets')
      .update({ user_id: realUserId })
      .eq('user_id', guestId);

    const { data: guestAcademies } = await supabase
      .from('academy_students')
      .select('academy_id')
      .eq('user_id', guestId);

    if (guestAcademies) {
      for (const ga of guestAcademies) {
        const { data: existing } = await supabase
          .from('academy_students')
          .select('id')
          .eq('academy_id', ga.academy_id)
          .eq('user_id', realUserId)
          .maybeSingle();

        if (existing) {
          await supabase.from('academy_students').delete().eq('user_id', guestId).eq('academy_id', ga.academy_id);
        } else {
          await supabase.from('academy_students').update({ user_id: realUserId }).eq('user_id', guestId).eq('academy_id', ga.academy_id);
        }
      }
    }

    await supabase
      .from('revenue_transactions')
      .update({ user_id: realUserId })
      .eq('user_id', guestId);

    // NO ACTION FK 테이블들도 이관
    await supabase
      .from('user_bookings')
      .update({ user_id: realUserId })
      .eq('user_id', guestId);

    await supabase
      .from('user_payments')
      .update({ user_id: realUserId })
      .eq('user_id', guestId);

    await supabase
      .from('user_ticket_payment_orders')
      .update({ user_id: realUserId })
      .eq('user_id', guestId);

    await supabase
      .from('bank_transfer_orders')
      .update({ user_id: realUserId })
      .eq('user_id', guestId);

    // 모든 FK 이관 완료 후 게스트 유저 행 삭제 (CASCADE FK는 자동 처리)
    await supabase
      .from('users')
      .delete()
      .eq('id', guestId)
      .eq('is_guest', true);
  }

  return mergedCount;
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

    // 1) 연락처 기준: user_id IS NULL인 bookings 매핑
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

    // 4) purchase-guest가 생성한 게스트 유저 병합
    let mergedCount = 0;
    if (normalizedProfilePhone || profileEmail) {
      try {
        mergedCount = await mergeGuestUsers(supabase, user.id, normalizedProfilePhone, profileEmail);
      } catch (e) {
        console.error('[link-guest-bookings] merge guest users error:', e);
      }
    }

    return NextResponse.json({ linked: linkedBookingIds.size, merged: mergedCount });
  } catch (e: any) {
    console.error('[link-guest-bookings] error:', e);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
