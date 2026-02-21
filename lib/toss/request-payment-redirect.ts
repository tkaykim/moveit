/**
 * 토스페이먼츠 결제창(API 개별 연동) 방식으로 결제 요청 후 리다이렉트.
 * 기존 NEXT_PUBLIC_TOSS_CLIENT_KEY(ck) + TOSS_SECRET_KEY(sk) 세트로 동작.
 */

const TOSS_SCRIPT_URL = 'https://js.tosspayments.com/v2/standard';

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

export type TossPaymentMethod = 'CARD' | 'TRANSFER' | 'VIRTUAL_ACCOUNT' | 'MOBILE';

export interface RequestTossPaymentRedirectParams {
  clientKey: string;
  method: TossPaymentMethod;
  orderId: string;
  orderName: string;
  amount: number;
  successUrl: string;
  failUrl: string;
}

/**
 * 결제창 SDK requestPayment 호출 → 토스 페이지로 리다이렉트.
 * API 개별 연동 키(ck) 사용 가능.
 */
export async function requestTossPaymentRedirect(params: RequestTossPaymentRedirectParams): Promise<void> {
  const { clientKey, method, orderId, orderName, amount, successUrl, failUrl } = params;
  if (!clientKey) throw new Error('결제 설정이 완료되지 않았습니다.');
  await loadTossScript();
  const TossPayments = (window as any).TossPayments;
  if (!TossPayments) throw new Error('토스페이먼츠 SDK를 불러올 수 없습니다.');
  const tossPayments = TossPayments(clientKey);
  if (typeof tossPayments.requestPayment !== 'function') {
    throw new Error('토스페이먼츠 결제창을 사용할 수 없습니다.');
  }
  await tossPayments.requestPayment(method, {
    amount,
    orderId,
    orderName,
    successUrl,
    failUrl,
  });
}
