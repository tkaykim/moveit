/**
 * GET /api/auth/profile
 * 현재 로그인한 사용자의 프로필을 서비스 클라이언트로 조회하여 반환.
 * 쿠키 또는 Authorization Bearer 토큰 지원 (Capacitor/다른 포트 환경).
 */
import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/supabase/server-auth';
import { createServiceClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);

    if (!user) {
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

    let instructor_id: string | null = null;
    try {
      const { data: instructorRow } = await serviceClient
        .from('instructors')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();
      if (instructorRow?.id) instructor_id = instructorRow.id;
    } catch {
      // instructors.user_id 컬럼이 아직 없을 수 있음
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
        instructor_id,
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
