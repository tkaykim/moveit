/**
 * GET /api/instructor/my-schedule
 * 로그인한 강사의 수업 목록 (예정/지난 탭, 학원 필터, 페이지네이션).
 * 쿠키 또는 Authorization Bearer 토큰 지원.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser, getAuthenticatedSupabase } from '@/lib/supabase/server-auth';
import { getInstructorByUserId } from '@/lib/db/instructors';
import { getSchedules } from '@/lib/db/schedules';
import { getScheduleEnrollmentStats } from '@/lib/db/bookings';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);

    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    const instructor = await getInstructorByUserId(user.id);
    if (!instructor?.id) {
      return NextResponse.json(
        { error: '연결된 강사 프로필이 없습니다.' },
        { status: 404 }
      );
    }

    const { searchParams } = new URL(request.url);
    const tab = searchParams.get('tab') || 'upcoming';
    const academyId = searchParams.get('academy_id') || undefined;
    const limit = Math.min(
      parseInt(searchParams.get('limit') || String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT,
      MAX_LIMIT
    );
    const offset = parseInt(searchParams.get('offset') || '0', 10) || 0;

    const now = new Date();
    const nowIso = now.toISOString();

    let startDate: string;
    let endDate: string;
    let filterPast = false;

    if (tab === 'past') {
      const end = new Date(now);
      end.setDate(end.getDate() - 1);
      const start = new Date(end);
      start.setMonth(start.getMonth() - 1);
      startDate = start.toISOString().slice(0, 10);
      endDate = end.toISOString().slice(0, 10);
      filterPast = true;
    } else {
      startDate = now.toISOString().slice(0, 10);
      const future = new Date(now);
      future.setDate(future.getDate() + 14);
      endDate = future.toISOString().slice(0, 10);
    }

    const filters: Parameters<typeof getSchedules>[0] = {
      instructor_id: instructor.id,
      start_date: startDate,
      end_date: endDate,
    };
    if (academyId) filters.academy_id = academyId;

    let schedules = await getSchedules(filters);
    if (!schedules) schedules = [];

    if (filterPast) {
      schedules = schedules.filter((s: { end_time?: string }) => s.end_time && new Date(s.end_time) < now);
      schedules.sort((a: { start_time: string }, b: { start_time: string }) =>
        new Date(b.start_time).getTime() - new Date(a.start_time).getTime()
      );
    } else {
      schedules = schedules.filter((s: { start_time?: string }) => s.start_time && new Date(s.start_time) >= now);
      schedules.sort((a: { start_time: string }, b: { start_time: string }) =>
        new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
      );
    }

    const total = schedules.length;
    const paginated = schedules.slice(offset, offset + limit);
    const scheduleIds = paginated.map((s: { id: string }) => s.id);
    const enrollmentStats = await getScheduleEnrollmentStats(scheduleIds);

    const supabase = await getAuthenticatedSupabase(request);
    const { data: academyInstructors } = await (supabase as any)
      .from('academy_instructors')
      .select('academy_id, academies(id, name_kr)')
      .eq('instructor_id', instructor.id)
      .eq('is_active', true);
    const academies = (academyInstructors || [])
      .map((ai: { academies?: { id: string; name_kr: string | null } | null }) => ai.academies)
      .filter(Boolean)
      .map((a: { id: string; name_kr: string | null }) => ({ id: a.id, name_kr: a.name_kr }));

    const schedulesWithEnrollment = paginated.map((s: any) => {
      const stat = enrollmentStats[s.id] || { confirmed: 0, pending: 0 };
      return {
        id: s.id,
        start_time: s.start_time,
        end_time: s.end_time,
        is_canceled: s.is_canceled,
        class: s.classes
          ? {
              id: s.classes.id,
              title: s.classes.title,
              genre: s.classes.genre,
              difficulty_level: s.classes.difficulty_level,
            }
          : null,
        academy: s.classes?.academies
          ? { id: s.classes.academies.id, name_kr: s.classes.academies.name_kr }
          : null,
        hall: s.halls ? { id: s.halls.id, name: s.halls.name } : null,
        max_students: s.max_students ?? 0,
        enrollment: { confirmed: stat.confirmed, pending: stat.pending },
      };
    });

    return NextResponse.json({
      academies,
      schedules: schedulesWithEnrollment,
      total,
      has_more: offset + limit < total,
    });
  } catch (e) {
    console.error('[GET /api/instructor/my-schedule]', e);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
