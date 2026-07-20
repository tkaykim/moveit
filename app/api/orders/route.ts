import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getAuthenticatedUser } from '@/lib/supabase/server-auth';
import {
  composeOrder,
  newProviderOrderId,
  previewOrder,
  sanitizeItems,
} from '@/lib/orders/composer';
import { parseOrderError, type OrderMethod } from '@/lib/orders/types';

export const dynamic = 'force-dynamic';

const METHODS: OrderMethod[] = ['BANK', 'TOSS', 'ONSITE'];

/**
 * POST /api/orders
 *
 * 주문 생성. RLS 상 order_groups/order_items 는 스태프·서비스 전용이므로
 * 학생 결제는 **이 서비스롤 라우트**를 통해서만 이뤄진다(경로를 하나로 고정).
 * 신원은 서버가 확인한 세션에서만 온다 — body 의 userId 는 읽지 않는다.
 *
 * body: {
 *   academyId, method, items[],
 *   providerOrderId?   // 더블클릭 방지용 멱등 키. 없으면 서버가 만든다.
 *   expectedTotalAmount?  // 클라이언트가 본 금액. 계산엔 안 쓰이고 불일치면 거절.
 *   orderer?: { name, phone, email }   // 게스트 주문용
 * }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const academyId = body?.academyId ?? body?.academy_id;
    const method = (body?.method ?? 'BANK') as OrderMethod;

    if (!academyId) {
      return NextResponse.json({ error: '학원 정보가 필요합니다.' }, { status: 400 });
    }
    if (!METHODS.includes(method)) {
      return NextResponse.json({ error: '지원하지 않는 결제 수단입니다.' }, { status: 400 });
    }

    const user = await getAuthenticatedUser(request);
    const items = sanitizeItems(body?.items);
    if (items.length === 0) {
      return NextResponse.json({ error: '주문할 항목이 없습니다.' }, { status: 400 });
    }

    const orderer = body?.orderer ?? null;
    if (!user && !orderer?.name) {
      // 게스트 주문은 최소한 주문자 이름이 있어야 나중에 입금 확인을 붙일 수 있다
      return NextResponse.json(
        { error: '주문자 정보를 입력해 주세요.', code: 'ORDERER_REQUIRED' },
        { status: 400 }
      );
    }

    const supabase = createServiceClient() as unknown as Parameters<typeof composeOrder>[0];

    const result = await composeOrder(supabase, {
      academyId,
      method,
      items,
      userId: user?.id ?? null,
      providerOrderId: body?.providerOrderId || newProviderOrderId(),
      orderer,
      expectedTotalAmount:
        body?.expectedTotalAmount === undefined || body?.expectedTotalAmount === null
          ? null
          : Number(body.expectedTotalAmount),
    });

    return NextResponse.json(result, { status: result.idempotent ? 200 : 201 });
  } catch (e: unknown) {
    const mapped = parseOrderError(e);
    console.error('[orders/create]', mapped.code, (e as Error)?.message);

    // 락 아래 재검증에서 뒤집힌 경우(마지막 좌석 등) 최신 판정을 함께 돌려준다 —
    // 클라이언트가 그 항목만 빼고 즉시 재시도할 수 있도록.
    let rejected: unknown = undefined;
    if (mapped.code === 'ORDER_ITEM_REJECTED') {
      try {
        const body = await request.clone().json();
        const user = await getAuthenticatedUser(request);
        const supabase = createServiceClient() as unknown as Parameters<typeof previewOrder>[0];
        const fresh = await previewOrder(supabase, {
          academyId: body?.academyId ?? body?.academy_id,
          items: sanitizeItems(body?.items),
          userId: user?.id ?? null,
        });
        rejected = fresh.items.filter((v) => !v.ok);
      } catch {
        /* 재판정 실패는 원래 오류를 가리지 않는다 */
      }
    }

    return NextResponse.json(
      {
        error: mapped.message,
        code: mapped.code,
        itemIndex: mapped.itemIndex,
        itemCode: mapped.itemCode,
        ...(rejected ? { rejected } : {}),
      },
      { status: mapped.status }
    );
  }
}
