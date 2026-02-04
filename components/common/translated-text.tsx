"use client";

import { useTranslatedText } from '@/lib/i18n/useTranslation';
import { useLocale } from '@/contexts/LocaleContext';

interface TranslatedTextProps {
  children: string;
  as?: keyof JSX.IntrinsicElements;
  className?: string;
  [key: string]: any;
}

/**
 * 자동 번역 텍스트 컴포넌트
 * 영어 모드일 때 자동으로 번역된 텍스트를 표시합니다.
 * 
 * @example
 * <TranslatedText>아임뉴 하남미사점</TranslatedText>
 * <TranslatedText as="h1" className="text-xl font-bold">클래스 제목</TranslatedText>
 */
export function TranslatedText({ 
  children, 
  as: Component = 'span', 
  className,
  ...props 
}: TranslatedTextProps) {
  const translated = useTranslatedText(children);

  return (
    <Component className={className} {...props}>
      {translated}
    </Component>
  );
}

/**
 * 번역 가능 이름 표시 컴포넌트
 * DB에서 가져온 name_kr/name_en 필드를 언어에 맞게 표시하고,
 * 영어 번역이 없는 경우 자동 번역합니다.
 */
interface TranslatedNameProps {
  nameKr?: string | null;
  nameEn?: string | null;
  as?: keyof JSX.IntrinsicElements;
  className?: string;
  [key: string]: any;
}

export function TranslatedName({
  nameKr,
  nameEn,
  as: Component = 'span',
  className,
  ...props
}: TranslatedNameProps) {
  const { language } = useLocale();
  
  // 영어 모드이고 nameEn이 있으면 그대로 사용
  if (language === 'en' && nameEn) {
    return (
      <Component className={className} {...props}>
        {nameEn}
      </Component>
    );
  }

  // 영어 모드이고 nameEn이 없으면 nameKr을 번역
  if (language === 'en' && nameKr) {
    return (
      <TranslatedText as={Component} className={className} {...props}>
        {nameKr}
      </TranslatedText>
    );
  }

  // 한국어 모드
  return (
    <Component className={className} {...props}>
      {nameKr || nameEn || ''}
    </Component>
  );
}
