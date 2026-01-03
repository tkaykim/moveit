import { createClient } from '@/lib/supabase/server';

export interface DashboardStats {
  academyCount: number;
  instructorCount: number;
  classCount: number;
  userCount: number;
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const supabase = await createClient() as any;

  try {
    // 모든 통계를 병렬로 가져오기
    const [academiesResult, instructorsResult, classesResult, usersResult] = await Promise.all([
      supabase.from('academies').select('*', { count: 'exact', head: true }),
      supabase.from('instructors').select('*', { count: 'exact', head: true }),
      supabase.from('classes').select('*', { count: 'exact', head: true }),
      supabase.from('users').select('*', { count: 'exact', head: true }),
    ]);

    // 에러가 있으면 로그에 기록하고 0 반환
    if (academiesResult.error) {
      console.error('Error fetching academies count:', academiesResult.error);
    }
    if (instructorsResult.error) {
      console.error('Error fetching instructors count:', instructorsResult.error);
    }
    if (classesResult.error) {
      console.error('Error fetching classes count:', classesResult.error);
    }
    if (usersResult.error) {
      console.error('Error fetching users count:', usersResult.error);
    }

    return {
      academyCount: academiesResult.count ?? 0,
      instructorCount: instructorsResult.count ?? 0,
      classCount: classesResult.count ?? 0,
      userCount: usersResult.count ?? 0,
    };
  } catch (error) {
    console.error('Error in getDashboardStats:', error);
    // 에러 발생 시 기본값 반환
    return {
      academyCount: 0,
      instructorCount: 0,
      classCount: 0,
      userCount: 0,
    };
  }
}

