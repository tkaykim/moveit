/**
 * 토스페이먼츠 고객키: 영문 대소문자, 숫자, 특수문자 -, _, =, ., @ 만 허용, 2~50자.
 * academyId가 길어도 항상 50자 이하로 생성.
 */
export function buildTossCustomerKey(academyId: string): string {
  const safeId = String(academyId).replace(/-/g, '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 12);
  const raw = `ac_${safeId}_${Date.now()}`;
  const allowed = raw.replace(/[^a-zA-Z0-9_\-=.@]/g, '');
  return allowed.length >= 2 ? allowed.slice(0, 50) : `ak_${Date.now()}`.slice(0, 50);
}
