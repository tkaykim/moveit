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

/**
 * successUrl/failUrl은 토스페이먼츠가 "결제창을 연 페이지와 같은 origin"을 요구하므로
 * 웹/앱 모두 https 도메인을 사용. (moveit:// 은 허용되지 않음)
 */
export function getPaymentSuccessUrl(path: string, query?: Record<string, string>): string {
  if (typeof window === 'undefined') return '';
  const origin = window.location.origin;
  const pathNorm = path.startsWith('/') ? path : `/${path}`;
  const qs = query ? new URLSearchParams(query).toString() : '';
  return `${origin}${pathNorm}${qs ? `?${qs}` : ''}`;
}

export function getPaymentFailUrl(path: string, query?: Record<string, string>): string {
  return getPaymentSuccessUrl(path, query);
}
