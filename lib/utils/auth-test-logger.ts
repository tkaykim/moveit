export type LogLevel = 'info' | 'success' | 'error' | 'warning';

export interface AuthTestLog {
  id: string;
  timestamp: Date;
  level: LogLevel;
  action: string;
  message: string;
  details?: any;
  error?: any;
}

class AuthTestLogger {
  private logs: AuthTestLog[] = [];
  private actionCounts: Map<string, number> = new Map();
  private maxRepeats = 5;
  private listeners: Set<(logs: AuthTestLog[]) => void> = new Set();

  addLog(
    level: LogLevel,
    action: string,
    message: string,
    details?: any,
    error?: any
  ) {
    const log: AuthTestLog = {
      id: `${Date.now()}-${Math.random()}`,
      timestamp: new Date(),
      level,
      action,
      message,
      details,
      error,
    };

    this.logs.push(log);

    // 동일한 액션 카운트 증가
    const count = (this.actionCounts.get(action) || 0) + 1;
    this.actionCounts.set(action, count);

    // 5번 이상 반복 시 오류로 판단
    if (count >= this.maxRepeats) {
      const errorLog: AuthTestLog = {
        id: `${Date.now()}-${Math.random()}`,
        timestamp: new Date(),
        level: 'error',
        action: `${action}_REPEAT_ERROR`,
        message: `${action}가 ${count}번 반복되었습니다. 오류로 판단됩니다.`,
        details: { originalAction: action, repeatCount: count },
      };
      this.logs.push(errorLog);
    }

    // 리스너들에게 알림
    this.notifyListeners();

    // 콘솔에도 출력
    const logMethod = level === 'error' ? console.error : level === 'warning' ? console.warn : console.log;
    logMethod(`[${action}] ${message}`, details || error || '');

    return log;
  }

  getLogs(): AuthTestLog[] {
    return [...this.logs];
  }

  getActionCount(action: string): number {
    return this.actionCounts.get(action) || 0;
  }

  clearLogs() {
    this.logs = [];
    this.actionCounts.clear();
    this.notifyListeners();
  }

  subscribe(listener: (logs: AuthTestLog[]) => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners() {
    const logs = this.getLogs();
    this.listeners.forEach((listener) => listener(logs));
  }

  // 특정 액션의 반복 횟수 초기화
  resetActionCount(action: string) {
    this.actionCounts.delete(action);
  }
}

export const authTestLogger = new AuthTestLogger();

