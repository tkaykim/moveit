import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getAuthenticatedUser } from '@/lib/supabase/server-auth';
import { previewOrder, sanitizeItems } from '@/lib/orders/composer';
import { parseOrderError } from '@/lib/orders/types';

export const dynamic = 'force-dynamic';

/**
 * POST /api/orders/preflight
 *
 * 장바구니 dry-run. 아무것도 쓰지 않고 항목별 판정만 돌려준다.
 * **불가 항목은 결제 전에 여기서 드러난다** — "일단 결제하고 취소"를 없애기 위한 입구.
 *
 * body: { academyId, items: [...] }
 * 게스트(비로그인)도 호출 가능하다. 기존 게스트 예약 플로우를 막지 않는다.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const academyId = body?.academyId ?? body?.academy_id;
    if (!academyId) {
      return NextResponse.json({ error: '학원 정보가 필요합니다.' }, { status: 400 });
    }

    const user = await getAuthenticatedUser(request);
    const items = sanitizeItems(body?.items);

    // 서비스롤로 판정한다. 사용자 신원은 서버가 확인한 user.id 만 쓰며,
    // body 의 userId 는 절대 신뢰하지 않는다.
    const supabase = createServiceClient() as unknown as Parameters<typeof previewOrder>[0];
    const result = await previewOrder(supabase, {
      academyId,
      items,
      userId: user?.id ?? null,
    });

    return NextResponse.json({
      ...result,
      // 클라이언트가 바로 쓸 수 있게 거절 항목만 따로 추린다
      rejected: result.items.filter((v) => !v.ok),
    });
  } catch (e: unknown) {
    const mapped = parseOrderError(e);
    console.error('[orders/preflight]', mapped.code, (e as Error)?.message);
    return NextResponse.json(
      { error: mapped.message, code: mapped.code },
      { status: mapped.status }
    );
  }
}
