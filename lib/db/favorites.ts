import { createClient } from '@/lib/supabase/server';

/**
 * Academy favorite 토글 (추가/삭제)
 * @returns true if favorited after toggle, false if unfavorited
 */
export async function toggleAcademyFavorite(userId: string, academyId: string): Promise<boolean> {
  const supabase = await createClient();

  // 기존 찜 확인
  const { data: existing, error: checkError } = await (supabase as any)
    .from('academy_favorites')
    .select('id')
    .eq('user_id', userId)
    .eq('academy_id', academyId)
    .maybeSingle();

  if (checkError && checkError.code !== 'PGRST116') {
    throw checkError;
  }

  if (existing) {
    // 이미 찜한 경우 - 삭제
    const { error: deleteError } = await (supabase as any)
      .from('academy_favorites')
      .delete()
      .eq('id', existing.id);

    if (deleteError) throw deleteError;
    return false;
  } else {
    // 찜하지 않은 경우 - 추가
    const { error: insertError } = await (supabase as any)
      .from('academy_favorites')
      .insert({
        user_id: userId,
        academy_id: academyId,
      });

    if (insertError) throw insertError;
    return true;
  }
}

/**
 * Instructor favorite 토글 (추가/삭제)
 * @returns true if favorited after toggle, false if unfavorited
 */
export async function toggleInstructorFavorite(userId: string, instructorId: string): Promise<boolean> {
  const supabase = await createClient();

  // 기존 찜 확인
  const { data: existing, error: checkError } = await (supabase as any)
    .from('instructor_favorites')
    .select('id')
    .eq('user_id', userId)
    .eq('instructor_id', instructorId)
    .maybeSingle();

  if (checkError && checkError.code !== 'PGRST116') {
    throw checkError;
  }

  if (existing) {
    // 이미 찜한 경우 - 삭제
    const { error: deleteError } = await (supabase as any)
      .from('instructor_favorites')
      .delete()
      .eq('id', existing.id);

    if (deleteError) throw deleteError;
    return false;
  } else {
    // 찜하지 않은 경우 - 추가
    const { error: insertError } = await (supabase as any)
      .from('instructor_favorites')
      .insert({
        user_id: userId,
        instructor_id: instructorId,
      });

    if (insertError) throw insertError;
    return true;
  }
}

/**
 * 사용자의 Academy favorites 조회
 */
export async function getAcademyFavorites(userId: string) {
  const supabase = await createClient();

  const { data, error } = await (supabase as any)
    .from('academy_favorites')
    .select(`
      id,
      academies (
        id,
        name_kr,
        name_en,
        logo_url,
        address,
        tags
      )
    `)
    .eq('user_id', userId);

  if (error) throw error;
  return data || [];
}

/**
 * 사용자의 Instructor favorites 조회
 */
export async function getInstructorFavorites(userId: string) {
  const supabase = await createClient();

  const { data, error } = await (supabase as any)
    .from('instructor_favorites')
    .select(`
      id,
      instructors (
        id,
        name_kr,
        name_en,
        profile_image_url,
        specialties
      )
    `)
    .eq('user_id', userId);

  if (error) throw error;
  return data || [];
}



