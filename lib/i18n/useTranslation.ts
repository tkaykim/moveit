"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { useLocale } from '@/contexts/LocaleContext';

// 클라이언트 사이드 캐시 (메모리)
const translationCache = new Map<string, string>();

/**
 * 텍스트 번역 훅
 * 영어 모드일 때 한글 텍스트를 자동으로 번역합니다.
 */
export function useTranslation() {
  const { language } = useLocale();

  /**
   * 단일 텍스트 번역
   */
  const translateText = useCallback(async (text: string): Promise<string> => {
    if (!text || language === 'ko') return text;

    // 캐시 확인
    const cacheKey = `${text}_${language}`;
    if (translationCache.has(cacheKey)) {
      return translationCache.get(cacheKey)!;
    }

    try {
      const response = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          texts: [text],
          targetLang: language,
          sourceLang: 'ko',
        }),
      });

      if (!response.ok) {
        return text;
      }

      const data = await response.json();
      const translated = data.translations?.[0] || text;
      
      // 캐시에 저장
      translationCache.set(cacheKey, translated);
      
      return translated;
    } catch (error) {
      console.error('Translation error:', error);
      return text;
    }
  }, [language]);

  /**
   * 여러 텍스트 일괄 번역
   */
  const translateTexts = useCallback(async (texts: string[]): Promise<string[]> => {
    if (language === 'ko') return texts;

    const results: string[] = [];
    const toTranslate: { index: number; text: string }[] = [];

    // 캐시 확인
    texts.forEach((text, index) => {
      if (!text) {
        results[index] = text;
        return;
      }

      const cacheKey = `${text}_${language}`;
      if (translationCache.has(cacheKey)) {
        results[index] = translationCache.get(cacheKey)!;
      } else {
        toTranslate.push({ index, text });
      }
    });

    // 번역이 필요한 것이 없으면 바로 반환
    if (toTranslate.length === 0) {
      return results;
    }

    try {
      const response = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          texts: toTranslate.map(t => t.text),
          targetLang: language,
          sourceLang: 'ko',
        }),
      });

      if (!response.ok) {
        toTranslate.forEach(t => {
          results[t.index] = t.text;
        });
        return results;
      }

      const data = await response.json();
      const translations = data.translations || [];

      toTranslate.forEach((t, i) => {
        const translated = translations[i] || t.text;
        results[t.index] = translated;
        
        // 캐시에 저장
        translationCache.set(`${t.text}_${language}`, translated);
      });

      return results;
    } catch (error) {
      console.error('Batch translation error:', error);
      toTranslate.forEach(t => {
        results[t.index] = t.text;
      });
      return results;
    }
  }, [language]);

  return {
    language,
    isEnglish: language === 'en',
    translateText,
    translateTexts,
  };
}

/**
 * 자동 번역 텍스트 훅
 * 영어 모드일 때 자동으로 번역된 텍스트를 반환합니다.
 */
export function useTranslatedText(text: string): string {
  const { language } = useLocale();
  const [translated, setTranslated] = useState(text);
  const prevTextRef = useRef(text);
  const prevLangRef = useRef(language);

  useEffect(() => {
    // 텍스트나 언어가 변경된 경우에만 번역
    if (prevTextRef.current === text && prevLangRef.current === language) {
      return;
    }

    prevTextRef.current = text;
    prevLangRef.current = language;

    if (!text || language === 'ko') {
      setTranslated(text);
      return;
    }

    // 캐시 확인
    const cacheKey = `${text}_${language}`;
    if (translationCache.has(cacheKey)) {
      setTranslated(translationCache.get(cacheKey)!);
      return;
    }

    // 번역 요청
    fetch('/api/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        texts: [text],
        targetLang: language,
        sourceLang: 'ko',
      }),
    })
      .then(res => res.json())
      .then(data => {
        const result = data.translations?.[0] || text;
        translationCache.set(cacheKey, result);
        setTranslated(result);
      })
      .catch(() => {
        setTranslated(text);
      });
  }, [text, language]);

  return translated;
}

/**
 * 객체의 특정 필드들을 번역하는 훅
 * 예: useTranslatedObject(academy, ['name', 'description'])
 */
export function useTranslatedObject<T extends Record<string, any>>(
  obj: T | null | undefined,
  fields: (keyof T)[]
): T | null | undefined {
  const { language } = useLocale();
  const [translated, setTranslated] = useState<T | null | undefined>(obj);

  useEffect(() => {
    if (!obj || language === 'ko') {
      setTranslated(obj);
      return;
    }

    const textsToTranslate: string[] = [];
    const fieldMap: { field: keyof T; index: number }[] = [];

    fields.forEach(field => {
      const value = obj[field];
      if (typeof value === 'string' && value.trim()) {
        const cacheKey = `${value}_${language}`;
        if (!translationCache.has(cacheKey)) {
          fieldMap.push({ field, index: textsToTranslate.length });
          textsToTranslate.push(value);
        }
      }
    });

    // 모든 필드가 캐시에 있는 경우
    if (textsToTranslate.length === 0) {
      const result = { ...obj };
      fields.forEach(field => {
        const value = obj[field];
        if (typeof value === 'string') {
          const cacheKey = `${value}_${language}`;
          if (translationCache.has(cacheKey)) {
            (result as any)[field] = translationCache.get(cacheKey);
          }
        }
      });
      setTranslated(result);
      return;
    }

    // 번역 요청
    fetch('/api/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        texts: textsToTranslate,
        targetLang: language,
        sourceLang: 'ko',
      }),
    })
      .then(res => res.json())
      .then(data => {
        const translations = data.translations || [];
        const result = { ...obj };

        // 새 번역 캐시에 저장 및 결과에 적용
        fieldMap.forEach(({ field, index }) => {
          const original = obj[field] as string;
          const translated = translations[index] || original;
          translationCache.set(`${original}_${language}`, translated);
          (result as any)[field] = translated;
        });

        // 이미 캐시된 필드도 적용
        fields.forEach(field => {
          const value = obj[field];
          if (typeof value === 'string') {
            const cacheKey = `${value}_${language}`;
            if (translationCache.has(cacheKey)) {
              (result as any)[field] = translationCache.get(cacheKey);
            }
          }
        });

        setTranslated(result);
      })
      .catch(() => {
        setTranslated(obj);
      });
  }, [obj, fields, language]);

  return translated;
}
