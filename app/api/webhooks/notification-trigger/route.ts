import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

/**
 * POST /api/webhooks/notification-trigger
 * Supabase DB Webhook에서 호출되거나, 직접 호출하여
 * notification_queue의 pending 항목을 Edge Function 워커로 전달
 * 
 * 이 엔드포인트는 내부 서비스용이므로 별도 인증 키로 보호
 */
export async function POST(request: NextRequest) {
  try {
    // 간단한 내부 인증 (환경변수로 시크릿 키 확인)
    const authHeader = request.headers.get('x-webhook-secret');
    const webhookSecret = process.env.WEBHOOK_SECRET || process.env.QR_SECRET_KEY;

    if (authHeader !== webhookSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createServiceClient();

    // pending 상태이고 예정 시간이 된 알림 조회
    const { data: pendingItems, error } = await (supabase as any)
      .from('notification_queue')
      .select('id')
      .eq('status', 'pending')
      .lte('scheduled_at', new Date().toISOString())
      .limit(50);

    if (error || !pendingItems || pendingItems.length === 0) {
      return NextResponse.json({ message: '처리할 알림이 없습니다.', processed: 0 });
    }

    // Edge Function 호출
    const edgeFunctionUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/notification-worker`;
    const queueItemIds = pendingItems.map((item: any) => item.id);

    const response = await fetch(edgeFunctionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ queue_item_ids: queueItemIds }),
    });

    const result = await response.json();

    return NextResponse.json({
      message: '알림 워커 호출 완료',
      queue_count: pendingItems.length,
      worker_result: result,
    });
  } catch (error) {
    console.error('[notification-trigger] 오류:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
