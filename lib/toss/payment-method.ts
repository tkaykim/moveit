/**
 * Toss 결제 승인 API 응답의 method, easyPay.provider 값을
 * 우리 DB/UI용 결제 수단 코드로 변환
 * @see https://docs.tosspayments.com - 결제 승인 응답 (method: 카드, 가상계좌, 계좌이체, 휴대폰, 간편결제 등)
 */
export function getTossPaymentMethodCode(tossPayment: {
  method?: string;
  easyPay?: { provider?: string } | null;
}): string {
  const m = tossPayment.method;
  if (m === '가상계좌') return 'TOSS_VIRTUAL_ACCOUNT';
  if (m === '계좌이체') return 'TOSS_TRANSFER';
  if (m === '휴대폰') return 'TOSS_MOBILE';
  if (m === '간편결제') {
    const p = tossPayment.easyPay?.provider;
    if (p === '카카오페이') return 'TOSS_EASYPAY_KAKAO';
    if (p === '토스페이') return 'TOSS_EASYPAY_TOSSPAY';
    if (p === '네이버페이') return 'TOSS_EASYPAY_NAVER';
    if (p === '페이코') return 'TOSS_EASYPAY_PAYCO';
    if (p) return `TOSS_EASYPAY_${String(p).replace(/\s/g, '_')}`;
    return 'TOSS_EASYPAY';
  }
  // 카드 또는 기타
  return 'TOSS_CARD';
}

/** 결제 수단 코드 → 사용자/관리자 화면 표시 라벨 */
export function getPaymentMethodDisplayLabel(code: string | null | undefined): string {
  if (!code) return '';
  const map: Record<string, string> = {
    TOSS_CARD: '카드',
    TOSS_VIRTUAL_ACCOUNT: '가상계좌',
    TOSS_TRANSFER: '계좌이체',
    TOSS_MOBILE: '휴대폰',
    TOSS_EASYPAY: '간편결제',
    TOSS_EASYPAY_KAKAO: '카카오페이',
    TOSS_EASYPAY_TOSSPAY: '토스페이',
    TOSS_EASYPAY_NAVER: '네이버페이',
    TOSS_EASYPAY_PAYCO: '페이코',
    CARD_DEMO: '카드(테스트)',
    TEST: '테스트',
    CASH: '현금',
  };
  if (map[code]) return map[code];
  if (code.startsWith('TOSS_EASYPAY_')) return code.replace('TOSS_EASYPAY_', '') || '간편결제';
  return code;
}
