"use client";

import { X } from 'lucide-react';
import { useState } from 'react';

export interface AcademyFilter {
  tags: string[];
  priceRange: {
    min: number | null;
    max: number | null;
  };
}

interface AcademyFilterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (filter: AcademyFilter) => void;
  currentFilter: AcademyFilter;
  availableTags: string[];
}

const PRICE_RANGES = [
  { label: '전체', min: null, max: null },
  { label: '5만원 이하', min: 0, max: 50000 },
  { label: '5만원 ~ 10만원', min: 50000, max: 100000 },
  { label: '10만원 ~ 20만원', min: 100000, max: 200000 },
  { label: '20만원 이상', min: 200000, max: null },
];

export const AcademyFilterModal = ({
  isOpen,
  onClose,
  onApply,
  currentFilter,
  availableTags,
}: AcademyFilterModalProps) => {
  const [selectedTags, setSelectedTags] = useState<string[]>(currentFilter.tags);
  const [selectedPriceRange, setSelectedPriceRange] = useState<{ min: number | null; max: number | null }>(
    currentFilter.priceRange
  );

  if (!isOpen) return null;

  const handleTagToggle = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const handleApply = () => {
    onApply({
      tags: selectedTags,
      priceRange: selectedPriceRange,
    });
    onClose();
  };

  const handleReset = () => {
    setSelectedTags([]);
    setSelectedPriceRange({ min: null, max: null });
  };

  const hasActiveFilters = selectedTags.length > 0 || selectedPriceRange.min !== null || selectedPriceRange.max !== null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center">
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in" 
        onClick={onClose} 
      />
      <div className="relative w-full max-w-[420px] bg-white dark:bg-neutral-900 rounded-t-3xl p-6 animate-in slide-in-from-bottom duration-300 border-t border-neutral-200 dark:border-neutral-800 shadow-2xl max-h-[80vh] overflow-y-auto">
        <div className="w-12 h-1 bg-neutral-300 dark:bg-neutral-700 rounded-full mx-auto mb-6" />
        
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold text-black dark:text-white">필터</h3>
          <button 
            onClick={onClose} 
            className="text-neutral-400 hover:text-black dark:hover:text-white"
          >
            <X size={24} />
          </button>
        </div>

        {/* 태그 필터 */}
        <div className="mb-6">
          <h4 className="text-sm font-bold text-black dark:text-white mb-3">태그</h4>
          <div className="flex flex-wrap gap-2">
            {availableTags.length > 0 ? (
              availableTags.map(tag => (
                <button
                  key={tag}
                  onClick={() => handleTagToggle(tag)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                    selectedTags.includes(tag)
                      ? 'bg-primary dark:bg-[#CCFF00] text-black'
                      : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700'
                  }`}
                >
                  {tag}
                </button>
              ))
            ) : (
              <p className="text-sm text-neutral-500 dark:text-neutral-400">사용 가능한 태그가 없습니다.</p>
            )}
          </div>
        </div>

        {/* 가격대 필터 */}
        <div className="mb-6">
          <h4 className="text-sm font-bold text-black dark:text-white mb-3">가격대</h4>
          <div className="space-y-2">
            {PRICE_RANGES.map((range, index) => {
              const isSelected = 
                selectedPriceRange.min === range.min && selectedPriceRange.max === range.max;
              return (
                <button
                  key={index}
                  onClick={() => setSelectedPriceRange({ min: range.min, max: range.max })}
                  className={`w-full px-4 py-3 rounded-xl text-left transition-all ${
                    isSelected
                      ? 'bg-primary dark:bg-[#CCFF00] text-black font-medium'
                      : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700'
                  }`}
                >
                  {range.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* 버튼 */}
        <div className="flex gap-3 pt-4 border-t border-neutral-200 dark:border-neutral-800">
          <button 
            onClick={handleReset}
            className="flex-1 bg-neutral-200 dark:bg-neutral-800 text-black dark:text-white font-bold py-4 rounded-xl"
          >
            초기화
          </button>
          <button 
            onClick={handleApply}
            className={`flex-[2] font-black py-4 rounded-xl text-lg ${
              hasActiveFilters
                ? 'bg-primary dark:bg-[#CCFF00] text-black shadow-[0_0_20px_rgba(204,255,0,0.3)]'
                : 'bg-neutral-200 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-500'
            }`}
          >
            적용하기
          </button>
        </div>
      </div>
    </div>
  );
};










