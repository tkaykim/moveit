'use client';

import { Plus } from 'lucide-react';

interface SectionHeaderProps {
  title: string;
  buttonText?: string;
  onButtonClick?: () => void;
  /** 온보딩 하이라이트용 (버튼에 data-onboarding 설정) */
  dataOnboarding?: string;
}

export function SectionHeader({ title, buttonText, onButtonClick, dataOnboarding }: SectionHeaderProps) {
  return (
    <div className="flex justify-between items-center mb-6">
      <h2 className="text-xl font-bold text-gray-800 dark:text-white">{title}</h2>
      {buttonText && (
        <button
          type="button"
          onClick={onButtonClick}
          className="bg-gray-900 dark:bg-gray-100 hover:bg-gray-800 dark:hover:bg-gray-200 text-white dark:text-gray-900 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors shadow-sm"
          {...(dataOnboarding ? { 'data-onboarding': dataOnboarding } : {})}
        >
          <Plus size={16} /> {buttonText}
        </button>
      )}
    </div>
  );
}










