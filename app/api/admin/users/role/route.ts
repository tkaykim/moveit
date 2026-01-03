import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { User } from '@/lib/supabase/types';
import { Database } from '@/types/database';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    // 현재 사용자 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: '인증이 필요합니다.' },
        { status: 401 }
      );
    }

    // 현재 사용자 프로필 확인
    const { data: currentProfile, error: profileError } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError || !currentProfile) {
      return NextResponse.json(
        { error: '사용자 프로필을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // SUPER_ADMIN만 권한 변경 가능
    if ((currentProfile as Pick<User, 'role'>).role !== 'SUPER_ADMIN') {
      return NextResponse.json(
        { error: '관리자 권한이 필요합니다.' },
        { status: 403 }
      );
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
    if (userId === user.id) {
      return NextResponse.json(
        { error: '자신의 역할은 변경할 수 없습니다.' },
        { status: 400 }
      );
    }

    // 사용자 역할 업데이트
    const { error: updateError } = await (supabase
      .from('users') as any)
      .update({ role: role as ValidRole })
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

