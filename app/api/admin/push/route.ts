/**
 * 관리자 푸시 알림 발송 API
 * 
 * GET  - 디바이스 토큰 현황 및 발송 가능 유저 목록
 * POST - 전체/특정 유저에게 푸시 알림 발송
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/supabase/admin-auth';
import { createServiceClient } from '@/lib/supabase/server';
import { sendNotification, sendBulkNotification } from '@/lib/notifications/send-notification';
import type { NotificationType } from '@/types/notifications';

/** GET: 디바이스 토큰 현황 조회 */
export async function GET() {
  try {
    const auth = await requireSuperAdmin();
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const supabase = createServiceClient();

    // 활성 디바이스 토큰 목록 (유저 정보 포함)
    const { data: tokens, error: tokensError } = await (supabase
      .from('device_tokens') as any)
      .select('id, user_id, platform, is_active, created_at, updated_at')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (tokensError) {
      return NextResponse.json({ error: '토큰 조회 실패', detail: tokensError.message }, { status: 500 });
    }

    // 토큰이 있는 유저들의 프로필 조회
    const userIds = [...new Set((tokens || []).map((t: any) => t.user_id))];
    let usersWithTokens: any[] = [];

    if (userIds.length > 0) {
      const { data: users } = await (supabase
        .from('users') as any)
        .select('id, display_name, email, role')
        .in('id', userIds);
      usersWithTokens = users || [];
    }

    // 전체 유저 수
    const { count: totalUsers } = await (supabase
      .from('users') as any)
      .select('*', { count: 'exact', head: true });

    // 최근 발송 이력
    const { data: recentQueue } = await (supabase
      .from('notification_queue') as any)
      .select('id, user_id, title, body, status, created_at, processed_at, error_message')
      .order('created_at', { ascending: false })
      .limit(20);

    return NextResponse.json({
      summary: {
        total_users: totalUsers || 0,
        users_with_tokens: userIds.length,
        total_active_tokens: (tokens || []).length,
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
    const auth = await requireSuperAdmin();
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await request.json();
    const {
      title,
      message,
      type = 'system' as NotificationType,
      target = 'all', // 'all' | 'specific'
      user_ids = [] as string[],
      data = {},
      trigger_worker = true,
    } = body;

    if (!title || !message) {
      return NextResponse.json({ error: 'title과 message는 필수입니다.' }, { status: 400 });
    }

    const supabase = createServiceClient();
    let targetUserIds: string[] = [];

    if (target === 'all') {
      // 활성 토큰이 있는 모든 유저
      const { data: tokens } = await (supabase
        .from('device_tokens') as any)
        .select('user_id')
        .eq('is_active', true);

      targetUserIds = [...new Set((tokens || []).map((t: any) => t.user_id))] as string[];
    } else if (target === 'specific' && user_ids.length > 0) {
      targetUserIds = user_ids;
    } else {
      return NextResponse.json({
        error: 'target이 "specific"인 경우 user_ids가 필요합니다.',
      }, { status: 400 });
    }

    if (targetUserIds.length === 0) {
      return NextResponse.json({
        error: '발송 대상이 없습니다. 디바이스 토큰이 등록된 유저가 없습니다.',
        hint: '앱에서 로그인하여 푸시 알림을 허용해야 디바이스 토큰이 등록됩니다.',
      }, { status: 400 });
    }

    // 벌크 알림 발송 (notification 테이블 + queue 삽입)
    const result = await sendBulkNotification(targetUserIds, {
      type,
      title,
      body: message,
      data,
      channel: 'push',
    });

    // notification-worker Edge Function 트리거
    let workerResult = null;
    if (trigger_worker) {
      workerResult = await triggerNotificationWorker(supabase);
    }

    return NextResponse.json({
      success: true,
      result: {
        ...result,
        target_user_ids: targetUserIds,
      },
      worker: workerResult,
    });
  } catch (error: any) {
    console.error('Admin push POST error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/** notification-worker Edge Function 호출 */
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
