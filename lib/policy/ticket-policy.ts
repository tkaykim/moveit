/**
 * 수강권 규칙엔진 — 환불/자동개시/일시정지 순수 계산 함수.
 * DB tickets.refund_policy / tickets.pause_policy / tickets.auto_start_days 와 짝을 이룬다.
 * UI·API 어디서든 이 모듈만 사용한다 (계산 로직 중복 금지).
 */

/** 환불 규칙.
 * - step: 개시일로부터 경과일 구간별 환불율 (실제 학원 관행: 1MILLION식 10일 내 2/3 → 15일 내 50% → 이후 불가)
 * - prorata: (총액 - 사용분) 기준 일할/회차 공제 후 잔액 환불
 * - none: 환불 불가 (워크샵/원데이 관행)
 */
export interface RefundPolicy {
  mode: 'step' | 'prorata' | 'none';
  /** mode=step 일 때: 경과일 상한(until_days)과 환불율(rate 0~1). until_days 오름차순. */
  steps?: { until_days: number; rate: number }[];
  /** mode=prorata 일 때: 사용 회차/일수 공제 여부 (기본 true) */
  deduct_used?: boolean;
  /** 사용분 공제 시 1회 정가(미지정 시 price/total_count) */
  per_unit_price?: number;
}

export interface PausePolicy {
  /** 1회 최대 정지 일수 */
  max_days: number;
  /** 수강권당 최대 정지 횟수 */
  max_times: number;
}

// ⚠ 환불액 "계산"의 단일 소스는 lib/refund/calc.ts (computeRefund) —
// tickets.refund_policy(여기의 RefundPolicy 형태)는 calc.ts의 customPolicy 입력으로 전달돼 우선 적용된다.
// 이 모듈은 정책의 타입 정의·고지 문구·자동개시·일시정지 검증만 담당한다 (계산 로직 중복 금지).

/** 자동 개시일 계산: 구매일 + auto_start_days. null이면 자동 개시 없음. */
export function computeAutoStartDate(purchasedAt: Date, autoStartDays: number | null | undefined): Date | null {
  if (!autoStartDays || autoStartDays <= 0) return null;
  const d = new Date(purchasedAt);
  d.setDate(d.getDate() + autoStartDays);
  return d;
}

/** 일시정지 신청 검증 */
export function validatePauseRequest(
  policy: PausePolicy | null | undefined,
  requestedDays: number,
  priorPauseCount: number,
): { ok: boolean; reason?: string } {
  if (!policy) return { ok: true };
  if (priorPauseCount >= policy.max_times) {
    return { ok: false, reason: `일시정지는 최대 ${policy.max_times}회까지 가능합니다.` };
  }
  if (requestedDays > policy.max_days) {
    return { ok: false, reason: `1회 최대 ${policy.max_days}일까지 정지할 수 있습니다.` };
  }
  return { ok: true };
}

/** 규칙을 학생에게 보여줄 한국어 요약으로 변환 (구매 화면 고지용) */
export function describePolicies(opts: {
  refund?: RefundPolicy | null;
  pause?: PausePolicy | null;
  autoStartDays?: number | null;
  validDays?: number | null;
}): string[] {
  const lines: string[] = [];
  if (opts.validDays) lines.push(`유효기간: 개시일로부터 ${opts.validDays}일`);
  if (opts.autoStartDays) lines.push(`구매 후 ${opts.autoStartDays}일이 지나면 자동으로 개시됩니다`);
  const r = opts.refund;
  if (r) {
    if (r.mode === 'none') lines.push('환불 불가 상품입니다');
    else if (r.mode === 'step' && r.steps?.length) {
      const sorted = [...r.steps].sort((a, b) => a.until_days - b.until_days);
      const parts = sorted
        .filter((s) => s.rate > 0)
        .map((s) => `${s.until_days}일 이내 ${Math.round(s.rate * 100)}%`);
      const hasCutoff = sorted.some((s) => s.rate === 0);
      lines.push(`환불: 개시 후 ${parts.join(' · ')}${hasCutoff ? ' · 이후 환불 불가' : ''}`);
    } else lines.push('환불: 사용분(회차/일할) 공제 후 잔액 환불');
  }
  if (opts.pause) lines.push(`일시정지: 최대 ${opts.pause.max_times}회, 회당 ${opts.pause.max_days}일`);
  return lines;
}
