/**
 * GET /api/auth/profile
 * 현재 로그인한 사용자의 프로필을 서비스 클라이언트로 조회하여 반환.
 * RLS로 인해 클라이언트에서 프로필(role 등) 조회가 실패하는 경우를 보완.
 */
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    const serviceClient = createServiceClient();
    const { data: profileRow, error: profileError } = await serviceClient
      .from('users')
      .select('id, nickname, name, name_en, email, phone, profile_image, role, created_at, updated_at')
      .eq('id', user.id)
      .single();

    if (profileError || !profileRow) {
      return NextResponse.json(
        { error: '프로필을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      profile: {
        id: profileRow.id,
        nickname: profileRow.nickname ?? null,
        name: profileRow.name ?? null,
        name_en: profileRow.name_en ?? null,
        email: profileRow.email ?? null,
        phone: profileRow.phone ?? null,
        profile_image: profileRow.profile_image ?? null,
        role: profileRow.role,
        created_at: profileRow.created_at,
        updated_at: profileRow.updated_at,
      },
    });
  } catch (e) {
    console.error('[GET /api/auth/profile]', e);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
