import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { getTicketById } from '@/lib/db/tickets';
import { getAuthenticatedUser } from '@/lib/supabase/server-auth';
import { createServiceClient } from '@/lib/supabase/server';
import { normalizeGuestEmail, normalizeGuestPhone } from '@/lib/utils/guest-normalize';
import { isGuestEligibleTicket } from '@/lib/utils/ticket-policy';
import { logTicketEvent } from '@/lib/db/enrollment-activity-log';
export const dynamic = 'force-dynamic';


/**
 * 수강권 결제용 주문 생성 (Toss Payments 결제창 연동)
 * Body: { ticketId, scheduleId?, countOptionIndex?, discountId?, guestName?, guestPhone?, guestEmail? }
 * - 로그인 사용자: 모든 수강권 구매 가능
 * - 비회원: scheduleId가 있고, 1회성 수강권인 경우에만 허용 (구매 후 즉시 예약)
 * Returns: { orderId, amount, orderName }
 */
export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    const supabase = createServiceClient() as any;
    const body = await request.json();
    const { ticketId, scheduleId, countOptionIndex, discountId, guestName, guestPhone, guestEmail } = body;

    if (!ticketId) {
      return NextResponse.json({ error: 'ticketId가 필요합니다.' }, { status: 400 });
    }

    const ticket = await getTicketById(ticketId);
    if (!ticket) {
      return NextResponse.json({ error: '티켓을 찾을 수 없습니다.' }, { status: 404 });
    }
    if (!ticket.is_on_sale) {
      return NextResponse.json({ error: '판매 중인 티켓이 아닙니다.' }, { status: 400 });
    }
    if (ticket.is_public === false) {
      return NextResponse.json({ error: '비공개 수강권은 직접 구매할 수 없습니다.' }, { status: 400 });
    }

    const academyId = ticket.academy_id;
    if (!academyId) {
      return NextResponse.json({ error: '학원 정보가 없는 수강권입니다.' }, { status: 400 });
    }

    const countOpts = (ticket.count_options as { count?: number; price?: number; valid_days?: number | null }[] | null) || [];
    const hasCountOptions = countOpts.length > 0 && (ticket.ticket_category === 'popup' || ticket.access_group === 'popup');
    const optIndex = typeof countOptionIndex === 'number' ? countOptionIndex : 0;
    if (hasCountOptions && (optIndex < 0 || optIndex >= countOpts.length)) {
      return NextResponse.json({ error: '유효하지 않은 수강권 옵션입니다.' }, { status: 400 });
    }

    const selectedOption = hasCountOptions && countOpts[optIndex] ? countOpts[optIndex] : null;
    const optionPrice = selectedOption ? (selectedOption.price ?? ticket.price ?? 0) : (ticket.price ?? 0);

    // B-4 (2026-04-27): 비회원 결제 허용 여부는 lib/utils/ticket-policy.ts의 단일 헬퍼로 통일.
    // 클라이언트(book/session/[sessionId]/page.tsx)와 정확히 동일한 판별 보장.
    const guestEligible = isGuestEligibleTicket(
      { ticket_type: ticket.ticket_type ?? 'COUNT', total_count: ticket.total_count ?? null },
      selectedOption,
    );

    let userId: string;

    if (user) {
      userId = user.id;
    } else if (scheduleId && guestEligible) {
      // 1회성 + 특정 수업 수강신청 → 비회원 허용 (구매 후 즉시 예약)
      const name = guestName != null ? String(guestName).trim() : '';
      const phone = normalizeGuestPhone(guestPhone);
      const email = normalizeGuestEmail(guestEmail);
      if (!name) {
        return NextResponse.json({ error: '이름을 입력해 주세요.' }, { status: 400 });
      }
      // B-4 (2026-04-27): 이메일 필수화 (Gmail SMTP/Apps Script로 결제 영수증·수업 알림 채널 단일화).
      // 외국인 수용을 위해 전화는 옵션. 이메일만 있으면 모든 알림은 메일로 처리.
      if (!email) {
        return NextResponse.json({ error: '이메일을 입력해 주세요. (영수증·알림 발송용)' }, { status: 400 });
      }

      // B-3 (2026-04-21) / B-4 (2026-04-28): 이메일/전화가 정식 회원(is_guest=false)과 충돌하면
      // 무음 귀속 대신 명시적 차단. SELECT가 어떤 이유로 row를 놓쳐 INSERT 단계로 떨어지더라도
      // unique violation(23505)을 잡아 동일 메시지로 안내한다.
      let guestUser: { id: string } | null = null;
      if (email) {
        const { data: existing, error: selectEmailErr } = await supabase
          .from('users').select('id, is_guest').ilike('email', email).limit(1).maybeSingle();
        if (selectEmailErr) {
          console.error('Email lookup error in payment-order:', selectEmailErr);
        }
        if (existing) {
          if (existing.is_guest !== true) {
            // 활동 로그: 회원 이메일과 충돌해 비회원 결제 시도 거절
            logTicketEvent({
              academy_id: academyId,
              user_id: existing.id,
              action: 'MEMBER_CONFLICT_REJECTED',
              via: 'member_conflict',
              reason: 'EMAIL_BELONGS_TO_MEMBER',
              context: {
                ticket_id: ticketId,
                schedule_id: scheduleId ?? null,
                attempted_email: email,
                attempted_phone: phone ?? null,
                attempted_name: name,
              },
              actor_user_id: null,
            }, supabase).catch(() => {});
            return NextResponse.json({
              error: '이미 가입된 이메일입니다. 로그인 후 결제해 주세요.',
              code: 'EMAIL_BELONGS_TO_MEMBER',
            }, { status: 409 });
          }
          guestUser = { id: existing.id };
        }
      }
      if (!guestUser && phone) {
        const { data: existing, error: selectPhoneErr } = await supabase
          .from('users').select('id, is_guest').eq('phone', phone).limit(1).maybeSingle();
        if (selectPhoneErr) {
          console.error('Phone lookup error in payment-order:', selectPhoneErr);
        }
        if (existing) {
          if (existing.is_guest !== true) {
            // 활동 로그: 회원 전화번호와 충돌해 비회원 결제 시도 거절
            logTicketEvent({
              academy_id: academyId,
              user_id: existing.id,
              action: 'MEMBER_CONFLICT_REJECTED',
              via: 'member_conflict',
              reason: 'PHONE_BELONGS_TO_MEMBER',
              context: {
                ticket_id: ticketId,
                schedule_id: scheduleId ?? null,
                attempted_email: email,
                attempted_phone: phone,
                attempted_name: name,
              },
              actor_user_id: null,
            }, supabase).catch(() => {});
            return NextResponse.json({
              error: '이미 가입된 전화번호입니다. 로그인 후 결제해 주세요.',
              code: 'PHONE_BELONGS_TO_MEMBER',
            }, { status: 409 });
          }
          guestUser = { id: existing.id };
        }
      }
      if (!guestUser) {
        // B-4 hotfix (2026-04-28): users.id default가 auth.uid()라 service role insert에선 NULL 반환 →
        // NOT NULL 위반(23502). 명시적 UUID로 회피. f890b6a의 23505 fallback도 그대로 유지.
        const { data: inserted, error: insertUserErr } = await supabase
          .from('users')
          .insert({ id: randomUUID(), name, phone: phone ?? null, email: email ?? null, is_guest: true })
          .select('id')
          .single();
        if (insertUserErr) {
          console.error('Guest user creation error:', insertUserErr);
          // B-4 (2026-04-28): unique violation은 거의 항상 정식 회원 row와 충돌. 친절한 409로 변환.
          // SELECT 단계가 RLS·race condition·서비스 키 누락 등으로 row를 놓쳤을 때의 안전망.
          if ((insertUserErr as any).code === '23505') {
            // 활동 로그: SELECT 가 race 로 회원 행을 놓치고 INSERT 충돌로 떨어진 케이스
            logTicketEvent({
              academy_id: academyId,
              action: 'MEMBER_CONFLICT_REJECTED',
              via: 'member_conflict',
              reason: 'EMAIL_OR_PHONE_BELONGS_TO_MEMBER',
              context: {
                ticket_id: ticketId,
                schedule_id: scheduleId ?? null,
                attempted_email: email,
                attempted_phone: phone ?? null,
                attempted_name: name,
                detection: 'unique_violation_23505',
              },
              actor_user_id: null,
            }, supabase).catch(() => {});
            return NextResponse.json({
              error: '이미 가입된 이메일 또는 전화번호입니다. 로그인 후 결제해 주세요.',
              code: 'EMAIL_OR_PHONE_BELONGS_TO_MEMBER',
            }, { status: 409 });
          }
          return NextResponse.json({ error: '게스트 정보 생성에 실패했습니다.' }, { status: 500 });
        }
        guestUser = inserted;
      }
      if (!guestUser) {
        return NextResponse.json({ error: '게스트 계정을 확인할 수 없습니다.' }, { status: 500 });
      }
      userId = guestUser.id;
    } else {
      return NextResponse.json(
        { error: scheduleId ? '다회권/기간권 구매는 로그인이 필요합니다.' : '수강권 구매를 위해서는 로그인이 필요합니다.' },
        { status: 401 }
      );
    }

    let discountAmount = 0;
    if (discountId) {
      const { data: discountData, error: discountError } = await supabase
        .from('discounts')
        .select('*')
        .eq('id', discountId)
        .eq('is_active', true)
        .single();
      if (discountError || !discountData) {
        return NextResponse.json({ error: '유효하지 않은 할인정책입니다.' }, { status: 400 });
      }
      const now = new Date().toISOString().split('T')[0];
      if (discountData.valid_from && discountData.valid_from > now) {
        return NextResponse.json({ error: '아직 적용할 수 없는 할인정책입니다.' }, { status: 400 });
      }
      if (discountData.valid_until && discountData.valid_until < now) {
        return NextResponse.json({ error: '만료된 할인정책입니다.' }, { status: 400 });
      }
      if (discountData.academy_id && discountData.academy_id !== academyId) {
        return NextResponse.json({ error: '해당 학원에서 사용할 수 없는 할인정책입니다.' }, { status: 400 });
      }
      if (discountData.discount_type === 'PERCENT') {
        discountAmount = Math.floor(optionPrice * discountData.discount_value / 100);
      } else {
        discountAmount = discountData.discount_value;
      }
      discountAmount = Math.min(discountAmount, optionPrice);
    }

    const amount = Math.max(0, optionPrice - discountAmount);
    if (amount <= 0) {
      return NextResponse.json({ error: '결제 금액이 올바르지 않습니다.' }, { status: 400 });
    }

    let classIdForOrder: string | null = null;
    if (scheduleId) {
      const { data: scheduleRow, error: scheduleErr } = await supabase
        .from('schedules')
        .select('id, class_id, is_canceled, start_time, classes(academy_id)')
        .eq('id', scheduleId)
        .single();
      if (scheduleErr || !scheduleRow) {
        return NextResponse.json({ error: '유효하지 않은 수업 일정입니다.' }, { status: 400 });
      }
      if (scheduleRow.is_canceled) {
        return NextResponse.json({ error: '취소된 수업에는 예약할 수 없습니다.' }, { status: 400 });
      }
      if (new Date(scheduleRow.start_time) < new Date()) {
        return NextResponse.json({ error: '이미 지난 수업에는 예약할 수 없습니다.' }, { status: 400 });
      }
      const scheduleAcademyId = scheduleRow.classes?.academy_id;
      if (scheduleAcademyId && scheduleAcademyId !== academyId) {
        return NextResponse.json({ error: '선택한 수업이 해당 수강권 학원과 일치하지 않습니다.' }, { status: 400 });
      }
      if (scheduleRow.class_id) {
        classIdForOrder = scheduleRow.class_id;
      }
    }

    const orderId = `tk_${Date.now()}_${Math.random().toString(36).slice(2, 15)}`;
    const orderName = selectedOption
      ? `${ticket.name} ${selectedOption.count ?? 1}회권`
      : (ticket.name || '수강권');

    const { error: insertError } = await supabase
      .from('user_ticket_payment_orders')
      .insert({
        order_id: orderId,
        user_id: userId,
        type: 'TICKET_PURCHASE',
        ticket_id: ticketId,
        academy_id: academyId,
        class_id: classIdForOrder,
        schedule_id: scheduleId || null,
        amount,
        count_option_index: hasCountOptions ? optIndex : null,
        discount_id: discountId || null,
        order_name: orderName,
        status: 'PENDING',
      });

    if (insertError) {
      console.error('payment-order insert error:', insertError);
      return NextResponse.json({ error: '주문 생성에 실패했습니다.' }, { status: 500 });
    }

    return NextResponse.json({
      orderId,
      amount,
      orderName,
    });
  } catch (e: any) {
    console.error('payment-order error:', e);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
