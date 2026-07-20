'use client';

/**
 * Toss 결제 실패/취소 화면 (T-P)
 *
 * 사용자가 창을 닫거나 카드가 거절되면 여기로 온다. 돈은 빠져나가지 않았다.
 * PENDING 주문은 그대로 남는다(중복 주문을 만들지 않는다) — 장바구니로 돌아가
 * 같은 번호로 다시 시도할 수 있다.
 */

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { XCircle } from 'lucide-react';

// Toss 가 흔히 주는 취소 코드 — 이 경우엔 "취소"로 부드럽게 말한다.
const CANCEL_CODES = new Set([
  'USER_CANCEL',
  'PAY_PROCESS_CANCELED',
  'PAY_PROCESS_ABORTED',
]);

export function TossFailView({ slug }: { slug: string }) {
  const search = useSearchParams();
  const code = search.get('code');
  const message = search.get('message');
  const canceled = !code || CANCEL_CODES.has(code);

  return (
    <div className="px-5 pt-12 text-center" data-testid="toss-fail" data-code={code ?? ''}>
      <XCircle size={44} className="mx-auto text-neutral-400" />
      <h1 className="text-[19px] font-extrabold mt-4" data-testid="toss-fail-headline">
        {canceled ? '결제가 취소되었습니다' : '결제에 실패했습니다'}
      </h1>
      <p className="text-[13px] text-neutral-500 mt-2 leading-relaxed" data-testid="toss-fail-message">
        {canceled
          ? '결제가 진행되지 않았습니다. 금액은 청구되지 않았어요.'
          : message || '결제를 완료하지 못했습니다. 잠시 후 다시 시도해 주세요.'}
      </p>

      <div className="mt-7 space-y-2">
        <Link
          href={`/s/${slug}/cart`}
          data-testid="toss-fail-cart-link"
          className="block w-full py-3 rounded-xl text-[13px] font-bold text-white"
          style={{ backgroundColor: 'var(--primary)' }}
        >
          장바구니로 돌아가기
        </Link>
        <Link
          href={`/s/${slug}/schedule`}
          className="block w-full py-3 rounded-xl text-[13px] font-bold border border-neutral-300 dark:border-neutral-700"
        >
          시간표로 돌아가기
        </Link>
      </div>
    </div>
  );
}
