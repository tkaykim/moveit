import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { email, password, name, nickname, phone } = body;

    // 입력 검증
    if (!email || !password) {
      return NextResponse.json(
        { error: '이메일과 비밀번호는 필수입니다.' },
        { status: 400 }
      );
    }

    // 이메일 형식 검증
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: '올바른 이메일 형식이 아닙니다.' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: '비밀번호는 최소 6자 이상이어야 합니다.' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Supabase Auth로 회원가입
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: {
        data: {
          name: name?.trim() || null,
          nickname: nickname?.trim() || null,
          phone: phone?.trim() || null,
        },
        emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/auth/callback`,
      },
    });

    if (authError) {
      console.error('Auth 회원가입 에러:', {
        message: authError.message,
        status: authError.status,
        name: authError.name,
      });

      // 사용자 친화적인 에러 메시지
      let errorMessage = authError.message;
      if (authError.message.includes('already registered')) {
        errorMessage = '이미 등록된 이메일입니다.';
      } else if (authError.message.includes('Invalid email')) {
        errorMessage = '올바른 이메일 형식이 아닙니다.';
      } else if (authError.message.includes('Password')) {
        errorMessage = '비밀번호가 너무 약합니다.';
      }

      return NextResponse.json(
        { error: errorMessage },
        { status: 400 }
      );
    }

    if (!authData.user) {
      console.error('Auth 사용자 데이터 없음:', authData);
      return NextResponse.json(
        { error: '회원가입에 실패했습니다. 사용자 데이터를 생성할 수 없습니다.' },
        { status: 400 }
      );
    }

    // users 테이블에 프로필 생성 (트리거가 없을 경우를 대비)
    // 트리거가 설정되어 있다면 이 부분은 실행되지 않을 수 있음
    const profileData: any = {
      id: authData.user.id,
      email: authData.user.email || email.trim().toLowerCase(),
    };

    if (name?.trim()) profileData.name = name.trim();
    if (nickname?.trim()) profileData.nickname = nickname.trim();
    if (phone?.trim()) profileData.phone = phone.trim();

    const { error: profileError, data: profileDataResult } = await supabase
      .from('users')
      .insert(profileData)
      .select()
      .single();

    if (profileError) {
      // 중복 키 에러는 무시 (트리거가 이미 생성했을 수 있음)
      if (profileError.code === '23505') {
        console.log('프로필이 이미 존재합니다 (트리거로 생성됨):', authData.user.id);
      } else {
        console.error('프로필 생성 실패:', {
          code: profileError.code,
          message: profileError.message,
          details: profileError.details,
          hint: profileError.hint,
        });

        // 프로필 생성 실패해도 Auth 사용자는 생성되었으므로 성공으로 처리
        // 하지만 사용자에게 알림
        return NextResponse.json({
          message: '회원가입이 완료되었습니다. (프로필 생성 중 일부 문제가 발생했을 수 있습니다)',
          user: authData.user,
          warning: '프로필 정보를 나중에 업데이트해주세요.',
        });
      }
    }

    return NextResponse.json({
      message: '회원가입이 완료되었습니다.',
      user: {
        id: authData.user.id,
        email: authData.user.email,
      },
      session: authData.session,
    });
  } catch (error: any) {
    console.error('회원가입 처리 중 예외 발생:', {
      message: error?.message,
      stack: error?.stack,
      name: error?.name,
    });

    return NextResponse.json(
      { 
        error: '서버 오류가 발생했습니다.',
        details: process.env.NODE_ENV === 'development' ? error?.message : undefined,
      },
      { status: 500 }
    );
  }
}

