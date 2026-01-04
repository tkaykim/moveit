import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { toggleAcademyFavorite, toggleInstructorFavorite, getAcademyFavorites, getInstructorFavorites } from '@/lib/db/favorites';

// 찜 추가/삭제 (토글)
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

    const { type, id } = await request.json();

    if (!type || !id) {
      return NextResponse.json(
        { error: 'type과 id가 필요합니다.' },
        { status: 400 }
      );
    }

    if (type !== 'academy' && type !== 'instructor') {
      return NextResponse.json(
        { error: 'type은 academy 또는 instructor여야 합니다.' },
        { status: 400 }
      );
    }

    let isFavorited: boolean;
    if (type === 'academy') {
      isFavorited = await toggleAcademyFavorite(user.id, id);
    } else {
      isFavorited = await toggleInstructorFavorite(user.id, id);
    }

    return NextResponse.json({
      success: true,
      isFavorited,
      message: isFavorited ? '찜 목록에 추가되었습니다.' : '찜 목록에서 제거되었습니다.',
    });
  } catch (error: any) {
    console.error('Error in favorites API:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// 찜 목록 조회
export async function GET(request: Request) {
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

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');

    if (!type || (type !== 'academy' && type !== 'instructor')) {
      return NextResponse.json(
        { error: 'type 쿼리 파라미터가 필요합니다 (academy 또는 instructor).' },
        { status: 400 }
      );
    }

    let data;
    if (type === 'academy') {
      data = await getAcademyFavorites(user.id);
    } else {
      data = await getInstructorFavorites(user.id);
    }

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error: any) {
    console.error('Error in favorites GET API:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

