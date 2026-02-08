"use client";

import { useLocale } from '@/contexts/LocaleContext';

export const LanguageToggle = () => {
  const { language, setLanguage } = useLocale();

  return (
    <button
      onClick={() => setLanguage(language === 'ko' ? 'en' : 'ko')}
      className="px-2.5 py-1.5 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-xs font-bold text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white transition-colors"
      aria-label="Toggle language"
    >
      {language === 'ko' ? 'EN' : 'KR'}
    </button>
  );
};
