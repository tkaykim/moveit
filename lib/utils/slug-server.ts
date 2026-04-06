import { SupabaseClient } from '@supabase/supabase-js';
import { generateBaseSlug } from './slug';

/**
 * name_en으로부터 고유한 slug을 생성.
 * 중복이 있으면 숫자를 붙여서 유니크하게 만듦 (e.g. astudio → astudio1 → astudio2).
 * excludeId를 전달하면 해당 학원 자체는 중복 검사에서 제외.
 */
export async function generateUniqueSlug(
  supabase: SupabaseClient,
  nameEn: string,
  excludeId?: string,
): Promise<string> {
  const base = generateBaseSlug(nameEn);
  if (!base) return '';

  let candidate = base;
  let suffix = 1;

  while (true) {
    let query = supabase
      .from('academies')
      .select('id')
      .eq('slug', candidate);

    if (excludeId) {
      query = query.neq('id', excludeId);
    }

    const { data } = await query.maybeSingle();

    if (!data) return candidate;
    candidate = `${base}${suffix}`;
    suffix++;
  }
}
