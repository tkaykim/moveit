'use client';

import { Edit2 } from 'lucide-react';
import { User, UserRole, ROLE_LABELS, ROLE_COLORS } from '../types';

interface GeneralUsersTableProps {
  users: User[];
  searchQuery: string;
  editingUserId: string | null;
  selectedRole: UserRole;
  onEditStart: (userId: string, role: UserRole) => void;
  onEditCancel: () => void;
  onRoleChange: (userId: string, role: UserRole) => void;
  onSelectedRoleChange: (role: UserRole) => void;
}

export default function GeneralUsersTable({
  users,
  searchQuery,
  editingUserId,
  selectedRole,
  onEditStart,
  onEditCancel,
  onRoleChange,
  onSelectedRoleChange,
}: GeneralUsersTableProps) {
  return (
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
            {users.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-neutral-500 dark:text-neutral-400">
                  {searchQuery ? '검색 결과가 없습니다.' : '등록된 일반 사용자가 없습니다.'}
                </td>
              </tr>
            ) : (
              users.map((user) => (
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
                          onChange={(e) => onSelectedRoleChange(e.target.value as UserRole)}
                          className="px-3 py-1 text-sm border border-neutral-300 dark:border-neutral-700 rounded bg-white dark:bg-neutral-900 text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
                        >
                          <option value="USER">일반 사용자</option>
                          <option value="INSTRUCTOR">강사</option>
                        </select>
                        <button
                          onClick={() => onRoleChange(user.id, selectedRole)}
                          className="px-3 py-1 text-sm bg-primary dark:bg-[#CCFF00] text-black rounded hover:opacity-90"
                        >
                          저장
                        </button>
                        <button
                          onClick={onEditCancel}
                          className="px-3 py-1 text-sm bg-neutral-200 dark:bg-neutral-700 text-black dark:text-white rounded hover:opacity-90"
                        >
                          취소
                        </button>
                      </div>
                    ) : (
                      <span className={`px-2 py-1 text-xs font-medium rounded ${ROLE_COLORS[user.role]}`}>
                        {ROLE_LABELS[user.role]}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-600 dark:text-neutral-400">
                    {user.created_at ? new Date(user.created_at).toLocaleDateString('ko-KR') : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    {editingUserId !== user.id && (
                      <button
                        onClick={() => onEditStart(user.id, user.role)}
                        className="p-1.5 text-neutral-600 dark:text-neutral-400 hover:text-primary dark:hover:text-[#CCFF00] transition-colors"
                        title="역할 변경"
                      >
                        <Edit2 size={16} />
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
