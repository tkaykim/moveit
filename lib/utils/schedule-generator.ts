/**
 * 반복 일정 날짜 생성 알고리즘
 * class_administor.md의 generateSessionDates 로직 구현
 */

/**
 * 반복 규칙에 따라 세션 날짜 목록을 생성합니다.
 * 
 * @param startDate 시작 날짜
 * @param endDate 종료 날짜
 * @param daysOfWeek 요일 배열 (0=일요일, 1=월요일, ... 6=토요일)
 * @param intervalWeeks 반복 주기 (1=매주, 2=격주, 3=3주 간격 등)
 * @returns 생성된 날짜 배열
 * 
 * @example
 * // 2026년 1월 1일부터 3월 31일까지, 매주 월/수/금
 * generateSessionDates(
 *   new Date('2026-01-01'),
 *   new Date('2026-03-31'),
 *   [1, 3, 5], // 월, 수, 금
 *   1 // 매주
 * );
 * 
 * @example
 * // 격주 화/목
 * generateSessionDates(startDate, endDate, [2, 4], 2);
 */
export function generateSessionDates(
  startDate: Date,
  endDate: Date,
  daysOfWeek: number[],
  intervalWeeks: number = 1
): Date[] {
  const dates: Date[] = [];
  
  // 시작일의 자정으로 설정
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);
  
  const current = new Date(start);
  
  while (current <= end) {
    // 시작일 기준 경과 일수 계산
    const diffTime = Math.abs(current.getTime() - start.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    // 주차 계산 (시작일이 0주차)
    const weekNumber = Math.floor(diffDays / 7);
    
    // Modulo 연산: 해당 주차가 반복 주기에 해당하는지 확인
    if (weekNumber % intervalWeeks === 0) {
      // 요일 필터링
      if (daysOfWeek.includes(current.getDay())) {
        dates.push(new Date(current));
      }
    }
    
    // 다음 날로 이동
    current.setDate(current.getDate() + 1);
  }
  
  return dates;
}

/**
 * 날짜와 시간을 조합하여 ISO 문자열로 변환
 * 
 * @param date 날짜 객체
 * @param timeString 시간 문자열 (HH:mm 형식)
 * @returns ISO 형식의 날짜-시간 문자열
 */
export function combineDateAndTime(date: Date, timeString: string): string {
  const [hours, minutes] = timeString.split(':').map(Number);
  const combined = new Date(date);
  combined.setHours(hours, minutes, 0, 0);
  return combined.toISOString();
}

/**
 * 요일 인덱스를 한글로 변환
 */
export const DAY_NAMES_KR = ['일', '월', '화', '수', '목', '금', '토'];

/**
 * 날짜를 YYYY-MM-DD 형식으로 포맷
 */
export function formatDateToYMD(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
