/**
 * 전화번호: DB에는 숫자만 저장, 프론트에서는 3-4-4 하이픈 표시
 */

/** 입력값에서 숫자만 추출 (DB 저장·중복 확인용) */
export function normalizePhone(value: string): string {
  return value.replace(/\D/g, '');
}

/** 숫자만 있는 전화번호를 3-4-4 하이픈 형식으로 표시 */
export function formatPhoneDisplay(digits: string): string {
  const d = normalizePhone(digits);
  if (d.length <= 3) return d;
  if (d.length <= 7) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7, 11)}`;
}

/** 전화번호 입력 시 숫자만 허용, 최대 11자리 */
export function parsePhoneInput(value: string): string {
  const digits = normalizePhone(value).slice(0, 11);
  return digits;
}
