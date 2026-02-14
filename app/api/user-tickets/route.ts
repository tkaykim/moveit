import { NextResponse } from 'next/server';
import { getAvailableUserTickets, getAllUserTickets, getUserTicketCounts } from '@/lib/db/user-tickets';
import { getAuthenticatedUser, getAuthenticatedSupabase } from '@/lib/supabase/server-auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/user-tickets
 * 사용자의 수강권 조회 (쿠키 또는 Authorization: Bearer 토큰)
 * Query params:
 *   - includeAll (optional): true면 전체 수강권(만료/사용완료 포함), 기본은 사용가능만
 *   - academyId (optional): 특정 학원에서 사용 가능한 수강권만 조회 (includeAll=false일 때)
 *   - classId (optional): 특정 클래스에서 사용 가능한 수강권만 조회
 *   - allowCoupon (optional): 쿠폰 포함 여부
 */
export async function GET(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);

    if (!user) {
      return NextResponse.json(
        { error: '로그인이 필요합니다.', data: [] },
        { status: 401 }
      );
    }

    const supabase = await getAuthenticatedSupabase(request);

    const { searchParams } = new URL(request.url);
    const includeAll = searchParams.get('includeAll') === 'true';
    const academyId = searchParams.get('academyId') || undefined;
    const classId = searchParams.get('classId') || undefined;
    const allowCoupon = searchParams.get('allowCoupon') === 'true';

    let tickets: any[];

    if (includeAll) {
      tickets = await getAllUserTickets(user.id, supabase);
    } else {
      tickets = await getAvailableUserTickets(user.id, academyId, classId, allowCoupon, supabase);
    }

    const counts = includeAll
      ? { total: tickets.length, academySpecific: tickets.length }
      : await getUserTicketCounts(user.id, academyId || undefined, supabase);

    return NextResponse.json({
      data: tickets,
      counts,
    });
  } catch (error: any) {
    console.error('Error fetching user tickets:', error);
    return NextResponse.json(
      { error: '수강권 조회에 실패했습니다.' },
      { status: 500 }
    );
  }
}

