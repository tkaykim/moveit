import { NextResponse } from 'next/server';
import { getTicketById } from '@/lib/db/tickets';
import { getAuthenticatedUser } from '@/lib/supabase/server-auth';
import { createServiceClient } from '@/lib/supabase/server';

/**
 * 계좌이체 신청 주문 생성 (입금 대기).
 * Body: { ticketId, scheduleId?, countOptionIndex?, discountId?, ordererName?, ordererPhone?, ordererEmail?, depositorName? }
 * - 로그인 시: orderer*·depositorName 생략 가능(프로필/이름 사용). 전달 시 그대로 저장.
 * - 비회원(guest): ordererName 필수, ordererPhone 또는 ordererEmail 중 하나 필수. depositorName 생략 시 ordererName 사용.
 * Returns: orderId, amount, orderName, bankName, bankAccountNumber, bankDepositorName
 */
export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    const supabase = createServiceClient() as any;
    const body = await request.json();
    const {
      ticketId,
      scheduleId,
      countOptionIndex,
      discountId,
      ordererName: bodyOrdererName,
      ordererPhone: bodyOrdererPhone,
      ordererEmail: bodyOrdererEmail,
      depositorName: bodyDepositorName,
    } = body;

    let ordererName: string;
    let ordererPhone: string | null = null;
    let ordererEmail: string | null = null;
    let depositorName: string;
    let userId: string | null = null;

    if (user) {
      userId = user.id;
      const { data: profile } = await supabase
        .from('users')
        .select('name, name_en, phone, email')
        .eq('id', user.id)
        .single();
      const rawName = profile?.name ?? profile?.name_en ?? '';
      const rawPhone = profile?.phone != null ? String(profile.phone).trim() : '';
      const rawEmail = profile?.email != null ? String(profile.email).trim() : '';
      ordererName = bodyOrdererName != null && String(bodyOrdererName).trim()
        ? String(bodyOrdererName).trim()
        : (rawName || '이름 없음');
      ordererPhone = bodyOrdererPhone != null && String(bodyOrdererPhone).trim()
        ? String(bodyOrdererPhone).trim()
        : (rawPhone || null);
      ordererEmail = bodyOrdererEmail != null && String(bodyOrdererEmail).trim()
        ? String(bodyOrdererEmail).trim()
        : (rawEmail || null);
      depositorName = bodyDepositorName != null && String(bodyDepositorName).trim()
        ? String(bodyDepositorName).trim()
        : ordererName;
    } else {
      // 비회원
      const name = bodyOrdererName != null ? String(bodyOrdererName).trim() : '';
      const phone = bodyOrdererPhone != null ? String(bodyOrdererPhone).trim() : '';
      const email = bodyOrdererEmail != null ? String(bodyOrdererEmail).trim() : '';
      if (!name) {
        return NextResponse.json({ error: '이름을 입력해 주세요.' }, { status: 400 });
      }
      if (!phone && !email) {
        return NextResponse.json({ error: '연락처 또는 이메일 중 하나는 필수입니다.' }, { status: 400 });
      }
      ordererName = name;
      ordererPhone = phone || null;
      ordererEmail = email || null;
      depositorName = bodyDepositorName != null && String(bodyDepositorName).trim()
        ? String(bodyDepositorName).trim()
        : ordererName;
    }

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

    const { data: academy, error: acError } = await (supabase as any)
      .from('academies')
      .select('bank_name, bank_account_number, bank_depositor_name')
      .eq('id', academyId)
      .single();

    if (acError || !academy) {
      return NextResponse.json({ error: '학원 정보를 불러올 수 없습니다.' }, { status: 500 });
    }

    const bankName = academy.bank_name?.trim();
    const bankAccountNumber = academy.bank_account_number?.trim();
    const bankDepositorName = academy.bank_depositor_name?.trim();
    if (!bankName || !bankAccountNumber || !bankDepositorName) {
      return NextResponse.json(
        { error: '해당 학원에 입금 계좌 정보가 등록되지 않았습니다. 학원에 문의해 주세요.' },
        { status: 400 }
      );
    }

    const countOpts = (ticket.count_options as { count?: number; price?: number; valid_days?: number | null }[] | null) || [];
    const hasCountOptions = countOpts.length > 0 && (ticket.ticket_category === 'popup' || ticket.access_group === 'popup');
    const optIndex = typeof countOptionIndex === 'number' ? countOptionIndex : 0;
    if (hasCountOptions && (optIndex < 0 || optIndex >= countOpts.length)) {
      return NextResponse.json({ error: '유효하지 않은 수강권 옵션입니다.' }, { status: 400 });
    }

    const selectedOption = hasCountOptions && countOpts[optIndex] ? countOpts[optIndex] : null;
    const optionPrice = selectedOption ? (selectedOption.price ?? ticket.price ?? 0) : (ticket.price ?? 0);

    let discountAmount = 0;
    if (discountId) {
      const { data: discountData, error: discountError } = await (supabase as any)
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
      const { data: scheduleRow, error: scheduleErr } = await (supabase as any)
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

    const orderName = selectedOption
      ? `${ticket.name} ${selectedOption.count ?? 1}회권`
      : (ticket.name || '수강권');

    const { data: order, error: insertError } = await (supabase as any)
      .from('bank_transfer_orders')
      .insert({
        academy_id: academyId,
        user_id: userId,
        ticket_id: ticketId,
        schedule_id: scheduleId || null,
        class_id: classIdForOrder,
        amount,
        count_option_index: hasCountOptions ? optIndex : null,
        discount_id: discountId || null,
        order_name: orderName,
        orderer_name: ordererName,
        orderer_phone: ordererPhone,
        orderer_email: ordererEmail,
        status: 'PENDING',
      })
      .select('id')
      .single();

    if (insertError) {
      console.error('bank-transfer-order insert error:', insertError);
      return NextResponse.json({ error: '주문 생성에 실패했습니다.' }, { status: 500 });
    }

    return NextResponse.json({
      orderId: order.id,
      amount,
      orderName,
      bankName,
      bankAccountNumber,
      bankDepositorName,
      ordererName: ordererName,
    });
  } catch (e: any) {
    console.error('bank-transfer-order error:', e);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
