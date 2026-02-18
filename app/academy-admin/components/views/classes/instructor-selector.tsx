"use client";

import { useState, useEffect, useCallback } from 'react';
import { Search, Plus, User, X, Check } from 'lucide-react';

interface InstructorSelectorProps {
  academyId: string;
  selectedInstructorId: string;
  onSelect: (instructorId: string) => void;
}

export function InstructorSelector({
  academyId,
  selectedInstructorId,
  onSelect,
}: InstructorSelectorProps) {
  const [showSearch, setShowSearch] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [instructors, setInstructors] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showNewInstructorForm, setShowNewInstructorForm] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [newInstructorData, setNewInstructorData] = useState({
    name_kr: '',
    name_en: '',
    contact: '',
    email: '',
  });
  const [selectedInstructor, setSelectedInstructor] = useState<any>(null);

  const fetchInstructors = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/academy-admin/${academyId}/instructors/search?q=${encodeURIComponent(searchTerm)}`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '검색에 실패했습니다.');
      setInstructors(data.instructors ?? []);
    } catch (e) {
      console.error(e);
      setInstructors([]);
    } finally {
      setLoading(false);
    }
  }, [academyId, searchTerm]);

  useEffect(() => {
    if (!selectedInstructorId) {
      setSelectedInstructor(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/academy-admin/${academyId}/instructors/search?q=`
        );
        const data = await res.json();
        const list = data.instructors ?? [];
        const found = list.find((i: any) => i.id === selectedInstructorId);
        if (!cancelled) {
          setSelectedInstructor(found || { id: selectedInstructorId, name_kr: '선택된 강사' });
        }
      } catch {
        if (!cancelled) {
          setSelectedInstructor({ id: selectedInstructorId, name_kr: '선택된 강사' });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [academyId, selectedInstructorId]);

  useEffect(() => {
    if (!showSearch) return;
    fetchInstructors();
  }, [showSearch]);

  useEffect(() => {
    if (!showSearch) return;
    const t = setTimeout(() => fetchInstructors(), 300);
    return () => clearTimeout(t);
  }, [showSearch, searchTerm, fetchInstructors]);

  const handleSelectInstructor = (instructor: any) => {
    onSelect(instructor.id);
    setSelectedInstructor(instructor);
    setShowSearch(false);
    setSearchTerm('');
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
      const instructorId = data.instructorId;
      if (data.alreadyExists && data.alreadyInAcademy) {
        alert('이미 우리 학원에 등록된 강사입니다.');
      } else if (data.alreadyExists) {
        alert('이미 플랫폼에 등록된 강사입니다. 우리 학원에 추가했습니다.');
      } else {
        alert('강사가 등록되었습니다.');
      }
      onSelect(instructorId);
      setSelectedInstructor({
        id: instructorId,
        name_kr: newInstructorData.name_kr.trim(),
        name_en: newInstructorData.name_en.trim() || null,
      });
      setNewInstructorData({ name_kr: '', name_en: '', contact: '', email: '' });
      setShowNewInstructorForm(false);
      setShowSearch(false);
    } catch (e: any) {
      alert(e.message || '등록에 실패했습니다.');
    } finally {
      setRegistering(false);
    }
  };

  if (showNewInstructorForm) {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 dark:bg-black/60 backdrop-blur-sm">
        <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden max-h-[90vh] overflow-y-auto">
          <div className="p-6 border-b dark:border-neutral-800 flex justify-between items-center sticky top-0 bg-white dark:bg-neutral-900">
            <h3 className="text-xl font-bold text-gray-800 dark:text-white">강사 등록하기</h3>
            <button
              onClick={() => {
                setShowNewInstructorForm(false);
                setNewInstructorData({ name_kr: '', name_en: '', contact: '', email: '' });
              }}
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
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={() => {
                  setShowNewInstructorForm(false);
                  setNewInstructorData({ name_kr: '', name_en: '', contact: '', email: '' });
                }}
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

  if (showSearch) {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 dark:bg-black/60 backdrop-blur-sm">
        <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden max-h-[90vh] flex flex-col">
          <div className="p-6 border-b dark:border-neutral-800 flex justify-between items-center">
            <h3 className="text-xl font-bold text-gray-800 dark:text-white">강사 검색</h3>
            <button
              onClick={() => {
                setShowSearch(false);
                setSearchTerm('');
              }}
              className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <X size={20} />
            </button>
          </div>

          <div className="p-6 border-b dark:border-neutral-800">
            <div className="relative">
              <Search
                size={20}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500"
              />
              <input
                type="text"
                placeholder="이름으로 검색 (우리 학원 강사만)"
                className="w-full pl-10 pr-4 py-3 border dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-900 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 outline-none"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                autoFocus
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            {loading ? (
              <div className="text-center py-12 text-gray-500 dark:text-gray-400">로딩 중...</div>
            ) : instructors.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500 dark:text-gray-400 mb-4">
                  {searchTerm.trim() ? '검색 결과가 없습니다.' : '등록된 강사가 없습니다.'}
                </p>
                <button
                  onClick={() => setShowNewInstructorForm(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors"
                >
                  <Plus size={18} /> 강사 등록하기
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {instructors.map((instructor) => (
                  <button
                    key={instructor.id}
                    type="button"
                    onClick={() => handleSelectInstructor(instructor)}
                    className={`w-full flex items-center justify-between p-4 border dark:border-neutral-800 rounded-lg hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors text-left ${
                      selectedInstructorId === instructor.id
                        ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700'
                        : ''
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-gray-200 dark:bg-neutral-700 flex items-center justify-center shrink-0">
                        <User size={20} className="text-gray-500 dark:text-gray-400" />
                      </div>
                      <div>
                        <h4 className="font-bold text-gray-900 dark:text-white">
                          {instructor.name_kr || instructor.name_en || '이름 없음'}
                        </h4>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {instructor.name_kr && instructor.name_en
                            ? `${instructor.name_kr} (${instructor.name_en})`
                            : instructor.name_en || instructor.name_kr || ''}
                        </p>
                      </div>
                    </div>
                    {selectedInstructorId === instructor.id && (
                      <Check size={20} className="text-blue-600 dark:text-blue-400 shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="p-6 border-t dark:border-neutral-800">
            <button
              onClick={() => setShowNewInstructorForm(true)}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed dark:border-neutral-700 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors font-medium"
            >
              <Plus size={18} /> 강사 등록하기 (이름·연락처·이메일)
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        강사
      </label>
      <button
        type="button"
        onClick={() => setShowSearch(true)}
        className="w-full border dark:border-neutral-700 rounded-lg px-3 py-2 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white text-left flex items-center justify-between hover:border-blue-500 dark:hover:border-blue-400 transition-colors"
      >
        <span
          className={
            selectedInstructor ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'
          }
        >
          {selectedInstructor
            ? selectedInstructor.name_kr || selectedInstructor.name_en || '선택된 강사'
            : '강사 검색 및 선택'}
        </span>
        <Search size={16} className="text-gray-400 dark:text-gray-500" />
      </button>
      {selectedInstructor && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onSelect('');
            setSelectedInstructor(null);
          }}
          className="mt-2 text-xs text-red-600 dark:text-red-400 hover:underline"
        >
          선택 해제
        </button>
      )}
    </div>
  );
}
