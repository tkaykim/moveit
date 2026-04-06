/**
 * name_en 값을 URL-friendly slug로 변환.
 * "Feedback Studio" → "feedback-studio"
 * "DifferentFromSame" → "differentfromsame"
 */
export function generateBaseSlug(nameEn: string): string {
  return nameEn
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUUID(value: string): boolean {
  return UUID_REGEX.test(value);
}
