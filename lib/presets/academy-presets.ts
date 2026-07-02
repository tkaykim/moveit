import type { RefundPolicy, PausePolicy } from '@/lib/policy/ticket-policy';

/**
 * 운영방식 프리셋 — 실제 학원 사례 기반 수강권 템플릿.
 * 온보딩 위저드에서 하나를 고르면 tickets 행이 이 정의대로 생성된다.
 *
 * 근거(2026-07 실사):
 * - 1MILLION: 순수 회차권 1회 3만~40회 50만, 유효 60일, 미사용 30일 후 자동개시, 일할 환불(10일 2/3 → 15일 50% → 불가)
 * - MID: 쿠폰 1장 3만/5장 13만/10장 25만 + 월 정규(주1회) 12만 + 올패스(무제한 30일) 50만
 * - 하이비트(입시): 월 고정 55만/70만, 상담 후 등록, 가격 비공개 관례
 * 8개 학원(DFS·Urban Play·Play The Urban·Project Lee·Maju·Feedback·IMNEW·NYDance) 추가 실사 반영 지점: PRESET 배열 하단 주석 참조.
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

/** 1MILLION식 일할 스텝 환불 */
const STEP_REFUND: RefundPolicy = {
  mode: 'step',
  steps: [
    { until_days: 10, rate: 2 / 3 },
    { until_days: 15, rate: 0.5 },
    { until_days: 99999, rate: 0 },
  ],
};

const PRORATA_REFUND: RefundPolicy = { mode: 'prorata', deduct_used: true };
const NO_REFUND: RefundPolicy = { mode: 'none' };
const STANDARD_PAUSE: PausePolicy = { max_days: 30, max_times: 2 };

export const ACADEMY_PRESETS: AcademyPreset[] = [
  {
    key: 'count_pack',
    name: '회차권형',
    tagline: '원하는 만큼 회수를 사서 아무 수업이나 듣는 방식',
    example: '예: 원밀리언 — 1회 3만원부터 묶음 구매, 유효기간 60일',
    emoji: '🎟️',
    hiddenMenus: ['deposit-confirm'],
    tickets: [
      { name: '1회권', ticket_type: 'COUNT', ticket_category: 'regular', total_count: 1, valid_days: 60, price: 30000, is_general: true, refund_policy: NO_REFUND, description: '모든 정규 수업 1회 수강' },
      { name: '5회권', ticket_type: 'COUNT', ticket_category: 'regular', total_count: 5, valid_days: 60, price: 130000, is_general: true, auto_start_days: 30, refund_policy: STEP_REFUND, pause_policy: STANDARD_PAUSE },
      { name: '10회권', ticket_type: 'COUNT', ticket_category: 'regular', total_count: 10, valid_days: 60, price: 240000, is_general: true, auto_start_days: 30, refund_policy: STEP_REFUND, pause_policy: STANDARD_PAUSE },
      { name: '20회권', ticket_type: 'COUNT', ticket_category: 'regular', total_count: 20, valid_days: 90, price: 380000, is_general: true, auto_start_days: 30, refund_policy: STEP_REFUND, pause_policy: STANDARD_PAUSE },
    ],
  },
  {
    key: 'coupon_allpass',
    name: '쿠폰 + 올패스형',
    tagline: '쿠폰(회수제)과 무제한 올패스를 함께 파는 방식',
    example: '예: MID — 쿠폰 1장 3만원, 올패스(30일 무제한) 50만원',
    emoji: '💳',
    hiddenMenus: [],
    tickets: [
      { name: '쿠폰 1장', ticket_type: 'COUNT', ticket_category: 'regular', total_count: 1, valid_days: 90, price: 30000, is_general: true, refund_policy: NO_REFUND },
      { name: '쿠폰 5장', ticket_type: 'COUNT', ticket_category: 'regular', total_count: 5, valid_days: 90, price: 130000, is_general: true, refund_policy: PRORATA_REFUND, pause_policy: STANDARD_PAUSE },
      { name: '쿠폰 10장', ticket_type: 'COUNT', ticket_category: 'regular', total_count: 10, valid_days: 90, price: 250000, is_general: true, refund_policy: PRORATA_REFUND, pause_policy: STANDARD_PAUSE },
      { name: '올패스 (30일 무제한)', ticket_type: 'PERIOD', ticket_category: 'regular', valid_days: 30, price: 500000, is_general: true, refund_policy: PRORATA_REFUND, description: '기간 내 모든 수업 무제한 수강' },
    ],
  },
  {
    key: 'monthly',
    name: '월 정규형',
    tagline: '매월 등록하고 정해진 반에 다니는 방식',
    example: '예: 주 1회 반 월 12만원, 주 2회 반 월 20만원',
    emoji: '📅',
    hiddenMenus: [],
    tickets: [
      { name: '월 정규 (주 1회)', ticket_type: 'COUNT', ticket_category: 'regular', total_count: 4, valid_days: 31, price: 120000, is_general: false, refund_policy: PRORATA_REFUND, pause_policy: { max_days: 14, max_times: 1 }, description: '한 달 4회, 등록한 반 수강' },
      { name: '월 정규 (주 2회)', ticket_type: 'COUNT', ticket_category: 'regular', total_count: 8, valid_days: 31, price: 200000, is_general: false, refund_policy: PRORATA_REFUND, pause_policy: { max_days: 14, max_times: 1 } },
      { name: '원데이 (체험)', ticket_type: 'COUNT', ticket_category: 'regular', total_count: 1, valid_days: 30, price: 30000, is_general: true, refund_policy: NO_REFUND },
    ],
  },
  {
    key: 'exam_track',
    name: '입시·전문반형',
    tagline: '상담과 선발을 거쳐 월 고정으로 다니는 방식',
    example: '예: 하이비트 — 입시 기본 월 55만원, 심화 월 70만원 (상담 후 등록)',
    emoji: '🎯',
    hiddenMenus: ['deposit-confirm'],
    tickets: [
      { name: '입시반 기본 (월)', ticket_type: 'PERIOD', ticket_category: 'regular', valid_days: 31, price: 550000, is_general: false, is_public: false, refund_policy: PRORATA_REFUND, description: '월 고정 커리큘럼 + 연습실 이용. 상담 후 등록' },
      { name: '입시반 심화 (월)', ticket_type: 'PERIOD', ticket_category: 'regular', valid_days: 31, price: 700000, is_general: false, is_public: false, refund_policy: PRORATA_REFUND, description: '전 과목 수강 + 연습실 이용. 상담 후 등록' },
      { name: '원데이 (체험)', ticket_type: 'COUNT', ticket_category: 'regular', total_count: 1, valid_days: 30, price: 30000, is_general: true, refund_policy: NO_REFUND },
    ],
  },
  {
    key: 'mixed',
    name: '혼합형',
    tagline: '쿠폰·월 정규·원데이를 모두 운영하는 방식',
    example: '가장 흔한 형태 — 취미반은 쿠폰, 고정반은 월 등록',
    emoji: '🎨',
    hiddenMenus: [],
    tickets: [
      { name: '원데이 (1회)', ticket_type: 'COUNT', ticket_category: 'regular', total_count: 1, valid_days: 30, price: 30000, is_general: true, refund_policy: NO_REFUND },
      { name: '쿠폰 10장', ticket_type: 'COUNT', ticket_category: 'regular', total_count: 10, valid_days: 90, price: 250000, is_general: true, refund_policy: PRORATA_REFUND, pause_policy: STANDARD_PAUSE },
      { name: '월 정규 (주 1회)', ticket_type: 'COUNT', ticket_category: 'regular', total_count: 4, valid_days: 31, price: 120000, is_general: false, refund_policy: PRORATA_REFUND, pause_policy: { max_days: 14, max_times: 1 } },
    ],
  },
];

// 8개 학원 실사 반영 지점 —
// 리서치 결과(가격·유효기간·환불 조항)가 위 기본값과 다르면 이 배열의 금액/일수만 조정한다.
// 프리셋 키·구조는 온보딩 위저드·admin 숨김 로직과 결합돼 있으므로 변경 금지.

export function getPreset(key: string | null | undefined): AcademyPreset | undefined {
  return ACADEMY_PRESETS.find((p) => p.key === key);
}
