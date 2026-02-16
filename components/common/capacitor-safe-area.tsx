"use client";

import { useEffect } from 'react';

/**
 * Capacitor 앱 환경에서 Android/iOS 시스템 UI 영역을 감지하고
 * CSS 변수(--safe-area-bottom)를 설정하는 컴포넌트.
 * env(safe-area-inset-bottom)이 작동하지 않는 Android WebView를 위한 폴백.
 */
export function CapacitorSafeArea() {
  useEffect(() => {
    const w = window as any;

    if (!w.Capacitor) return;

    const platform: string = w.Capacitor.getPlatform?.() ?? '';
    document.documentElement.classList.add('capacitor-app');

    if (platform === 'android') {
      document.documentElement.classList.add('capacitor-android');
    } else if (platform === 'ios') {
      document.documentElement.classList.add('capacitor-ios');
    }
  }, []);

  return null;
}
