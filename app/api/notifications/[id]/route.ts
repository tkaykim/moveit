import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/supabase/server-auth';
import { createClient } from '@/lib/supabase/server';

/**
 * PATCH /api/notifications/[id]
 * 알림 읽음 처리
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    const { id } = params;

    // 'read-all' 으로 요청 시 전체 읽음 처리
    if (id === 'read-all') {
      const supabase = await createClient();
      const { error } = await (supabase as any)
        .from('notifications')
        .update({ is_read: true, status: 'read' })
        .eq('user_id', user.id)
        .eq('is_read', false);

      if (error) {
        console.error('[notifications] 전체 읽음 처리 실패:', error);
        return NextResponse.json(
          { error: '전체 읽음 처리에 실패했습니다.' },
          { status: 500 }
        );
      }

      return NextResponse.json({ success: true });
    }

    // 개별 알림 읽음 처리
    const supabase = await createClient();
    const { error } = await (supabase as any)
      .from('notifications')
      .update({ is_read: true, status: 'read' })
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      console.error('[notifications] 읽음 처리 실패:', error);
      return NextResponse.json(
        { error: '읽음 처리에 실패했습니다.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[notifications] 서버 오류:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
