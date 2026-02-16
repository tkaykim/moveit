import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/supabase/server-auth';
import { createClient } from '@/lib/supabase/server';
import type { UpdatePreferencesRequest } from '@/types/notifications';

/**
 * GET /api/notifications/preferences
 * 알림 설정 조회 (없으면 기본값으로 생성)
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    const supabase = await createClient();

    let { data, error } = await (supabase as any)
      .from('notification_preferences')
      .select('*')
      .eq('user_id', user.id)
      .single();

    // 설정이 없으면 기본값으로 생성
    if (error || !data) {
      const { data: newData, error: insertError } = await (supabase as any)
        .from('notification_preferences')
        .insert({ user_id: user.id })
        .select()
        .single();

      if (insertError) {
        console.error('[preferences] 기본 설정 생성 실패:', insertError);
        // 기본값 반환
        return NextResponse.json({
          user_id: user.id,
          push_enabled: true,
          kakao_enabled: true,
          class_reminder: true,
          booking_updates: true,
          attendance_updates: true,
          ticket_updates: true,
          content_updates: true,
          consultation_updates: true,
          marketing: false,
          reminder_minutes_before: 60,
        });
      }

      data = newData;
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('[preferences] 서버 오류:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/notifications/preferences
 * 알림 설정 업데이트
 */
export async function PATCH(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    const body: UpdatePreferencesRequest = await request.json();

    // 허용된 필드만 업데이트
    const allowedFields = [
      'push_enabled', 'kakao_enabled', 'class_reminder',
      'booking_updates', 'attendance_updates', 'ticket_updates',
      'content_updates', 'consultation_updates', 'marketing',
      'reminder_minutes_before',
    ] as const;

    const updates: Record<string, any> = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates[field] = body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: '업데이트할 필드가 없습니다.' },
        { status: 400 }
      );
    }

    updates.updated_at = new Date().toISOString();

    const supabase = await createClient();

    // upsert로 없으면 생성, 있으면 업데이트
    const { data, error } = await (supabase as any)
      .from('notification_preferences')
      .upsert(
        { user_id: user.id, ...updates },
        { onConflict: 'user_id' }
      )
      .select()
      .single();

    if (error) {
      console.error('[preferences] 업데이트 실패:', error);
      return NextResponse.json(
        { error: '설정 업데이트에 실패했습니다.' },
        { status: 500 }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('[preferences] 서버 오류:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
