import { getSupabaseClient } from './supabase-client';

/**
 * Supabase Storage에 파일을 업로드합니다.
 * @param bucketName - Storage bucket 이름
 * @param file - 업로드할 파일
 * @param path - 파일 경로 (예: 'academies/academy-id/image.jpg')
 * @returns 업로드된 파일의 공개 URL
 */
export async function uploadFile(
  bucketName: string,
  file: File,
  path: string
): Promise<string> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error('Supabase client is not available');
  }

  // 파일 확장자 확인
  const fileExt = file.name.split('.').pop();
  const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
  const filePath = `${path}/${fileName}`;

  // 파일 업로드
  const { data, error } = await supabase.storage
    .from(bucketName)
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false,
    });

  if (error) {
    console.error('Upload error:', error);
    throw new Error(`파일 업로드에 실패했습니다: ${error.message}`);
  }

  // 공개 URL 가져오기
  const { data: urlData } = supabase.storage
    .from(bucketName)
    .getPublicUrl(filePath);

  return urlData.publicUrl;
}

/**
 * Supabase Storage에서 파일을 삭제합니다.
 * @param bucketName - Storage bucket 이름
 * @param path - 삭제할 파일 경로
 */
export async function deleteFile(
  bucketName: string,
  path: string
): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error('Supabase client is not available');
  }

  const { error } = await supabase.storage
    .from(bucketName)
    .remove([path]);

  if (error) {
    console.error('Delete error:', error);
    throw new Error(`파일 삭제에 실패했습니다: ${error.message}`);
  }
}

/**
 * URL에서 파일 경로를 추출합니다.
 * @param url - Supabase Storage URL
 * @returns 파일 경로
 */
export function extractFilePathFromUrl(url: string): string | null {
  try {
    const urlObj = new URL(url);
    // Supabase Storage URL 형식: https://project.supabase.co/storage/v1/object/public/bucket-name/path/to/file.jpg
    const pathMatch = urlObj.pathname.match(/\/storage\/v1\/object\/public\/[^/]+\/(.+)$/);
    return pathMatch ? pathMatch[1] : null;
  } catch {
    return null;
  }
}











