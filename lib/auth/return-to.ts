/**
 * 로그인/회원가입(이메일·Google OAuth) 후 "원래 있던 화면 + 하던 행동"으로
 * 복귀시키기 위한 헬퍼.
 *
 * 문제 배경:
 * - 로그인은 모달(MyTab)이라 이메일 로그인은 페이지 이동이 없지만,
 *   Google OAuth는 Google → Supabase → /auth/callback 으로 **페이지를 떠났다 돌아오므로**
 *   React in-memory state(선택한 수강권·결제수단·pendingPurchaseResume)가 전부 소실된다.
 * - 게다가 Supabase OAuth 왕복 중 redirectTo 의 `?next=` 쿼리가 유실되면
 *   콜백이 `/home` 으로 폴백해 "홈으로 튕기는" 현상이 난다. (modoo_app도 같은 이유로 쿠키 폴백을 둠)
 *
 * 그래서:
 * 1) returnTo 경로는 쿠키(`login_return_to`)로도 백업 → 콜백 서버가 쿼리 유실 시 쿠키로 복원.
 * 2) "하던 행동"(어떤 수강권을 어떤 결제수단으로 사려 했는지)은 localStorage 에 intent 로 저장 →
 *    OAuth 복귀 후 예약 페이지가 마운트되면 선택을 복원하고 결제를 자동 재개한다.
 */

const RETURN_TO_COOKIE = 'login_return_to';
const PURCHASE_INTENT_KEY = 'moveit:purchaseIntent';
const INTENT_TTL_MS = 30 * 60 * 1000; // 30분

/** 오픈 리다이렉트 방지: 같은 사이트 내부 경로만 허용. */
export function getSafeReturnPath(value: string | null | undefined): string | null {
  if (!value) return null;
  if (!value.startsWith('/')) return null; // 절대 URL/외부 차단
  if (value.startsWith('//')) return null; // 프로토콜 상대 URL 차단
  if (value.startsWith('/auth')) return null; // 콜백/인증 경로로의 루프 차단
  return value;
}

/**
 * OAuth 직전에 호출. returnTo 경로를 쿠키로 백업한다(서버 콜백 폴백용).
 * Lax 쿠키라 Supabase→앱 콜백의 top-level GET 네비게이션에 함께 전송된다.
 */
export function setReturnToCookie(path: string): void {
  if (typeof document === 'undefined') return;
  const safe = getSafeReturnPath(path);
  if (!safe) return;
  document.cookie = `${RETURN_TO_COOKIE}=${encodeURIComponent(safe)}; path=/; max-age=3600; SameSite=Lax`;
}

export type PurchaseIntent = {
  /** 예약 대상 세션(schedule) id — 복귀 페이지가 자기 것인지 대조 */
  sessionId: string;
  ticketId: string;
  paymentType: 'card' | 'account' | string;
  countOptionIndex?: number;
  savedAt: number;
};

/** 로그인 유도 직전, "사려던 것"을 저장. (이메일·OAuth 양쪽 공용) */
export function savePurchaseIntent(intent: Omit<PurchaseIntent, 'savedAt'>): void {
  if (typeof window === 'undefined') return;
  try {
    const payload: PurchaseIntent = { ...intent, savedAt: Date.now() };
    localStorage.setItem(PURCHASE_INTENT_KEY, JSON.stringify(payload));
  } catch {
    /* storage 비활성(사파리 프라이빗 등) 시 무시 */
  }
}

/** 저장된 구매 의도를 읽는다. TTL 경과·세션 불일치는 null. 읽으면서 만료는 정리. */
export function readPurchaseIntent(expectedSessionId?: string): PurchaseIntent | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(PURCHASE_INTENT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PurchaseIntent;
    if (!parsed?.sessionId || !parsed?.ticketId) return null;
    if (Date.now() - (parsed.savedAt ?? 0) > INTENT_TTL_MS) {
      clearPurchaseIntent();
      return null;
    }
    if (expectedSessionId && parsed.sessionId !== expectedSessionId) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearPurchaseIntent(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(PURCHASE_INTENT_KEY);
  } catch {
    /* ignore */
  }
}
