/**
 * 수강권 환불액 산정 엔진 (서버 단일 소스).
 *
 * 기본 정책 = 학원법 시행령 교습비 반환기준(요지) + 정가(original_price) 차감.
 * 산출된 값은 "권장 환불액"이며, 관리자가 모달에서 최종 금액을 직접 조정할 수 있다(학원 자율).
 *
 * - 기간제(PERIOD): 진행률(경과일/총유효일) 구간별
 *     시작 전          → 전액(100%)
 *     1/3 경과 전      → 2/3
 *     1/2 경과 전      → 1/2
 *     1/2 경과 후      → 0
 *   (교습기간 1개월 이내 기준. 장기 수강권은 월할 계산이 더 정확 — 권장값은 근사이며 관리자 조정 전제)
 * - 횟수제/워크샵(COUNT·popup): 결제액 − (사용회차 × 정가 1회 단가),  정가단가 = original_price / 총수량
 *     사용회차 = "실제 출석(COMPLETED) 회차". 미래 예약(취소 예정)·취소된 예약은 부과하지 않음.
 *     (remaining_count 는 예약 시점에 차감되고 취소 복구가 누락될 수 있어, 출석 기준이 정확.)
 *     (1회 워크샵은 미참석→전액, 참석→0 으로 자연 수렴)
 * - 만료(EXPIRED): 권장 0 (관리자 override 가능)
 *
 * 모든 결과는 [0, 결제액] 범위로 clamp.
 */

export type RefundTicketKind = 'PERIOD' | 'COUNT' | 'WORKSHOP';

/** 학원별 커스텀 환불 규칙 (tickets.refund_policy jsonb). 미지정/prorata = 아래 기본(학원법) 로직. */
export interface CustomRefundPolicy {
  mode: 'step' | 'prorata' | 'none';
  /** mode=step: 개시 후 경과일 상한별 환불율 (예: 1MILLION식 10일 2/3 → 15일 1/2 → 이후 0) */
  steps?: { until_days: number; rate: number }[];
}

export interface RefundCalcInput {
  ticketTypeSnapshot?: string | null; // revenue_transactions.ticket_type_snapshot ('COUNT'|'PERIOD'|...)
  ticketCategory?: string | null;     // tickets.ticket_category ('regular'|'popup')
  customPolicy?: CustomRefundPolicy | null; // tickets.refund_policy — 학원이 상품에 지정한 규칙(있으면 우선)
  quantity?: number | null;           // 구매 총 회차(횟수제) — revenue.quantity
  remainingCount?: number | null;     // user_tickets.remaining_count (현재 잔여 — 표시용)
  attendedCount?: number | null;      // 실제 출석(COMPLETED) 예약 수 — 부과 기준. null이면 (총-잔여) fallback
  startDate?: string | null;          // user_tickets.start_date (YYYY-MM-DD)
  expiryDate?: string | null;         // user_tickets.expiry_date (YYYY-MM-DD)
  validDays?: number | null;          // revenue.valid_days (총 유효일)
  ticketStatus?: string | null;       // user_tickets.status (ACTIVE/USED/EXPIRED/REFUNDED)
  originalPrice?: number | null;      // revenue.original_price (할인 전 정가)
  finalPrice: number;                 // revenue.final_price (실결제액)
  /** 기준 시각(테스트용). 미지정 시 호출자가 new Date() 전달 */
  nowISO: string;
}

export interface RefundCalcResult {
  kind: RefundTicketKind;
  paidAmount: number;          // 실결제액(환불 가능 상한)
  suggestedRefund: number;     // 권장 환불액(정수, [0, paid])
  /** 한 줄 산정 근거(관리자에게 표시) */
  basis: string;
  /** 세부 산식 항목(표시용) */
  breakdown: {
    label: string;
    value: string;
  }[];
  /** 기간제 진행률(0~1) — 표시용, 해당 시에만 */
  progress?: number;
  /** 횟수제 사용(출석)/총/잔여 — 표시용, 해당 시에만 */
  usedCount?: number;
  totalCount?: number;
  remainingCount?: number;
  /** 잔여 기간(일). null=무기한 */
  remainingDays?: number | null;
  expired: boolean;
}

function clampMoney(v: number, max: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(Math.round(v), max));
}

/** YYYY-MM-DD 또는 ISO 문자열을 UTC 자정 기준 epoch(ms)로 (일 단위 계산용) */
function dayStart(value: string): number {
  const d = new Date(value);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/** 만료일까지 잔여 일수(음수면 0). 표시용 문자열 함께 반환. */
function remainingPeriod(expiryDate: string | null | undefined, nowISO: string): { days: number | null; label: string } {
  if (!expiryDate) return { days: null, label: '무기한' };
  const days = Math.round((dayStart(expiryDate) - dayStart(nowISO)) / 86400000);
  if (days < 0) return { days: 0, label: `만료 ${expiryDate} (기간 지남)` };
  return { days, label: `${expiryDate}까지 (잔여 ${days}일)` };
}

export function computeRefund(input: RefundCalcInput): RefundCalcResult {
  const paid = Math.max(0, Math.round(input.finalPrice || 0));
  const type = (input.ticketTypeSnapshot || '').toUpperCase();
  const isPeriod = type === 'PERIOD';
  const isWorkshop = (input.ticketCategory || '').toLowerCase() === 'popup';
  const kind: RefundTicketKind = isPeriod ? 'PERIOD' : isWorkshop ? 'WORKSHOP' : 'COUNT';
  const expired = (input.ticketStatus || '').toUpperCase() === 'EXPIRED';

  // 만료 건: 법정 환불 대상 아님(권장 0). 관리자 override 가능.
  if (expired) {
    return {
      kind,
      paidAmount: paid,
      suggestedRefund: 0,
      basis: '만료된 수강권 — 법정 환불 대상이 아닙니다(권장 0원). 필요 시 학원 재량으로 금액을 직접 입력하세요.',
      breakdown: [
        { label: '결제액', value: `${paid.toLocaleString()}원` },
        { label: '상태', value: '만료(EXPIRED)' },
      ],
      expired: true,
    };
  }

  // ── 학원별 커스텀 규칙(tickets.refund_policy) 우선 적용 ──
  const custom = input.customPolicy;
  if (custom?.mode === 'none') {
    return {
      kind,
      paidAmount: paid,
      suggestedRefund: 0,
      basis: '이 상품은 학원이 지정한 "환불 불가" 상품입니다(구매 시 고지). 필요 시 재량으로 금액을 직접 입력하세요.',
      breakdown: [
        { label: '결제액', value: `${paid.toLocaleString()}원` },
        { label: '상품 규칙', value: '환불 불가' },
      ],
      expired: false,
    };
  }
  if (custom?.mode === 'step' && custom.steps?.length) {
    const now = dayStart(input.nowISO);
    const started = !!input.startDate && dayStart(input.startDate) <= now;
    if (!started) {
      return {
        kind,
        paidAmount: paid,
        suggestedRefund: paid,
        basis: '개시 전 수강권 — 학원 지정 규칙상 전액 환불.',
        breakdown: [
          { label: '결제액', value: `${paid.toLocaleString()}원` },
          { label: '상태', value: '개시 전(전액)' },
        ],
        expired: false,
      };
    }
    const elapsed = Math.floor((now - dayStart(input.startDate!)) / 86400000);
    const sorted = [...custom.steps].sort((a, b) => a.until_days - b.until_days);
    const hit = sorted.find((s) => elapsed <= s.until_days);
    const rate = hit ? Math.max(0, Math.min(1, hit.rate)) : 0;
    const suggested = clampMoney(paid * rate, paid);
    const bracket = hit
      ? `개시 ${hit.until_days}일 이내 구간 → ${Math.round(rate * 100)}%`
      : `환불 가능 기간(${sorted[sorted.length - 1].until_days}일) 초과 → 0%`;
    return {
      kind,
      paidAmount: paid,
      suggestedRefund: suggested,
      basis: `학원 지정 단계별 규칙 · 개시 후 ${elapsed}일 경과, ${bracket}. 재량 조정 가능합니다.`,
      breakdown: [
        { label: '결제액', value: `${paid.toLocaleString()}원` },
        { label: '개시 후 경과', value: `${elapsed}일` },
        { label: '적용 구간', value: bracket },
        { label: '권장 환불액', value: `${suggested.toLocaleString()}원` },
      ],
      expired: false,
    };
  }

  if (isPeriod) {
    const now = dayStart(input.nowISO);
    let totalDays = input.validDays && input.validDays > 0 ? input.validDays : null;
    if (!totalDays && input.startDate && input.expiryDate) {
      totalDays = Math.max(1, Math.round((dayStart(input.expiryDate) - dayStart(input.startDate)) / 86400000));
    }
    const start = input.startDate ? dayStart(input.startDate) : now;
    const elapsedDays = Math.floor((now - start) / 86400000);
    const rem = remainingPeriod(input.expiryDate, input.nowISO);

    // 학원법 구간 비율: 진행률<1/3→2/3, <1/2→1/2, 이후→0
    const bracketRatio = (p: number) => (p < 1 / 3 ? 2 / 3 : p < 1 / 2 ? 1 / 2 : 0);

    let suggested: number;
    let bracket: string;
    let basisNote: string;

    if (!totalDays) {
      const ratio = elapsedDays <= 0 ? 1 : 0.5;
      bracket = elapsedDays <= 0 ? '시작 전(전액)' : '진행 중(유효기간 불명 — 1/2 적용)';
      suggested = clampMoney(paid * ratio, paid);
      basisNote = '유효기간 정보가 없어 보수적으로 적용했습니다. 직접 조정하세요.';
    } else if (elapsedDays <= 0) {
      bracket = '교습 시작 전(전액)';
      suggested = paid;
      basisNote = '';
    } else if (totalDays <= 31) {
      // 1개월 이내 단기: 총 기간 기준 단일 구간
      const p = elapsedDays / totalDays;
      const ratio = bracketRatio(p);
      bracket = ratio === 2 / 3 ? '총 기간 1/3 경과 전(2/3)' : ratio === 1 / 2 ? '총 기간 1/2 경과 전(1/2)' : '총 기간 1/2 경과 후(반환 없음)';
      suggested = clampMoney(paid * ratio, paid);
      basisNote = '';
    } else {
      // 1개월 초과 장기: 학원법 월할 — 지난 달 전액소진, 당월은 구간비율, 잔여 달 전액환급
      const months = Math.max(1, Math.round(totalDays / 30));
      const perMonthDays = totalDays / months;
      const monthlyFee = paid / months;
      const fullElapsed = Math.floor(elapsedDays / perMonthDays); // 완전히 지난 달 수
      if (fullElapsed >= months) {
        suggested = 0;
        bracket = `${months}개월 전부 경과(반환 없음)`;
      } else {
        const withinProgress = (elapsedDays - fullElapsed * perMonthDays) / perMonthDays;
        const curRatio = bracketRatio(withinProgress);
        const remainingFullMonths = months - fullElapsed - 1;
        suggested = clampMoney(monthlyFee * (remainingFullMonths + curRatio), paid);
        const curBracketLabel = curRatio === 2 / 3 ? '당월 1/3 전(2/3)' : curRatio === 1 / 2 ? '당월 1/2 전(1/2)' : '당월 반환없음';
        bracket = `${months}개월 중 ${fullElapsed + 1}개월차 · 잔여 ${remainingFullMonths}개월 전액 + ${curBracketLabel}`;
      }
      basisNote = `월 교습비 약 ${Math.round(monthlyFee).toLocaleString()}원 기준 월할 계산.`;
    }

    return {
      kind: 'PERIOD',
      paidAmount: paid,
      suggestedRefund: suggested,
      basis: `기간제 · 학원법 시행령 반환기준(${bracket}).${basisNote ? ' ' + basisNote : ''} 학원 재량으로 조정 가능합니다.`,
      breakdown: [
        { label: '결제액', value: `${paid.toLocaleString()}원` },
        { label: '경과/총일수', value: `${Math.max(0, elapsedDays)}일 / ${totalDays ?? '?'}일` },
        { label: '잔여 기간', value: rem.label },
        { label: '반환 구간', value: bracket },
        { label: '권장 환불액', value: `${suggested.toLocaleString()}원` },
      ],
      progress: totalDays ? elapsedDays / totalDays : undefined,
      remainingDays: rem.days,
      expired: false,
    };
  }

  // COUNT / WORKSHOP — 사용분 정가 차감
  const total = input.quantity && input.quantity > 0 ? input.quantity : 1;
  const remaining = input.remainingCount != null ? Math.max(0, input.remainingCount) : 0;
  // 부과 기준 = 실제 출석(COMPLETED) 회차. 없으면 (총-잔여) fallback.
  // 미래 예약은 환불 시 취소되어 부과하지 않고, 취소된 예약도 부과하지 않으므로 출석 기준이 정확.
  const attended = input.attendedCount != null ? Math.max(0, input.attendedCount) : Math.max(0, total - remaining);
  const used = Math.min(attended, total);
  // 정가 1회 단가 (할인 전 기준). original 없으면 결제액 기준 fallback.
  const baseForUnit = input.originalPrice && input.originalPrice > 0 ? input.originalPrice : paid;
  const unitPrice = Math.round(baseForUnit / total);
  const suggested = clampMoney(paid - used * unitPrice, paid);
  const rem = remainingPeriod(input.expiryDate, input.nowISO);

  const kindLabel = isWorkshop ? '워크샵/팝업' : '횟수제';
  return {
    kind: isWorkshop ? 'WORKSHOP' : 'COUNT',
    paidAmount: paid,
    suggestedRefund: suggested,
    basis: `${kindLabel} · 결제액 − (출석 ${used}회 × 정가 1회 ${unitPrice.toLocaleString()}원). 출석완료 회차만 차감(미래·취소 예약 미부과), 정가 기준이며 학원 재량 조정 가능.`,
    breakdown: [
      { label: '결제액', value: `${paid.toLocaleString()}원` },
      { label: '출석(사용) 회차', value: `${used}회 / 총 ${total}회` },
      { label: '잔여 횟수', value: `${remaining}회` },
      { label: '잔여 기간', value: rem.label },
      { label: '정가 1회 단가', value: `${unitPrice.toLocaleString()}원` },
      { label: '차감액', value: `−${(used * unitPrice).toLocaleString()}원` },
      { label: '권장 환불액', value: `${suggested.toLocaleString()}원` },
    ],
    usedCount: used,
    totalCount: total,
    remainingCount: remaining,
    remainingDays: rem.days,
    expired: false,
  };
}

// ⚠ 이 파일은 T7 이전(HEAD=bb53a61) lib/refund/calc.ts 의 **한 글자도 다르지 않은 사본**이다.
// 손으로 고치지 말 것. 하위호환 회귀 테스트가 현재 엔진의 출력을 이 사본의 출력과 대조한다.
// 재생성: git show bb53a61:lib/refund/calc.ts > tests/fixtures/refund-calc-legacy.ts
