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
 *     (1회 워크샵은 미참석→전액, 참석→0 으로 자연 수렴)
 * - 만료(EXPIRED): 권장 0 (관리자 override 가능)
 *
 * 모든 결과는 [0, 결제액] 범위로 clamp.
 */

export type RefundTicketKind = 'PERIOD' | 'COUNT' | 'WORKSHOP';

export interface RefundCalcInput {
  ticketTypeSnapshot?: string | null; // revenue_transactions.ticket_type_snapshot ('COUNT'|'PERIOD'|...)
  ticketCategory?: string | null;     // tickets.ticket_category ('regular'|'popup')
  quantity?: number | null;           // 구매 총 회차(횟수제) — revenue.quantity
  remainingCount?: number | null;     // user_tickets.remaining_count
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
  /** 횟수제 사용/총 — 표시용, 해당 시에만 */
  usedCount?: number;
  totalCount?: number;
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

  if (isPeriod) {
    // 진행률 = 경과일 / 총유효일
    const now = dayStart(input.nowISO);
    let totalDays = input.validDays && input.validDays > 0 ? input.validDays : null;
    if (!totalDays && input.startDate && input.expiryDate) {
      totalDays = Math.max(1, Math.round((dayStart(input.expiryDate) - dayStart(input.startDate)) / 86400000));
    }
    const start = input.startDate ? dayStart(input.startDate) : now;
    const elapsedDays = Math.floor((now - start) / 86400000);

    let ratio: number;
    let bracket: string;
    if (!totalDays) {
      // 유효일 정보 없음 → 시작 여부만으로 보수적 판단
      ratio = elapsedDays <= 0 ? 1 : 0.5;
      bracket = elapsedDays <= 0 ? '시작 전(전액)' : '진행 중(유효기간 불명 — 1/2 적용)';
    } else if (elapsedDays <= 0) {
      ratio = 1; bracket = '교습 시작 전(전액)';
    } else {
      const progress = elapsedDays / totalDays;
      if (progress < 1 / 3) { ratio = 2 / 3; bracket = '총 기간 1/3 경과 전(2/3)'; }
      else if (progress < 1 / 2) { ratio = 1 / 2; bracket = '총 기간 1/2 경과 전(1/2)'; }
      else { ratio = 0; bracket = '총 기간 1/2 경과 후(반환 없음)'; }
    }
    const suggested = clampMoney(paid * ratio, paid);

    return {
      kind: 'PERIOD',
      paidAmount: paid,
      suggestedRefund: suggested,
      basis: `기간제 · 학원법 시행령 반환기준(${bracket}). 장기 수강권은 월할 계산이 더 정확하므로 필요 시 직접 조정하세요.`,
      breakdown: [
        { label: '결제액', value: `${paid.toLocaleString()}원` },
        { label: '경과/총일수', value: `${Math.max(0, elapsedDays)}일 / ${totalDays ?? '?'}일` },
        { label: '반환 구간', value: bracket },
        { label: '권장 환불액', value: `${suggested.toLocaleString()}원` },
      ],
      progress: totalDays ? elapsedDays / totalDays : undefined,
      expired: false,
    };
  }

  // COUNT / WORKSHOP — 사용분 정가 차감
  const total = input.quantity && input.quantity > 0 ? input.quantity : 1;
  const remaining = input.remainingCount != null ? Math.max(0, input.remainingCount) : 0;
  const used = Math.max(0, total - remaining);
  // 정가 1회 단가 (할인 전 기준). original 없으면 결제액 기준 fallback.
  const baseForUnit = input.originalPrice && input.originalPrice > 0 ? input.originalPrice : paid;
  const unitPrice = Math.round(baseForUnit / total);
  const suggested = clampMoney(paid - used * unitPrice, paid);

  const kindLabel = isWorkshop ? '워크샵/팝업' : '횟수제';
  return {
    kind: isWorkshop ? 'WORKSHOP' : 'COUNT',
    paidAmount: paid,
    suggestedRefund: suggested,
    basis: `${kindLabel} · 결제액 − (사용 ${used}회 × 정가 1회 ${unitPrice.toLocaleString()}원). 정가 차감 기준이며 학원 재량으로 조정 가능합니다.`,
    breakdown: [
      { label: '결제액', value: `${paid.toLocaleString()}원` },
      { label: '사용/총 회차', value: `${used}회 / ${total}회 (잔여 ${remaining}회)` },
      { label: '정가 1회 단가', value: `${unitPrice.toLocaleString()}원` },
      { label: '차감액', value: `−${(used * unitPrice).toLocaleString()}원` },
      { label: '권장 환불액', value: `${suggested.toLocaleString()}원` },
    ],
    usedCount: used,
    totalCount: total,
    expired: false,
  };
}
