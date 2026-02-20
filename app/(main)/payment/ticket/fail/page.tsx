'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

function TicketPaymentFailContent() {
  const searchParams = useSearchParams();
  const code = searchParams.get('code') || '';
  const message = searchParams.get('message') || '결제에 실패했습니다.';
  const sessionId = searchParams.get('sessionId');

  return (
    <div className="min-h-[40vh] flex flex-col items-center justify-center p-6">
      <div className="text-center max-w-md">
        <h2 className="text-lg font-bold text-red-600 dark:text-red-400 mb-2">결제 실패</h2>
        <p className="text-neutral-600 dark:text-neutral-400 mb-1">{message}</p>
        {code && <p className="text-sm text-neutral-500 mb-4">코드: {code}</p>}
        <div className="flex gap-3 justify-center">
          {sessionId && (
            <Link
              href={`/book/session/${sessionId}`}
              className="px-4 py-2 rounded-lg bg-neutral-200 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 text-sm font-medium"
            >
              다시 예약하기
            </Link>
          )}
          <Link
            href="/my/tickets"
            className="px-4 py-2 rounded-lg bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 text-sm font-medium"
          >
            수강권 목록
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function TicketPaymentFailPage() {
  return (
    <Suspense fallback={<div className="min-h-[40vh] flex items-center justify-center p-6"><p className="text-neutral-600 dark:text-neutral-400">로딩 중…</p></div>}>
      <TicketPaymentFailContent />
    </Suspense>
  );
}
