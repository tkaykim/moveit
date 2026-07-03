import type { RefundPolicy, PausePolicy } from '@/lib/policy/ticket-policy';

/**
 * 운영 유형 — 학원이 **복수 선택**하는 수업 운영 방식.
 * (기간제 수업과 쿠폰제 수업을 함께 운영하는 학원이 흔하므로 단일 아키타입이 아니라 조합형)
 * 선택된 유형들의 수강권 정의를 합쳐(composeTickets) tickets 행을 자동 생성한다.
 *
 * 근거 (2026-07-03 실사 — DFS·Urban Play·Play The Urban·Project Lee·Maju·Feedback·IMNEW·NYDance + 1MILLION·MID·하이비트·YGX):
 * - 쿠폰제: 가격 공개 학원 전부 「1회 3만 / 5회 13만 / 10회 24~25만 + 무제한 50만, 30일 소진」으로 수렴
 * - 기간제: 월 12만(주1회)·20만(주2회), 3개월 일괄 할인(연장 불가 조건)
 * - 입시반: 월 55~70만 고정, 상담 후 등록·가격 비공개 관행 / 오디션반: 기획사 오디션 준비, 상담제
 * - 전문반: 올패스+연습실+월평가 결합, 선발제·상담가
 * - 환불: 1MILLION식 스텝(10일 2/3→15일 1/2→불가) 명문화 사례, 원데이는 환불 불가 관행
 */

export interface PresetTicketDef {
  name: string;
  ticket_type: 'PERIOD' | 'COUNT';
  ticket_category: 'regular' | 'popup' | 'workshop';
  total_count?: number;
  valid_days?: number;
  price: number;
  is_coupon?: boolean;
  /** 학원의 모든 클래스에서 사용 가능 여부 */
  is_general?: boolean;
  /** 구매 노출 여부 (입시·전문반 등 상담 전환 상품은 false) */
  is_public?: boolean;
  auto_start_days?: number | null;
  refund_policy?: RefundPolicy;
  pause_policy?: PausePolicy;
  description?: string;
}

export type OperationKey = 'coupon' | 'period' | 'exam' | 'audition' | 'pro';

export interface OperationType {
  key: OperationKey;
  name: string;
  tagline: string;
  emoji: string;
  /** 대표 사례 (카드 보조 설명) */
  example: string;
  tickets: PresetTicketDef[];
}

/** 1MILLION식 스텝 환불 (개시 10일 내 2/3 → 15일 내 1/2 → 이후 불가) */
const STEP_REFUND: RefundPolicy = {
  mode: 'step',
  steps: [
    { until_days: 10, rate: 2 / 3 },
    { until_days: 15, rate: 0.5 },
    { until_days: 99999, rate: 0 },
  ],
};
/** 기본 — 서버 계산 엔진의 학원법 반환기준 */
const DEFAULT_REFUND: RefundPolicy = { mode: 'prorata', deduct_used: true };
/** 원데이·워크샵 관행 — 환불 불가 */
const NO_REFUND: RefundPolicy = { mode: 'none' };
const STANDARD_PAUSE: PausePolicy = { max_days: 30, max_times: 2 };
const MONTHLY_PAUSE: PausePolicy = { max_days: 14, max_times: 1 };

/** 체험용 원데이 — 어떤 조합을 고르든 하나는 있어야 하는 진입 상품 */
const ONE_DAY: PresetTicketDef = {
  name: '원데이 (1회)',
  ticket_type: 'COUNT',
  ticket_category: 'regular',
  total_count: 1,
  valid_days: 30,
  price: 30000,
  is_general: true,
  refund_policy: NO_REFUND,
  description: '모든 수업 1회 수강 (당일 환불 불가)',
};

export const OPERATION_TYPES: OperationType[] = [
  {
    key: 'coupon',
    name: '쿠폰제',
    tagline: '쿠폰을 사서 원하는 수업을 골라 듣는 방식',
    emoji: '🎟️',
    example: '1회 3만 · 5회 13만 · 10회 25만 · 무제한 50만 (30일)',
    tickets: [
      ONE_DAY,
      { name: '쿠폰 5회', ticket_type: 'COUNT', ticket_category: 'regular', total_count: 5, valid_days: 30, price: 130000, is_general: true, refund_policy: STEP_REFUND, pause_policy: STANDARD_PAUSE },
      { name: '쿠폰 10회', ticket_type: 'COUNT', ticket_category: 'regular', total_count: 10, valid_days: 30, price: 250000, is_general: true, refund_policy: STEP_REFUND, pause_policy: STANDARD_PAUSE },
      { name: '무제한 패스 (30일)', ticket_type: 'PERIOD', ticket_category: 'regular', valid_days: 30, price: 500000, is_general: true, refund_policy: DEFAULT_REFUND, description: '기간 내 모든 수업 무제한' },
    ],
  },
  {
    key: 'period',
    name: '기간제 (월 등록)',
    tagline: '매월 등록하고 정해진 반에 다니는 방식',
    emoji: '📅',
    example: '주 1회 월 12만 · 주 2회 월 20만 · 3개월 32만',
    tickets: [
      { name: '월 정규 (주 1회)', ticket_type: 'COUNT', ticket_category: 'regular', total_count: 4, valid_days: 31, price: 120000, is_general: false, refund_policy: DEFAULT_REFUND, pause_policy: MONTHLY_PAUSE, description: '한 달 4회, 등록한 반 수강' },
      { name: '월 정규 (주 2회)', ticket_type: 'COUNT', ticket_category: 'regular', total_count: 8, valid_days: 31, price: 200000, is_general: false, refund_policy: DEFAULT_REFUND, pause_policy: MONTHLY_PAUSE },
      { name: '3개월 정규 (할인)', ticket_type: 'COUNT', ticket_category: 'regular', total_count: 12, valid_days: 92, price: 320000, is_general: false, refund_policy: DEFAULT_REFUND, description: '3개월 일괄 등록 할인 (연장 불가)' },
    ],
  },
  {
    key: 'exam',
    name: '입시반',
    tagline: '예대·예고 실용무용 입시 대비 월 고정 커리큘럼',
    emoji: '🎓',
    example: '기본 월 55만 · 심화 월 70만 (상담 후 등록)',
    tickets: [
      { name: '입시반 기본 (월 12회)', ticket_type: 'PERIOD', ticket_category: 'regular', valid_days: 31, price: 550000, is_general: false, is_public: false, refund_policy: DEFAULT_REFUND, description: '월 고정 커리큘럼 + 서브 1과목. 상담 후 등록' },
      { name: '입시반 심화 (월 12회+전과목)', ticket_type: 'PERIOD', ticket_category: 'regular', valid_days: 31, price: 700000, is_general: false, is_public: false, refund_policy: DEFAULT_REFUND, description: '서브 전 과목 수강. 상담 후 등록' },
    ],
  },
  {
    key: 'audition',
    name: '오디션반',
    tagline: '아이돌 연습생·기획사 오디션 준비반',
    emoji: '🎤',
    example: '월 고정 커리큘럼 + 오디션 연계 (상담 후 등록)',
    tickets: [
      { name: '오디션반 (월)', ticket_type: 'PERIOD', ticket_category: 'regular', valid_days: 31, price: 600000, is_general: false, is_public: false, refund_policy: DEFAULT_REFUND, description: '기획사 오디션 대비 트레이닝. 상담 후 등록' },
    ],
  },
  {
    key: 'pro',
    name: '전문반',
    tagline: '프로 댄서 육성 — 선발제 집중 트레이닝',
    emoji: '🔥',
    example: '올패스 + 연습실 + 월평가 결합 (선발 후 등록)',
    tickets: [
      { name: '전문반 (월)', ticket_type: 'PERIOD', ticket_category: 'regular', valid_days: 31, price: 700000, is_general: false, is_public: false, refund_policy: DEFAULT_REFUND, description: '전 수업 무제한 + 연습실 이용 + 월평가. 선발 후 등록' },
    ],
  },
];

export function getOperationType(key: string): OperationType | undefined {
  return OPERATION_TYPES.find((t) => t.key === key);
}

/** 선택된 유형들의 수강권을 합친다 (이름 기준 중복 제거, 원데이는 1개만). */
export function composeTickets(keys: string[]): PresetTicketDef[] {
  const seen = new Set<string>();
  const out: PresetTicketDef[] = [];
  for (const key of keys) {
    const type = getOperationType(key);
    if (!type) continue;
    for (const t of type.tickets) {
      if (seen.has(t.name)) continue;
      seen.add(t.name);
      out.push(t);
    }
  }
  // 상담제 유형만 골랐어도 체험 상품 하나는 필요
  if (out.length > 0 && !out.some((t) => t.name === ONE_DAY.name)) {
    out.unshift(ONE_DAY);
    }
  return out;
}

/** academies.preset_type 저장 형식: 콤마 조인 (예: "coupon,period,exam") */
export function serializeOperationKeys(keys: string[]): string {
  return keys.filter((k) => OPERATION_TYPES.some((t) => t.key === k)).join(',');
}
export function parseOperationKeys(presetType: string | null | undefined): OperationKey[] {
  if (!presetType) return [];
  return presetType
    .split(',')
    .map((s) => s.trim())
    .filter((k): k is OperationKey => OPERATION_TYPES.some((t) => t.key === k));
}

// ── 하위 호환 (구 단일 프리셋 키 참조 코드용) ──
/** @deprecated 다중 선택 전환 — parseOperationKeys/getOperationType 사용 */
export function getPreset(key: string | null | undefined): OperationType | undefined {
  return getOperationType(key || '');
}
