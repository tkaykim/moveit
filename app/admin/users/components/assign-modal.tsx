'use client';

import { Search, X } from 'lucide-react';
import { User, Academy, AcademySelection } from '../types';
import AcademyMultiSelect from './academy-multi-select';

interface AssignModalProps {
  academies: Academy[];
  assignSearchQuery: string;
  setAssignSearchQuery: (q: string) => void;
  userSearchResults: User[];
  showUserDropdown: boolean;
  setShowUserDropdown: (v: boolean) => void;
  selectedAssignUser: User | null;
  setSelectedAssignUser: (u: User | null) => void;
  assignUserId: string;
  setAssignUserId: (id: string) => void;
  academySelections: AcademySelection[];
  setAcademySelections: (s: AcademySelection[]) => void;
  academySearchQuery: string;
  setAcademySearchQuery: (q: string) => void;
  assignLoading: boolean;
  onAssign: () => void;
  onClose: () => void;
  getAcademyName: (id: string) => string;
}

export default function AssignModal({
  academies,
  assignSearchQuery,
  setAssignSearchQuery,
  userSearchResults,
  showUserDropdown,
  setShowUserDropdown,
  selectedAssignUser,
  setSelectedAssignUser,
  assignUserId,
  setAssignUserId,
  academySelections,
  setAcademySelections,
  academySearchQuery,
  setAcademySearchQuery,
  assignLoading,
  onAssign,
  onClose,
  getAcademyName,
}: AssignModalProps) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-neutral-900 rounded-2xl w-full max-w-lg shadow-xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-neutral-200 dark:border-neutral-800 flex-shrink-0">
          <h2 className="text-lg font-bold text-black dark:text-white">학원 역할 할당</h2>
          <button
            onClick={onClose}
            className="p-1.5 text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          {/* 사용자 검색 */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">
              사용자
            </label>
            {selectedAssignUser ? (
              <div className="flex items-center justify-between px-3 py-2.5 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg">
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-black dark:text-white">
                    {selectedAssignUser.name || selectedAssignUser.nickname || '이름 없음'}
                  </span>
                  <span className="text-xs text-neutral-500">{selectedAssignUser.email}</span>
                </div>
                <button
                  onClick={() => {
                    setSelectedAssignUser(null);
                    setAssignUserId('');
                    setAssignSearchQuery('');
                  }}
                  className="p-1 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
                >
                  <X size={16} />
                </button>
              </div>
            ) : (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={16} />
                <input
                  type="text"
                  placeholder="이름, 이메일, 닉네임으로 검색..."
                  value={assignSearchQuery}
                  onChange={(e) => setAssignSearchQuery(e.target.value)}
                  onFocus={() => assignSearchQuery.length >= 1 && setShowUserDropdown(true)}
                  className="w-full pl-9 pr-4 py-2.5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg text-sm text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-primary dark:focus:ring-[#CCFF00]"
                />
                {showUserDropdown && userSearchResults.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {userSearchResults.map((u) => (
                      <button
                        key={u.id}
                        onClick={() => {
                          setSelectedAssignUser(u);
                          setAssignUserId(u.id);
                          setShowUserDropdown(false);
                          setAssignSearchQuery('');
                        }}
                        className="w-full text-left px-4 py-2.5 hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors border-b border-neutral-100 dark:border-neutral-700 last:border-b-0"
                      >
                        <div className="text-sm font-medium text-black dark:text-white">
                          {u.name || u.nickname || '이름 없음'}
                        </div>
                        <div className="text-xs text-neutral-500">{u.email}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 학원 다중 선택 */}
          <AcademyMultiSelect
            academies={academies}
            selections={academySelections}
            setSelections={setAcademySelections}
            searchQuery={academySearchQuery}
            setSearchQuery={setAcademySearchQuery}
            getAcademyName={getAcademyName}
            defaultRole="ACADEMY_MANAGER"
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
            onClick={onAssign}
            disabled={!assignUserId || academySelections.length === 0 || assignLoading}
            className="px-4 py-2 text-sm font-medium bg-primary dark:bg-[#CCFF00] text-black rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {assignLoading ? '할당 중...' : '할당하기'}
          </button>
        </div>
      </div>
    </div>
  );
}
