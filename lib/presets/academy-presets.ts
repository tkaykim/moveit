import type { RefundPolicy, PausePolicy } from '@/lib/policy/ticket-policy';

/**
 * 운영방식 프리셋 — 실제 학원 사례 기반 수강권 템플릿.
 * 온보딩 위저드에서 하나를 고르면 tickets 행이 이 정의대로 생성된다.
 *
 * 근거 (2026-07-03 실사 — 8개 학원 + 보조 검증):
 * - 쿠폰제 표준 수렴: 프로젝트리(로우그래피)·MID·YGX·피드백 전부 「1회 3만 / 5회 13만 / 10회 24~25만 + 무제한 50만, 30일 소진」
 * - 어반플레이: 1회 3만 / 4회 10만 / 8회 18만 / 15회 30만, 등록일 기준 4주 소진, 양도 불가
 * - MID: 월등록 12만(주1회 80분), 3개월 4만 할인(연장 불가 조건), 환불=최초 수강 후 2주 내 미사용분만
 * - 하이비트·어반플레이 입시: 월 55만(기본)/70만(심화)/100만(고급), 상담·선발 등록, 가격 비공개 관행(DFS·NYDance·IMNEW)
 * - 1MILLION: 일할 스텝 환불(10일 2/3 → 15일 1/2 → 이후 불가) 명문화
 * - 관찰된 전 사례가 "구매일 즉시 개시"(auto_start는 옵션 필드로만 유지)
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
  /** 구매 노출 여부 (입시반 등 상담 전환 상품은 false) */
  is_public?: boolean;
  auto_start_days?: number | null;
  refund_policy?: RefundPolicy;
  pause_policy?: PausePolicy;
  description?: string;
}

export interface AcademyPreset {
  key: 'count_pack' | 'coupon_allpass' | 'monthly' | 'exam_track' | 'mixed';
  name: string;
  tagline: string;
  /** 카드에 보여줄 대표 사례 설명 */
  example: string;
  emoji: string;
  tickets: PresetTicketDef[];
  /** 이 운영방식에서 숨길 관리자 메뉴 (라우트 마지막 세그먼트) */
  hiddenMenus: string[];
}

/** 1MILLION식 일할 스텝 환불 (개시 10일 내 2/3 → 15일 내 1/2 → 이후 불가) */
const STEP_REFUND: RefundPolicy = {
  mode: 'step',
  steps: [
    { until_days: 10, rate: 2 / 3 },
    { until_days: 15, rate: 0.5 },
    { until_days: 99999, rate: 0 },
  ],
};

/** 기본 — 서버 계산 엔진의 학원법 반환기준 적용 */
const DEFAULT_REFUND: RefundPolicy = { mode: 'prorata', deduct_used: true };
/** 원데이·워크샵 관행 — 환불 불가 */
const NO_REFUND: RefundPolicy = { mode: 'none' };
const STANDARD_PAUSE: PausePolicy = { max_days: 30, max_times: 2 };
const MONTHLY_PAUSE: PausePolicy = { max_days: 14, max_times: 1 };

export const ACADEMY_PRESETS: AcademyPreset[] = [
  {
    key: 'count_pack',
    name: '쿠폰제 표준형',
    tagline: '쿠폰을 사서 30일 안에 원하는 수업을 골라 듣는 방식',
    example: '예: 프로젝트리·MID·YGX — 1회 3만 / 5회 13만 / 10회 25만 + 무제한 50만, 30일',
    emoji: '🎟️',
    hiddenMenus: [],
    tickets: [
      { name: '1회권', ticket_type: 'COUNT', ticket_category: 'regular', total_count: 1, valid_days: 30, price: 30000, is_general: true, refund_policy: NO_REFUND, description: '모든 수업 1회 수강 (당일 환불 불가)' },
      { name: '5회권', ticket_type: 'COUNT', ticket_category: 'regular', total_count: 5, valid_days: 30, price: 130000, is_general: true, refund_policy: STEP_REFUND, pause_policy: STANDARD_PAUSE },
      { name: '10회권', ticket_type: 'COUNT', ticket_category: 'regular', total_count: 10, valid_days: 30, price: 250000, is_general: true, refund_policy: STEP_REFUND, pause_policy: STANDARD_PAUSE },
      { name: '무제한 패스 (30일)', ticket_type: 'PERIOD', ticket_category: 'regular', valid_days: 30, price: 500000, is_general: true, refund_policy: DEFAULT_REFUND, description: '기간 내 모든 수업 무제한' },
    ],
  },
  {
    key: 'coupon_allpass',
    name: '쿠폰 촘촘형 (4주)',
    tagline: '쿠폰 단계를 잘게 나눠 4주 안에 소진하는 방식',
    example: '예: 어반플레이 — 1회 3만 / 4회 10만 / 8회 18만 / 15회 30만, 4주 소진',
    emoji: '💳',
    hiddenMenus: [],
    tickets: [
      { name: '1쿠폰', ticket_type: 'COUNT', ticket_category: 'regular', total_count: 1, valid_days: 28, price: 30000, is_general: true, refund_policy: NO_REFUND },
      { name: '4쿠폰', ticket_type: 'COUNT', ticket_category: 'regular', total_count: 4, valid_days: 28, price: 100000, is_general: true, refund_policy: DEFAULT_REFUND, pause_policy: STANDARD_PAUSE },
      { name: '8쿠폰', ticket_type: 'COUNT', ticket_category: 'regular', total_count: 8, valid_days: 28, price: 180000, is_general: true, refund_policy: DEFAULT_REFUND, pause_policy: STANDARD_PAUSE },
      { name: '15쿠폰', ticket_type: 'COUNT', ticket_category: 'regular', total_count: 15, valid_days: 28, price: 300000, is_general: true, refund_policy: DEFAULT_REFUND, pause_policy: STANDARD_PAUSE },
    ],
  },
  {
    key: 'monthly',
    name: '월 정규형',
    tagline: '매월 등록하고 정해진 요일의 반에 다니는 방식',
    example: '예: MID 월등록·NY댄스 취미반 — 주 1회 월 12만원, 3개월 32만원',
    emoji: '📅',
    hiddenMenus: [],
    tickets: [
      { name: '월 정규 (주 1회)', ticket_type: 'COUNT', ticket_category: 'regular', total_count: 4, valid_days: 31, price: 120000, is_general: false, refund_policy: DEFAULT_REFUND, pause_policy: MONTHLY_PAUSE, description: '한 달 4회, 등록한 반 수강' },
      { name: '월 정규 (주 2회)', ticket_type: 'COUNT', ticket_category: 'regular', total_count: 8, valid_days: 31, price: 200000, is_general: false, refund_policy: DEFAULT_REFUND, pause_policy: MONTHLY_PAUSE },
      { name: '3개월 정규 (할인)', ticket_type: 'COUNT', ticket_category: 'regular', total_count: 12, valid_days: 92, price: 320000, is_general: false, refund_policy: DEFAULT_REFUND, description: '3개월 일괄 등록 할인 (연장 불가)' },
      { name: '원데이 (체험)', ticket_type: 'COUNT', ticket_category: 'regular', total_count: 1, valid_days: 30, price: 30000, is_general: true, refund_policy: NO_REFUND },
    ],
  },
  {
    key: 'exam_track',
    name: '입시·전문반형',
    tagline: '상담과 선발을 거쳐 월 고정으로 다니는 방식',
    example: '예: 하이비트·어반플레이 — 기본 월 55만 / 심화 70만 / 고급 100만 (상담 후 등록)',
    emoji: '🎯',
    hiddenMenus: [],
    tickets: [
      { name: '입시반 기본 (월 12회)', ticket_type: 'PERIOD', ticket_category: 'regular', valid_days: 31, price: 550000, is_general: false, is_public: false, refund_policy: DEFAULT_REFUND, description: '월 고정 커리큘럼 + 서브 1과목. 상담 후 등록' },
      { name: '입시반 심화 (월 12회+전과목)', ticket_type: 'PERIOD', ticket_category: 'regular', valid_days: 31, price: 700000, is_general: false, is_public: false, refund_policy: DEFAULT_REFUND, description: '서브 전 과목 수강. 상담 후 등록' },
      { name: '전문반 (풀 커리큘럼)', ticket_type: 'PERIOD', ticket_category: 'regular', valid_days: 31, price: 1000000, is_general: false, is_public: false, refund_policy: DEFAULT_REFUND, description: '풀 커리큘럼 + 연습실 이용. 선발제' },
      { name: '원데이 (체험)', ticket_type: 'COUNT', ticket_category: 'regular', total_count: 1, valid_days: 30, price: 30000, is_general: true, refund_policy: NO_REFUND },
    ],
  },
  {
    key: 'mixed',
    name: '혼합형',
    tagline: '쿠폰·월 정규·원데이를 모두 운영하는 방식',
    example: '가장 흔한 형태 — 취미 원데이는 쿠폰, 고정반은 월 등록',
    emoji: '🎨',
    hiddenMenus: [],
    tickets: [
      { name: '원데이 (1회)', ticket_type: 'COUNT', ticket_category: 'regular', total_count: 1, valid_days: 30, price: 30000, is_general: true, refund_policy: NO_REFUND },
      { name: '10회권', ticket_type: 'COUNT', ticket_category: 'regular', total_count: 10, valid_days: 30, price: 250000, is_general: true, refund_policy: STEP_REFUND, pause_policy: STANDARD_PAUSE },
      { name: '월 정규 (주 1회)', ticket_type: 'COUNT', ticket_category: 'regular', total_count: 4, valid_days: 31, price: 120000, is_general: false, refund_policy: DEFAULT_REFUND, pause_policy: MONTHLY_PAUSE },
    ],
  },
];

export function getPreset(key: string | null | undefined): AcademyPreset | undefined {
  return ACADEMY_PRESETS.find((p) => p.key === key);
}
