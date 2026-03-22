/**
 * POST /api/me/link-guest-bookings
 * 로그인/회원가입 후 비회원 시절 예약을 현재 사용자에 매핑.
 *
 * Phase 1: guest_phone/guest_email 기준 (user_id IS NULL인 bookings)
 * Phase 2: bank_transfer_orders 매핑
 * Phase 3: purchase-guest가 생성한 게스트 유저 병합 (users 테이블에 있지만 본인이 아닌 유저)
 * Phase 4: CONFIRMED 계좌이체 주문 중 수강권 미발급 건 소급 발급
 *
 * 전화번호는 숫자만 추출해 비교 (010-1234-5678 vs 01012345678 동일 처리).
 * 중복 호출해도 safe (이미 매핑된 행은 조건 불일치로 무시).
 */
import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/supabase/server-auth';
import { createServiceClient } from '@/lib/supabase/server';
import { getTicketById } from '@/lib/db/tickets';

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

/**
 * Phase 4: 비회원 시 계좌이체 입금확인이 먼저 처리된 경우,
 * 회원가입 후 매핑된 주문에 대해 수강권을 소급 발급.
 * (비회원 입금확인 시에는 user_id 없어 수강권 발급 불가 → 회원 전환 후 발급)
 */
async function issueTicketsForConfirmedOrders(
  supabase: any,
  userId: string
): Promise<number> {
  const { data: unissuedOrders } = await supabase
    .from('bank_transfer_orders')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'CONFIRMED')
    .is('user_ticket_id', null);

  if (!unissuedOrders || unissuedOrders.length === 0) return 0;

  let issuedCount = 0;

  for (const order of unissuedOrders) {
    try {
      const ticket = await getTicketById(order.ticket_id);
      if (!ticket) continue;

      const countOpts = (ticket.count_options as { count?: number; price?: number; valid_days?: number | null }[] | null) || [];
      const hasCountOptions = countOpts.length > 0 && (ticket.ticket_category === 'popup' || ticket.access_group === 'popup');
      const optIndex = order.count_option_index ?? 0;
      const selectedOption = hasCountOptions && countOpts[optIndex] ? countOpts[optIndex] : null;
      const optionCount = selectedOption ? (selectedOption.count ?? 1) : (ticket.total_count ?? 1);
      const optionValidDays = selectedOption?.valid_days ?? ticket.valid_days ?? null;
      const isPeriodTicket = ticket.ticket_type === 'PERIOD';
      const remainingCount = isPeriodTicket ? null : optionCount;

      const startDate = new Date();
      let expiryDateStr: string | null;
      if (optionValidDays != null && optionValidDays > 0) {
        const exp = new Date(startDate);
        exp.setDate(exp.getDate() + optionValidDays);
        expiryDateStr = exp.toISOString().split('T')[0];
      } else if (optionValidDays === null) {
        expiryDateStr = null;
      } else {
        const exp = new Date(startDate);
        exp.setFullYear(exp.getFullYear() + 1);
        expiryDateStr = exp.toISOString().split('T')[0];
      }

      const { data: userTicket, error: utError } = await supabase
        .from('user_tickets')
        .insert({
          user_id: userId,
          ticket_id: order.ticket_id,
          remaining_count: remainingCount,
          start_date: startDate.toISOString().split('T')[0],
          expiry_date: expiryDateStr,
          status: 'ACTIVE',
        })
        .select()
        .single();

      if (utError || !userTicket) {
        console.error('[link-guest-bookings] user_ticket insert error:', utError);
        continue;
      }

      const ticketDisplayName = selectedOption ? `${ticket.name} ${optionCount}회권` : ticket.name;
      const purchaseQuantity = isPeriodTicket ? 1 : optionCount;
      const { data: revRow } = await supabase
        .from('revenue_transactions')
        .insert({
          academy_id: order.academy_id,
          user_id: userId,
          ticket_id: order.ticket_id,
          user_ticket_id: userTicket.id,
          discount_id: order.discount_id || null,
          original_price: order.amount,
          discount_amount: 0,
          final_price: order.amount,
          payment_method: 'BANK_TRANSFER',
          payment_status: 'COMPLETED',
          registration_type: 'NEW',
          quantity: purchaseQuantity,
          valid_days: optionValidDays,
          ticket_name: ticketDisplayName,
          ticket_type_snapshot: ticket.ticket_type,
          transaction_date: new Date().toISOString().split('T')[0],
        })
        .select('id')
        .single();

      if (order.academy_id) {
        const { data: existingStudent } = await supabase
          .from('academy_students')
          .select('id')
          .eq('academy_id', order.academy_id)
          .eq('user_id', userId)
          .maybeSingle();
        if (!existingStudent) {
          await supabase
            .from('academy_students')
            .insert({ academy_id: order.academy_id, user_id: userId });
        }
      }

      if (order.schedule_id) {
        const { data: existingBooking } = await supabase
          .from('bookings')
          .select('id, user_ticket_id')
          .eq('bank_transfer_order_id', order.id)
          .maybeSingle();

        if (existingBooking && !existingBooking.user_ticket_id) {
          await supabase
            .from('bookings')
            .update({ user_ticket_id: userTicket.id })
            .eq('id', existingBooking.id);

          if (!isPeriodTicket && remainingCount !== null && remainingCount > 0) {
            const newRemaining = remainingCount - 1;
            const ticketUpdate: Record<string, unknown> = { remaining_count: newRemaining };
            if (newRemaining === 0) ticketUpdate.status = 'USED';
            await supabase
              .from('user_tickets')
              .update(ticketUpdate)
              .eq('id', userTicket.id);
          }
        }
      }

      await supabase
        .from('bank_transfer_orders')
        .update({
          user_ticket_id: userTicket.id,
          revenue_transaction_id: revRow?.id || null,
        })
        .eq('id', order.id);

      issuedCount++;
      console.log(`[link-guest-bookings] 소급 수강권 발급 완료: order=${order.id}, userTicket=${userTicket.id}`);
    } catch (e) {
      console.error('[link-guest-bookings] issue ticket error for order:', order.id, e);
    }
  }

  return issuedCount;
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

    // 5) CONFIRMED 계좌이체 주문 중 수강권 미발급 건 소급 발급
    let retroIssuedCount = 0;
    try {
      retroIssuedCount = await issueTicketsForConfirmedOrders(supabase, user.id);
    } catch (e) {
      console.error('[link-guest-bookings] retroactive ticket issue error:', e);
    }

    return NextResponse.json({ linked: linkedBookingIds.size, merged: mergedCount, retroIssued: retroIssuedCount });
  } catch (e: any) {
    console.error('[link-guest-bookings] error:', e);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
