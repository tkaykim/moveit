/**
 * 토스페이먼츠 PG 결제 노출 여부.
 * true일 때만 사용자/관리자 화면에서 카드·토스 계좌이체 결제 UI가 노출됨.
 * false 또는 미설정 시: 계좌이체는 학원 계좌 안내 + 입금 대기 플로우만 사용.
 * (코드는 삭제하지 않고 조건 분기로만 제어)
 */
export const ENABLE_TOSS_PAYMENT =
  process.env.NEXT_PUBLIC_ENABLE_TOSS_PAYMENT === 'true';
