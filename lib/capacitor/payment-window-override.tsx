'use client';

import { useEffect } from 'react';
import { Browser } from '@capacitor/browser';
import { Capacitor } from '@capacitor/core';

/** 토스/PG 결제 관련 URL 패턴 (window.open 가로채기 대상) */
const PAYMENT_URL_PATTERNS = [
  /tosspayments\.com/i,
  /toss\.im/i,
  /portone\.io/i,
  /pay\.tosspayments\.com/i,
  /api\.tosspayments\.com/i,
];

function isPaymentUrl(url: string | undefined): boolean {
  if (!url || typeof url !== 'string') return false;
  return PAYMENT_URL_PATTERNS.some((p) => p.test(url));
}

/**
 * Capacitor 앱에서 결제 관련 window.open을 앱 내 브라우저(모달)로 열어
 * 외부 브라우저 이탈을 방지합니다.
 * 웹에서는 기존 동작 유지.
 */
export function usePaymentWindowOverride() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const originalOpen = window.open.bind(window);
    window.open = function (
      url?: string | URL,
      target?: string,
      features?: string
    ): Window | null {
      const urlStr = typeof url === 'string' ? url : url?.href;
      if (isPaymentUrl(urlStr)) {
        Browser.open({ url: urlStr! });
        return null;
      }
      return originalOpen(url, target, features);
    };

    return () => {
      window.open = originalOpen;
    };
  }, []);
}

/** 레이아웃에 마운트용 컴포넌트 (children 없음) */
export function PaymentWindowOverride() {
  usePaymentWindowOverride();
  return null;
}
