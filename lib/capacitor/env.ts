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
