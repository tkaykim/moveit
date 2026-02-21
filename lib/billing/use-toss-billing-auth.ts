'use client';

import { useState, useCallback } from 'react';
import { buildTossCustomerKey } from '@/lib/billing/toss-customer-key';
import { isCapacitorNative, APP_SCHEME, getPaymentSuccessUrl, getPaymentFailUrl } from '@/lib/capacitor/env';

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
        const q: Record<string, string> = {};
        if (params?.returnTo) q.returnTo = params.returnTo;
        if (params?.planId) q.planId = params.planId;
        if (params?.cycle) q.cycle = params.cycle;
        const successUrl = getPaymentSuccessUrl(`academy-admin/${academyId}/billing/callback`, Object.keys(q).length ? q : undefined);
        const failUrl = getPaymentFailUrl(`academy-admin/${academyId}/billing`, { billing: 'fail' });

        const tossPayments = TossPayments(TOSS_CLIENT_KEY);
        const payment = tossPayments.payment({ customerKey });
        await payment.requestBillingAuth({
          method: 'CARD',
          successUrl,
          failUrl,
          customerEmail: '',
          customerName: '',
          ...(isCapacitorNative() && { appScheme: APP_SCHEME }),
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
