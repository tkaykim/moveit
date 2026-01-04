'use client';

import { useEffect, useState } from 'react';
import { authTestLogger, type AuthTestLog, type LogLevel } from '@/lib/utils/auth-test-logger';

export function AuthTestLogger() {
  const [logs, setLogs] = useState<AuthTestLog[]>([]);

  useEffect(() => {
    // 초기 로그 로드
    setLogs(authTestLogger.getLogs());

    // 로그 변경 구독
    const unsubscribe = authTestLogger.subscribe((newLogs) => {
      setLogs(newLogs);
    });

    return unsubscribe;
  }, []);

  const getLevelColor = (level: LogLevel) => {
    switch (level) {
      case 'success':
        return 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-700 dark:text-green-400';
      case 'error':
        return 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400';
      case 'warning':
        return 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800 text-yellow-700 dark:text-yellow-400';
      default:
        return 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400';
    }
  };

  const getLevelIcon = (level: LogLevel) => {
    switch (level) {
      case 'success':
        return '✓';
      case 'error':
        return '✗';
      case 'warning':
        return '⚠';
      default:
        return 'ℹ';
    }
  };

  const formatTimestamp = (date: Date) => {
    return new Date(date).toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3,
    });
  };

  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-neutral-900 dark:text-white">
          인증 테스트 로그
        </h3>
        <button
          onClick={() => {
            authTestLogger.clearLogs();
          }}
          className="px-3 py-1.5 text-sm bg-neutral-200 dark:bg-neutral-800 hover:bg-neutral-300 dark:hover:bg-neutral-700 rounded-lg transition-colors text-neutral-700 dark:text-neutral-300"
        >
          로그 지우기
        </button>
      </div>

      <div className="flex-1 overflow-y-auto space-y-2">
        {logs.length === 0 ? (
          <div className="text-center py-8 text-neutral-500 dark:text-neutral-400">
            로그가 없습니다. 회원가입 또는 로그인을 시도해보세요.
          </div>
        ) : (
          logs.map((log) => (
            <div
              key={log.id}
              className={`p-3 rounded-lg border ${getLevelColor(log.level)}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2 flex-1">
                  <span className="font-semibold text-sm">{getLevelIcon(log.level)}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm">{log.action}</span>
                      <span className="text-xs opacity-75">
                        {formatTimestamp(log.timestamp)}
                      </span>
                    </div>
                    <p className="text-sm">{log.message}</p>
                    {log.details && (
                      <details className="mt-2">
                        <summary className="text-xs cursor-pointer opacity-75 hover:opacity-100">
                          상세 정보
                        </summary>
                        <pre className="mt-1 text-xs bg-white/50 dark:bg-black/50 p-2 rounded overflow-x-auto">
                          {JSON.stringify(log.details, null, 2)}
                        </pre>
                      </details>
                    )}
                    {log.error && (
                      <details className="mt-2">
                        <summary className="text-xs cursor-pointer opacity-75 hover:opacity-100 text-red-600 dark:text-red-400">
                          오류 정보
                        </summary>
                        <pre className="mt-1 text-xs bg-white/50 dark:bg-black/50 p-2 rounded overflow-x-auto text-red-600 dark:text-red-400">
                          {JSON.stringify(log.error, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="mt-4 pt-4 border-t border-neutral-200 dark:border-neutral-800">
        <div className="text-sm text-neutral-600 dark:text-neutral-400">
          총 {logs.length}개의 로그
        </div>
      </div>
    </div>
  );
}

