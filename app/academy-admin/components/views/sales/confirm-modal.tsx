"use client";

import { formatCurrency } from '../utils/format-currency';

interface ConfirmModalProps {
  selectedStudent: any;
  selectedProduct: any;
  pricing: {
    original: number;
    discount: number;
    final: number;
  };
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  selectedStudent,
  selectedProduct,
  pricing,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 dark:bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="p-6 border-b border-slate-100 dark:border-neutral-800">
          <h3 className="text-xl font-bold text-slate-800 dark:text-white">결제 내용을 확인해주세요</h3>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">이 작업은 취소할 수 없습니다.</p>
        </div>
        <div className="p-6 space-y-4">
          <div className="flex justify-between items-center py-2 border-b border-slate-100 dark:border-neutral-800">
            <span className="text-slate-500 dark:text-slate-400">학생</span>
            <span className="font-bold text-slate-800 dark:text-white">{selectedStudent?.name}</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-slate-100 dark:border-neutral-800">
            <span className="text-slate-500 dark:text-slate-400">상품</span>
            <span className="font-bold text-slate-800 dark:text-white">{selectedProduct?.name}</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-slate-100 dark:border-neutral-800">
            <span className="text-slate-500 dark:text-slate-400">할인</span>
            <span className="text-red-500 dark:text-red-400">-{formatCurrency(pricing.discount)}</span>
          </div>
          <div className="flex justify-between items-center pt-2">
            <span className="text-lg font-bold text-slate-800 dark:text-white">결제 금액</span>
            <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {formatCurrency(pricing.final)}
            </span>
          </div>
        </div>
        <div className="p-4 bg-slate-50 dark:bg-neutral-800 flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-3 bg-white dark:bg-neutral-900 border border-slate-300 dark:border-neutral-700 text-slate-700 dark:text-slate-300 rounded-xl font-medium hover:bg-slate-50 dark:hover:bg-neutral-800 transition-colors"
          >
            취소
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-4 py-3 bg-blue-600 dark:bg-blue-500 text-white rounded-xl font-bold hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors shadow-lg shadow-blue-200 dark:shadow-blue-900/50"
          >
            확인 및 결제
          </button>
        </div>
      </div>
    </div>
  );
}










