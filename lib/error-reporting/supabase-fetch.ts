/**
 * Supabase 브라우저 클라이언트에 주입하는 리포팅 fetch.
 * 모든 /rest/v1/ 데이터 호출의 권한/RLS/서버 오류를 자동으로 /api/errors/report 로 보낸다.
 *
 * 목적: RLS 도입 후 "되어야 하는데 권한 없음(42501 / permission denied / row-level security)" 이
 * 발생하면 사용자가 인지 못 해도 관리자(개발자)에게 즉시 보고되게 함.
 *
 * 주의:
 * - RLS가 단순히 행을 "필터"하는 경우(SELECT가 빈 배열 반환)는 오류가 아니라 잡히지 않음.
 *   명시적 권한 거부(401/403/42501) 와 5xx 만 보고한다.
 * - .single() 의 행 없음(406/PGRST116), 일반 검증(400/404/409 등)은 정상 흐름이라 제외.
 * - 리포트 전송 자체는 plain fetch(reportError 내부)라 이 wrapper를 다시 타지 않음(무한루프 없음).
 */
import { reportError } from './report';

function urlOf(input: RequestInfo | URL): string {
  try {
    if (typeof input === 'string') return input;
    if (input instanceof URL) return input.toString();
    return (input as Request).url || '';
  } catch {
    return '';
  }
}

export const reportingFetch: typeof fetch = async (input, init) => {
  const res = await fetch(input as any, init);
  try {
    const url = urlOf(input as any);
    // 데이터 호출만 검사 (auth 토큰 갱신 등 /auth/v1 의 401/400 잡음 제외)
    if (res.status >= 400 && /\/rest\/v1\//.test(url)) {
      const clone = res.clone();
      clone.text().then((body) => {
        let code = '';
        let message = (body || '').slice(0, 400);
        try {
          const j = JSON.parse(body);
          code = j.code || j.error_code || '';
          message = j.message || j.error || message;
        } catch { /* non-json body */ }

        const isRls =
          res.status === 401 || res.status === 403 || code === '42501' ||
          /row-level security|permission denied|insufficient/i.test(message);

        // 보고 대상: 권한/RLS(401/403/42501/RLS메시지) + 서버오류(5xx). 그 외 4xx(검증/충돌/없음)는 제외.
        if (!isRls && res.status < 500) return;

        reportError({
          source: 'supabase',
          level: isRls ? 'warning' : 'error',
          message: `Supabase ${res.status}${code ? ` [${code}]` : ''}${isRls ? ' (권한/RLS 의심)' : ''}: ${message}`,
          statusCode: res.status,
          context: { url, code, rls: isRls },
        });
      }).catch(() => { /* 본문 읽기 실패는 무시 */ });
    }
  } catch { /* wrapper는 절대 호출 흐름을 깨지 않음 */ }
  return res;
};
