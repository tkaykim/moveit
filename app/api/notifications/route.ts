import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/supabase/server-auth';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/notifications
 * 알림 목록 조회
 * Query params:
 *   - unread_count=true : 읽지 않은 알림 수만 반환
 *   - page=1 : 페이지 번호
 *   - limit=20 : 페이지당 항목 수
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const unreadCountOnly = searchParams.get('unread_count') === 'true';

    const supabase = await createClient();

    // 읽지 않은 알림 수만 요청한 경우
    if (unreadCountOnly) {
      const { count, error } = await (supabase as any)
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_read', false);

      if (error) {
        console.error('[notifications] 읽지 않은 수 조회 실패:', error);
        return NextResponse.json({ unread_count: 0 });
      }

      return NextResponse.json({ unread_count: count || 0 });
    }

    // 알림 목록 조회
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50);
    const offset = (page - 1) * limit;

    const { data: notifications, error, count } = await (supabase as any)
      .from('notifications')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('[notifications] 목록 조회 실패:', error);
      return NextResponse.json(
        { error: '알림 목록 조회에 실패했습니다.' },
        { status: 500 }
      );
    }

    // 읽지 않은 알림 수 별도 조회
    const { count: unreadCount } = await (supabase as any)
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('is_read', false);

    return NextResponse.json({
      notifications: notifications || [],
      total_count: count || 0,
      unread_count: unreadCount || 0,
      page,
      limit,
    });
  } catch (error) {
    console.error('[notifications] 서버 오류:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
