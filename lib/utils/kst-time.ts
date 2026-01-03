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

/**
 * 현재 시간을 KST 기준으로 반환
 */
export function getKSTNow(): Date {
  const now = new Date();
  // UTC 시간에 9시간을 더해 KST로 변환
  const kstTime = new Date(now.getTime() + (9 * 60 * 60 * 1000));
  return kstTime;
}

/**
 * KST 기준으로 날짜의 요일 반환 (0=일요일, 1=월요일, ...)
 */
export function getKSTDay(date: Date): number {
  const kstTime = new Date(date.getTime() + (9 * 60 * 60 * 1000));
  return kstTime.getUTCDay();
}

/**
 * KST 기준으로 날짜의 년, 월, 일 반환
 */
export function getKSTDateParts(date: Date): { year: number; month: number; day: number } {
  const kstTime = new Date(date.getTime() + (9 * 60 * 60 * 1000));
  return {
    year: kstTime.getUTCFullYear(),
    month: kstTime.getUTCMonth() + 1,
    day: kstTime.getUTCDate(),
  };
}

/**
 * KST 기준으로 주의 시작(월요일) 날짜 계산
 */
export function getKSTWeekStart(date: Date = new Date()): Date {
  const kstTime = new Date(date.getTime() + (9 * 60 * 60 * 1000));
  const day = kstTime.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day; // 월요일을 0으로
  
  const weekStart = new Date(kstTime);
  weekStart.setUTCDate(kstTime.getUTCDate() + diff);
  weekStart.setUTCHours(0, 0, 0, 0);
  
  // UTC로 변환하여 반환 (KST에서 9시간 빼기)
  return new Date(weekStart.getTime() - (9 * 60 * 60 * 1000));
}

/**
 * KST 기준 날짜를 표시용 문자열로 변환 (M/D 형식)
 */
export function formatKSTDate(date: Date): string {
  const parts = getKSTDateParts(date);
  return `${parts.month}/${parts.day}`;
}

/**
 * KST 기준 날짜 범위를 표시용 문자열로 변환 (M/D - M/D 형식)
 */
export function formatKSTDateRange(start: Date, end: Date): string {
  const startParts = getKSTDateParts(start);
  const endParts = getKSTDateParts(end);
  return `${startParts.month}/${startParts.day} - ${endParts.month}/${endParts.day}`;
}

/**
 * KST 기준으로 날짜가 오늘인지 확인
 */
export function isKSTToday(date: Date): boolean {
  const now = getKSTNow();
  const dateParts = getKSTDateParts(date);
  const nowParts = getKSTDateParts(now);
  
  return dateParts.year === nowParts.year &&
         dateParts.month === nowParts.month &&
         dateParts.day === nowParts.day;
}

/**
 * KST 기준 날짜의 일(day) 반환
 */
export function getKSTDayOfMonth(date: Date): number {
  return getKSTDateParts(date).day;
}

