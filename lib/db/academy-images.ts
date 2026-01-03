import { createClient } from '@/lib/supabase/server';
import { Database } from '@/types/database';

export async function getAcademyImages(academyId: string) {
  const supabase = await createClient() as any;
  const { data, error } = await supabase
    .from('academy_images')
    .select('*')
    .eq('academy_id', academyId)
    .order('display_order', { ascending: true });

  if (error) throw error;
  return data;
}

export async function createAcademyImage(image: any) {
  const supabase = await createClient() as any;
  const { data, error } = await supabase
    .from('academy_images')
    .insert(image)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteAcademyImage(id: string) {
  const supabase = await createClient() as any;
  const { error } = await supabase
    .from('academy_images')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function updateAcademyImageOrder(academyId: string, images: { id: string; display_order: number }[]) {
  const supabase = await createClient() as any;
  
  // 트랜잭션처럼 처리하기 위해 Promise.all 사용
  const updates = images.map(img =>
    supabase
      .from('academy_images')
      .update({ display_order: img.display_order })
      .eq('id', img.id)
      .eq('academy_id', academyId)
  );

  const results = await Promise.all(updates);
  const errors = results.filter(r => r.error);
  
  if (errors.length > 0) {
    throw errors[0].error;
  }
}

