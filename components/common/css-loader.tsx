"use client";

import { useEffect } from 'react';

/**
 * CSS 로딩을 보장하는 컴포넌트
 * CSS가 로드될 때까지 페이지를 숨기고, 로드되면 표시합니다.
 */
export function CSSLoader() {
  useEffect(() => {
    // CSS 로딩 확인 함수
    const checkCSSLoaded = () => {
      // 스타일시트가 로드되었는지 확인
      const hasStylesheets = document.styleSheets.length > 0;
      
      // Tailwind CSS 클래스가 적용되는지 확인
      const testElement = document.createElement('div');
      testElement.className = 'hidden';
      document.body.appendChild(testElement);
      const computedStyle = window.getComputedStyle(testElement);
      const hasTailwind = computedStyle.display === 'none';
      document.body.removeChild(testElement);
      
      return hasStylesheets && hasTailwind;
    };

    // 즉시 확인
    if (checkCSSLoaded()) {
      document.documentElement.classList.add('css-loaded');
      return;
    }

    // 주기적으로 확인 (최대 3초)
    let attempts = 0;
    const maxAttempts = 30; // 3초 (100ms * 30)
    
    const interval = setInterval(() => {
      attempts++;
      
      if (checkCSSLoaded() || attempts >= maxAttempts) {
        document.documentElement.classList.add('css-loaded');
        clearInterval(interval);
      }
    }, 100);

    // 최종 안전장치: 3초 후 강제로 표시
    const timeout = setTimeout(() => {
      document.documentElement.classList.add('css-loaded');
      clearInterval(interval);
    }, 3000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, []);

  return null;
}



