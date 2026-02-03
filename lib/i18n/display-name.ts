/**
 * DB에서 가져온 name_kr/name_en 필드 중 언어에 맞는 값 반환
 * @param language 현재 언어 ('ko' | 'en')
 * @param nameKr 한국어 이름
 * @param nameEn 영어 이름
 * @returns 언어에 맞는 이름 (없으면 다른 언어로 fallback)
 */
export function getDisplayName(
  language: 'ko' | 'en',
  nameKr?: string | null,
  nameEn?: string | null
): string {
  if (language === 'en') {
    return nameEn || nameKr || '';
  }
  return nameKr || nameEn || '';
}

/**
 * 학원/강사/클래스 등 객체에서 언어에 맞는 이름 추출
 * @param language 현재 언어
 * @param item name_kr, name_en 필드를 가진 객체
 * @returns 언어에 맞는 이름
 */
export function getItemDisplayName(
  language: 'ko' | 'en',
  item?: { name_kr?: string | null; name_en?: string | null } | null
): string {
  if (!item) return '';
  return getDisplayName(language, item.name_kr, item.name_en);
}
