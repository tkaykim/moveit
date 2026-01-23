import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { getAvailableUserTickets, getUserTicketCounts } from '@/lib/db/user-tickets';

/**
 * GET /api/user-tickets
 * 사용자의 사용 가능한 수강권 조회
 * Query params:
 *   - academyId (optional): 특정 학원에서 사용 가능한 수강권만 조회
 */
export async function GET(request: Request) {
  try {
    const supabase = await createClient();

    // 현재 사용자 확인
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();

    if (authError || !authUser) {
      // 로그인하지 않은 사용자에게는 빈 데이터 반환
      return NextResponse.json({
        data: [],
        counts: {
          total: 0,
          academySpecific: 0,
        },
      });
    }

    const { searchParams } = new URL(request.url);
    const academyId = searchParams.get('academyId') || undefined;
    const classId = searchParams.get('classId') || undefined;

    // 수강권 목록 조회
    const tickets = await getAvailableUserTickets(authUser.id, academyId, classId);

    // 수강권 개수 조회
    const counts = await getUserTicketCounts(authUser.id, academyId || undefined);

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

