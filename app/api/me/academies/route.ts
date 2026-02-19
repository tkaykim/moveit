import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/supabase/server-auth';
import { createServiceClient } from '@/lib/supabase/server';
import type { Database } from '@/types/database';

type UserRole = Database['public']['Enums']['user_role'];

/**
 * 현재 로그인한 사용자가 OWNER 또는 MANAGER로 속한 학원 목록 조회.
 * intro → 구독 시작 시 학원 선택용.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    const supabase = createServiceClient();

    const { data: roles, error } = await supabase
      .from('academy_user_roles')
      .select('academy_id, role')
      .eq('user_id', user.id)
      .in('role', ['ACADEMY_OWNER', 'ACADEMY_MANAGER']);

    if (error) throw error;

    const academyIds = [...new Set((roles ?? []).map((r: any) => r.academy_id))];
    if (academyIds.length === 0) {
      return NextResponse.json({ academies: [] });
    }

    const { data: academies, error: acError } = await supabase
      .from('academies')
      .select('id, name_kr, name_en')
      .in('id', academyIds)
      .order('name_kr', { ascending: true });

    if (acError) throw acError;

    return NextResponse.json({ academies: academies ?? [] });
  } catch (error) {
    console.error('[me/academies] Error:', error);
    return NextResponse.json({ error: '학원 목록을 불러오지 못했습니다.' }, { status: 500 });
  }
}

/**
 * 인증된 사용자가 본인 소유 학원을 개설.
 * academies insert → academy_user_roles(ACADEMY_OWNER) → users.role 업데이트.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    const body = await request.json();
    const name_kr = body?.name_kr?.trim();
    if (!name_kr) {
      return NextResponse.json({ error: '학원 이름(한글)은 필수입니다.' }, { status: 400 });
    }

    const supabase = createServiceClient();

    const academyInsert: Record<string, unknown> = {
      name_kr,
      name_en: body?.name_en?.trim() || null,
      address: body?.address?.trim() || null,
      contact_number: body?.contact_number?.trim() || null,
      is_active: true,
    };
    if (body?.tags && Array.isArray(body.tags)) {
      academyInsert.tags = body.tags.filter(Boolean).join(', ');
    } else if (typeof body?.tags === 'string' && body.tags.trim()) {
      academyInsert.tags = body.tags.trim();
    }

    const { data: newAcademy, error: acError } = await supabase
      .from('academies')
      .insert([academyInsert])
      .select('id')
      .single();

    if (acError) {
      console.error('[me/academies POST] academies insert:', acError);
      return NextResponse.json({ error: '학원 생성에 실패했습니다.' }, { status: 500 });
    }

    const academyId = newAcademy.id;

    if (body?.hall_name?.trim()) {
      await supabase.from('halls').insert({
        academy_id: academyId,
        name: body.hall_name.trim(),
        capacity: typeof body?.hall_capacity === 'number' ? body.hall_capacity : 1,
      });
    }

    const { error: roleError } = await supabase.from('academy_user_roles').insert({
      user_id: user.id,
      academy_id: academyId,
      role: 'ACADEMY_OWNER',
    });

    if (roleError) {
      if (roleError.code === '23505') {
        return NextResponse.json({ error: '이미 해당 학원에 등록되어 있습니다.' }, { status: 409 });
      }
      console.error('[me/academies POST] academy_user_roles insert:', roleError);
      await supabase.from('academies').delete().eq('id', academyId);
      return NextResponse.json({ error: '역할 등록에 실패했습니다.' }, { status: 500 });
    }

    const { data: existingRoles } = await supabase
      .from('academy_user_roles')
      .select('role')
      .eq('user_id', user.id);

    const allRoles = [...(existingRoles ?? []).map((r: { role: string }) => r.role), 'ACADEMY_OWNER'];
    const highestRole: UserRole = allRoles.includes('ACADEMY_OWNER') ? 'ACADEMY_OWNER' : 'ACADEMY_MANAGER';

    await supabase
      .from('users')
      .update({ role: highestRole })
      .eq('id', user.id);

    return NextResponse.json({ academyId });
  } catch (error) {
    console.error('[me/academies POST] Error:', error);
    return NextResponse.json({ error: '학원 개설 처리 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
