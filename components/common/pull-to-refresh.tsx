"use client";

import { useRef, useState, useCallback, useEffect, ReactNode } from 'react';
import { RefreshCw } from 'lucide-react';

interface PullToRefreshProps {
  children: ReactNode;
  onRefresh?: () => Promise<void>;
  threshold?: number;
  maxPull?: number;
}

export function PullToRefresh({
  children,
  onRefresh,
  threshold = 80,
  maxPull = 120,
}: PullToRefreshProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const startYRef = useRef(0);
  const currentYRef = useRef(0);
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isActive, setIsActive] = useState(false);

  const getScrollParent = useCallback((): HTMLElement | null => {
    let el = containerRef.current?.parentElement;
    while (el) {
      const style = getComputedStyle(el);
      if (style.overflow === 'auto' || style.overflow === 'scroll' ||
          style.overflowY === 'auto' || style.overflowY === 'scroll') {
        return el;
      }
      el = el.parentElement;
    }
    return null;
  }, []);

  const isAtTop = useCallback(() => {
    const scrollParent = getScrollParent();
    if (scrollParent) return scrollParent.scrollTop <= 0;
    return window.scrollY <= 0;
  }, [getScrollParent]);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (isRefreshing) return;
    if (!isAtTop()) return;
    startYRef.current = e.touches[0].clientY;
    currentYRef.current = e.touches[0].clientY;
    setIsActive(true);
  }, [isRefreshing, isAtTop]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!isActive || isRefreshing) return;
    if (!isAtTop()) {
      setPullDistance(0);
      return;
    }

    currentYRef.current = e.touches[0].clientY;
    const diff = currentYRef.current - startYRef.current;

    if (diff > 0) {
      // 감속 효과 적용
      const dampened = Math.min(diff * 0.4, maxPull);
      setPullDistance(dampened);

      if (dampened > 10) {
        e.preventDefault();
      }
    }
  }, [isActive, isRefreshing, isAtTop, maxPull]);

  const handleTouchEnd = useCallback(async () => {
    if (!isActive) return;
    setIsActive(false);

    if (pullDistance >= threshold && !isRefreshing) {
      setIsRefreshing(true);
      setPullDistance(threshold * 0.6);

      try {
        if (onRefresh) {
          await onRefresh();
        }
        // onRefresh 미제공 시에는 전역 새로고침 이벤트만 발생 (layout에서 주입한 onRefresh가 처리).
        // window.location.reload()는 호출하지 않아 세션/현재 화면 유지.
      } catch {
        // 실패해도 새로고침 상태 해제
      } finally {
        setIsRefreshing(false);
        setPullDistance(0);
      }
    } else {
      setPullDistance(0);
    }
  }, [isActive, pullDistance, threshold, isRefreshing, onRefresh]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const opts: AddEventListenerOptions = { passive: false };
    container.addEventListener('touchstart', handleTouchStart, { passive: true });
    container.addEventListener('touchmove', handleTouchMove, opts);
    container.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  const progress = Math.min(pullDistance / threshold, 1);
  const rotation = pullDistance * 3;

  return (
    <div ref={containerRef} className="relative">
      {/* Pull indicator */}
      <div
        className="absolute left-0 right-0 flex justify-center z-50 pointer-events-none"
        style={{
          top: 0,
          transform: `translateY(${pullDistance - 40}px)`,
          opacity: progress,
          transition: isActive ? 'none' : 'all 0.3s ease-out',
        }}
      >
        <div className={`w-9 h-9 rounded-full bg-white dark:bg-neutral-800 shadow-lg flex items-center justify-center ${
          isRefreshing ? 'animate-spin' : ''
        }`}>
          <RefreshCw
            size={18}
            className={`${progress >= 1 ? 'text-primary dark:text-[#CCFF00]' : 'text-neutral-400'}`}
            style={!isRefreshing ? { transform: `rotate(${rotation}deg)` } : undefined}
          />
        </div>
      </div>

      {/* Content with pull effect */}
      <div
        style={{
          transform: `translateY(${pullDistance}px)`,
          transition: isActive ? 'none' : 'transform 0.3s ease-out',
        }}
      >
        {children}
      </div>
    </div>
  );
}
