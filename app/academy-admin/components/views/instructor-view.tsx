"use client";

import { useState, useEffect } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { SectionHeader } from '../common/section-header';
import { StatusBadge } from '../common/status-badge';
import { InstructorModal } from './instructors/instructor-modal';
import { InstructorSearchModal } from './instructors/instructor-search-modal';
import { getSupabaseClient } from '@/lib/utils/supabase-client';

interface InstructorViewProps {
  academyId: string;
}

export function InstructorView({ academyId }: InstructorViewProps) {
  const [instructors, setInstructors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [selectedInstructor, setSelectedInstructor] = useState<any>(null);
  const [modalInitialMode, setModalInitialMode] = useState<'view' | 'edit'>('view');

  useEffect(() => {
    loadInstructors();
  }, [academyId]);

  const loadInstructors = async () => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      setLoading(false);
      return;
    }

    try {
      // 먼저 academy_instructors 테이블에서 조회 시도
      let instructorIds: string[] = [];
      
      try {
        const { data: academyInstructors, error: academyError } = await supabase
          .from('academy_instructors')
          .select('instructor_id')
          .eq('academy_id', academyId)
          .eq('is_active', true);

        if (!academyError && academyInstructors) {
          instructorIds = academyInstructors.map((ai: any) => ai.instructor_id);
        }
      } catch (error: any) {
        // academy_instructors 테이블이 없으면 classes 테이블로 fallback
        if (error.code === '42P01') {
          const { data: classes } = await supabase
            .from('classes')
            .select('instructor_id')
            .eq('academy_id', academyId);

          instructorIds = [...new Set((classes || []).map((c: any) => c.instructor_id).filter(Boolean))] as string[];
        } else {
          throw error;
        }
      }

      if (instructorIds.length === 0) {
        setInstructors([]);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('instructors')
        .select(`
          *,
          classes!classes_instructor_id_fkey (
            id,
            start_time,
            academy_id
          )
        `)
        .in('id', instructorIds);

      if (error) throw error;

      // 이번 달 수업 수 계산
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      const instructorsWithStats = (data || []).map((instructor: any) => {
        // 해당 학원의 클래스만 필터링
        const academyClasses = (instructor.classes || []).filter((c: any) => c.academy_id === academyId);
        const thisMonthClasses = academyClasses.filter((c: any) => {
          if (!c.start_time) return false;
          const classDate = new Date(c.start_time);
          return classDate >= startOfMonth && classDate <= endOfMonth;
        });

        return {
          ...instructor,
          classesCount: academyClasses.length,
          thisMonthClasses: thisMonthClasses.length,
          estimatedSalary: thisMonthClasses.length * 300000, // 임시 계산 (실제로는 정산 테이블에서 가져와야 함)
        };
      });

      setInstructors(instructorsWithStats);
    } catch (error) {
      console.error('Error loading instructors:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (instructor: any) => {
    const confirmed = window.confirm(
      `"${instructor.name_kr || instructor.name_en || '강사'}"를 삭제하시겠습니까?\n\n이 학원에서의 강사 연결이 해제되고, 강사 정보가 삭제됩니다.`
    );
    if (!confirmed) return;

    const supabase = getSupabaseClient();
    if (!supabase) return;

    try {
      await supabase
        .from('academy_instructors')
        .delete()
        .eq('academy_id', academyId)
        .eq('instructor_id', instructor.id);

      await supabase
        .from('instructors')
        .delete()
        .eq('id', instructor.id);

      alert('강사가 삭제되었습니다.');
      loadInstructors();
    } catch (error: any) {
      console.error('Error deleting instructor:', error);
      alert(`강사 삭제에 실패했습니다: ${error.message}`);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500 dark:text-gray-400">로딩 중...</div>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6" data-onboarding="page-instructors-0">
        <SectionHeader
          title="강사 관리 및 정산"
          buttonText="강사 등록"
          onButtonClick={() => {
            setShowSearchModal(true);
          }}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {instructors.length === 0 ? (
            <div className="col-span-full text-center py-12 text-gray-500 dark:text-gray-400">
              등록된 강사가 없습니다.
            </div>
          ) : (
            instructors.map((instructor) => (
              <div
                key={instructor.id}
                className="bg-white dark:bg-neutral-900 rounded-xl shadow-sm border border-gray-100 dark:border-neutral-800 p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-gray-200 dark:bg-neutral-800 flex items-center justify-center font-bold text-gray-600 dark:text-gray-400 text-lg">
                      {(instructor.name_kr || instructor.name_en || 'U')[0]}
                    </div>
                    <div>
                      <h3 className="font-bold text-lg text-gray-900 dark:text-white">
                        {instructor.name_kr || instructor.name_en || '-'}
                      </h3>
                      <p className="text-sm text-blue-600 dark:text-blue-400">
                        {instructor.specialties || '-'}
                      </p>
                    </div>
                  </div>
                  <StatusBadge status="Active" />
                </div>

                <div className="space-y-3 border-t dark:border-neutral-800 pt-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500 dark:text-gray-400">주력 장르</span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {instructor.specialties?.split(',')[0] || '-'}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500 dark:text-gray-400">이번 달 수업</span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {instructor.thisMonthClasses || 0} 강
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500 dark:text-gray-400">예상 정산금</span>
                    <span className="font-bold text-gray-900 dark:text-white">
                      ₩ {(instructor.estimatedSalary || 0).toLocaleString()}
                    </span>
                  </div>
                </div>

                <div className="mt-6 space-y-2">
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setSelectedInstructor(instructor);
                        setModalInitialMode('view');
                        setShowModal(true);
                      }}
                      className="flex-1 py-2 border dark:border-neutral-700 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-neutral-800 text-gray-700 dark:text-gray-300 transition-colors"
                    >
                      상세 프로필
                    </button>
                    <button className="flex-1 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors">
                      정산 명세서
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setSelectedInstructor(instructor);
                        setModalInitialMode('edit');
                        setShowModal(true);
                      }}
                      className="flex-1 py-2 border border-yellow-300 dark:border-yellow-700 rounded-lg text-sm hover:bg-yellow-50 dark:hover:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 transition-colors flex items-center justify-center gap-1.5"
                    >
                      <Pencil size={14} />
                      수정
                    </button>
                    <button
                      onClick={() => handleDelete(instructor)}
                      className="flex-1 py-2 border border-red-300 dark:border-red-700 rounded-lg text-sm hover:bg-red-50 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 transition-colors flex items-center justify-center gap-1.5"
                    >
                      <Trash2 size={14} />
                      삭제
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {showModal && (
        <InstructorModal
          academyId={academyId}
          instructor={selectedInstructor}
          initialMode={modalInitialMode}
          onClose={() => {
            setShowModal(false);
            setSelectedInstructor(null);
            setModalInitialMode('view');
            loadInstructors();
          }}
          onDelete={selectedInstructor ? () => handleDelete(selectedInstructor) : undefined}
        />
      )}

      {showSearchModal && (
        <InstructorSearchModal
          academyId={academyId}
          onClose={() => {
            setShowSearchModal(false);
          }}
          onInstructorRegistered={() => {
            loadInstructors();
          }}
        />
      )}
    </>
  );
}
