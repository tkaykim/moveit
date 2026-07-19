/**
 * 환불 프리셋 (T7) — lib/refund/calc.ts 엔진 위에 얹는 "이름 붙은 규칙" 층.
 *
 * ⚠ 이 파일은 계산 엔진을 새로 만들지 않는다. 프리셋은 전부 calc.ts 의 computeRefund 로 위임된다.
 *    (SPORTS_FACILITY_CONTINUOUS 만 계산식이 달라 calc.ts 안에 분기가 추가돼 있다)
 *
 * ── 법적 우선순위 (resolveRefundPreset) ────────────────────────────────
 *   ① 사업자 등록 업종의 강행법규            → statutoryPresetForCategory()
 *   ② 학원이 적법하게 고지한 약관·개별약정   → publishedTerms
 *   ③ 학원이 설정한 프리셋                   → configuredPreset
 *   ④ 직원 수동 조정 (감사 기록 필수)        → refund_proposals.adjusted_amount
 *   ①은 ②③을 이긴다. ②는 ③을 이긴다. 단 ②③이 ①보다 소비자에게 유리하면 그대로 쓴다.
 *
 * ── 모든 프리셋 공통 규칙 ───────────────────────────────────────────────
 *   · 사용분(used portion)은 **실제 결제액** 기준으로 계산한다. 정가(original_price) 기준이 아니다.
 *   · 카드 수수료를 소비자에게 추가 공제하지 않는다. (이 엔진에는 수수료 공제 항목 자체가 없다)
 *
 * ── 하위호환 ────────────────────────────────────────────────────────────
 *   preset 을 지정하지 않으면(=기존 티켓 전부) computeRefund 는 T6 이전과 완전히 동일하게 동작한다.
 *   기존 tickets.refund_policy(jsonb) 는 CUSTOM_STEP 프리셋과 같은 의미이며 그대로 계속 쓰인다.
 */

import type { CustomRefundPolicy } from './calc';

export type RefundPresetKey =
  /** 학원법(학원의 설립·운영 및 과외교습에 관한 법률) 시행령 교습비등 반환기준.
   *  경과 교습기간/교습회차 비율에 따른 구간 반환. 학원 등록 사업자의 기본값. */
  | 'ACADEMY_STATUTORY'
  /** 체육시설의 설치·이용에 관한 법률 기준.
   *  환불 = 결제액 − (사용분 + 위약금), 위약금은 총액의 10% 를 넘지 않는다. */
  | 'SPORTS_FACILITY_CONTINUOUS'
  /** 학원이 고지한 자체 단계표. 기존 tickets.refund_policy {mode:'step'} 와 동일. */
  | 'CUSTOM_STEP'
  /** 적법한 경우에 한해 환불 불가 (예: 당일 소진된 1일권/원데이 쿠폰). */
  | 'NON_REFUNDABLE_WHERE_LAWFUL';

/** 사업자 등록 업종 */
export type BusinessCategory = 'ACADEMY' | 'SPORTS_FACILITY' | 'OTHER';

export interface RefundPresetMeta {
  key: RefundPresetKey;
  label: string;
  legalBasis: string;
  /** 학생에게 보여줄 한 줄 설명 */
  summary: string;
}

export const REFUND_PRESETS: Record<RefundPresetKey, RefundPresetMeta> = {
  ACADEMY_STATUTORY: {
    key: 'ACADEMY_STATUTORY',
    label: '학원법 반환기준 (법정)',
    legalBasis: '학원의 설립·운영 및 과외교습에 관한 법률 시행령 제18조 [별표 4] 교습비등 반환기준',
    summary: '남은 교습기간(또는 남은 회차) 비율에 따라 반환합니다. 교습 시작 전에는 전액 반환됩니다.',
  },
  SPORTS_FACILITY_CONTINUOUS: {
    key: 'SPORTS_FACILITY_CONTINUOUS',
    label: '체육시설업 기준',
    legalBasis: '체육시설의 설치·이용에 관한 법률 시행령 [별표 4] · 소비자분쟁해결기준(계속거래)',
    summary: '이미 이용한 금액과 위약금(총액의 10% 이내)을 뺀 나머지를 반환합니다.',
  },
  CUSTOM_STEP: {
    key: 'CUSTOM_STEP',
    label: '학원 자체 단계표',
    legalBasis: '학원이 고지한 약관 — 법정 기준보다 불리하면 법정 기준이 우선합니다.',
    summary: '개시 후 경과일 구간에 따라 정해진 비율로 반환합니다.',
  },
  NON_REFUNDABLE_WHERE_LAWFUL: {
    key: 'NON_REFUNDABLE_WHERE_LAWFUL',
    label: '환불 불가 (적법한 경우에 한함)',
    legalBasis: '당일 소진된 1회권 등 이미 이행이 완료된 거래에 한해 유효합니다.',
    summary: '구매 시 고지된 환불 불가 상품입니다.',
  },
};

/** ① 업종별 강행법규 기본값 */
export function statutoryPresetForCategory(category: BusinessCategory): RefundPresetKey | null {
  if (category === 'ACADEMY') return 'ACADEMY_STATUTORY';
  if (category === 'SPORTS_FACILITY') return 'SPORTS_FACILITY_CONTINUOUS';
  return null;
}

export interface PresetResolution {
  preset: RefundPresetKey;
  /** 어느 단계에서 정해졌는지 — 감사 기록(refund_proposals.preset_source)에 남는다. */
  source: 'STATUTE' | 'PUBLISHED_TERMS' | 'ACADEMY_PRESET' | 'FALLBACK';
  note: string;
}

export interface ResolvePresetInput {
  /** 사업자 등록 업종. 우리 대상 학원은 'ACADEMY'. */
  businessCategory: BusinessCategory;
  /** ② 적법하게 고지된 약관/개별약정이 지정하는 프리셋 */
  publishedTerms?: RefundPresetKey | null;
  /** ③ 학원이 상품에 설정해 둔 프리셋 */
  configuredPreset?: RefundPresetKey | null;
}

/**
 * 법적 우선순위에 따라 적용할 프리셋을 결정한다. **엄격한 순서**로 판정한다.
 *
 *   ① 업종 강행법규가 있으면 그것이 이긴다. 학원이 뭘 설정했든 무관하다.
 *      (학원 등록 사업자 → ACADEMY_STATUTORY. 우리 대상 학원이 여기 해당한다)
 *   ② 강행법규가 없는 업종에서만 학원이 적법하게 고지한 약관이 적용된다.
 *   ③ 그것도 없으면 학원이 설정한 프리셋.
 *   ④ 그래도 없으면 학원법 기준을 준용(가장 보수적인 소비자 보호선).
 *
 * ④ 직원 수동 조정은 여기서 결정되지 않는다 — 산정 이후 refund_proposals 에
 * 감사 기록과 함께 남는 별도 단계다.
 */
export function resolveRefundPreset(input: ResolvePresetInput): PresetResolution {
  const statutory = statutoryPresetForCategory(input.businessCategory);

  if (statutory) {
    return {
      preset: statutory,
      source: 'STATUTE',
      note: `업종 강행법규(${REFUND_PRESETS[statutory].label})가 우선합니다. 학원 자체 설정은 이를 배제할 수 없습니다.`,
    };
  }

  if (input.publishedTerms) {
    return {
      preset: input.publishedTerms,
      source: 'PUBLISHED_TERMS',
      note: `적법하게 고지된 약관(${REFUND_PRESETS[input.publishedTerms].label})을 적용합니다.`,
    };
  }

  if (input.configuredPreset) {
    return {
      preset: input.configuredPreset,
      source: 'ACADEMY_PRESET',
      note: `학원 설정(${REFUND_PRESETS[input.configuredPreset].label})을 적용합니다.`,
    };
  }

  return {
    preset: 'ACADEMY_STATUTORY',
    source: 'FALLBACK',
    note: '지정된 규칙이 없어 학원법 기준을 준용합니다.',
  };
}

/** tickets.refund_policy(jsonb) → 프리셋 키. 기존 데이터 해석용(하위호환). */
export function presetFromLegacyPolicy(policy: CustomRefundPolicy | null | undefined): RefundPresetKey | null {
  if (!policy) return null;
  if (policy.mode === 'none') return 'NON_REFUNDABLE_WHERE_LAWFUL';
  if (policy.mode === 'step') return 'CUSTOM_STEP';
  return 'ACADEMY_STATUTORY';
}
