"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import koMessages from '@/locales/ko.json';
import enMessages from '@/locales/en.json';

export type Language = 'ko' | 'en';

interface LocaleContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, fallback?: string) => string;
}

const LocaleContext = createContext<LocaleContextType | undefined>(undefined);

const STORAGE_KEY = 'moveit_lang';

const messages: Record<Language, Record<string, string>> = {
  ko: koMessages,
  en: enMessages,
};

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>('ko');

  // 초기 언어 로드 (클라이언트에서만)
  useEffect(() => {
    const savedLang = localStorage.getItem(STORAGE_KEY) as Language | null;
    if (savedLang && (savedLang === 'ko' || savedLang === 'en')) {
      setLanguageState(savedLang);
    }
  }, []);

  // 언어 변경
  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem(STORAGE_KEY, lang);
  }, []);

  // 번역 함수 - 키가 없으면 한국어로 fallback, 그것도 없으면 키 반환
  const t = useCallback((key: string, fallback?: string): string => {
    const langMessages = messages[language];
    if (langMessages && langMessages[key]) {
      return langMessages[key];
    }
    // 한국어로 fallback
    if (language !== 'ko' && messages.ko[key]) {
      return messages.ko[key];
    }
    // fallback 문자열이 있으면 사용
    if (fallback) {
      return fallback;
    }
    // 최후에는 키 반환
    return key;
  }, [language]);

  // 항상 렌더링 - 초기값은 'ko'로 설정되어 있으므로 바로 렌더링 가능
  return (
    <LocaleContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale() {
  const context = useContext(LocaleContext);
  if (context === undefined) {
    throw new Error('useLocale must be used within a LocaleProvider');
  }
  return context;
}

// 선택적: 언어에 따라 DB 값(name_kr/name_en) 선택하는 헬퍼
export function useDisplayName() {
  const { language } = useLocale();
  
  return useCallback((nameKr?: string | null, nameEn?: string | null): string => {
    if (language === 'en') {
      return nameEn || nameKr || '';
    }
    return nameKr || nameEn || '';
  }, [language]);
}
