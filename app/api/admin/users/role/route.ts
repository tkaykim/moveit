import { createServiceClient } from '@/lib/supabase/server';
import { requireSuperAdmin } from '@/lib/supabase/admin-auth';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const auth = await requireSuperAdmin(request);
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { userId, role } = await request.json();

    if (!userId || !role) {
      return NextResponse.json(
        { error: '사용자 ID와 역할이 필요합니다.' },
        { status: 400 }
      );
    }

    // 유효한 역할인지 확인
    const validRoles = ['SUPER_ADMIN', 'ACADEMY_OWNER', 'ACADEMY_MANAGER', 'INSTRUCTOR', 'USER'] as const;
    type ValidRole = typeof validRoles[number];
    
    if (!validRoles.includes(role as ValidRole)) {
      return NextResponse.json(
        { error: '유효하지 않은 역할입니다.' },
        { status: 400 }
      );
    }

    // 자신의 역할은 변경할 수 없음
    if (userId === auth.user!.id) {
      return NextResponse.json(
        { error: '자신의 역할은 변경할 수 없습니다.' },
        { status: 400 }
      );
    }

    // 서비스 클라이언트로 사용자 역할 업데이트 (RLS 우회)
    const serviceClient = createServiceClient();
    const { error: updateError } = await serviceClient
      .from('users')
      .update({ role: role as ValidRole } as any)
      .eq('id', userId);

    if (updateError) {
      console.error('Error updating user role:', updateError);
      return NextResponse.json(
        { error: '역할 변경에 실패했습니다.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: '역할이 성공적으로 변경되었습니다.',
      userId,
      role,
    });
  } catch (error: any) {
    console.error('Error in role update API:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
