'use client';

import { X } from 'lucide-react';
import { User, UserRole, Academy, AcademySelection, ROLE_LABELS } from '../types';
import AcademyMultiSelect from './academy-multi-select';

interface EditAcademyUserModalProps {
  user: User;
  academies: Academy[];
  userRole: UserRole;
  setUserRole: (role: UserRole) => void;
  academySelections: AcademySelection[];
  setAcademySelections: (s: AcademySelection[]) => void;
  academySearchQuery: string;
  setAcademySearchQuery: (q: string) => void;
  editLoading: boolean;
  onSave: () => void;
  onClose: () => void;
  getAcademyName: (id: string) => string;
}

export default function EditAcademyUserModal({
  user,
  academies,
  userRole,
  setUserRole,
  academySelections,
  setAcademySelections,
  academySearchQuery,
  setAcademySearchQuery,
  editLoading,
  onSave,
  onClose,
  getAcademyName,
}: EditAcademyUserModalProps) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-neutral-900 rounded-2xl w-full max-w-lg shadow-xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-neutral-200 dark:border-neutral-800 flex-shrink-0">
          <h2 className="text-lg font-bold text-black dark:text-white">학원 사용자 수정</h2>
          <button
            onClick={onClose}
            className="p-1.5 text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          {/* 사용자 정보 */}
          <div className="flex items-center gap-3 p-3 bg-neutral-50 dark:bg-neutral-800 rounded-lg">
            <div className="w-10 h-10 rounded-full bg-neutral-200 dark:bg-neutral-700 flex items-center justify-center">
              <span className="text-sm font-bold text-neutral-600 dark:text-neutral-300">
                {(user.name || user.nickname || '?')[0]}
              </span>
            </div>
            <div>
              <div className="text-sm font-medium text-black dark:text-white">
                {user.name || user.nickname || '이름 없음'}
              </div>
              <div className="text-xs text-neutral-500">{user.email || '-'}</div>
            </div>
          </div>

          {/* 역할 선택 */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">
              사용자 역할
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['ACADEMY_OWNER', 'ACADEMY_MANAGER', 'SUPER_ADMIN'] as UserRole[]).map((role) => (
                <button
                  key={role}
                  onClick={() => setUserRole(role)}
                  className={`px-3 py-2 rounded-lg border-2 text-xs font-medium transition-all ${
                    userRole === role
                      ? role === 'SUPER_ADMIN'
                        ? 'border-red-500 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'
                        : role === 'ACADEMY_OWNER'
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400'
                        : 'border-purple-500 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400'
                      : 'border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:border-neutral-300'
                  }`}
                >
                  {ROLE_LABELS[role]}
                </button>
              ))}
            </div>
          </div>

          {/* 학원 다중 선택 */}
          <AcademyMultiSelect
            academies={academies}
            selections={academySelections}
            setSelections={setAcademySelections}
            searchQuery={academySearchQuery}
            setSearchQuery={setAcademySearchQuery}
            getAcademyName={getAcademyName}
            defaultRole={
              userRole === 'ACADEMY_OWNER' || userRole === 'SUPER_ADMIN'
                ? 'ACADEMY_OWNER'
                : 'ACADEMY_MANAGER'
            }
          />
        </div>

        <div className="flex justify-end gap-3 p-6 border-t border-neutral-200 dark:border-neutral-800 flex-shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-neutral-700 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-800 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
          >
            취소
          </button>
          <button
            onClick={onSave}
            disabled={editLoading}
            className="px-4 py-2 text-sm font-medium bg-primary dark:bg-[#CCFF00] text-black rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {editLoading ? '저장 중...' : '저장하기'}
          </button>
        </div>
      </div>
    </div>
  );
}
