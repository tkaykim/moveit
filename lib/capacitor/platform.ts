/**
 * Capacitor 플랫폼 감지 유틸리티
 * 원격 URL(Vercel) 환경에서도 안정적으로 감지
 */

export type Platform = 'web' | 'android' | 'ios';

/** window.Capacitor 직접 확인 (원격 URL에서도 안정적) */
function getWindowCapacitor(): any {
  if (typeof window === 'undefined') return null;
  return (window as any).Capacitor || null;
}

/** 현재 플랫폼 반환 */
export function getPlatform(): Platform {
  const cap = getWindowCapacitor();
  if (!cap) return 'web';

  const p = typeof cap.getPlatform === 'function' ? cap.getPlatform() : null;
  if (p === 'android' || p === 'ios') return p;
  return 'web';
}

/** 네이티브 앱(Android/iOS) 환경인지 확인 */
export function isNativePlatform(): boolean {
  const cap = getWindowCapacitor();
  if (!cap) return false;

  // 방법 1: isNativePlatform 함수
  if (typeof cap.isNativePlatform === 'function') return cap.isNativePlatform();

  // 방법 2: isNativePlatform 속성 (boolean)
  if (cap.isNativePlatform === true) return true;

  // 방법 3: 플랫폼이 web이 아니면 네이티브
  const p = typeof cap.getPlatform === 'function' ? cap.getPlatform() : null;
  return p === 'android' || p === 'ios';
}

/** Android 환경인지 확인 */
export function isAndroid(): boolean {
  return getPlatform() === 'android';
}

/** iOS 환경인지 확인 */
export function isIOS(): boolean {
  return getPlatform() === 'ios';
}

/** 웹 환경인지 확인 */
export function isWeb(): boolean {
  return !isNativePlatform();
}

/** 특정 플러그인 사용 가능 여부 확인 */
export function isPluginAvailable(name: string): boolean {
  const cap = getWindowCapacitor();
  if (!cap) return false;

  // Capacitor 3+: isPluginAvailable
  if (typeof cap.isPluginAvailable === 'function') return cap.isPluginAvailable(name);

  // Fallback: Plugins 객체에 존재하는지
  return !!(cap.Plugins && cap.Plugins[name]);
}
