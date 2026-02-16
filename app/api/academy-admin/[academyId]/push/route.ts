import { NextResponse } from 'next/server';
import { getAuthenticatedUser, getAuthenticatedSupabase } from '@/lib/supabase/server-auth';
import { sendNotification } from '@/lib/notifications';
import { createServiceClient } from '@/lib/supabase/server';

/**
 * GET /api/academy-admin/[academyId]/push
 * 학원 관리자용 푸시 알림 현황 조회
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ academyId: string }> }
) {
  try {
    const { academyId } = await params;
    const user = await getAuthenticatedUser(request);

    if (!user) {
      return NextResponse.json(
        { error: '로그인이 필요합니다.' },
        { status: 401 }
      );
    }

    // 학원 관리자 권한 확인
    const serviceSupabase = createServiceClient();
    const { data: roleData, error: roleError } = await serviceSupabase
      .from('academy_user_roles')
      .select('role')
      .eq('academy_id', academyId)
      .eq('user_id', user.id)
      .single();

    if (roleError || !roleData || !['ACADEMY_OWNER', 'ACADEMY_MANAGER'].includes(roleData.role)) {
      return NextResponse.json(
        { error: '학원 관리자 권한이 필요합니다.' },
        { status: 403 }
      );
    }

    // 해당 학원에 등록된 수강생 목록 조회
    const { data: students } = await serviceSupabase
      .from('user_tickets')
      .select('user_id, tickets!inner(academy_id)')
      .eq('tickets.academy_id', academyId)
      .eq('status', 'ACTIVE');

    const uniqueStudentIds = [...new Set(students?.map((s) => s.user_id) || [])];

    // 해당 학원 수강생들의 디바이스 토큰 수
    const { data: tokens } = await serviceSupabase
      .from('device_tokens')
      .select('id')
      .in('user_id', uniqueStudentIds)
      .eq('is_active', true);

    return NextResponse.json({
      summary: {
        total_students: uniqueStudentIds.length,
        active_tokens: tokens?.length || 0,
      },
    });
  } catch (error: any) {
    console.error('Error in GET /api/academy-admin/[academyId]/push:', error);
    return NextResponse.json(
      { error: '알림 현황 조회에 실패했습니다.' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/academy-admin/[academyId]/push
 * 학원 관리자용 푸시 알림 발송
 * Body: {
 *   target: 'all' | 'specific',
 *   user_ids?: string[],
 *   title: string,
 *   body: string,
 *   image_url?: string,
 *   data?: { display_style?: 'default' | 'big_text', path?: string, url?: string, image_url?: string }
 * }
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ academyId: string }> }
) {
  try {
    const { academyId } = await params;
    const user = await getAuthenticatedUser(request);

    if (!user) {
      return NextResponse.json(
        { error: '로그인이 필요합니다.' },
        { status: 401 }
      );
    }

    // 학원 관리자 권한 확인
    const serviceSupabase = createServiceClient();
    const { data: roleData, error: roleError } = await serviceSupabase
      .from('academy_user_roles')
      .select('role')
      .eq('academy_id', academyId)
      .eq('user_id', user.id)
      .single();

    if (roleError || !roleData || !['ACADEMY_OWNER', 'ACADEMY_MANAGER'].includes(roleData.role)) {
      return NextResponse.json(
        { error: '학원 관리자 권한이 필요합니다.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { target, user_ids, title, body: messageBody, image_url, data } = body;

    if (!title || !messageBody) {
      return NextResponse.json(
        { error: 'title과 body는 필수입니다.' },
        { status: 400 }
      );
    }

    // 대상 사용자 ID 목록 생성
    let targetUserIds: string[] = [];

    if (target === 'specific' && Array.isArray(user_ids)) {
      targetUserIds = user_ids;
    } else if (target === 'all') {
      // 해당 학원에 등록된 수강생 목록 조회
      const { data: students } = await serviceSupabase
        .from('user_tickets')
        .select('user_id, tickets!inner(academy_id)')
        .eq('tickets.academy_id', academyId)
        .eq('status', 'ACTIVE');

      targetUserIds = [...new Set(students?.map((s) => s.user_id) || [])];
    } else {
      return NextResponse.json(
        { error: '유효한 target을 지정해주세요 (all | specific)' },
        { status: 400 }
      );
    }

    if (targetUserIds.length === 0) {
      return NextResponse.json(
        { error: '알림을 보낼 대상이 없습니다.' },
        { status: 400 }
      );
    }

    // 각 사용자에게 알림 발송
    const promises = targetUserIds.map((userId) =>
      sendNotification({
        user_id: userId,
        type: 'marketing',
        title,
        body: messageBody,
        data: data || {},
      }).catch((err) => console.error(`[academy-push-${userId}]`, err))
    );

    await Promise.all(promises);

    return NextResponse.json({
      success: true,
      message: `${targetUserIds.length}명에게 알림을 발송했습니다.`,
      sent_count: targetUserIds.length,
    });
  } catch (error: any) {
    console.error('Error in POST /api/academy-admin/[academyId]/push:', error);
    return NextResponse.json(
      { error: '알림 발송에 실패했습니다.' },
      { status: 500 }
    );
  }
}
