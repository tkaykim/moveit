/**
 * 관리자 푸시 알림 발송 API
 * 
 * GET  - 디바이스 토큰 현황 및 발송 가능 유저 목록
 * POST - 전체/특정 유저에게 푸시 알림 발송
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/supabase/admin-auth';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { sendNotification, sendBulkNotification } from '@/lib/notifications/send-notification';
import type { NotificationType } from '@/types/notifications';

/** GET: 디바이스 토큰 현황 조회 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireSuperAdmin(request);
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    // 서비스 클라이언트 사용 (RLS 우회 - SUPER_ADMIN 확인 완료)
    const supabase = createServiceClient();

    // 활성 디바이스 토큰 목록 (유저 정보 포함)
    const { data: tokens, error: tokensError } = await (supabase as any)
      .from('device_tokens')
      .select('id, user_id, platform, is_active, created_at, updated_at')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (tokensError) {
      return NextResponse.json({ error: '토큰 조회 실패', detail: tokensError.message }, { status: 500 });
    }

    // 토큰이 있는 유저들의 프로필 조회
    const userIds = [...new Set((tokens || []).filter((t: any) => t.user_id).map((t: any) => t.user_id))];
    const anonymousTokenCount = (tokens || []).filter((t: any) => !t.user_id).length;
    let usersWithTokens: any[] = [];

    if (userIds.length > 0) {
      const { data: users } = await (supabase as any)
        .from('users')
        .select('id, display_name, email, role')
        .in('id', userIds);
      usersWithTokens = users || [];
    }

    // 전체 유저 수
    const { count: totalUsers } = await (supabase as any)
      .from('users')
      .select('*', { count: 'exact', head: true });

    // 최근 발송 이력 (data 필드도 포함)
    const { data: recentQueue } = await (supabase as any)
      .from('notification_queue')
      .select('id, user_id, title, body, data, status, created_at, processed_at, error_message')
      .order('created_at', { ascending: false })
      .limit(30);

    return NextResponse.json({
      summary: {
        total_users: totalUsers || 0,
        users_with_tokens: userIds.length,
        total_active_tokens: (tokens || []).length,
        anonymous_tokens: anonymousTokenCount,
        android_tokens: (tokens || []).filter((t: any) => t.platform === 'android').length,
        ios_tokens: (tokens || []).filter((t: any) => t.platform === 'ios').length,
      },
      users_with_tokens: usersWithTokens.map((u: any) => ({
        ...u,
        tokens: (tokens || []).filter((t: any) => t.user_id === u.id),
      })),
      recent_queue: recentQueue || [],
    });
  } catch (error: any) {
    console.error('Admin push GET error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/** POST: 푸시 알림 발송 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireSuperAdmin(request);
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await request.json();
    const {
      title,
      message,
      image_url,
      type = 'system' as NotificationType,
      target = 'all', // 'all' | 'specific' | 'role'
      user_ids = [] as string[],
      roles = [] as string[],
      data = {},
      trigger_worker = true,
    } = body;

    if (!title || !message) {
      return NextResponse.json({ error: 'title과 message는 필수입니다.' }, { status: 400 });
    }

    const supabase = createServiceClient();

    // 역할별 필터: 해당 역할의 유저 ID 조회
    let roleUserIds: string[] = [];
    if (target === 'role' && roles.length > 0) {
      const { data: roleUsers } = await (supabase as any)
        .from('users')
        .select('id')
        .in('role', roles);
      roleUserIds = (roleUsers || []).map((u: any) => u.id);
      if (roleUserIds.length === 0) {
        return NextResponse.json({ error: '해당 역할의 유저가 없습니다.' }, { status: 400 });
      }
    }

    // 활성 디바이스 토큰 조회
    let tokenQuery = (supabase as any)
      .from('device_tokens')
      .select('id, token, platform, user_id')
      .eq('is_active', true);

    if (target === 'specific' && user_ids.length > 0) {
      tokenQuery = tokenQuery.in('user_id', user_ids);
    } else if (target === 'role' && roleUserIds.length > 0) {
      tokenQuery = tokenQuery.in('user_id', roleUserIds);
    }

    const { data: activeTokens, error: tokenError } = await tokenQuery;

    if (tokenError) {
      return NextResponse.json({ error: '토큰 조회 실패', detail: tokenError.message }, { status: 500 });
    }

    if (!activeTokens || activeTokens.length === 0) {
      return NextResponse.json({
        error: '발송 대상이 없습니다. 디바이스 토큰이 등록된 기기가 없습니다.',
        hint: '앱을 설치하고 알림을 허용해야 디바이스 토큰이 등록됩니다.',
      }, { status: 400 });
    }

    // image_url을 data에 포함
    const enrichedData = { ...data };
    if (image_url) enrichedData.image_url = image_url;

    // 로그인된 유저들에게는 인앱 알림도 기록
    const loggedInUserIds = [...new Set(
      activeTokens.filter((t: any) => t.user_id).map((t: any) => t.user_id)
    )] as string[];

    let bulkResult = null;
    if (loggedInUserIds.length > 0) {
      bulkResult = await sendBulkNotification(loggedInUserIds, {
        type, title, body: message, data: enrichedData, channel: 'push',
      });
    }

    // notification-worker Edge Function 트리거 (큐에 있는 알림 처리)
    let workerResult = null;
    if (trigger_worker && loggedInUserIds.length > 0) {
      workerResult = await triggerNotificationWorker(supabase);
    }

    // 비로그인 토큰에는 직접 FCM 발송 요청 (Edge Function 직접 호출)
    const anonymousTokens = activeTokens.filter((t: any) => !t.user_id);
    let directFcmResult = null;
    if (anonymousTokens.length > 0 || loggedInUserIds.length === 0) {
      directFcmResult = await triggerDirectPush(supabase, activeTokens, title, message, enrichedData, image_url);
    }

    return NextResponse.json({
      success: true,
      summary: {
        total_tokens: activeTokens.length,
        logged_in_users: loggedInUserIds.length,
        anonymous_tokens: anonymousTokens.length,
        target_type: target,
        target_roles: roles,
      },
      bulk_result: bulkResult,
      worker: workerResult,
      direct_fcm: directFcmResult,
    });
  } catch (error: any) {
    console.error('Admin push POST error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/** notification-worker Edge Function 호출 (큐 기반) */
async function triggerNotificationWorker(supabase: any) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
      || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !serviceKey) {
      return { triggered: false, error: 'Supabase URL/Key 미설정' };
    }

    const res = await fetch(`${supabaseUrl}/functions/v1/notification-worker`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({}),
    });

    const data = await res.json();
    return { triggered: true, status: res.status, data };
  } catch (error: any) {
    return { triggered: false, error: error.message };
  }
}

/** 모든 토큰에 직접 FCM 발송 (notification_queue를 거치지 않고 Edge Function 호출) */
async function triggerDirectPush(
  supabase: any,
  tokens: any[],
  title: string,
  message: string,
  data: Record<string, any>,
  imageUrl?: string,
) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
      || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !serviceKey) {
      return { success: false, error: 'Supabase URL/Key 미설정' };
    }

    const res = await fetch(`${supabaseUrl}/functions/v1/notification-worker`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({
        direct_tokens: tokens.map((t: any) => t.token),
        title,
        body: message,
        data: data || {},
        image_url: imageUrl || undefined,
      }),
    });

    const result = await res.json();
    return { success: res.ok, status: res.status, result };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
