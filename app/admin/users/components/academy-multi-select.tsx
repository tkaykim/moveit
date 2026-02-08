'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { Search, X, Check, ChevronDown, Building2 } from 'lucide-react';
import { Academy, AcademyRole, AcademySelection } from '../types';

interface AcademyMultiSelectProps {
  academies: Academy[];
  selections: AcademySelection[];
  setSelections: (s: AcademySelection[]) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  getAcademyName: (id: string) => string;
  defaultRole: AcademyRole;
}

export default function AcademyMultiSelect({
  academies,
  selections,
  setSelections,
  searchQuery,
  setSearchQuery,
  getAcademyName,
  defaultRole,
}: AcademyMultiSelectProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 외부 클릭 감지로 드롭다운 닫기
  useEffect(() => {
    if (!isDropdownOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isDropdownOpen]);

  const filteredAcademies = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return academies.filter((a) => {
      if (!q) return true;
      return a.name_kr?.toLowerCase().includes(q);
    });
  }, [academies, searchQuery]);

  const isSelected = (academyId: string) => {
    return selections.some((s) => s.academy_id === academyId);
  };

  const toggleAcademy = (academyId: string) => {
    if (isSelected(academyId)) {
      setSelections(selections.filter((s) => s.academy_id !== academyId));
    } else {
      setSelections([...selections, { academy_id: academyId, role: defaultRole }]);
    }
  };

  const updateRole = (academyId: string, role: AcademyRole) => {
    setSelections(
      selections.map((s) => (s.academy_id === academyId ? { ...s, role } : s))
    );
  };

  const removeSelection = (academyId: string) => {
    setSelections(selections.filter((s) => s.academy_id !== academyId));
  };

  return (
    <div>
      <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">
        담당 학원
      </label>

      {/* 선택된 학원 목록 */}
      {selections.length > 0 && (
        <div className="mb-3 space-y-2">
          {selections.map((sel) => (
            <div
              key={sel.academy_id}
              className="flex items-center justify-between px-3 py-2 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg"
            >
              <div className="flex items-center gap-2 min-w-0">
                <Building2 size={14} className="text-neutral-500 flex-shrink-0" />
                <span className="text-sm text-black dark:text-white truncate">
                  {getAcademyName(sel.academy_id)}
                </span>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                <select
                  value={sel.role}
                  onChange={(e) => updateRole(sel.academy_id, e.target.value as AcademyRole)}
                  className="px-2 py-1 text-xs border border-neutral-300 dark:border-neutral-600 rounded bg-white dark:bg-neutral-900 text-black dark:text-white focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="ACADEMY_OWNER">관리자</option>
                  <option value="ACADEMY_MANAGER">매니저</option>
                </select>
                <button
                  onClick={() => removeSelection(sel.academy_id)}
                  className="p-0.5 text-neutral-400 hover:text-red-500 transition-colors"
                  title="제거"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 학원 검색 & 드롭다운 */}
      <div className="relative" ref={dropdownRef}>
        <div
          className="flex items-center border border-neutral-200 dark:border-neutral-700 rounded-lg overflow-hidden cursor-text"
          onClick={() => setIsDropdownOpen(true)}
        >
          <Search className="ml-3 text-neutral-400 flex-shrink-0" size={16} />
          <input
            type="text"
            placeholder="학원 검색..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setIsDropdownOpen(true);
            }}
            onFocus={() => setIsDropdownOpen(true)}
            className="w-full px-3 py-2.5 bg-transparent text-sm text-black dark:text-white focus:outline-none"
          />
          <ChevronDown
            size={16}
            className={`mr-3 text-neutral-400 flex-shrink-0 transition-transform ${
              isDropdownOpen ? 'rotate-180' : ''
            }`}
          />
        </div>

        {isDropdownOpen && (
          <div className="absolute z-20 w-full mt-1 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg shadow-lg max-h-52 overflow-y-auto">
            {filteredAcademies.length === 0 ? (
              <div className="px-4 py-3 text-sm text-neutral-500">검색 결과가 없습니다.</div>
            ) : (
              filteredAcademies.map((academy) => {
                const selected = isSelected(academy.id);
                return (
                  <button
                    key={academy.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleAcademy(academy.id);
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors border-b border-neutral-100 dark:border-neutral-700 last:border-b-0 ${
                      selected
                        ? 'bg-primary/10 dark:bg-[#CCFF00]/10'
                        : 'hover:bg-neutral-50 dark:hover:bg-neutral-700'
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                        selected
                          ? 'border-primary dark:border-[#CCFF00] bg-primary dark:bg-[#CCFF00]'
                          : 'border-neutral-300 dark:border-neutral-600'
                      }`}
                    >
                      {selected && <Check size={10} className="text-white dark:text-black" />}
                    </div>
                    <span className="text-sm text-black dark:text-white">{academy.name_kr}</span>
                  </button>
                );
              })
            )}
          </div>
        )}
      </div>

      {selections.length > 0 && (
        <div className="mt-2 text-xs text-neutral-500">
          {selections.length}개 학원 선택됨
        </div>
      )}
    </div>
  );
}
