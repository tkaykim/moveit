/**
 * 클라이언트 오류 리포터.
 * 어디서든 import 해서 reportError(...)를 호출하면 /api/errors/report 로 비동기 전송된다.
 * - 절대 throw 하지 않음(리포터가 또 에러를 내면 안 됨).
 * - 동일 메시지 단시간 폭주 방지를 위한 클라이언트측 소프트 디듀프(5초).
 * - 현재 페이지 academyId 를 URL(/academy-admin/{slug}...)에서 추정해 함께 전송(있으면).
 */

type ReportLevel = 'error' | 'warning' | 'fatal';

interface ReportInput {
  level?: ReportLevel;
  source: string;
  message: string;
  stack?: string;
  statusCode?: number;
  context?: Record<string, unknown>;
}

const recent = new Map<string, number>();
const DEDUP_MS = 5000;

/** academy-admin 경로의 slug 를 academyId로 변환할 수는 없으므로, 알 수 있는 경우만 context로 넘긴다.
 *  (서버에서 slug→id 매핑까지 하면 더 정확하지만, 우선 url/path를 컨텍스트로 보존) */
function currentAcademyId(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  // window.__MOVEIT_ACADEMY_ID__ 를 academy-admin 레이아웃에서 세팅하면 사용(있으면)
  const v = (window as any).__MOVEIT_ACADEMY_ID__;
  return typeof v === 'string' && v.length === 36 ? v : undefined;
}

export function reportError(input: ReportInput): void {
  try {
    if (typeof window === 'undefined') return;
    const msg = (input.message || '').trim();
    if (!msg) return;

    // 클라이언트 소프트 디듀프
    const key = `${input.source}|${msg.slice(0, 120)}`;
    const now = Date.now();
    const last = recent.get(key);
    if (last && now - last < DEDUP_MS) return;
    recent.set(key, now);
    if (recent.size > 200) recent.clear();

    const payload = {
      level: input.level || 'error',
      source: input.source,
      message: msg,
      stack: input.stack,
      url: window.location.href,
      statusCode: input.statusCode,
      context: input.context,
      academyId: currentAcademyId(),
    };

    // keepalive: 페이지 이탈/네비게이션 중에도 전송 보장
    fetch('/api/errors/report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => { /* 리포터 실패는 무시 */ });
  } catch {
    /* 리포터는 절대 흐름을 깨지 않는다 */
  }
}

let installed = false;

/** 전역 window 에러/프라미스 거부 핸들러 설치 (앱 1회) */
export function installGlobalErrorHandlers(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;

  window.addEventListener('error', (event: ErrorEvent) => {
    // 리소스 로드 에러(img 등)는 message 없음 → 걸러짐
    reportError({
      source: 'window.onerror',
      message: event.message || (event.error && event.error.message) || 'Unknown error',
      stack: event.error?.stack,
      context: { filename: event.filename, lineno: event.lineno, colno: event.colno },
    });
  });

  window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
    const reason: any = event.reason;
    const message = reason?.message || (typeof reason === 'string' ? reason : 'Unhandled promise rejection');
    reportError({
      source: 'unhandledrejection',
      message,
      stack: reason?.stack,
    });
  });
}
