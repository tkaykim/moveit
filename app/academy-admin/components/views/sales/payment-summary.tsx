"use client";

import { formatCurrency } from '../utils/format-currency';

interface PaymentSummaryProps {
  selectedStudent: any;
  selectedProduct: any;
  pricing: {
    original: number;
    discount: number;
    final: number;
  };
  onPayment: () => void;
}

export function PaymentSummary({
  selectedStudent,
  selectedProduct,
  pricing,
  onPayment,
}: PaymentSummaryProps) {
  return (
    <div className="sticky top-24 space-y-4">
      <div className="bg-white dark:bg-neutral-900 p-6 rounded-xl shadow-lg border border-slate-200 dark:border-neutral-800">
        <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-6 border-b border-slate-100 dark:border-neutral-800 pb-4">
          결제 예상 정보
        </h3>

        <div className="space-y-4 mb-6">
          <div className="flex justify-between text-sm text-slate-500 dark:text-slate-400">
            <span>상품 금액</span>
            <span>{formatCurrency(pricing.original)}</span>
          </div>
          <div className="flex justify-between text-sm text-red-500 dark:text-red-400">
            <span className="flex items-center gap-1">
              할인 금액
              {pricing.discount > 0 && (
                <span className="text-xs bg-red-100 dark:bg-red-900/30 px-1.5 py-0.5 rounded-full">
                  적용됨
                </span>
              )}
            </span>
            <span>- {formatCurrency(pricing.discount)}</span>
          </div>
          <div className="border-t border-dashed border-slate-300 dark:border-neutral-700 my-2"></div>
          <div className="flex justify-between items-end">
            <span className="font-bold text-slate-800 dark:text-white">최종 결제 금액</span>
            <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {formatCurrency(pricing.final)}
            </span>
          </div>
        </div>

        <div className="space-y-3">
          <div className="text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-neutral-800 p-3 rounded">
            <p className="mb-1">
              <span className="font-bold">받는 분:</span>{' '}
              {selectedStudent ? selectedStudent.name : '-'}
            </p>
            <p>
              <span className="font-bold">상품:</span> {selectedProduct ? selectedProduct.name : '-'}
            </p>
          </div>

          <button
            onClick={onPayment}
            disabled={!selectedStudent || !selectedProduct}
            className="w-full bg-blue-600 dark:bg-blue-500 text-white py-4 rounded-xl font-bold text-lg hover:bg-blue-700 dark:hover:bg-blue-600 disabled:bg-slate-300 dark:disabled:bg-neutral-700 disabled:cursor-not-allowed shadow-blue-200 dark:shadow-blue-900/50 shadow-lg transition-all active:scale-[0.98]"
          >
            결제 및 수강권 충전
          </button>
        </div>
      </div>
    </div>
  );
}








