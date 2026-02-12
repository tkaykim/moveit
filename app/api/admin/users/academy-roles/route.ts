import { createServiceClient } from '@/lib/supabase/server';
import { requireSuperAdmin } from '@/lib/supabase/admin-auth';
import { NextResponse } from 'next/server';

// GET: 학원-유저 역할 매핑 목록 조회
export async function GET(request: Request) {
  try {
    const auth = await requireSuperAdmin();
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    const serviceClient = createServiceClient();
    let query = serviceClient
      .from('academy_user_roles')
      .select(`
        id,
        user_id,
        academy_id,
        role,
        created_at
      `)
      .order('created_at', { ascending: false });

    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json({ data: data || [] });
  } catch (error: any) {
    console.error('Error fetching academy user roles:', error);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

// POST: 학원-유저 역할 매핑 추가
export async function POST(request: Request) {
  try {
    const auth = await requireSuperAdmin();
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { userId, academyId, role } = await request.json();

    if (!userId || !academyId || !role) {
      return NextResponse.json(
        { error: '사용자 ID, 학원 ID, 역할이 모두 필요합니다.' },
        { status: 400 }
      );
    }

    if (!['ACADEMY_OWNER', 'ACADEMY_MANAGER'].includes(role)) {
      return NextResponse.json(
        { error: '유효하지 않은 역할입니다. (ACADEMY_OWNER 또는 ACADEMY_MANAGER)' },
        { status: 400 }
      );
    }

    const serviceClient = createServiceClient();

    // 유저의 role도 함께 업데이트 (가장 높은 학원 역할로)
    const { data: existingRoles } = await serviceClient
      .from('academy_user_roles')
      .select('role')
      .eq('user_id', userId);

    const allRoles = [...(existingRoles || []).map((r: any) => r.role), role];
    const highestRole = allRoles.includes('ACADEMY_OWNER') ? 'ACADEMY_OWNER' : 'ACADEMY_MANAGER';

    // 매핑 추가
    const { data, error } = await serviceClient
      .from('academy_user_roles')
      .insert({
        user_id: userId,
        academy_id: academyId,
        role: role,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { error: '이미 해당 학원에 같은 역할이 할당되어 있습니다.' },
          { status: 409 }
        );
      }
      throw error;
    }

    // 유저의 role 업데이트
    await serviceClient
      .from('users')
      .update({ role: highestRole } as any)
      .eq('id', userId);

    return NextResponse.json({ data, message: '학원 역할이 할당되었습니다.' });
  } catch (error: any) {
    console.error('Error creating academy user role:', error);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

// DELETE: 학원-유저 역할 매핑 삭제
export async function DELETE(request: Request) {
  try {
    const auth = await requireSuperAdmin();
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { id, userId } = await request.json();

    if (!id) {
      return NextResponse.json({ error: '매핑 ID가 필요합니다.' }, { status: 400 });
    }

    const serviceClient = createServiceClient();

    const { error } = await serviceClient
      .from('academy_user_roles')
      .delete()
      .eq('id', id);

    if (error) throw error;

    // 남은 매핑을 확인하여 유저의 role 업데이트
    if (userId) {
      const { data: remainingRoles } = await serviceClient
        .from('academy_user_roles')
        .select('role')
        .eq('user_id', userId);

      if (!remainingRoles || remainingRoles.length === 0) {
        // 학원 역할이 더 이상 없으면 USER로 되돌림
        await serviceClient
          .from('users')
          .update({ role: 'USER' } as any)
          .eq('id', userId);
      } else {
        const highestRole = remainingRoles.some((r: any) => r.role === 'ACADEMY_OWNER')
          ? 'ACADEMY_OWNER'
          : 'ACADEMY_MANAGER';
        await serviceClient
          .from('users')
          .update({ role: highestRole } as any)
          .eq('id', userId);
      }
    }

    return NextResponse.json({ message: '학원 역할이 해제되었습니다.' });
  } catch (error: any) {
    console.error('Error deleting academy user role:', error);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
