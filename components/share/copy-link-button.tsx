'use client';

/**
 * 링크 복사 버튼 (Task L)
 *
 * 학원이 "이 수업 링크 하나"를 인스타/카톡에 붙일 수 있게, 클립보드로 URL 을 복사한다.
 * clipboard API 가 막힌 환경(비보안 컨텍스트 등)에서도 조용히 실패하지 않도록
 * execCommand 폴백을 둔다. 복사 성공은 잠깐 라벨을 바꿔 눈으로 확인시킨다.
 */
import { useCallback, useState } from 'react';
import { Check, Link2 } from 'lucide-react';

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* 폴백으로 넘어간다 */
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

export function CopyLinkButton({
  url,
  label = '링크 복사',
  copiedLabel = '복사됨',
  className,
  iconOnly = false,
  ariaLabel,
  testId = 'copy-link',
}: {
  url: string;
  label?: string;
  copiedLabel?: string;
  className?: string;
  iconOnly?: boolean;
  ariaLabel?: string;
  testId?: string;
}) {
  const [copied, setCopied] = useState(false);

  const onClick = useCallback(async () => {
    const ok = await copyText(url);
    if (ok) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    }
  }, [url]);

  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testId}
      data-url={url}
      data-copied={copied ? '1' : '0'}
      aria-label={ariaLabel ?? label}
      title={ariaLabel ?? label}
      className={
        className ??
        'inline-flex items-center gap-1.5 rounded-lg border border-neutral-300 dark:border-neutral-700 px-2.5 py-1.5 text-[12px] font-semibold text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors'
      }
    >
      {copied ? <Check size={13} className="flex-shrink-0" /> : <Link2 size={13} className="flex-shrink-0" />}
      {!iconOnly && <span>{copied ? copiedLabel : label}</span>}
    </button>
  );
}
