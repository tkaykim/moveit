"use client";

import { Tag, Calculator } from 'lucide-react';
import { formatCurrency } from '../utils/format-currency';

interface DiscountApplicationProps {
  selectedProduct: any;
  discountMode: 'policy' | 'manual';
  selectedPolicyId: string | null;
  manualDiscountType: 'amount' | 'percent';
  manualDiscountValue: number;
  discountPolicies: any[];
  onDiscountModeChange: (mode: 'policy' | 'manual') => void;
  onPolicySelect: (id: string | null) => void;
  onManualDiscountTypeChange: (type: 'amount' | 'percent') => void;
  onManualDiscountValueChange: (value: number) => void;
}

export function DiscountApplication({
  selectedProduct,
  discountMode,
  selectedPolicyId,
  manualDiscountType,
  manualDiscountValue,
  discountPolicies,
  onDiscountModeChange,
  onPolicySelect,
  onManualDiscountTypeChange,
  onManualDiscountValueChange,
}: DiscountApplicationProps) {
  return (
    <section
      className={`bg-white dark:bg-neutral-900 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-neutral-800 transition-opacity ${
        !selectedProduct ? 'opacity-50 pointer-events-none' : ''
      }`}
    >
      <h2 className="text-lg font-semibold flex items-center gap-2 mb-4 text-gray-800 dark:text-white">
        <span className="w-6 h-6 bg-slate-100 dark:bg-neutral-800 rounded-full flex items-center justify-center text-xs font-bold text-slate-600 dark:text-slate-400">
          3
        </span>
        할인 적용
      </h2>

      <div className="flex gap-4 border-b border-slate-200 dark:border-neutral-700 mb-4">
        <button
          onClick={() => onDiscountModeChange('policy')}
          className={`pb-2 text-sm font-medium border-b-2 transition-colors ${
            discountMode === 'policy'
              ? 'border-blue-500 dark:border-blue-400 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-slate-500 dark:text-slate-400'
          }`}
        >
          할인 정책 선택
        </button>
        <button
          onClick={() => onDiscountModeChange('manual')}
          className={`pb-2 text-sm font-medium border-b-2 transition-colors ${
            discountMode === 'manual'
              ? 'border-blue-500 dark:border-blue-400 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-slate-500 dark:text-slate-400'
          }`}
        >
          직접 입력
        </button>
      </div>

      {discountMode === 'policy' ? (
        <div className="space-y-2">
          {discountPolicies.length === 0 ? (
            <div className="text-center py-4 text-gray-500 dark:text-gray-400 text-sm">
              등록된 할인 정책이 없습니다.
            </div>
          ) : (
            discountPolicies.map((policy) => (
            <label
              key={policy.id}
              className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all ${
                selectedPolicyId === policy.id
                  ? 'border-blue-500 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-slate-200 dark:border-neutral-700 hover:bg-slate-50 dark:hover:bg-neutral-800'
              }`}
            >
              <div className="flex items-center gap-3">
                <input
                  type="radio"
                  name="discount"
                  className="text-blue-600 dark:text-blue-400 focus:ring-blue-500 dark:focus:ring-blue-400"
                  checked={selectedPolicyId === policy.id}
                  onChange={() => onPolicySelect(policy.id)}
                  onClick={() => onPolicySelect(selectedPolicyId === policy.id ? null : policy.id)}
                />
                <div>
                  <div className="text-sm font-medium text-slate-800 dark:text-white">{policy.name}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {policy.type === 'percent'
                      ? `${policy.value}% 할인`
                      : `${formatCurrency(policy.value)} 할인`}
                  </div>
                </div>
              </div>
              {selectedPolicyId === policy.id && (
                <Tag size={16} className="text-blue-500 dark:text-blue-400" />
              )}
            </label>
            ))
          )}
          {selectedPolicyId === null && discountPolicies.length > 0 && (
            <div className="text-xs text-slate-400 dark:text-slate-500 pl-1">
              * 할인을 적용하지 않으려면 선택을 해제하세요.
            </div>
          )}
        </div>
      ) : (
        <div className="bg-slate-50 dark:bg-neutral-800 p-4 rounded-lg border border-slate-200 dark:border-neutral-700">
          <div className="flex gap-2 mb-3">
            <button
              onClick={() => onManualDiscountTypeChange('amount')}
              className={`flex-1 py-1.5 text-xs font-medium rounded shadow-sm border ${
                manualDiscountType === 'amount'
                  ? 'bg-white dark:bg-neutral-900 border-slate-300 dark:border-neutral-600 text-slate-800 dark:text-white'
                  : 'bg-slate-100 dark:bg-neutral-800 border-transparent text-slate-400 dark:text-slate-500'
              }`}
            >
              금액(₩) 할인
            </button>
            <button
              onClick={() => onManualDiscountTypeChange('percent')}
              className={`flex-1 py-1.5 text-xs font-medium rounded shadow-sm border ${
                manualDiscountType === 'percent'
                  ? 'bg-white dark:bg-neutral-900 border-slate-300 dark:border-neutral-600 text-slate-800 dark:text-white'
                  : 'bg-slate-100 dark:bg-neutral-800 border-transparent text-slate-400 dark:text-slate-500'
              }`}
            >
              비율(%) 할인
            </button>
          </div>
          <div className="flex items-center gap-2">
            <Calculator size={20} className="text-slate-400 dark:text-slate-500" />
            <input
              type="number"
              min="0"
              className="flex-1 bg-white dark:bg-neutral-900 border border-slate-300 dark:border-neutral-700 rounded px-3 py-2 text-right focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 outline-none text-gray-900 dark:text-white"
              placeholder={manualDiscountType === 'percent' ? '10' : '10000'}
              value={manualDiscountValue}
              onChange={(e) => onManualDiscountValueChange(Number(e.target.value))}
            />
            <span className="text-sm font-bold text-slate-600 dark:text-slate-400 w-8">
              {manualDiscountType === 'percent' ? '%' : '원'}
            </span>
          </div>
        </div>
      )}
    </section>
  );
}

