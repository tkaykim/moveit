'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { fetchWithAuth } from '@/lib/api/auth-fetch';

/** 결제 확인 API는 멱등하지만, 클라이언트에서 동일 orderId로 중복 호출 방지 (Strict Mode·리마운트·searchParams 참조 변경 대비) */
const processedOrderIds = new Set<string>();
const REDIRECT_DELAY_MS = 1500;

function TicketPaymentSuccessContent() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const mountedRef = useRef(true);
  const redirectScheduledRef = useRef(false);
  const redirectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (redirectTimeoutRef.current) {
        clearTimeout(redirectTimeoutRef.current);
        redirectTimeoutRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const paymentKey = searchParams.get('paymentKey');
    const orderId = searchParams.get('orderId');
    const amount = searchParams.get('amount');
    const returnTo = searchParams.get('returnTo');
    const sessionId = searchParams.get('sessionId');

    if (!paymentKey || !orderId || !amount) {
      if (mountedRef.current) {
        setStatus('error');
        setMessage('결제 정보가 없습니다.');
      }
      return;
    }

    const amountNum = Number(amount);
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      if (mountedRef.current) {
        setStatus('error');
        setMessage('결제 정보가 올바르지 않습니다.');
      }
      return;
    }

    if (processedOrderIds.has(orderId)) {
      return;
    }
    processedOrderIds.add(orderId);

    const doRedirect = (toSession: boolean, sid: string | null) => {
      if (redirectScheduledRef.current) return;
      redirectScheduledRef.current = true;
      if (toSession && sid) {
        window.location.replace(`/book/session/${sid}/success?type=purchase`);
        return;
      }
      redirectTimeoutRef.current = setTimeout(() => {
        redirectTimeoutRef.current = null;
        window.location.replace('/my/tickets');
      }, REDIRECT_DELAY_MS);
    };

    (async () => {
      try {
        const res = await fetchWithAuth('/api/tickets/payment-confirm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ paymentKey, orderId, amount: amountNum }),
          cache: 'no-store',
        });
        const data = await res.json();

        if (!mountedRef.current) return;

        if (!res.ok) {
          setStatus('error');
          setMessage(data?.error || '결제 확인에 실패했습니다.');
          processedOrderIds.delete(orderId);
          return;
        }

        setStatus('success');
        setMessage(data?.message || '결제가 완료되었습니다.');

        if (returnTo === 'session' && sessionId) {
          doRedirect(true, sessionId);
          return;
        }
        doRedirect(false, null);
      } catch {
        if (mountedRef.current) {
          setStatus('error');
          setMessage('결제 처리 중 오류가 발생했습니다.');
          processedOrderIds.delete(orderId);
        }
      }
    })();
  // orderId 기준으로 한 번만 실행 (동일 주문 중복 확인 방지). 나머지 쿼리는 effect 내부에서 읽음.
  }, [searchParams.get('orderId') ?? '']);

  return (
    <div className="min-h-[40vh] flex flex-col items-center justify-center p-6">
      {status === 'loading' && (
        <p className="text-neutral-600 dark:text-neutral-400">결제를 확인하고 있습니다…</p>
      )}
      {status === 'success' && (
        <div className="text-center">
          <p className="text-green-600 dark:text-green-400 font-medium mb-4">{message}</p>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">잠시 후 수강권 페이지로 이동합니다.</p>
        </div>
      )}
      {status === 'error' && (
        <div className="text-center max-w-md">
          <p className="text-red-600 dark:text-red-400 font-medium mb-4">{message}</p>
          <a
            href="/my/tickets"
            className="inline-block px-4 py-2 rounded-lg bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 text-sm font-medium"
          >
            수강권으로 이동
          </a>
        </div>
      )}
    </div>
  );
}

export default function TicketPaymentSuccessPage() {
  return (
    <Suspense fallback={<div className="min-h-[40vh] flex items-center justify-center p-6"><p className="text-neutral-600 dark:text-neutral-400">결제를 확인하고 있습니다…</p></div>}>
      <TicketPaymentSuccessContent />
    </Suspense>
  );
}
