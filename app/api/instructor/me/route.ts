/**
 * GET /api/instructor/me
 * 로그인 유저에 연결된 강사 프로필과, 해당 강사가 등록된 학원 목록 반환.
 * 쿠키 또는 Authorization Bearer 토큰 지원.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/supabase/server-auth';
import { getAuthenticatedSupabase } from '@/lib/supabase/server-auth';
import { getInstructorByUserId } from '@/lib/db/instructors';

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);

    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    const instructor = await getInstructorByUserId(user.id);
    if (!instructor?.id) {
      return NextResponse.json(
        { error: '연결된 강사 프로필이 없습니다.' },
        { status: 404 }
      );
    }

    const supabase = await getAuthenticatedSupabase(request);
    const { data: academyInstructors } = await (supabase as any)
      .from('academy_instructors')
      .select('academy_id, academies(id, name_kr)')
      .eq('instructor_id', instructor.id)
      .eq('is_active', true);

    const academies = (academyInstructors || [])
      .map((ai: { academies?: { id: string; name_kr: string | null } | null }) => ai.academies)
      .filter(Boolean);

    return NextResponse.json({
      instructor: {
        id: instructor.id,
        name_kr: instructor.name_kr,
        name_en: instructor.name_en,
        bio: instructor.bio,
        specialties: instructor.specialties,
        profile_image_url: instructor.profile_image_url,
      },
      academies: academies.map((a: { id: string; name_kr: string | null }) => ({
        id: a.id,
        name_kr: a.name_kr,
      })),
    });
  } catch (e) {
    console.error('[GET /api/instructor/me]', e);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
