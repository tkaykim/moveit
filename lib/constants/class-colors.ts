/**
 * 수업 카드 색상 (관리자가 클래스 등록/수정 시 지정).
 * card_color 미지정 시 difficulty_level로 매핑하여 사용.
 */
export type ClassCardColorKey =
  | 'green'
  | 'yellow'
  | 'red'
  | 'blue'
  | 'purple'
  | 'amber'
  | 'indigo'
  | 'pink';

export const CLASS_CARD_COLOR_KEYS: ClassCardColorKey[] = [
  'green',
  'yellow',
  'red',
  'blue',
  'purple',
  'amber',
  'indigo',
  'pink',
];

export const CLASS_CARD_COLOR_LABELS: Record<ClassCardColorKey, string> = {
  green: '초록',
  yellow: '노랑',
  red: '빨강',
  blue: '파랑',
  purple: '보라',
  amber: '주황',
  indigo: '남색',
  pink: '분홍',
};

export interface ClassColorStyle {
  bg: string;
  text: string;
  border: string;
  dot?: string;
}

export const CLASS_CARD_COLORS: Record<ClassCardColorKey, ClassColorStyle> = {
  green: {
    bg: 'bg-green-50 dark:bg-green-900/20',
    text: 'text-green-700 dark:text-green-400',
    border: 'border-green-200 dark:border-green-800',
    dot: 'bg-green-500',
  },
  yellow: {
    bg: 'bg-yellow-50 dark:bg-yellow-900/20',
    text: 'text-yellow-700 dark:text-yellow-400',
    border: 'border-yellow-200 dark:border-yellow-800',
    dot: 'bg-yellow-500',
  },
  red: {
    bg: 'bg-red-50 dark:bg-red-900/20',
    text: 'text-red-700 dark:text-red-400',
    border: 'border-red-200 dark:border-red-800',
    dot: 'bg-red-500',
  },
  blue: {
    bg: 'bg-blue-50 dark:bg-blue-900/20',
    text: 'text-blue-700 dark:text-blue-400',
    border: 'border-blue-200 dark:border-blue-800',
    dot: 'bg-blue-500',
  },
  purple: {
    bg: 'bg-purple-50 dark:bg-purple-900/20',
    text: 'text-purple-700 dark:text-purple-400',
    border: 'border-purple-200 dark:border-purple-800',
    dot: 'bg-purple-500',
  },
  amber: {
    bg: 'bg-amber-50 dark:bg-amber-900/20',
    text: 'text-amber-700 dark:text-amber-400',
    border: 'border-amber-200 dark:border-amber-800',
    dot: 'bg-amber-500',
  },
  indigo: {
    bg: 'bg-indigo-50 dark:bg-indigo-900/20',
    text: 'text-indigo-700 dark:text-indigo-400',
    border: 'border-indigo-200 dark:border-indigo-800',
    dot: 'bg-indigo-500',
  },
  pink: {
    bg: 'bg-pink-50 dark:bg-pink-900/20',
    text: 'text-pink-700 dark:text-pink-400',
    border: 'border-pink-200 dark:border-pink-800',
    dot: 'bg-pink-500',
  },
};

/** 난이도 → 카드 색상 키 (card_color 미지정 시 fallback) */
const DIFFICULTY_TO_COLOR_KEY: Record<string, ClassCardColorKey> = {
  BEGINNER: 'green',
  INTERMEDIATE: 'yellow',
  ADVANCED: 'red',
  ALL: 'blue',
};

const DEFAULT_COLOR: ClassColorStyle = CLASS_CARD_COLORS.green;

/**
 * 수업 카드 색상 스타일 반환.
 * @param cardColor classes.card_color (관리자 지정)
 * @param difficultyFallback classes.difficulty_level (미지정 시 사용)
 */
export function getClassColor(
  cardColor: string | null | undefined,
  difficultyFallback?: string | null
): ClassColorStyle {
  const key = (cardColor?.trim().toLowerCase() as ClassCardColorKey) || null;
  if (key && key in CLASS_CARD_COLORS) return CLASS_CARD_COLORS[key];

  const fallbackKey = difficultyFallback
    ? DIFFICULTY_TO_COLOR_KEY[difficultyFallback.toUpperCase()]
    : undefined;
  return fallbackKey ? CLASS_CARD_COLORS[fallbackKey] : DEFAULT_COLOR;
}
