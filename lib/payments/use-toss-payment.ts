'use client';

/**
 * Toss Payments v2 **일회성 결제** 위젯 (학생 카드결제, T-P)
 *
 * billing 의 use-toss-billing-auth 는 B2B 카드 **등록**(requestBillingAuth)용이라
 * 여기서 쓰지 않는다. 학생 장바구니는 한 번짜리 결제(requestPayment)가 필요하다.
 *
 * 규율:
 *   ① 금액은 **서버가 만든 주문**의 total 만 넣는다. 화면 합계를 믿지 않는다.
 *   ② orderId = 우리가 미리 만든 provider_order_id. 재시도해도 같은 값(멱등).
 *   ③ SDK 로드 실패·키 없음이면 조용히 죽지 않고 명확한 오류를 던진다.
 *
 * ⚠ 실제 결제는 프로젝트 테스트 클라이언트 키(NEXT_PUBLIC_TOSS_CLIENT_KEY=test_gck_*)로만.
 */

import { useCallback, useState } from 'react';

const TOSS_CLIENT_KEY =
  typeof window !== 'undefined' ? process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY : undefined;

const TOSS_SDK_URL = 'https://js.tosspayments.com/v2/standard';

export interface TossOneTimePaymentParams {
  /** = provider_order_id. Toss 의 orderId 로 그대로 들어간다. */
  orderId: string;
  /** 서버가 계산한 결제 총액(원). 화면 합계가 아니다. */
  amount: number;
  /** 결제창에 표시할 짧은 라벨 */
  orderName: string;
  successUrl: string;
  failUrl: string;
  customerName?: string | null;
  customerEmail?: string | null;
}

let scriptPromise: Promise<void> | null = null;

/** SDK 스크립트를 한 번만 로드한다. 이미 있으면 즉시 resolve. */
function loadTossScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('브라우저에서만 결제할 수 있습니다.'));
  if ((window as any).TossPayments) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${TOSS_SDK_URL}"]`);
    if (existing) {
      if ((window as any).TossPayments) return resolve();
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('토스페이먼츠 스크립트 로드 실패')));
      return;
    }
    const script = document.createElement('script');
    script.src = TOSS_SDK_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      scriptPromise = null; // 다음 시도에서 다시 붙일 수 있게
      reject(new Error('토스페이먼츠 스크립트 로드 실패'));
    };
    document.body.appendChild(script);
  });
  return scriptPromise;
}

/**
 * 결제창을 연다. 성공/실패 모두 successUrl/failUrl 로 **리다이렉트**되므로,
 * 정상 흐름에서는 이 Promise 의 resolve 이후 코드가 실행되지 않는다
 * (창을 닫거나 SDK 오류일 때만 reject 로 돌아온다).
 */
export async function requestTossOneTimePayment(params: TossOneTimePaymentParams): Promise<void> {
  if (!TOSS_CLIENT_KEY) {
    throw new Error('결제 설정이 완료되지 않았습니다. (클라이언트 키 없음)');
  }
  if (!Number.isFinite(params.amount) || params.amount <= 0) {
    throw new Error('결제 금액이 올바르지 않습니다.');
  }

  await loadTossScript();
  const TossPayments = (window as any).TossPayments;
  if (typeof TossPayments !== 'function') {
    throw new Error('토스페이먼츠 SDK를 불러올 수 없습니다.');
  }

  const tossPayments = TossPayments(TOSS_CLIENT_KEY);
  // 일회성 결제는 회원 식별이 필요 없다 → ANONYMOUS.
  const customerKey = TossPayments.ANONYMOUS ?? 'ANONYMOUS';
  const payment = tossPayments.payment({ customerKey });

  await payment.requestPayment({
    method: 'CARD',
    amount: { currency: 'KRW', value: params.amount },
    orderId: params.orderId,
    orderName: params.orderName,
    successUrl: params.successUrl,
    failUrl: params.failUrl,
    customerName: params.customerName ?? undefined,
    customerEmail: params.customerEmail ?? undefined,
    card: {
      useEscrow: false,
      flowMode: 'DEFAULT',
      useCardPoint: false,
      useAppCardOnly: false,
    },
  });
}

/** 클라이언트 키가 설정돼 있는지 (버튼 노출·안내 분기용) */
export function isTossConfigured(): boolean {
  return !!TOSS_CLIENT_KEY;
}

/** 편의 훅 — loading/error 상태를 함께 관리한다. */
export function useTossPayment() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestPayment = useCallback(async (params: TossOneTimePaymentParams) => {
    setError(null);
    setLoading(true);
    try {
      await requestTossOneTimePayment(params);
      return { ok: true as const };
    } catch (err: any) {
      const message = err?.message ?? '결제창을 열 수 없습니다.';
      setError(message);
      return { ok: false as const, message };
    } finally {
      setLoading(false);
    }
  }, []);

  return { requestPayment, loading, error, configured: isTossConfigured() };
}
