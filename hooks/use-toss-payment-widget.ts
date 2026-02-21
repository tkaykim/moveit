'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { isNativePlatform } from '@/lib/capacitor/platform';
import { getTicketPaymentSuccessUrl, getTicketPaymentFailUrl } from '@/lib/toss/payment-urls';

const TOSS_SCRIPT_URL = 'https://js.tosspayments.com/v2/standard';
const WIDGET_AGREEMENT_VARIANT = 'DEFAULT';
const WIDGET_PAYMENT_METHODS_VARIANT = 'DEFAULT';

let scriptLoadPromise: Promise<void> | null = null;

function loadTossScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('window undefined'));
  if ((window as any).TossPayments) return Promise.resolve();
  if (scriptLoadPromise) return scriptLoadPromise;
  scriptLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = TOSS_SCRIPT_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('토스페이먼츠 스크립트 로드 실패'));
    document.body.appendChild(script);
  });
  return scriptLoadPromise;
}

export interface UseTossPaymentWidgetParams {
  clientKey: string;
  customerKey: string;
  amount: number;
  orderId: string;
  orderName: string;
  sessionId: string;
  returnTo?: string;
  paymentMethodsSelector: string;
  agreementSelector: string;
}

export interface UseTossPaymentWidgetReturn {
  isReady: boolean;
  error: string | null;
  renderWidgets: () => Promise<void>;
  requestPayment: (params?: { customerEmail?: string; customerName?: string }) => Promise<void>;
  destroy: () => Promise<void>;
}

export function useTossPaymentWidget(params: UseTossPaymentWidgetParams): UseTossPaymentWidgetReturn {
  const {
    clientKey,
    customerKey,
    amount,
    orderId,
    orderName,
    sessionId,
    returnTo = 'session',
    paymentMethodsSelector,
    agreementSelector,
  } = params;

  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const widgetsRef = useRef<{ setAmount: (p: { value: number; currency: string }) => Promise<void>; renderPaymentMethods: (p: { selector: string; variantKey?: string }) => Promise<unknown>; renderAgreement: (p: { selector: string; variantKey?: string }) => Promise<unknown>; requestPayment: (p: Record<string, unknown>) => Promise<void>; destroy?: () => Promise<void> } | null>(null);
  const paymentMethodInstanceRef = useRef<{ destroy?: () => Promise<void> } | null>(null);
  const agreementInstanceRef = useRef<{ destroy?: () => Promise<void> } | null>(null);

  const renderWidgets = useCallback(async () => {
    if (!clientKey) {
      setError('결제 설정이 완료되지 않았습니다.');
      return;
    }
    setError(null);
    try {
      await destroy();
      await loadTossScript();
      const TossPayments = (window as any).TossPayments;
      if (!TossPayments) {
        throw new Error('토스페이먼츠 SDK를 불러올 수 없습니다.');
      }
      const widgets = TossPayments(clientKey).widgets({ customerKey });
      await widgets.setAmount({ value: amount, currency: 'KRW' });
      const [paymentMethodWidget, agreementWidget] = await Promise.all([
        widgets.renderPaymentMethods({ selector: paymentMethodsSelector, variantKey: WIDGET_PAYMENT_METHODS_VARIANT }),
        widgets.renderAgreement({ selector: agreementSelector, variantKey: WIDGET_AGREEMENT_VARIANT }),
      ]);
      widgetsRef.current = widgets as any;
      paymentMethodInstanceRef.current = paymentMethodWidget as any;
      agreementInstanceRef.current = agreementWidget as any;
      setIsReady(true);
    } catch (e: any) {
      setError(e?.message ?? '결제위젯을 불러올 수 없습니다.');
      setIsReady(false);
    }
  }, [clientKey, customerKey, amount, paymentMethodsSelector, agreementSelector]);

  const requestPayment = useCallback(
    async (opts?: { customerEmail?: string; customerName?: string }) => {
      const widgets = widgetsRef.current;
      if (!widgets?.requestPayment) {
        throw new Error('결제위젯이 준비되지 않았습니다.');
      }
      const successUrl = getTicketPaymentSuccessUrl({ sessionId, returnTo });
      const failUrl = getTicketPaymentFailUrl({ sessionId });
      const payload: Record<string, unknown> = {
        orderId,
        orderName,
        successUrl,
        failUrl,
        customerEmail: opts?.customerEmail ?? '',
        customerName: opts?.customerName ?? '',
      };
      if (isNativePlatform()) {
        payload.appScheme = 'moveitapp://';
      }
      await widgets.requestPayment(payload);
    },
    [orderId, orderName, sessionId, returnTo]
  );

  const destroy = useCallback(async () => {
    try {
      if (paymentMethodInstanceRef.current?.destroy) {
        await paymentMethodInstanceRef.current.destroy();
      }
      if (agreementInstanceRef.current?.destroy) {
        await agreementInstanceRef.current.destroy();
      }
    } finally {
      widgetsRef.current = null;
      paymentMethodInstanceRef.current = null;
      agreementInstanceRef.current = null;
      setIsReady(false);
    }
  }, []);

  useEffect(() => {
    return () => {
      destroy();
    };
  }, [destroy]);

  return { isReady, error, renderWidgets, requestPayment, destroy };
}
