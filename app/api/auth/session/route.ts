import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const supabase = await createClient();

    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      return NextResponse.json(
        { user: null, profile: null },
        { status: 200 }
      );
    }

    // 사용자 프로필 정보 가져오기
    const { data: profile } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single();

    return NextResponse.json({
      user,
      profile: profile || null,
    });
  } catch (error: any) {
    console.error('세션 확인 에러:', error);
    return NextResponse.json(
      { user: null, profile: null },
      { status: 200 }
    );
  }
}

