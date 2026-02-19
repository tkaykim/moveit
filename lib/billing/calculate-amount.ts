/**
 * 프로모/쿠폰 적용 후 최종 결제 금액 계산 (원).
 * discount_percent: 0~100, first_month_free: 첫 결제만 0원 처리 시 true.
 */
export function calculateAmount(
  baseAmount: number,
  options?: {
    discountPercent?: number | null;
    firstMonthFree?: boolean;
  }
): number {
  if (baseAmount <= 0) return 0;
  if (options?.firstMonthFree) return 0;
  const pct = options?.discountPercent;
  if (pct != null && pct > 0) {
    const discounted = Math.round((baseAmount * (100 - pct)) / 100);
    return Math.max(0, discounted);
  }
  return baseAmount;
}
