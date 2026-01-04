/**
 * 권한 체크 유틸리티 함수
 */

export type UserRole = 'SUPER_ADMIN' | 'ACADEMY_OWNER' | 'ACADEMY_MANAGER' | 'INSTRUCTOR' | 'USER';

export interface UserProfile {
  id: string;
  email: string | null;
  name: string | null;
  nickname: string | null;
  phone: string | null;
  profile_image: string | null;
  role?: UserRole | string;
}

/**
 * Admin 페이지 접근 권한이 있는지 확인
 */
export function hasAdminAccess(profile: UserProfile | null): boolean {
  if (!profile || !profile.role) {
    return false;
  }

  const role = profile.role as UserRole;
  return role === 'SUPER_ADMIN' || role === 'ACADEMY_OWNER' || role === 'ACADEMY_MANAGER';
}

/**
 * Super Admin 권한이 있는지 확인
 */
export function isSuperAdmin(profile: UserProfile | null): boolean {
  if (!profile || !profile.role) {
    return false;
  }
  return profile.role === 'SUPER_ADMIN';
}

/**
 * 특정 역할을 가진 사용자인지 확인
 */
export function hasRole(profile: UserProfile | null, roles: UserRole[]): boolean {
  if (!profile || !profile.role) {
    return false;
  }
  return roles.includes(profile.role as UserRole);
}

/**
 * 역할 우선순위 비교
 */
export function compareRoles(role1: UserRole, role2: UserRole): number {
  const roleHierarchy: Record<UserRole, number> = {
    SUPER_ADMIN: 5,
    ACADEMY_OWNER: 4,
    ACADEMY_MANAGER: 3,
    INSTRUCTOR: 2,
    USER: 1,
  };

  return (roleHierarchy[role1] || 0) - (roleHierarchy[role2] || 0);
}




