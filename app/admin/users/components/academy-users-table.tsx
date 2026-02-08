'use client';

import { useState } from 'react';
import { Edit2, Crown, UserCog } from 'lucide-react';
import { User, AcademyUserRole, ROLE_LABELS, ROLE_COLORS } from '../types';

interface AcademyUsersTableProps {
  users: User[];
  searchQuery: string;
  getAcademyName: (academyId: string) => string;
  getUserAcademyRoles: (userId: string) => AcademyUserRole[];
  onEditUser: (user: User) => void;
}

export default function AcademyUsersTable({
  users,
  searchQuery,
  getAcademyName,
  getUserAcademyRoles,
  onEditUser,
}: AcademyUsersTableProps) {
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);

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
                담당 학원
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
                <td colSpan={8} className="px-6 py-12 text-center text-neutral-500 dark:text-neutral-400">
                  {searchQuery ? '검색 결과가 없습니다.' : '등록된 학원 사용자가 없습니다.'}
                </td>
              </tr>
            ) : (
              users.map((user) => {
                const userRoles = getUserAcademyRoles(user.id);
                const isExpanded = expandedUserId === user.id;

                return (
                  <tr key={user.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50 align-top">
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
                      <span className={`px-2 py-1 text-xs font-medium rounded ${ROLE_COLORS[user.role]}`}>
                        {ROLE_LABELS[user.role]}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {userRoles.length === 0 ? (
                        <span className="text-neutral-400 dark:text-neutral-500 text-xs">미배정</span>
                      ) : (
                        <div className="space-y-1.5">
                          {(isExpanded ? userRoles : userRoles.slice(0, 2)).map((ur) => (
                            <div key={ur.id} className="flex items-center gap-1.5">
                              {ur.role === 'ACADEMY_OWNER' ? (
                                <Crown size={12} className="text-blue-500 flex-shrink-0" />
                              ) : (
                                <UserCog size={12} className="text-purple-500 flex-shrink-0" />
                              )}
                              <span className="text-xs text-black dark:text-white whitespace-nowrap">
                                {getAcademyName(ur.academy_id)}
                              </span>
                            </div>
                          ))}
                          {userRoles.length > 2 && !isExpanded && (
                            <button
                              onClick={() => setExpandedUserId(user.id)}
                              className="text-xs text-primary dark:text-[#CCFF00] hover:underline"
                            >
                              +{userRoles.length - 2}개 더보기
                            </button>
                          )}
                          {isExpanded && userRoles.length > 2 && (
                            <button
                              onClick={() => setExpandedUserId(null)}
                              className="text-xs text-primary dark:text-[#CCFF00] hover:underline"
                            >
                              접기
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-600 dark:text-neutral-400">
                      {user.created_at ? new Date(user.created_at).toLocaleDateString('ko-KR') : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <button
                        onClick={() => onEditUser(user)}
                        className="p-1.5 text-neutral-600 dark:text-neutral-400 hover:text-primary dark:hover:text-[#CCFF00] transition-colors"
                        title="수정"
                      >
                        <Edit2 size={16} />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
