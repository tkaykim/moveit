import { NextResponse } from 'next/server';
import { getAuthenticatedUser, getAuthenticatedSupabase } from '@/lib/supabase/server-auth';

/**
 * POST /api/upload/image
 * 에디터용 이미지 업로드 (academy-images 버킷) - 쿠키 또는 Authorization Bearer
 * FormData: file (이미지), academyId (학원 ID)
 */
export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const supabase = await getAuthenticatedSupabase(request) as any;

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const academyId = formData.get('academyId') as string | null;

    if (!file) {
      return NextResponse.json({ error: '파일이 필요합니다.' }, { status: 400 });
    }

    if (!academyId) {
      return NextResponse.json({ error: 'academyId가 필요합니다.' }, { status: 400 });
    }

    // 파일 크기 제한 (5MB)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: '파일 크기는 5MB 이하여야 합니다.' }, { status: 400 });
    }

    // 허용 타입
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: 'JPG, PNG, GIF, WebP만 업로드 가능합니다.' }, { status: 400 });
    }

    // 파일명 생성
    const ext = file.name.split('.').pop() || 'jpg';
    const fileName = `introduction/${academyId}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);

    const { data, error } = await supabase.storage
      .from('academy-images')
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (error) {
      console.error('Upload error:', error);
      return NextResponse.json({ error: `업로드 실패: ${error.message}` }, { status: 500 });
    }

    // public URL 생성
    const { data: urlData } = supabase.storage
      .from('academy-images')
      .getPublicUrl(data.path);

    return NextResponse.json({ url: urlData.publicUrl });
  } catch (error: any) {
    console.error('Image upload error:', error);
    return NextResponse.json({ error: error.message || '서버 오류' }, { status: 500 });
  }
}
