/**
 * POST /api/academy-admin/[academyId]/instructors/register
 * 강사 등록: 이메일 중복 시 기존 강사에 학원만 연결, 없으면 신규 생성.
 * Body: { name_kr?, name_en?, contact?, email? }
 */
import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/supabase/server-auth';
import { createServiceClient } from '@/lib/supabase/server';

function normalizeEmail(email: string | null | undefined): string | null {
  if (email == null || typeof email !== 'string') return null;
  const trimmed = email.trim().toLowerCase();
  return trimmed === '' ? null : trimmed;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ academyId: string }> }
) {
  try {
    const { academyId } = await params;
    const user = await getAuthenticatedUser(request);

    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const serviceClient = createServiceClient();
    const { data: userData } = await serviceClient
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();
    const isSuperAdmin = userData?.role === 'SUPER_ADMIN';

    if (!isSuperAdmin) {
      const { data: roleData, error: roleError } = await serviceClient
        .from('academy_user_roles')
        .select('role')
        .eq('academy_id', academyId)
        .eq('user_id', user.id)
        .single();
      if (roleError || !roleData || !['ACADEMY_OWNER', 'ACADEMY_MANAGER'].includes(roleData.role)) {
        return NextResponse.json({ error: '학원 관리자 권한이 필요합니다.' }, { status: 403 });
      }
    }

    const body = await request.json().catch(() => ({}));
    const name_kr = typeof body.name_kr === 'string' ? body.name_kr.trim() : '';
    const name_en = typeof body.name_en === 'string' ? body.name_en.trim() : null;
    const contact = typeof body.contact === 'string' ? body.contact.trim() : null;
    const email = normalizeEmail(body.email);

    if (!name_kr) {
      return NextResponse.json({ error: '이름(한글)을 입력해 주세요.' }, { status: 400 });
    }

    // 이메일이 있으면 기존 강사 조회 (trim+lower 일치)
    if (email) {
      const { data: allWithEmail } = await serviceClient
        .from('instructors')
        .select('id, email')
        .not('email', 'is', null);
      const existingInstructor = (allWithEmail || []).find(
        (r: any) => r.email && normalizeEmail(r.email) === email
      );

      if (existingInstructor) {
        const { data: existingLink } = await serviceClient
          .from('academy_instructors')
          .select('id')
          .eq('academy_id', academyId)
          .eq('instructor_id', existingInstructor.id)
          .maybeSingle();

        if (existingLink) {
          return NextResponse.json({
            instructorId: existingInstructor.id,
            alreadyExists: true,
            alreadyInAcademy: true,
          });
        }

        const { error: linkError } = await serviceClient.from('academy_instructors').insert({
          academy_id: academyId,
          instructor_id: existingInstructor.id,
          is_active: true,
        });

        if (linkError) {
          console.error('[instructors/register] link', linkError);
          return NextResponse.json({ error: '학원 연결에 실패했습니다.' }, { status: 500 });
        }
        return NextResponse.json({
          instructorId: existingInstructor.id,
          alreadyExists: true,
          alreadyInAcademy: false,
        });
      }
    }

    // 신규 강사 생성
    const { data: newInstructor, error: insertError } = await serviceClient
      .from('instructors')
      .insert({
        name_kr,
        name_en: name_en || null,
        contact,
        email,
      })
      .select('id')
      .single();

    if (insertError) {
      if (insertError.code === '23505') {
        return NextResponse.json(
          { error: '이미 등록된 이메일입니다. 우리 학원에 추가하려면 확인을 눌러 주세요.' },
          { status: 409 }
        );
      }
      console.error('[instructors/register] insert', insertError);
      return NextResponse.json({ error: '강사 등록에 실패했습니다.' }, { status: 500 });
    }

    const { error: linkError } = await serviceClient.from('academy_instructors').insert({
      academy_id: academyId,
      instructor_id: newInstructor.id,
      is_active: true,
    });

    if (linkError) {
      console.error('[instructors/register] academy_instructors', linkError);
      return NextResponse.json({ error: '학원 연결에 실패했습니다.' }, { status: 500 });
    }

    return NextResponse.json({ instructorId: newInstructor.id, alreadyExists: false });
  } catch (e) {
    console.error('[POST academy-admin instructors/register]', e);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
