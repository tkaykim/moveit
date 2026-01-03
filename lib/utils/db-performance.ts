/**
 * 데이터베이스 쿼리 성능 모니터링 유틸리티
 * 개발 환경에서 DB 응답 시간을 측정하고 로깅합니다.
 */

interface PerformanceLog {
  query: string;
  duration: number;
  timestamp: number;
  error?: string;
}

const performanceLogs: PerformanceLog[] = [];
const MAX_LOGS = 100; // 최대 로그 개수

/**
 * 쿼리 실행 시간을 측정하는 래퍼 함수
 * @param queryName 쿼리 이름 (예: "getAcademies")
 * @param queryFn 실행할 쿼리 함수
 * @returns 쿼리 결과
 */
export async function measureQuery<T>(
  queryName: string,
  queryFn: () => Promise<T>
): Promise<T> {
  const startTime = performance.now();
  const timestamp = Date.now();

  try {
    const result = await queryFn();
    const duration = performance.now() - startTime;

    // 성능 로그 기록
    logPerformance({
      query: queryName,
      duration,
      timestamp,
    });

    // 느린 쿼리 경고 (1초 이상)
    if (duration > 1000) {
      console.warn(
        `⚠️ 느린 쿼리 감지: ${queryName} (${duration.toFixed(2)}ms)`
      );
    }

    // 매우 느린 쿼리 경고 (5초 이상)
    if (duration > 5000) {
      console.error(
        `🚨 매우 느린 쿼리: ${queryName} (${duration.toFixed(2)}ms) - DB 연결 상태를 확인하세요.`
      );
    }

    return result;
  } catch (error: any) {
    const duration = performance.now() - startTime;

    logPerformance({
      query: queryName,
      duration,
      timestamp,
      error: error?.message || 'Unknown error',
    });

    console.error(`❌ 쿼리 실패: ${queryName}`, error);
    throw error;
  }
}

/**
 * 성능 로그 기록
 */
function logPerformance(log: PerformanceLog) {
  performanceLogs.push(log);

  // 최대 로그 개수 초과 시 오래된 로그 제거
  if (performanceLogs.length > MAX_LOGS) {
    performanceLogs.shift();
  }

  // 개발 환경에서만 상세 로그 출력
  if (process.env.NODE_ENV === 'development') {
    const emoji = log.duration > 5000 ? '🚨' : log.duration > 1000 ? '⚠️' : '✅';
    console.log(
      `${emoji} [DB] ${log.query}: ${log.duration.toFixed(2)}ms`
    );
  }
}

/**
 * 성능 통계 조회
 */
export function getPerformanceStats() {
  if (performanceLogs.length === 0) {
    return {
      total: 0,
      average: 0,
      min: 0,
      max: 0,
      slowQueries: [],
    };
  }

  const durations = performanceLogs.map((log) => log.duration);
  const average = durations.reduce((a, b) => a + b, 0) / durations.length;
  const min = Math.min(...durations);
  const max = Math.max(...durations);

  // 1초 이상 걸린 쿼리들
  const slowQueries = performanceLogs
    .filter((log) => log.duration > 1000)
    .sort((a, b) => b.duration - a.duration)
    .slice(0, 10); // 상위 10개만

  return {
    total: performanceLogs.length,
    average: Math.round(average),
    min: Math.round(min),
    max: Math.round(max),
    slowQueries: slowQueries.map((log) => ({
      query: log.query,
      duration: Math.round(log.duration),
      timestamp: new Date(log.timestamp).toLocaleString('ko-KR'),
    })),
  };
}

/**
 * 성능 로그 초기화
 */
export function clearPerformanceLogs() {
  performanceLogs.length = 0;
}

/**
 * 개발 환경에서 성능 통계를 주기적으로 출력
 */
if (typeof window === 'undefined' && process.env.NODE_ENV === 'development') {
  // 서버 사이드에서만 실행
  setInterval(() => {
    const stats = getPerformanceStats();
    if (stats.total > 0 && stats.slowQueries.length > 0) {
      console.log('\n📊 DB 성능 통계:');
      console.log(`  총 쿼리: ${stats.total}개`);
      console.log(`  평균 응답 시간: ${stats.average}ms`);
      console.log(`  최소: ${stats.min}ms, 최대: ${stats.max}ms`);
      if (stats.slowQueries.length > 0) {
        console.log(`  느린 쿼리 (${stats.slowQueries.length}개):`);
        stats.slowQueries.forEach((q) => {
          console.log(`    - ${q.query}: ${q.duration}ms (${q.timestamp})`);
        });
      }
      console.log('');
    }
  }, 60000); // 1분마다
}

