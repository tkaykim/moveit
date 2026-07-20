'use client';

/**
 * Toss 결제 성공 콜백 처리 화면 (T-P)
 *
 * 규율:
 *   ① Toss 가 넘겨준 paymentKey/orderId/amount 로 서버 확정을 부른다.
 *      확정 성공 → 주문 상태 화면으로. (상태의 정본은 언제나 서버)
 *   ② 확정 호출이 실패해도 **돈이 승인됐을 수 있다** — 그러면 실패라고 단정하지 않는다.
 *      주문 상태 화면이 PAYMENT_APPROVED("처리 중")/FAILED 를 정직하게 보여주므로,
 *      복구 안내와 함께 그 화면으로 갈 수 있게 한다.
 *   ③ 파라미터가 없으면(직접 진입 등) 조용히 죽지 않고 안내한다.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Loader2, AlertTriangle } from 'lucide-react';
import { fetchWithAuth } from '@/lib/api/auth-fetch';
import { clearCart } from '@/lib/miniapp/cart';

const PENDING_SIG_KEY = (academyId: string) => `miniapp-pending-order-sig:${academyId}`;

type Stage = 'confirming' | 'recover' | 'invalid';

export function TossCallbackView({
  slug,
  academyId,
}: {
  slug: string;
  academyId: string;
}) {
  const router = useRouter();
  const search = useSearchParams();
  const [stage, setStage] = useState<Stage>('confirming');
  const [message, setMessage] = useState<string | null>(null);
  const ran = useRef(false);

  const paymentKey = search.get('paymentKey');
  const orderId = search.get('orderId');
  const amountRaw = search.get('amount');

  const confirm = useCallback(async () => {
    if (!paymentKey || !orderId || !amountRaw) {
      setStage('invalid');
      return;
    }
    const amount = Number(amountRaw);
    try {
      const res = await fetchWithAuth('/api/orders/toss-confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, paymentKey, amount }),
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        // 확정 성공 — 장바구니를 비우고 상태 화면으로.
        try {
          clearCart(academyId);
          window.localStorage.removeItem(PENDING_SIG_KEY(academyId));
        } catch {
          /* noop */
        }
        router.replace(`/s/${slug}/orders/${encodeURIComponent(orderId)}`);
        return;
      }

      // 확정 호출은 실패했지만 — 상태 화면이 진실을 말한다.
      // 승인 금액 불일치/일시 오류일 수 있으니 실패라고 단정하지 않는다.
      setMessage(data?.error || '결제 확인 중 문제가 발생했습니다.');
      setStage('recover');
    } catch {
      setMessage('네트워크 오류로 결제 확인을 마치지 못했습니다.');
      setStage('recover');
    }
  }, [paymentKey, orderId, amountRaw, academyId, router, slug]);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    void confirm();
  }, [confirm]);

  if (stage === 'confirming') {
    return (
      <div className="flex flex-col items-center justify-center py-24" data-testid="toss-callback">
        <Loader2 className="animate-spin" size={26} style={{ color: 'var(--primary)' }} />
        <p className="mt-4 text-[13px] text-neutral-500">결제를 확인하고 있습니다…</p>
      </div>
    );
  }

  if (stage === 'invalid') {
    return (
      <div className="px-5 pt-12 text-center" data-testid="toss-callback" data-stage="invalid">
        <AlertTriangle size={26} className="mx-auto text-neutral-400 mb-3" />
        <p className="text-sm font-semibold">결제 정보를 확인할 수 없습니다</p>
        <p className="text-xs text-neutral-500 mt-1.5 leading-relaxed">
          결제 창을 통해 다시 시도해 주세요.
        </p>
        <Link
          href={`/s/${slug}/cart`}
          className="inline-block mt-5 px-4 py-2.5 rounded-xl text-[13px] font-bold text-white"
          style={{ backgroundColor: 'var(--primary)' }}
        >
          장바구니로 돌아가기
        </Link>
      </div>
    );
  }

  // recover — 확정 호출은 실패했지만 승인됐을 수 있다. 정직하게 상태 화면으로 안내한다.
  return (
    <div className="px-5 pt-12 text-center" data-testid="toss-callback" data-stage="recover">
      <AlertTriangle size={26} className="mx-auto text-amber-500 mb-3" />
      <h1 className="text-[17px] font-extrabold" data-testid="toss-recover-headline">
        결제 확인을 마무리하지 못했습니다
      </h1>
      <p className="text-[13px] text-neutral-500 mt-2 leading-relaxed" data-testid="toss-recover-message">
        결제가 승인되었다면 금액은 안전하게 기록되어 있습니다.
        <br />
        주문 상태에서 진행 상황을 확인할 수 있고, 필요하면 학원에 문의해 주세요.
      </p>
      {message && <p className="text-[11px] text-neutral-400 mt-2 break-all">{message}</p>}
      <div className="mt-6 space-y-2">
        {orderId && (
          <Link
            href={`/s/${slug}/orders/${encodeURIComponent(orderId)}`}
            data-testid="toss-recover-status-link"
            className="block w-full py-3 rounded-xl text-[13px] font-bold text-white"
            style={{ backgroundColor: 'var(--primary)' }}
          >
            주문 상태 확인하기
          </Link>
        )}
        <Link
          href={`/s/${slug}/cart`}
          className="block w-full py-3 rounded-xl text-[13px] font-bold border border-neutral-300 dark:border-neutral-700"
        >
          장바구니로 돌아가기
        </Link>
      </div>
    </div>
  );
}
