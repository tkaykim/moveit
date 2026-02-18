"use client";

import { useEffect } from 'react';

/** Android 상태바(알림/시계/배터리) 대략 높이 px. env(safe-area-inset-top) 미지원 시 폴백 */
const ANDROID_STATUS_BAR_FALLBACK_PX = 28;

/**
 * Capacitor 앱 환경에서 Android/iOS 시스템 UI 영역을 감지하고
 * CSS 변수(--app-safe-bottom, --app-safe-top)를 설정하는 컴포넌트.
 * 상단: 앱 헤더가 휴대폰 상태바와 겹치지 않도록 --app-safe-top 적용.
 * 하단: env(safe-area-inset-bottom)이 작동하지 않는 Android WebView를 위한 폴백.
 */
export function CapacitorSafeArea() {
  useEffect(() => {
    const w = window as any;

    if (!w.Capacitor) return;

    const platform: string = w.Capacitor.getPlatform?.() ?? '';
    document.documentElement.classList.add('capacitor-app');

    if (platform === 'android') {
      document.documentElement.classList.add('capacitor-android');
      // Android WebView에서 env(safe-area-inset-top)이 0인 경우가 많아, 상단 상태바 높이만큼 폴백
      document.documentElement.style.setProperty(
        '--app-safe-top',
        `max(${ANDROID_STATUS_BAR_FALLBACK_PX}px, env(safe-area-inset-top, 0px))`
      );
    } else if (platform === 'ios') {
      document.documentElement.classList.add('capacitor-ios');
      // iOS는 보통 env(safe-area-inset-top)이 잘 동작하므로 globals.css 기본값 사용
    }
  }, []);

  return null;
}
