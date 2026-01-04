"use client";

import { useState, useEffect } from 'react';
import { Search, Plus, User, X, Check } from 'lucide-react';
import { getSupabaseClient } from '@/lib/utils/supabase-client';

interface InstructorSelectorProps {
  academyId: string;
  selectedInstructorId: string;
  onSelect: (instructorId: string) => void;
}

export function InstructorSelector({ academyId, selectedInstructorId, onSelect }: InstructorSelectorProps) {
  const [showSearch, setShowSearch] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [instructors, setInstructors] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showNewInstructorForm, setShowNewInstructorForm] = useState(false);
  const [newInstructorData, setNewInstructorData] = useState({
    name_kr: '',
    name_en: '',
    bio: '',
    specialties: '',
    instagram_url: '',
  });
  const [selectedInstructor, setSelectedInstructor] = useState<any>(null);

  useEffect(() => {
    if (selectedInstructorId) {
      loadSelectedInstructor();
    }
  }, [selectedInstructorId]);

  const loadSelectedInstructor = async () => {
    if (!selectedInstructorId) return;
    
    const supabase = getSupabaseClient();
    if (!supabase) return;

    try {
      const { data, error } = await supabase
        .from('instructors')
        .select('*')
        .eq('id', selectedInstructorId)
        .single();

      if (!error && data) {
        setSelectedInstructor(data);
      }
    } catch (error) {
      console.error('Error loading instructor:', error);
    }
  };

  const loadInstructors = async () => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      let query = supabase.from('instructors').select('*').order('created_at', { ascending: false });

      if (searchTerm) {
        query = query.or(`name_kr.ilike.%${searchTerm}%,name_en.ilike.%${searchTerm}%`);
      }

      const { data, error } = await query.limit(50);

      if (error) throw error;
      setInstructors(data || []);
    } catch (error) {
      console.error('Error loading instructors:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (showSearch) {
      loadInstructors();
    }
  }, [showSearch]);

  useEffect(() => {
    if (showSearch && searchTerm !== undefined) {
      const timeoutId = setTimeout(() => {
        loadInstructors();
      }, 300);

      return () => clearTimeout(timeoutId);
    }
  }, [searchTerm]);

  const handleSelectInstructor = (instructor: any) => {
    onSelect(instructor.id);
    setSelectedInstructor(instructor);
    setShowSearch(false);
    setSearchTerm('');
  };

  const handleCreateNewInstructor = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = getSupabaseClient();
    if (!supabase) {
      alert('데이터베이스 연결에 실패했습니다.');
      return;
    }

    try {
      const { data: newInstructor, error } = await supabase
        .from('instructors')
        .insert([newInstructorData])
        .select()
        .single();

      if (error) throw error;

      // 새로 생성된 강사 선택
      handleSelectInstructor(newInstructor);
      
      // 폼 초기화
      setNewInstructorData({
        name_kr: '',
        name_en: '',
        bio: '',
        specialties: '',
        instagram_url: '',
      });
      setShowNewInstructorForm(false);
    } catch (error: any) {
      console.error('Error creating instructor:', error);
      alert(`강사 등록에 실패했습니다: ${error.message}`);
    }
  };

  const filteredInstructors = instructors.filter((instructor) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      instructor.name_kr?.toLowerCase().includes(term) ||
      instructor.name_en?.toLowerCase().includes(term)
    );
  });

  if (showNewInstructorForm) {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 dark:bg-black/60 backdrop-blur-sm">
        <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden max-h-[90vh] overflow-y-auto">
          <div className="p-6 border-b dark:border-neutral-800 flex justify-between items-center sticky top-0 bg-white dark:bg-neutral-900">
            <h3 className="text-xl font-bold text-gray-800 dark:text-white">신규 강사 등록</h3>
            <button
              onClick={() => {
                setShowNewInstructorForm(false);
                setNewInstructorData({
                  name_kr: '',
                  name_en: '',
                  bio: '',
                  specialties: '',
                  instagram_url: '',
                });
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
                onChange={(e) => setNewInstructorData({ ...newInstructorData, name_kr: e.target.value })}
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
                onChange={(e) => setNewInstructorData({ ...newInstructorData, name_en: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                전문 분야
              </label>
              <input
                type="text"
                className="w-full border dark:border-neutral-700 rounded-lg px-3 py-2 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
                value={newInstructorData.specialties}
                onChange={(e) => setNewInstructorData({ ...newInstructorData, specialties: e.target.value })}
                placeholder="예: Hip-hop, Choreography"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                인스타그램 URL
              </label>
              <input
                type="url"
                className="w-full border dark:border-neutral-700 rounded-lg px-3 py-2 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
                value={newInstructorData.instagram_url}
                onChange={(e) => setNewInstructorData({ ...newInstructorData, instagram_url: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                소개
              </label>
              <textarea
                className="w-full border dark:border-neutral-700 rounded-lg px-3 py-2 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
                rows={4}
                value={newInstructorData.bio}
                onChange={(e) => setNewInstructorData({ ...newInstructorData, bio: e.target.value })}
              />
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={() => {
                  setShowNewInstructorForm(false);
                  setNewInstructorData({
                    name_kr: '',
                    name_en: '',
                    bio: '',
                    specialties: '',
                    instagram_url: '',
                  });
                }}
                className="flex-1 px-4 py-2 border dark:border-neutral-700 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors"
              >
                취소
              </button>
              <button
                type="submit"
                className="flex-1 px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors"
              >
                등록
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
        <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl max-w-3xl w-full overflow-hidden max-h-[90vh] flex flex-col">
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
                className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500"
              />
              <input
                type="text"
                placeholder="댄서 이름으로 검색..."
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
            ) : filteredInstructors.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500 dark:text-gray-400 mb-4">
                  {searchTerm ? '검색 결과가 없습니다.' : '등록된 강사가 없습니다.'}
                </p>
                <button
                  onClick={() => setShowNewInstructorForm(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors"
                >
                  <Plus size={18} /> 신규 강사 추가하기
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredInstructors.map((instructor) => (
                  <div
                    key={instructor.id}
                    className={`flex items-center justify-between p-4 border dark:border-neutral-800 rounded-lg hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors cursor-pointer ${
                      selectedInstructorId === instructor.id ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700' : ''
                    }`}
                    onClick={() => handleSelectInstructor(instructor)}
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-gray-200 dark:bg-neutral-700 flex items-center justify-center">
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
                        {instructor.specialties && (
                          <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                            {instructor.specialties}
                          </p>
                        )}
                      </div>
                    </div>
                    {selectedInstructorId === instructor.id && (
                      <Check size={20} className="text-blue-600 dark:text-blue-400" />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="p-6 border-t dark:border-neutral-800">
            <button
              onClick={() => setShowNewInstructorForm(true)}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed dark:border-neutral-700 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors font-medium"
            >
              <Plus size={18} /> 신규 강사 추가하기
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
        <span className={selectedInstructor ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}>
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







