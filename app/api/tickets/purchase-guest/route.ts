import { NextResponse } from 'next/server';

/**
 * POST /api/tickets/purchase-guest
 * 비회원 수강권 구매는 더 이상 지원하지 않습니다.
 * 수강권 구매는 회원가입/로그인 후 이용해 주세요.
 * (특정 수업 수강신청은 /api/bookings/guest 또는 payment-order + scheduleId로 가능)
 */
export async function POST(request: Request) {
  return NextResponse.json(
    { error: '수강권 구매를 위해서는 로그인이 필요합니다. 회원가입 후 이용해 주세요.' },
    { status: 401 }
  );
}
