/**
 * 구독 빌링 상수 (14일 무료 체험 등)
 */
export const TRIAL_DAYS = 14;

/**
 * 오늘 기준 체험 종료일 (DATE 문자열 YYYY-MM-DD)
 */
export function getTrialEndsAt(): string {
  const end = new Date();
  end.setDate(end.getDate() + TRIAL_DAYS);
  return end.toISOString().split('T')[0];
}
