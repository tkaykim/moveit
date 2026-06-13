import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/supabase/server-auth';
import { assertAcademyAdmin } from '@/lib/supabase/academy-admin-auth';
import { createServiceClient } from '@/lib/supabase/server';

/**
 * GET /api/academy-admin/[academyId]/setup-progress
 *
 * 신규 학원 "오픈 준비" 체크리스트의 각 항목 완료 여부를 실제 데이터로 판정한다.
 * (가짜 체크가 아니라 DB 카운트/필드 기반)
 *
 * 반환:
 *  - decorate: 학원 홈 꾸미기 (소개/대표사진/페이지 구성 중 하나라도)
 *  - instructors / tickets / classes / schedules: 각 항목 1개 이상 존재 여부 + 개수
 *  '홍보 링크 공유'는 데이터로 판정 불가하여 클라이언트(localStorage)에서 관리한다.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ academyId: string }> }
) {
  try {
    const { academyId } = await params;
    const user = await getAuthenticatedUser(request);

    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    try {
      await assertAcademyAdmin(academyId, user.id);
    } catch {
      return NextResponse.json({ error: '학원 관리자 권한이 필요합니다.' }, { status: 403 });
    }

    const supabase = createServiceClient() as any;

    // 학원 홈 꾸미기 판정용 필드
    const academyPromise = supabase
      .from('academies')
      .select('introduction_html, images, section_config, logo_url, description')
      .eq('id', academyId)
      .single();

    const countOf = (table: string) =>
      supabase
        .from(table)
        .select('id', { count: 'exact', head: true })
        .eq('academy_id', academyId);

    const [
      academyRes,
      instructorsRes,
      ticketsRes,
      classesRes,
      schedulesRes,
    ] = await Promise.all([
      academyPromise,
      countOf('academy_instructors'),
      countOf('tickets'),
      countOf('classes'),
      countOf('recurring_schedules'),
    ]);

    const academy = academyRes?.data ?? {};

    const imagesLen = Array.isArray(academy.images) ? academy.images.length : 0;
    const hasIntro =
      typeof academy.introduction_html === 'string' &&
      academy.introduction_html.trim().length > 0;
    const hasSectionConfig =
      academy.section_config !== null && academy.section_config !== undefined;
    const hasLogo =
      typeof academy.logo_url === 'string' && academy.logo_url.trim().length > 0;
    const decorate = hasIntro || imagesLen > 0 || hasSectionConfig || hasLogo;

    const instructorsCount = instructorsRes?.count ?? 0;
    const ticketsCount = ticketsRes?.count ?? 0;
    const classesCount = classesRes?.count ?? 0;
    const schedulesCount = schedulesRes?.count ?? 0;

    return NextResponse.json({
      items: {
        decorate: { done: decorate },
        instructors: { done: instructorsCount > 0, count: instructorsCount },
        tickets: { done: ticketsCount > 0, count: ticketsCount },
        classes: { done: classesCount > 0, count: classesCount },
        schedules: { done: schedulesCount > 0, count: schedulesCount },
      },
    });
  } catch (error: any) {
    console.error('Error in GET /api/academy-admin/[academyId]/setup-progress:', error);
    return NextResponse.json(
      { error: '오픈 준비 현황 조회에 실패했습니다.' },
      { status: 500 }
    );
  }
}
