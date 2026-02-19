'use client';

import { useState, useCallback } from 'react';
import { buildTossCustomerKey } from '@/lib/billing/toss-customer-key';

const TOSS_CLIENT_KEY =
  typeof window !== 'undefined' ? process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY : undefined;

export interface TossBillingAuthParams {
  planId?: string;
  cycle?: string;
  returnTo?: string;
}

let scriptLoaded: Promise<void> | null = null;

function loadTossScript(): Promise<void> {
  if (scriptLoaded) return scriptLoaded;
  scriptLoaded = new Promise((resolve, reject) => {
    if ((window as any).TossPayments) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://js.tosspayments.com/v2/standard';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('토스페이먼츠 스크립트 로드 실패'));
    document.body.appendChild(script);
  });
  return scriptLoaded;
}

export function useTossBillingAuth(academyId: string) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openCardRegistration = useCallback(
    async (params?: TossBillingAuthParams) => {
      if (!TOSS_CLIENT_KEY) {
        setError('결제 설정이 완료되지 않았습니다.');
        return;
      }
      setError(null);
      setLoading(true);
      try {
        await loadTossScript();
        const TossPayments = (window as any).TossPayments;
        if (!TossPayments) throw new Error('토스페이먼츠 SDK를 불러올 수 없습니다.');

        const customerKey = buildTossCustomerKey(academyId);
        const baseUrl = window.location.origin;
        let successUrl = `${baseUrl}/academy-admin/${academyId}/billing/callback`;
        if (params?.returnTo || params?.planId || params?.cycle) {
          const q = new URLSearchParams();
          if (params.returnTo) q.set('returnTo', params.returnTo);
          if (params.planId) q.set('planId', params.planId);
          if (params.cycle) q.set('cycle', params.cycle);
          successUrl += '?' + q.toString();
        }
        const failUrl = `${baseUrl}/academy-admin/${academyId}/billing?billing=fail`;

        const tossPayments = TossPayments(TOSS_CLIENT_KEY);
        const payment = tossPayments.payment({ customerKey });
        await payment.requestBillingAuth({
          method: 'CARD',
          successUrl,
          failUrl,
          customerEmail: '',
          customerName: '',
        });
      } catch (err: any) {
        setError(err?.message ?? '카드 등록 창을 열 수 없습니다.');
      } finally {
        setLoading(false);
      }
    },
    [academyId]
  );

  return { openCardRegistration, loading, error };
}
