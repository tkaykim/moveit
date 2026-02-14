import { NextResponse } from 'next/server';
import { getAuthenticatedUser, getAuthenticatedSupabase } from '@/lib/supabase/server-auth';

/**
 * POST /api/upload/profile-image
 * 프로필 이미지 업로드 (profile-images 버킷)
 * FormData: file (이미지), targetUserId (대상 사용자 ID, 관리자 전용 - 선택)
 * 
 * - 본인 프로필: targetUserId 없이 호출
 * - 관리자 대리 업로드: targetUserId 지정 (관리자 권한 확인)
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
    const targetUserId = formData.get('targetUserId') as string | null;

    if (!file) {
      return NextResponse.json({ error: '파일이 필요합니다.' }, { status: 400 });
    }

    // 파일 크기 제한 (5MB)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: '파일 크기는 5MB 이하여야 합니다.' }, { status: 400 });
    }

    // 허용 타입
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: 'JPG, PNG, WebP, HEIC만 업로드 가능합니다.' }, { status: 400 });
    }

    // 대상 사용자 결정
    let userId = user.id;

    if (targetUserId && targetUserId !== user.id) {
      // 관리자 권한 확인: users 테이블에서 role 확인
      const { data: currentUser } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single();

      const adminRoles = ['SUPER_ADMIN', 'ACADEMY_OWNER', 'ACADEMY_MANAGER'];
      if (!currentUser || !adminRoles.includes(currentUser.role)) {
        // academy_user_roles에서도 확인
        const { data: academyRole } = await supabase
          .from('academy_user_roles')
          .select('role')
          .eq('user_id', user.id)
          .in('role', ['ACADEMY_OWNER', 'ACADEMY_MANAGER'])
          .limit(1)
          .maybeSingle();

        if (!academyRole) {
          return NextResponse.json({ error: '다른 사용자의 프로필을 수정할 권한이 없습니다.' }, { status: 403 });
        }
      }

      userId = targetUserId;
    }

    // 기존 프로필 이미지 삭제 (같은 유저 폴더 내 파일들)
    const { data: existingFiles } = await supabase.storage
      .from('profile-images')
      .list(userId);

    if (existingFiles && existingFiles.length > 0) {
      const filesToDelete = existingFiles.map((f: any) => `${userId}/${f.name}`);
      await supabase.storage
        .from('profile-images')
        .remove(filesToDelete);
    }

    // 파일명 생성
    const ext = file.name.split('.').pop() || 'jpg';
    const fileName = `${userId}/profile_${Date.now()}.${ext}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);

    // 업로드
    const { data, error } = await supabase.storage
      .from('profile-images')
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: true,
      });

    if (error) {
      console.error('Profile image upload error:', error);
      return NextResponse.json({ error: `업로드 실패: ${error.message}` }, { status: 500 });
    }

    // public URL 생성
    const { data: urlData } = supabase.storage
      .from('profile-images')
      .getPublicUrl(data.path);

    const publicUrl = urlData.publicUrl;

    // users 테이블의 profile_image 업데이트
    const { error: updateError } = await supabase
      .from('users')
      .update({ profile_image: publicUrl, updated_at: new Date().toISOString() })
      .eq('id', userId);

    if (updateError) {
      console.error('Profile image URL update error:', updateError);
      // 업로드는 성공했으므로 URL 반환은 함
    }

    return NextResponse.json({ 
      url: publicUrl,
      userId,
      success: true,
    });
  } catch (error: any) {
    console.error('Profile image upload error:', error);
    return NextResponse.json({ error: error.message || '서버 오류' }, { status: 500 });
  }
}

/**
 * DELETE /api/upload/profile-image
 * 프로필 이미지 삭제
 * Body: { targetUserId?: string }
 */
export async function DELETE(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const supabase = await getAuthenticatedSupabase(request) as any;

    let body: any = {};
    try {
      body = await request.json();
    } catch {
      // body가 없을 수 있음
    }

    const targetUserId = body.targetUserId;
    let userId = user.id;

    if (targetUserId && targetUserId !== user.id) {
      // 관리자 권한 확인
      const { data: currentUser } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single();

      const adminRoles = ['SUPER_ADMIN', 'ACADEMY_OWNER', 'ACADEMY_MANAGER'];
      if (!currentUser || !adminRoles.includes(currentUser.role)) {
        const { data: academyRole } = await supabase
          .from('academy_user_roles')
          .select('role')
          .eq('user_id', user.id)
          .in('role', ['ACADEMY_OWNER', 'ACADEMY_MANAGER'])
          .limit(1)
          .maybeSingle();

        if (!academyRole) {
          return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
        }
      }

      userId = targetUserId;
    }

    // 기존 이미지 삭제
    const { data: existingFiles } = await supabase.storage
      .from('profile-images')
      .list(userId);

    if (existingFiles && existingFiles.length > 0) {
      const filesToDelete = existingFiles.map((f: any) => `${userId}/${f.name}`);
      await supabase.storage
        .from('profile-images')
        .remove(filesToDelete);
    }

    // users 테이블의 profile_image 초기화
    await supabase
      .from('users')
      .update({ profile_image: null, updated_at: new Date().toISOString() })
      .eq('id', userId);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Profile image delete error:', error);
    return NextResponse.json({ error: error.message || '서버 오류' }, { status: 500 });
  }
}
