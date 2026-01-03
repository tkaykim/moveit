'use client';

import { useState, useEffect } from 'react';
import { Shield, Search, Edit2, X } from 'lucide-react';
import { getSupabaseClient } from '@/lib/utils/supabase-client';
import { useAuth } from '@/lib/auth/auth-context';

type UserRole = 'SUPER_ADMIN' | 'ACADEMY_OWNER' | 'ACADEMY_MANAGER' | 'INSTRUCTOR' | 'USER';

interface User {
  id: string;
  email: string | null;
  name: string | null;
  nickname: string | null;
  phone: string | null;
  role: UserRole;
  created_at: string | null;
}

const ROLE_LABELS: Record<UserRole, string> = {
  SUPER_ADMIN: '관리자',
  ACADEMY_OWNER: '학원 관리자',
  ACADEMY_MANAGER: '학원 매니저',
  INSTRUCTOR: '강사',
  USER: '일반 사용자',
};

const ROLE_COLORS: Record<UserRole, string> = {
  SUPER_ADMIN: 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400',
  ACADEMY_OWNER: 'bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400',
  ACADEMY_MANAGER: 'bg-purple-100 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400',
  INSTRUCTOR: 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400',
  USER: 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-400',
};

export default function UsersPage() {
  const { profile } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<UserRole>('USER');

  // SUPER_ADMIN만 접근 가능
  useEffect(() => {
    if (profile && profile.role !== 'SUPER_ADMIN') {
      alert('관리자 권한이 필요합니다.');
      window.location.href = '/admin';
    }
  }, [profile]);

  const loadUsers = async () => {
    try {
      const supabase = getSupabaseClient();
      if (!supabase) return;

      const { data, error } = await (supabase as any)
        .from('users')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Error loading users:', error);
      alert('사용자 목록을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    try {
      const response = await fetch('/api/admin/users/role', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          role: newRole,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '권한 변경에 실패했습니다.');
      }

      // 로컬 상태 업데이트
      setUsers((prev) =>
        prev.map((user) => (user.id === userId ? { ...user, role: newRole } : user))
      );
      setEditingUserId(null);
      alert('권한이 변경되었습니다.');
    } catch (error: any) {
      console.error('Error updating role:', error);
      alert(error.message || '권한 변경에 실패했습니다.');
    }
  };

  const filteredUsers = users.filter((user) => {
    const query = searchQuery.toLowerCase();
    return (
      user.email?.toLowerCase().includes(query) ||
      user.name?.toLowerCase().includes(query) ||
      user.nickname?.toLowerCase().includes(query) ||
      ROLE_LABELS[user.role].toLowerCase().includes(query)
    );
  });

  if (loading) {
    return <div className="text-center py-12">로딩 중...</div>;
  }

  if (profile?.role !== 'SUPER_ADMIN') {
    return (
      <div className="text-center py-12">
        <p className="text-neutral-600 dark:text-neutral-400">관리자 권한이 필요합니다.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-black dark:text-white">사용자 관리</h1>
          <p className="text-neutral-600 dark:text-neutral-400 mt-1">
            사용자 목록을 조회하고 권한을 부여할 수 있습니다.
          </p>
        </div>
      </div>

      {/* 검색 */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={20} />
          <input
            type="text"
            placeholder="이메일, 이름, 닉네임, 역할로 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-primary dark:focus:ring-[#CCFF00]"
          />
        </div>
      </div>

      {/* 사용자 목록 */}
      <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-neutral-50 dark:bg-neutral-800">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">
                  이메일
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">
                  이름
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">
                  닉네임
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">
                  전화번호
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">
                  역할
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">
                  가입일
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">
                  작업
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-neutral-500 dark:text-neutral-400">
                    {searchQuery ? '검색 결과가 없습니다.' : '등록된 사용자가 없습니다.'}
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-black dark:text-white">
                      {user.email || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-black dark:text-white">
                      {user.name || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-black dark:text-white">
                      {user.nickname || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-black dark:text-white">
                      {user.phone || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {editingUserId === user.id ? (
                        <div className="flex items-center gap-2">
                          <select
                            value={selectedRole}
                            onChange={(e) => setSelectedRole(e.target.value as UserRole)}
                            className="px-3 py-1 text-sm border border-neutral-300 dark:border-neutral-700 rounded bg-white dark:bg-neutral-900 text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
                          >
                            <option value="USER">일반 사용자</option>
                            <option value="INSTRUCTOR">강사</option>
                            <option value="ACADEMY_MANAGER">학원 매니저</option>
                            <option value="ACADEMY_OWNER">학원 관리자</option>
                            <option value="SUPER_ADMIN">관리자</option>
                          </select>
                          <button
                            onClick={() => handleRoleChange(user.id, selectedRole)}
                            className="px-3 py-1 text-sm bg-primary dark:bg-[#CCFF00] text-black rounded hover:opacity-90"
                          >
                            저장
                          </button>
                          <button
                            onClick={() => {
                              setEditingUserId(null);
                              setSelectedRole(user.role);
                            }}
                            className="px-3 py-1 text-sm bg-neutral-200 dark:bg-neutral-700 text-black dark:text-white rounded hover:opacity-90"
                          >
                            취소
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-1 text-xs font-medium rounded ${ROLE_COLORS[user.role]}`}
                          >
                            {ROLE_LABELS[user.role]}
                          </span>
                          <button
                            onClick={() => {
                              setEditingUserId(user.id);
                              setSelectedRole(user.role);
                            }}
                            className="p-1 text-neutral-600 dark:text-neutral-400 hover:text-primary dark:hover:text-[#CCFF00] transition-colors"
                            title="권한 변경"
                          >
                            <Edit2 size={16} />
                          </button>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-600 dark:text-neutral-400">
                      {user.created_at
                        ? new Date(user.created_at).toLocaleDateString('ko-KR')
                        : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                      {/* 추가 작업 버튼들 */}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-4 text-sm text-neutral-600 dark:text-neutral-400">
        총 {filteredUsers.length}명의 사용자
      </div>
    </div>
  );
}

