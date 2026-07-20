"use client";

/**
 * 운영 콘솔 공통 UI (T9)
 *
 * 원칙
 *  - 용어는 원장·인포데스크의 말로. 기술 용어(FULFILLMENT_FAILED 등)는 화면에 그대로 쓰지 않는다.
 *  - 비어 있는 목록은 "정상"으로 읽혀야 한다. 고장난 화면처럼 보이면 안 된다.
 *  - 모바일(390px)에서 가로 스크롤이 생기지 않는다. 표가 필요하면 스스로 스크롤 컨테이너를 갖는다.
 */
import { ReactNode } from 'react';
import { CheckCircle2, Loader2, AlertCircle } from 'lucide-react';

export function ConsolePage({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="w-full max-w-full overflow-x-hidden p-4 sm:p-6 space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl font-bold text-neutral-900 dark:text-white break-keep">
            {title}
          </h1>
          {description && (
            <p className="mt-1 text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 break-keep">
              {description}
            </p>
          )}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </div>
  );
}

export function ConsoleCard({
  title,
  count,
  tone = 'neutral',
  children,
  headerRight,
  dataTestId,
}: {
  title: string;
  count?: number;
  tone?: 'neutral' | 'warn';
  children: ReactNode;
  headerRight?: ReactNode;
  dataTestId?: string;
}) {
  const warn = tone === 'warn' && (count ?? 0) > 0;
  return (
    <section
      {...(dataTestId ? { 'data-testid': dataTestId } : {})}
      className="w-full max-w-full rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 overflow-hidden"
    >
      <header className="flex items-center justify-between gap-2 px-3 sm:px-4 py-3 border-b border-neutral-100 dark:border-neutral-800">
        <div className="flex items-center gap-2 min-w-0">
          <h2 className="text-sm font-bold text-neutral-800 dark:text-neutral-100 break-keep truncate">
            {title}
          </h2>
          {count != null && (
            <span
              className={`shrink-0 px-2 py-0.5 rounded-full text-[11px] font-bold ${
                warn
                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                  : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400'
              }`}
            >
              {count}
            </span>
          )}
        </div>
        {headerRight}
      </header>
      <div className="p-3 sm:p-4">{children}</div>
    </section>
  );
}

/** 비어 있음 = 정상. 이 문구가 "고장"으로 읽히면 안 된다. */
export function AllClear({ message }: { message: string }) {
  return (
    <div
      data-testid="all-clear"
      className="flex items-center gap-2 py-6 justify-center text-center"
    >
      <CheckCircle2 size={18} className="text-emerald-500 shrink-0" />
      <span className="text-sm font-medium text-emerald-700 dark:text-emerald-400 break-keep">
        정상 · {message}
      </span>
    </div>
  );
}

export function Loading({ label = '불러오는 중' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-10 text-neutral-500">
      <Loader2 size={16} className="animate-spin" />
      <span className="text-sm">{label}…</span>
    </div>
  );
}

export function ErrorNote({ message }: { message: string }) {
  return (
    <div
      role="alert"
      data-testid="console-error"
      className="flex items-start gap-2 rounded-lg bg-red-50 dark:bg-red-900/20 px-3 py-2 text-sm text-red-700 dark:text-red-300 break-keep"
    >
      <AlertCircle size={16} className="shrink-0 mt-0.5" />
      <span className="min-w-0">{message}</span>
    </div>
  );
}

export function Chip({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: 'neutral' | 'good' | 'warn' | 'bad' | 'info';
}) {
  const tones: Record<string, string> = {
    neutral: 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300',
    good: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
    warn: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
    bad: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
    info: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  };
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded-md text-[11px] font-medium whitespace-nowrap ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export function ActionButton({
  children,
  onClick,
  busy,
  disabled,
  variant = 'primary',
  type = 'button',
  testId,
}: {
  children: ReactNode;
  onClick?: () => void;
  busy?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'ghost' | 'danger';
  type?: 'button' | 'submit';
  testId?: string;
}) {
  const styles: Record<string, string> = {
    primary:
      'bg-neutral-900 text-white hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-white',
    ghost:
      'bg-white text-neutral-700 border border-neutral-300 hover:bg-neutral-50 dark:bg-neutral-900 dark:text-neutral-200 dark:border-neutral-700 dark:hover:bg-neutral-800',
    danger: 'bg-red-600 text-white hover:bg-red-700',
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={busy || disabled}
      {...(testId ? { 'data-testid': testId } : {})}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap ${styles[variant]}`}
    >
      {busy && <Loader2 size={13} className="animate-spin" />}
      {children}
    </button>
  );
}

/** 넓은 내용을 담을 때만 사용. 페이지 본문이 아니라 이 컨테이너가 스크롤된다. */
export function ScrollX({ children }: { children: ReactNode }) {
  return <div className="w-full max-w-full overflow-x-auto">{children}</div>;
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="block mb-1 text-xs font-semibold text-neutral-600 dark:text-neutral-400 break-keep">
        {label}
      </span>
      {children}
    </label>
  );
}

export const inputClass =
  'w-full max-w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-neutral-400';

export function formatKrw(n: number | null | undefined): string {
  if (n == null) return '—';
  return `${n.toLocaleString('ko-KR')}원`;
}

export function formatTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Seoul',
  });
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('ko-KR', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Seoul',
  });
}
