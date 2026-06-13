'use client';

import React from 'react';
import { installGlobalErrorHandlers, reportError } from '@/lib/error-reporting/report';

/** 앱 최상단에 1회 마운트 — window 전역 에러/프라미스 거부 수집 시작 */
export function GlobalErrorReporter() {
  React.useEffect(() => {
    installGlobalErrorHandlers();
  }, []);
  return null;
}

interface BoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}
interface BoundaryState {
  hasError: boolean;
}

/** React 렌더 트리 에러를 잡아 리포트하고, 흰 화면 대신 복구 UI 표시 */
export class AppErrorBoundary extends React.Component<BoundaryProps, BoundaryState> {
  constructor(props: BoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): BoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    reportError({
      level: 'fatal',
      source: 'react',
      message: error?.message || 'React render error',
      stack: error?.stack,
      context: { componentStack: info?.componentStack?.slice(0, 2000) },
    });
  }

  handleReload = () => {
    this.setState({ hasError: false });
    if (typeof window !== 'undefined') window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="min-h-[50vh] flex flex-col items-center justify-center gap-4 p-8 text-center">
          <p className="text-base font-semibold text-neutral-800 dark:text-neutral-100">
            화면을 표시하는 중 문제가 발생했습니다.
          </p>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            오류가 자동으로 관리자에게 전달되었습니다. 잠시 후 다시 시도해 주세요.
          </p>
          <button
            onClick={this.handleReload}
            className="px-4 py-2 rounded-lg bg-neutral-900 dark:bg-white text-white dark:text-black text-sm font-medium"
          >
            새로고침
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
