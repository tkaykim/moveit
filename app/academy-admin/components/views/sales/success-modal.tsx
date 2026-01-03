"use client";

import { Check } from 'lucide-react';

interface SuccessModalProps {
  selectedStudent: any;
  selectedProduct: any;
  onReset: () => void;
  onViewLogs: () => void;
}

export function SuccessModal({
  selectedStudent,
  selectedProduct,
  onReset,
  onViewLogs,
}: SuccessModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 dark:bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl max-w-sm w-full p-8 text-center animate-in fade-in zoom-in-95 duration-200">
        <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-6 text-green-600 dark:text-green-400">
          <Check size={32} strokeWidth={3} />
        </div>
        <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">결제 완료!</h3>
        <p className="text-slate-500 dark:text-slate-400 mb-8">
          <span className="font-bold text-slate-800 dark:text-white">{selectedStudent?.name}</span>
          님에게
          <br />
          <span className="font-bold text-blue-600 dark:text-blue-400">{selectedProduct?.name}</span>
          이(가)
          <br />
          성공적으로 지급되었습니다.
        </p>
        <div className="flex flex-col gap-2">
          <button
            onClick={onReset}
            className="w-full px-4 py-3 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-xl font-bold hover:bg-slate-800 dark:hover:bg-slate-200 transition-colors"
          >
            추가 판매하기
          </button>
          <button
            onClick={onViewLogs}
            className="w-full px-4 py-3 text-slate-500 dark:text-slate-400 font-medium hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
          >
            로그 확인하러 가기
          </button>
        </div>
      </div>
    </div>
  );
}

