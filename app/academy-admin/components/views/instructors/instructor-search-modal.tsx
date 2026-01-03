"use client";

import { useState, useEffect } from 'react';
import { X, Search, Plus, User } from 'lucide-react';
import { getSupabaseClient } from '@/lib/utils/supabase-client';

interface InstructorSearchModalProps {
  academyId: string;
  onClose: () => void;
  onInstructorRegistered: () => void;
}

export function InstructorSearchModal({ academyId, onClose, onInstructorRegistered }: InstructorSearchModalProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [instructors, setInstructors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState<string | null>(null);
  const [showNewInstructorForm, setShowNewInstructorForm] = useState(false);
  const [newInstructorData, setNewInstructorData] = useState({
    name_kr: '',
    name_en: '',
    bio: '',
    specialties: '',
    instagram_url: '',
  });

  useEffect(() => {
    loadInstructors();
  }, []);

  const loadInstructors = async () => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      setLoading(false);
      return;
    }

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
    const timeoutId = setTimeout(() => {
      loadInstructors();
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchTerm]);

  const checkInstructorRegistered = async (instructorId: string): Promise<boolean> => {
    const supabase = getSupabaseClient();
    if (!supabase) return false;

    try {
      // 먼저 academy_instructors 테이블 확인
      const { data: academyInstructor, error: academyError } = await supabase
        .from('academy_instructors')
        .select('id')
        .eq('academy_id', academyId)
        .eq('instructor_id', instructorId)
        .limit(1);

      // academy_instructors 테이블이 없으면 classes 테이블로 확인
      if (academyError && academyError.code === '42P01') {
        const { data: classData, error: classError } = await supabase
          .from('classes')
          .select('id')
          .eq('academy_id', academyId)
          .eq('instructor_id', instructorId)
          .limit(1);

        if (classError) throw classError;
        return (classData || []).length > 0;
      }

      if (academyError) throw academyError;
      return (academyInstructor || []).length > 0;
    } catch (error) {
      console.error('Error checking instructor:', error);
      return false;
    }
  };

  const handleRegisterInstructor = async (instructor: any) => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      alert('데이터베이스 연결에 실패했습니다.');
      return;
    }

    setRegistering(instructor.id);

    try {
      // 이미 등록되어 있는지 확인
      const isRegistered = await checkInstructorRegistered(instructor.id);
      
      if (isRegistered) {
        alert('이미 등록된 강사입니다.');
        setRegistering(null);
        return;
      }

      // 확인 메시지
      const confirmed = window.confirm(
        `${instructor.name_kr || instructor.name_en || '이 강사'}를 학원 강사로 등록하시겠습니까?`
      );

      if (!confirmed) {
        setRegistering(null);
        return;
      }

      // academy_instructors 테이블에 등록 시도
      try {
        const { error: insertError } = await supabase
          .from('academy_instructors')
          .insert([
            {
              academy_id: academyId,
              instructor_id: instructor.id,
              is_active: true,
            },
          ]);

        // 테이블이 없으면 무시하고 계속 진행 (기존 방식으로 작동)
        if (insertError && insertError.code !== '42P01') {
          throw insertError;
        }

        alert('강사가 등록되었습니다.');
        onInstructorRegistered();
        onClose();
      } catch (error: any) {
        // academy_instructors 테이블이 없는 경우, 기존 방식으로 작동
        if (error.code === '42P01') {
          alert('강사가 등록되었습니다. 이제 클래스를 생성할 때 이 강사를 선택할 수 있습니다.');
          onInstructorRegistered();
          onClose();
        } else {
          throw error;
        }
      }
    } catch (error: any) {
      console.error('Error registering instructor:', error);
      alert(`강사 등록에 실패했습니다: ${error.message}`);
    } finally {
      setRegistering(null);
    }
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

      alert('강사가 등록되었습니다.');
      
      // 새로 생성된 강사를 자동으로 학원에 등록
      await handleRegisterInstructor(newInstructor);
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
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 dark:bg-black/60 backdrop-blur-sm">
        <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden max-h-[90vh] overflow-y-auto">
          <div className="p-6 border-b dark:border-neutral-800 flex justify-between items-center sticky top-0 bg-white dark:bg-neutral-900">
            <h3 className="text-xl font-bold text-gray-800 dark:text-white">신규 강사 등록</h3>
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
                onClick={() => setShowNewInstructorForm(false)}
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 dark:bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl max-w-3xl w-full overflow-hidden max-h-[90vh] flex flex-col">
        <div className="p-6 border-b dark:border-neutral-800 flex justify-between items-center">
          <h3 className="text-xl font-bold text-gray-800 dark:text-white">강사 검색 및 등록</h3>
          <button
            onClick={onClose}
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
                  className="flex items-center justify-between p-4 border dark:border-neutral-800 rounded-lg hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors"
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
                  <button
                    onClick={() => handleRegisterInstructor(instructor)}
                    disabled={registering === instructor.id}
                    className="px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                  >
                    {registering === instructor.id ? '등록 중...' : '선택'}
                  </button>
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

