import { createServiceClient } from '@/lib/supabase/server';

/**
 * 학원 관리자 권한 검사.
 * - SUPER_ADMIN: 모든 학원에 대해 권한 있음.
 * - 해당 학원의 ACADEMY_OWNER 또는 ACADEMY_MANAGER(academy_user_roles): 해당 학원에 대해 권한 있음.
 * 권한 없으면 throw new Error('학원 관리자 권한이 필요합니다.')
 */
export async function assertAcademyAdmin(academyId: string, userId: string): Promise<void> {
  const supabase = createServiceClient();
  const { data: userData } = await (supabase as any)
    .from('users')
    .select('role')
    .eq('id', userId)
    .single();
  const isSuperAdmin = userData?.role === 'SUPER_ADMIN';
  if (isSuperAdmin) return;

  const { data: roleData, error: roleError } = await (supabase as any)
    .from('academy_user_roles')
    .select('role')
    .eq('academy_id', academyId)
    .eq('user_id', userId)
    .single();
  if (roleError || !roleData || !['ACADEMY_OWNER', 'ACADEMY_MANAGER'].includes(roleData.role)) {
    throw new Error('학원 관리자 권한이 필요합니다.');
  }
}
