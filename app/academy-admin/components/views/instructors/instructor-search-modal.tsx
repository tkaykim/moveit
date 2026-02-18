"use client";

import { useState, useEffect, useCallback } from 'react';
import { X, Search, Plus, User } from 'lucide-react';

interface InstructorSearchModalProps {
  academyId: string;
  onClose: () => void;
  onInstructorRegistered: () => void;
}

export function InstructorSearchModal({
  academyId,
  onClose,
  onInstructorRegistered,
}: InstructorSearchModalProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [instructors, setInstructors] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [showNewInstructorForm, setShowNewInstructorForm] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [newInstructorData, setNewInstructorData] = useState({
    name_kr: '',
    name_en: '',
    contact: '',
    email: '',
  });

  const fetchInstructors = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/academy-admin/${academyId}/instructors/search?q=${encodeURIComponent(searchTerm)}`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '검색에 실패했습니다.');
      setInstructors(data.instructors ?? []);
    } catch (e: any) {
      console.error(e);
      setInstructors([]);
    } finally {
      setLoading(false);
    }
  }, [academyId, searchTerm]);

  useEffect(() => {
    const t = setTimeout(() => {
      fetchInstructors();
    }, 300);
    return () => clearTimeout(t);
  }, [fetchInstructors]);

  const handleSelectInstructor = (instructor: any) => {
    onInstructorRegistered();
    onClose();
  };

  const handleCreateNewInstructor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newInstructorData.name_kr.trim()) {
      alert('이름(한글)을 입력해 주세요.');
      return;
    }
    setRegistering(true);
    try {
      const res = await fetch(`/api/academy-admin/${academyId}/instructors/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name_kr: newInstructorData.name_kr.trim(),
          name_en: newInstructorData.name_en.trim() || null,
          contact: newInstructorData.contact.trim() || null,
          email: newInstructorData.email.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || '등록에 실패했습니다.');
        return;
      }
      if (data.alreadyExists && data.alreadyInAcademy) {
        alert('이미 우리 학원에 등록된 강사입니다.');
      } else if (data.alreadyExists) {
        alert('이미 플랫폼에 등록된 강사입니다. 우리 학원에 추가했습니다.');
      } else {
        alert('강사가 등록되었습니다.');
      }
      onInstructorRegistered();
      onClose();
    } catch (e: any) {
      alert(e.message || '등록에 실패했습니다.');
    } finally {
      setRegistering(false);
    }
  };

  if (showNewInstructorForm) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 dark:bg-black/60 backdrop-blur-sm">
        <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden max-h-[90vh] overflow-y-auto">
          <div className="p-6 border-b dark:border-neutral-800 flex justify-between items-center sticky top-0 bg-white dark:bg-neutral-900">
            <h3 className="text-xl font-bold text-gray-800 dark:text-white">강사 등록하기</h3>
            <button
              onClick={() => setShowNewInstructorForm(false)}
              className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleCreateNewInstructor} className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                이름 (한글) *
              </label>
              <input
                type="text"
                required
                className="w-full border dark:border-neutral-700 rounded-lg px-3 py-2 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
                value={newInstructorData.name_kr}
                onChange={(e) =>
                  setNewInstructorData({ ...newInstructorData, name_kr: e.target.value })
                }
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                이름 (영문)
              </label>
              <input
                type="text"
                className="w-full border dark:border-neutral-700 rounded-lg px-3 py-2 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
                value={newInstructorData.name_en}
                onChange={(e) =>
                  setNewInstructorData({ ...newInstructorData, name_en: e.target.value })
                }
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                연락처
              </label>
              <input
                type="text"
                className="w-full border dark:border-neutral-700 rounded-lg px-3 py-2 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
                value={newInstructorData.contact}
                onChange={(e) =>
                  setNewInstructorData({ ...newInstructorData, contact: e.target.value })
                }
                placeholder="010-0000-0000"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                이메일 주소
              </label>
              <input
                type="email"
                className="w-full border dark:border-neutral-700 rounded-lg px-3 py-2 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
                value={newInstructorData.email}
                onChange={(e) =>
                  setNewInstructorData({ ...newInstructorData, email: e.target.value })
                }
                placeholder="instructor@example.com"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                이미 등록된 이메일이면 우리 학원에만 추가됩니다. (이중 등록 방지)
              </p>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={() => setShowNewInstructorForm(false)}
                className="flex-1 px-4 py-2 border dark:border-neutral-700 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors"
              >
                취소
              </button>
              <button
                type="submit"
                disabled={registering}
                className="flex-1 px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors disabled:opacity-50"
              >
                {registering ? '등록 중...' : '등록'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 dark:bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden">
        <div className="p-6 border-b dark:border-neutral-800 flex justify-between items-center">
          <h3 className="text-xl font-bold text-gray-800 dark:text-white">강사 검색 및 등록</h3>
          <button
            onClick={onClose}
            className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6">
          <div className="relative">
            <Search
              size={20}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500"
            />
            <input
              type="text"
              placeholder="이름으로 검색 (우리 학원 강사만 표시)"
              className="w-full pl-10 pr-4 py-3 border dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-900 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 outline-none"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onFocus={() => setDropdownOpen(true)}
            />
            {dropdownOpen && (
              <>
                <div
                  className="fixed inset-0 z-0"
                  aria-hidden
                  onClick={() => setDropdownOpen(false)}
                />
                <div className="absolute top-full left-0 right-0 mt-1 z-10 rounded-lg border dark:border-neutral-700 bg-white dark:bg-neutral-900 shadow-lg max-h-64 overflow-y-auto">
                  {loading ? (
                    <div className="p-4 text-center text-gray-500 dark:text-gray-400">
                      검색 중...
                    </div>
                  ) : instructors.length === 0 ? (
                    <div className="p-4 text-center">
                      <p className="text-gray-500 dark:text-gray-400 mb-3">
                        {searchTerm.trim()
                          ? '검색 결과가 없습니다.'
                          : '등록된 강사가 없습니다.'}
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setDropdownOpen(false);
                          setShowNewInstructorForm(true);
                        }}
                        className="inline-flex items-center gap-2 px-3 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 text-sm"
                      >
                        <Plus size={16} /> 강사 등록하기
                      </button>
                    </div>
                  ) : (
                    instructors.map((instructor) => (
                      <button
                        key={instructor.id}
                        type="button"
                        onClick={() => handleSelectInstructor(instructor)}
                        className="w-full flex items-center gap-3 p-3 text-left hover:bg-gray-50 dark:hover:bg-neutral-800 border-b dark:border-neutral-700 last:border-0"
                      >
                        <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-neutral-700 flex items-center justify-center shrink-0">
                          <User size={18} className="text-gray-500 dark:text-gray-400" />
                        </div>
                        <div>
                          <div className="font-medium text-gray-900 dark:text-white">
                            {instructor.name_kr || instructor.name_en || '이름 없음'}
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            {instructor.name_kr && instructor.name_en
                              ? `${instructor.name_kr} (${instructor.name_en})`
                              : instructor.name_en || instructor.name_kr || ''}
                          </div>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </>
            )}
          </div>

          <div className="mt-4">
            <button
              type="button"
              onClick={() => setShowNewInstructorForm(true)}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed dark:border-neutral-700 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors font-medium"
            >
              <Plus size={18} /> 강사 등록하기 (이름·연락처·이메일)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
