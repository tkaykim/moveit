'use client';

import React from 'react';
import { X } from 'lucide-react';

interface IntroPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export function IntroPreviewModal({ isOpen, onClose, title, children }: IntroPreviewModalProps) {
  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
        aria-hidden
      />
      <div className="fixed inset-0 z-[101] flex items-center justify-center p-4 pointer-events-none">
        <div
          className="pointer-events-auto w-full max-w-[360px] flex flex-col animate-in zoom-in-95 fade-in duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-2 px-1">
            <span className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">{title}</span>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg text-neutral-500 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              aria-label="닫기"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          {/* 폰 프레임 */}
          <div className="rounded-[2rem] border-[10px] border-neutral-800 dark:border-neutral-700 bg-neutral-900 dark:bg-neutral-950 overflow-hidden shadow-2xl">
            <div className="rounded-t-2xl bg-neutral-800 dark:bg-neutral-900 h-6 flex items-center justify-center">
              <div className="w-16 h-1 rounded-full bg-neutral-600" />
            </div>
            <div className="bg-white dark:bg-neutral-950 max-h-[70vh] overflow-y-auto">
              {children}
            </div>
          </div>
          <p className="text-[11px] text-neutral-500 dark:text-neutral-400 text-center mt-2">
            실제 앱 화면을 재현한 미리보기입니다. 전체 체험은 데모에서 이용하세요.
          </p>
        </div>
      </div>
    </>
  );
}
