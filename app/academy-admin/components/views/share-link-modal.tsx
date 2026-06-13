"use client";

import { useCallback, useEffect, useState } from 'react';
import { X, Copy, Check, Share2, Link2, Megaphone } from 'lucide-react';

interface ShareLinkModalProps {
  open: boolean;
  onClose: () => void;
  /** 공유할 실제 링크 */
  url: string;
  /** 'session' = 수업 결제 링크 / 'ticket' = 수강권 구매 링크 */
  kind: 'session' | 'ticket';
  /** 수업명/수강권명 등 맥락 (문구에 삽입) */
  contextName?: string;
}

function copyToClipboard(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(text);
  }
  return new Promise((resolve, reject) => {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      resolve();
    } catch (e) {
      reject(e);
    }
  });
}

function CopyRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  const onCopy = useCallback(async () => {
    try {
      await copyToClipboard(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }, [value]);
  return (
    <button
      type="button"
      onClick={onCopy}
      className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 border-t border-neutral-200 dark:border-neutral-700 transition-colors"
    >
      {copied ? (
        <>
          <Check className="w-3.5 h-3.5 text-emerald-500" /> {label} 복사됨
        </>
      ) : (
        <>
          <Copy className="w-3.5 h-3.5" /> {label} 복사
        </>
      )}
    </button>
  );
}

export function ShareLinkModal({ open, onClose, url, kind, contextName }: ShareLinkModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  const ctx = contextName?.trim() ? contextName.trim() : kind === 'session' ? '이번 수업' : '수강권';

  const template1 =
    kind === 'session'
      ? `💃 ${ctx} 신청 받아요!\n\n아래 링크 누르면 바로 신청·결제돼요 👇\n${url}`
      : `🎫 ${ctx} 판매 중!\n\n아래 링크에서 바로 구매하실 수 있어요 👇\n${url}`;

  const template2 =
    kind === 'session'
      ? `[${ctx}] 자리 한정 모집 중 🔥\n예약은 링크에서: ${url}`
      : `[${ctx}] 지금 등록하면 바로 수강 시작 ✨\n구매: ${url}`;

  const canNativeShare = typeof navigator !== 'undefined' && !!navigator.share;
  const nativeShare = async () => {
    try {
      await navigator.share({ title: ctx, text: `${ctx} — MOVE IT`, url });
    } catch {
      /* 취소/미지원 무시 */
    }
  };

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md bg-white dark:bg-neutral-900 rounded-2xl shadow-xl border border-neutral-200 dark:border-neutral-700 max-h-[88vh] flex flex-col">
        {/* 헤더 */}
        <div className="flex items-center justify-between gap-2 px-5 py-4 border-b border-neutral-200 dark:border-neutral-800">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-primary/15 flex items-center justify-center flex-shrink-0">
              <Megaphone className="w-5 h-5 text-primary" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-bold text-neutral-900 dark:text-white truncate">
                {kind === 'session' ? '수업 홍보 링크 공유' : '수강권 홍보 링크 공유'}
              </h3>
              {contextName && (
                <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">{contextName}</p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex-shrink-0 p-1.5 rounded-lg text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 dark:text-neutral-400"
            aria-label="닫기"
          >
            <X size={18} />
          </button>
        </div>

        {/* 본문 */}
        <div className="overflow-y-auto p-5 space-y-5">
          <p className="text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed">
            이 링크를 인스타·카톡·오픈채팅에 올리면, 회원이 링크만 누르고 바로 결제·신청합니다.
          </p>

          {/* 링크 */}
          <div>
            <p className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5 flex items-center gap-1.5">
              <Link2 className="w-3.5 h-3.5" /> 공유 링크
            </p>
            <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 overflow-hidden">
              <div className="px-3 py-2.5 text-xs text-neutral-700 dark:text-neutral-300 break-all bg-neutral-50 dark:bg-neutral-800/50">
                {url}
              </div>
              <CopyRow label="링크" value={url} />
            </div>
          </div>

          {/* 휴대폰 공유 */}
          {canNativeShare && (
            <button
              type="button"
              onClick={nativeShare}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-black text-sm font-semibold hover:opacity-90"
            >
              <Share2 className="w-4 h-4" /> 휴대폰으로 공유하기
            </button>
          )}

          {/* 문구 템플릿 */}
          <div>
            <p className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">
              바로 쓰는 홍보 문구
            </p>
            <div className="space-y-3">
              {[template1, template2].map((tpl, i) => (
                <div
                  key={i}
                  className="rounded-lg border border-neutral-200 dark:border-neutral-700 overflow-hidden"
                >
                  <pre className="px-3 py-3 text-xs text-neutral-700 dark:text-neutral-300 whitespace-pre-wrap font-sans leading-relaxed bg-neutral-50 dark:bg-neutral-800/50">
{tpl}
                  </pre>
                  <CopyRow label="문구" value={tpl} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
