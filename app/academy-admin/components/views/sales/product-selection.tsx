"use client";

import { useState, useMemo } from 'react';
import { Check, Search } from 'lucide-react';
import { formatCurrency } from '../utils/format-currency';

interface ProductSelectionProps {
  selectedProduct: any;
  products: any[];
  onProductSelect: (product: any) => void;
  disabled: boolean;
}

export function ProductSelection({
  selectedProduct,
  products,
  onProductSelect,
  disabled,
}: ProductSelectionProps) {
  const [searchQuery, setSearchQuery] = useState('');

  // 검색 필터링된 상품 목록
  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) return products;
    const query = searchQuery.toLowerCase();
    return products.filter(product => 
      (product.name?.toLowerCase().includes(query)) ||
      (product.price?.toString().includes(query)) ||
      (product.type?.toLowerCase().includes(query)) ||
      (product.amount?.toString().includes(query)) ||
      (product.days?.toString().includes(query))
    );
  }, [products, searchQuery]);

  return (
    <section
      className={`bg-white dark:bg-neutral-900 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-neutral-800 transition-opacity ${
        disabled ? 'opacity-50 pointer-events-none' : ''
      }`}
    >
      <h2 className="text-lg font-semibold flex items-center gap-2 mb-4 text-gray-800 dark:text-white">
        <span className="w-6 h-6 bg-slate-100 dark:bg-neutral-800 rounded-full flex items-center justify-center text-xs font-bold text-slate-600 dark:text-slate-400">
          2
        </span>
        수강권 선택
      </h2>

      {/* 검색 입력 */}
      <div className="relative mb-4">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="수강권명, 가격, 유형으로 검색..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          disabled={disabled}
          className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 text-gray-900 dark:text-white disabled:opacity-50"
        />
      </div>

      {products.length === 0 ? (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          등록된 수강권이 없습니다.
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          <Search size={24} className="mx-auto mb-2 opacity-50" />
          <p className="text-sm">&quot;{searchQuery}&quot;에 대한 검색 결과가 없습니다.</p>
        </div>
      ) : (
        <div className="max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {filteredProducts.map((product) => {
              const selKey = selectedProduct?.productKey ?? selectedProduct?.id;
              const prodKey = product.productKey ?? product.id;
              const isSelected = selKey === prodKey;
              return (
            <button
              key={prodKey}
              onClick={() => onProductSelect(isSelected ? null : product)}
              className={`relative p-3 rounded-lg border-2 text-left transition-all ${
                isSelected
                  ? 'border-blue-500 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/20 ring-1 ring-blue-500 dark:ring-blue-400'
                  : 'border-slate-200 dark:border-neutral-700 hover:border-blue-300 dark:hover:border-blue-600 hover:bg-slate-50 dark:hover:bg-neutral-800'
              }`}
            >
              <div className="flex justify-between items-start mb-1.5">
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                    product.type === 'count'
                      ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400'
                      : 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400'
                  }`}
                >
                  {product.type === 'count' ? '횟수제' : '기간제'}
                </span>
                {isSelected && (
                  <div className="bg-blue-500 dark:bg-blue-400 text-white rounded-full p-0.5">
                    <Check size={10} />
                  </div>
                )}
              </div>
              <div className="font-semibold text-sm text-slate-800 dark:text-white mb-1 truncate">{product.name}</div>
              <div className="text-sm font-medium text-slate-700 dark:text-slate-300">
                {formatCurrency(product.price)}
              </div>
              <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                {product.type === 'count'
                  ? `${product.amount}회 제공`
                  : `${product.days}일 무제한`}
              </div>
            </button>
              );
            })}
          </div>
          {filteredProducts.length > 10 && (
            <div className="text-center text-xs text-gray-500 dark:text-gray-400 mt-3 py-2">
              총 {filteredProducts.length}개의 수강권
            </div>
          )}
        </div>
      )}
    </section>
  );
}

