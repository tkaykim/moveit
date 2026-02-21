/**
 * Capacitor 네이티브 앱 환경 감지
 * @see https://capacitorjs.com/docs/core-apis
 */

import { Capacitor } from '@capacitor/core';

/** Capacitor로 빌드된 네이티브 앱(Android/iOS) 내 WebView에서 실행 중인지 */
export function isCapacitorNative(): boolean {
  if (typeof window === 'undefined') return false;
  return Capacitor.isNativePlatform();
}

/** 앱으로 복귀하기 위한 URL 스킴 (토스페이먼츠 appScheme 등에서 사용) */
export const APP_SCHEME = 'moveit://';

/** 앱 환경에서 successUrl/failUrl용 (딥링크 → MainActivity에서 https로 변환하여 로드) */
export function getPaymentSuccessUrl(path: string, query?: Record<string, string>): string {
  if (typeof window === 'undefined') return '';
  const isApp = isCapacitorNative();
  const base = isApp ? APP_SCHEME : window.location.origin;
  const pathNorm = path.startsWith('/') ? path.slice(1) : path;
  const qs = query ? new URLSearchParams(query).toString() : '';
  return `${base}${pathNorm}${qs ? `?${qs}` : ''}`;
}

export function getPaymentFailUrl(path: string, query?: Record<string, string>): string {
  return getPaymentSuccessUrl(path, query);
}
