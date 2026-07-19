/**
 * 미니앱 스킨 (T10) — **데이터로만** 학원별 외형·문구를 바꾼다.
 *
 * 규율: 여기에도, 이걸 쓰는 화면에도 slug 분기(`if (slug === 'mid')`)는 없다.
 * 두 번째 학원은 `academies.section_config.miniapp` 에 값을 넣는 것만으로
 * 자기 스킨을 갖는다 — 코드 수정 없이.
 *
 * 저장 위치: academies.section_config -> 'miniapp' (jsonb)
 *   {
 *     "heroEyebrow": "STUDIO",
 *     "heroTitle": "오늘도 춤추자",
 *     "scheduleNote": "예약은 수업 1시간 전까지",
 *     "specialNotice": "특별수업은 올패스로 예약되지 않습니다",
 *     "bankNotice": "24시간 내 미입금 시 자동 취소됩니다",
 *     "checkoutCta": "결제하기",
 *     "currencySuffix": "원"
 *   }
 * 정의되지 않은 항목은 아래 기본값을 그대로 쓴다(부분 지정 가능).
 */

export interface MiniSkin {
  brandColor: string;
  heroEyebrow: string;
  heroTitle: string | null;
  scheduleNote: string | null;
  specialNotice: string;
  bankNotice: string;
  checkoutCta: string;
  currencySuffix: string;
}

export const DEFAULT_MINI_SKIN: Omit<MiniSkin, 'brandColor' | 'heroTitle' | 'scheduleNote'> = {
  heroEyebrow: 'Weekly',
  specialNotice: '특별수업은 별도 결제가 필요합니다. 무제한 수강권으로는 예약되지 않습니다.',
  bankNotice: '입금 확인 전까지 좌석을 24시간 잡아둡니다. 기한 내 미입금 시 자동 취소됩니다.',
  checkoutCta: '결제하기',
  currencySuffix: '원',
};

function str(raw: unknown): string | null {
  return typeof raw === 'string' && raw.trim() !== '' ? raw : null;
}

/** academies 한 행에서 스킨을 만든다. 모든 값은 데이터에서 온다. */
export function resolveMiniSkin(academy: {
  brand_color?: string | null;
  section_config?: unknown;
}): MiniSkin {
  const cfg =
    academy.section_config && typeof academy.section_config === 'object'
      ? ((academy.section_config as Record<string, unknown>).miniapp as
          | Record<string, unknown>
          | undefined)
      : undefined;
  const m = cfg && typeof cfg === 'object' ? cfg : {};

  return {
    brandColor: str(academy.brand_color) ?? '#111111',
    heroEyebrow: str(m.heroEyebrow) ?? DEFAULT_MINI_SKIN.heroEyebrow,
    heroTitle: str(m.heroTitle),
    scheduleNote: str(m.scheduleNote),
    specialNotice: str(m.specialNotice) ?? DEFAULT_MINI_SKIN.specialNotice,
    bankNotice: str(m.bankNotice) ?? DEFAULT_MINI_SKIN.bankNotice,
    checkoutCta: str(m.checkoutCta) ?? DEFAULT_MINI_SKIN.checkoutCta,
    currencySuffix: str(m.currencySuffix) ?? DEFAULT_MINI_SKIN.currencySuffix,
  };
}
