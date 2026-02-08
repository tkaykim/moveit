export type UserRole = 'SUPER_ADMIN' | 'ACADEMY_OWNER' | 'ACADEMY_MANAGER' | 'INSTRUCTOR' | 'USER';
export type AcademyRole = 'ACADEMY_OWNER' | 'ACADEMY_MANAGER';
export type TabType = 'general' | 'academy';

export interface User {
  id: string;
  email: string | null;
  name: string | null;
  nickname: string | null;
  phone: string | null;
  role: UserRole;
  created_at: string | null;
}

export interface Academy {
  id: string;
  name_kr: string | null;
}

export interface AcademyUserRole {
  id: string;
  user_id: string;
  academy_id: string;
  role: AcademyRole;
  created_at: string;
}

export interface AcademySelection {
  academy_id: string;
  role: AcademyRole;
  existingId?: string;
}

export const ROLE_LABELS: Record<UserRole, string> = {
  SUPER_ADMIN: '최고 관리자',
  ACADEMY_OWNER: '학원 관리자',
  ACADEMY_MANAGER: '학원 매니저',
  INSTRUCTOR: '강사',
  USER: '일반 사용자',
};

export const ROLE_COLORS: Record<UserRole, string> = {
  SUPER_ADMIN: 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400',
  ACADEMY_OWNER: 'bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400',
  ACADEMY_MANAGER: 'bg-purple-100 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400',
  INSTRUCTOR: 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400',
  USER: 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-400',
};
