/**
 * 숫자 포맷팅 유틸리티
 */

/**
 * 숫자를 천단위 콤마가 포함된 문자열로 변환
 * @param num 숫자
 * @returns 포맷된 문자열 (예: 50000 -> "50,000")
 */
export function formatNumberWithCommas(num: number | string | null | undefined): string {
  if (num === null || num === undefined || num === '') return '';
  const numStr = String(num).replace(/,/g, ''); // 기존 콤마 제거
  const numValue = parseInt(numStr, 10);
  if (isNaN(numValue)) return '';
  return numValue.toLocaleString('ko-KR');
}

/**
 * 콤마가 포함된 문자열을 숫자로 변환
 * @param str 콤마가 포함된 문자열
 * @returns 숫자 (예: "50,000" -> 50000)
 */
export function parseNumberFromString(str: string): number {
  if (!str) return 0;
  const cleaned = str.replace(/,/g, '');
  const num = parseInt(cleaned, 10);
  return isNaN(num) ? 0 : num;
}

/**
 * 입력 필드에서 숫자만 입력받도록 처리 (천단위 콤마 자동 추가)
 * @param value 입력값
 * @returns 포맷된 문자열
 */
export function formatNumberInput(value: string): string {
  // 숫자와 콤마만 허용
  const cleaned = value.replace(/[^\d,]/g, '');
  // 콤마 제거 후 숫자로 변환
  const num = parseNumberFromString(cleaned);
  // 다시 포맷팅
  return formatNumberWithCommas(num);
}



