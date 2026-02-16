import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/supabase/server-auth';
import { createServiceClient } from '@/lib/supabase/server';
import type { RegisterDeviceTokenRequest } from '@/types/notifications';

/**
 * POST /api/notifications/device-token
 * 디바이스 토큰 등록 (FCM 토큰)
 * - 비로그인: user_id = null로 토큰만 등록
 * - 로그인: user_id와 함께 토큰 등록/업데이트
 */
export async function POST(request: NextRequest) {
  try {
    // 인증은 선택사항 (비로그인도 허용)
    let userId: string | null = null;
    try {
      const user = await getAuthenticatedUser(request);
      if (user) userId = user.id;
    } catch {
      // 인증 실패해도 진행 (비로그인 토큰 등록)
    }

    const body: RegisterDeviceTokenRequest = await request.json();
    const { token, platform } = body;

    if (!token || !platform) {
      return NextResponse.json(
        { error: 'token과 platform은 필수입니다.' },
        { status: 400 }
      );
    }

    if (!['android', 'ios', 'web'].includes(platform)) {
      return NextResponse.json(
        { error: 'platform은 android, ios, web 중 하나여야 합니다.' },
        { status: 400 }
      );
    }

    // 서비스 클라이언트 사용 (RLS 우회 - 비로그인도 저장 가능)
    const supabase = createServiceClient();

    // upsert on token: 동일 토큰이 있으면 업데이트
    const upsertData: Record<string, any> = {
      token,
      platform,
      is_active: true,
      updated_at: new Date().toISOString(),
    };
    // 로그인 유저가 있으면 user_id도 업데이트
    if (userId) {
      upsertData.user_id = userId;
    }

    const { data, error } = await (supabase as any)
      .from('device_tokens')
      .upsert(upsertData, { onConflict: 'token' })
      .select()
      .single();

    if (error) {
      console.error('[device-token] 등록 실패:', error);
      return NextResponse.json(
        { error: '토큰 등록에 실패했습니다.', detail: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('[device-token] 서버 오류:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/notifications/device-token
 * 디바이스 토큰 비활성화 (로그아웃 시)
 */
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { token } = body;

    if (!token) {
      return NextResponse.json(
        { error: 'token은 필수입니다.' },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();

    // 토큰 비활성화 (사용자 인증 없이도 가능 - 로그아웃 후 호출될 수 있음)
    const { error } = await (supabase as any)
      .from('device_tokens')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('token', token);

    if (error) {
      console.error('[device-token] 비활성화 실패:', error);
      return NextResponse.json(
        { error: '토큰 비활성화에 실패했습니다.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[device-token] 서버 오류:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
