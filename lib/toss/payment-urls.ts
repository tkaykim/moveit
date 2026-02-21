/**
 * 토스페이먼츠 successUrl / failUrl 생성
 * 정책: 항상 결제창을 연 페이지와 같은 origin(https) 사용. 커스텀 스킴 미지원.
 */

function getOrigin(): string {
  if (typeof window === 'undefined') return '';
  return window.location.origin;
}

/**
 * 결제 성공 리다이렉트 URL (수강권)
 */
export function getTicketPaymentSuccessUrl(params: {
  sessionId: string;
  returnTo?: string;
}): string {
  const origin = getOrigin();
  const q = new URLSearchParams();
  if (params.returnTo) q.set('returnTo', params.returnTo);
  q.set('sessionId', params.sessionId);
  return `${origin}/payment/ticket/success?${q.toString()}`;
}

/**
 * 결제 실패 리다이렉트 URL (수강권)
 */
export function getTicketPaymentFailUrl(params: { sessionId: string }): string {
  const origin = getOrigin();
  return `${origin}/payment/ticket/fail?sessionId=${params.sessionId}`;
}
