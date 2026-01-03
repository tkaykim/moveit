/**
 * KST(한국 표준시) 시간 처리 유틸리티
 * KST = UTC+9
 */

/**
 * UTC 시간을 KST로 변환하여 datetime-local 형식으로 반환
 */
export function convertUTCToKSTForInput(utcString: string | null): string {
  if (!utcString) return '';
  
  const utcDate = new Date(utcString);
  // UTC를 KST로 변환 (UTC+9)
  const kstDate = new Date(utcDate.getTime() + (9 * 60 * 60 * 1000));
  
  // datetime-local 형식으로 변환 (YYYY-MM-DDTHH:mm)
  const year = kstDate.getUTCFullYear();
  const month = String(kstDate.getUTCMonth() + 1).padStart(2, '0');
  const day = String(kstDate.getUTCDate()).padStart(2, '0');
  const hours = String(kstDate.getUTCHours()).padStart(2, '0');
  const minutes = String(kstDate.getUTCMinutes()).padStart(2, '0');
  
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

/**
 * datetime-local 입력값(KST로 해석)을 UTC로 변환하여 ISO 문자열로 반환
 */
export function convertKSTInputToUTC(kstInputString: string): string | null {
  if (!kstInputString) return null;
  
  // 입력값을 KST로 해석 (YYYY-MM-DDTHH:mm 형식)
  const [datePart, timePart] = kstInputString.split('T');
  if (!datePart || !timePart) return null;
  
  const [year, month, day] = datePart.split('-').map(Number);
  const [hours, minutes] = timePart.split(':').map(Number);
  
  // KST 시간으로 Date 객체 생성 (UTC 기준으로 생성)
  const kstDate = new Date(Date.UTC(year, month - 1, day, hours, minutes, 0, 0));
  
  // KST를 UTC로 변환 (9시간 빼기)
  const utcDate = new Date(kstDate.getTime() - (9 * 60 * 60 * 1000));
  
  return utcDate.toISOString();
}

/**
 * UTC 시간을 KST로 변환하여 표시용 문자열 반환
 */
export function formatKST(utcString: string | null): string {
  if (!utcString) return '';
  
  const utcDate = new Date(utcString);
  // UTC를 KST로 변환 (UTC+9)
  const kstDate = new Date(utcDate.getTime() + (9 * 60 * 60 * 1000));
  
  return kstDate.toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC'
  });
}

/**
 * UTC 시간을 KST로 변환하여 시간만 반환 (HH:mm)
 */
export function formatKSTTime(utcString: string | null): string {
  if (!utcString) return '';
  
  const utcDate = new Date(utcString);
  // UTC를 KST로 변환 (UTC+9)
  const kstDate = new Date(utcDate.getTime() + (9 * 60 * 60 * 1000));
  
  // UTC 기준으로 KST 시간 추출
  const hours = String(kstDate.getUTCHours()).padStart(2, '0');
  const minutes = String(kstDate.getUTCMinutes()).padStart(2, '0');
  
  return `${hours}:${minutes}`;
}

/**
 * Date 객체를 KST 기준 datetime-local 형식으로 변환
 */
export function dateToKSTInput(date: Date): string {
  // Date 객체를 KST로 해석 (로컬 시간대를 KST로 간주)
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

