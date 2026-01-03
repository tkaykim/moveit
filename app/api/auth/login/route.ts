import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    // 입력 검증
    if (!email || !password) {
      return NextResponse.json(
        { error: '이메일과 비밀번호를 입력해주세요.' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Supabase Auth로 로그인
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    if (authError) {
      console.error('로그인 에러:', authError);
      return NextResponse.json(
        { error: authError.message },
        { status: 401 }
      );
    }

    if (!authData.user || !authData.session) {
      console.error('로그인 실패: 사용자 또는 세션이 없음');
      return NextResponse.json(
        { error: '로그인에 실패했습니다.' },
        { status: 401 }
      );
    }

    // 사용자 프로필 정보 가져오기 (에러가 발생해도 로그인은 성공)
    let profile = null;
    try {
      const { data: profileData, error: profileError } = await supabase
        .from('users')
        .select('*')
        .eq('id', authData.user.id)
        .single();

      if (!profileError && profileData) {
        profile = profileData;
      }
    } catch (profileError) {
      // 프로필 조회 실패해도 로그인은 성공한 것으로 처리
      console.warn('프로필 조회 실패 (로그인은 성공):', profileError);
    }

    // 응답 생성 및 쿠키 설정
    const response = NextResponse.json({
      message: '로그인 성공',
      user: {
        id: authData.user.id,
        email: authData.user.email,
      },
      profile: profile,
    });

    // 세션 쿠키를 응답에 포함 (Supabase SSR이 자동으로 처리하지만 명시적으로 확인)
    // Supabase SSR의 createServerClient가 이미 쿠키를 설정했으므로 추가 작업 불필요
    
    return response;
  } catch (error: any) {
    console.error('로그인 에러:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

