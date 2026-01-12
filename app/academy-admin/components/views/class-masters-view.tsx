"use client";

import { useState, useEffect } from 'react';
import { Plus, Settings, Lock, Unlock, BookOpen } from 'lucide-react';
import { SectionHeader } from '../common/section-header';
import { ClassMasterModal } from './class-masters/class-master-modal';
import { getSupabaseClient } from '@/lib/utils/supabase-client';
import { AccessConfig } from '@/types/database';

interface ClassMastersViewProps {
  academyId: string;
}

const DIFFICULTY_LABELS: Record<string, string> = {
  BEGINNER: '초급',
  INTERMEDIATE: '중급',
  ADVANCED: '고급',
};

const DIFFICULTY_COLORS: Record<string, string> = {
  BEGINNER: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  INTERMEDIATE: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  ADVANCED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

export function ClassMastersView({ academyId }: ClassMastersViewProps) {
  const [classMasters, setClassMasters] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedClass, setSelectedClass] = useState<any>(null);

  useEffect(() => {
    loadData();
  }, [academyId]);

  const loadData = async () => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('classes')
        .select(`
          *,
          instructors (
            id,
            name_kr,
            name_en
          ),
          halls (
            id,
            name
          )
        `)
        .eq('academy_id', academyId)
        .eq('is_canceled', false)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setClassMasters(data || []);
    } catch (error) {
      console.error('Error loading class masters:', error);
    } finally {
      setLoading(false);
    }
  };

  const getAccessConfigDisplay = (accessConfig: AccessConfig | null) => {
    if (!accessConfig) {
      return { icon: Unlock, text: '제한 없음', color: 'text-gray-500' };
    }
    
    if (accessConfig.requiredGroup) {
      return {
        icon: Lock,
        text: `${accessConfig.requiredGroup} 전용`,
        color: 'text-indigo-600 dark:text-indigo-400',
      };
    }
    
    if (!accessConfig.allowStandardCoupon) {
      return {
        icon: Lock,
        text: '쿠폰 불가',
        color: 'text-red-600 dark:text-red-400',
      };
    }
    
    return { icon: Unlock, text: '전체 허용', color: 'text-green-600 dark:text-green-400' };
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
      <div className="space-y-6">
        <SectionHeader
          title="클래스(반) 관리"
          buttonText="새 클래스 추가"
          onButtonClick={() => {
            setSelectedClass(null);
            setShowModal(true);
          }}
        />

        <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-sm border border-gray-100 dark:border-neutral-800 p-6">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            클래스(반)는 수업의 기본 정의입니다. 여기서 정의한 클래스를 기반으로 스케줄(세션)을 생성합니다.
          </p>
          
          {classMasters.length === 0 ? (
            <div className="text-center py-12">
              <BookOpen className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
              <p className="text-gray-500 dark:text-gray-400 mb-4">
                등록된 클래스가 없습니다.
              </p>
              <button
                onClick={() => {
                  setSelectedClass(null);
                  setShowModal(true);
                }}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus size={16} /> 첫 클래스 만들기
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {classMasters.map((classItem) => {
                const accessDisplay = getAccessConfigDisplay(classItem.access_config);
                const AccessIcon = accessDisplay.icon;
                
                return (
                  <div
                    key={classItem.id}
                    className="border dark:border-neutral-700 rounded-xl p-4 hover:border-blue-300 dark:hover:border-blue-600 transition-colors bg-white dark:bg-neutral-900 cursor-pointer group"
                    onClick={() => {
                      setSelectedClass(classItem);
                      setShowModal(true);
                    }}
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="font-bold text-gray-900 dark:text-white text-lg">
                          {classItem.title || '제목 없음'}
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {classItem.instructors?.name_kr || classItem.instructors?.name_en || '강사 미지정'}
                        </p>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedClass(classItem);
                          setShowModal(true);
                        }}
                        className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-opacity"
                      >
                        <Settings size={18} />
                      </button>
                    </div>

                    <div className="flex flex-wrap gap-2 mb-3">
                      {classItem.genre && (
                        <span className="text-xs px-2 py-1 bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-gray-400 rounded">
                          {classItem.genre}
                        </span>
                      )}
                      {classItem.difficulty_level && (
                        <span className={`text-xs px-2 py-1 rounded font-medium ${DIFFICULTY_COLORS[classItem.difficulty_level] || ''}`}>
                          {DIFFICULTY_LABELS[classItem.difficulty_level] || classItem.difficulty_level}
                        </span>
                      )}
                      {classItem.class_type && classItem.class_type !== 'regular' && (
                        <span className="text-xs px-2 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded">
                          {classItem.class_type}
                        </span>
                      )}
                    </div>

                    <div className={`flex items-center gap-1.5 text-xs ${accessDisplay.color}`}>
                      <AccessIcon size={14} />
                      <span>{accessDisplay.text}</span>
                      {classItem.access_config?.allowStandardCoupon && classItem.access_config?.requiredGroup && (
                        <span className="text-gray-400">| 쿠폰 가능</span>
                      )}
                    </div>

                    {classItem.halls?.name && (
                      <div className="mt-2 text-xs text-gray-400 dark:text-gray-500">
                        기본 홀: {classItem.halls.name}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <ClassMasterModal
          academyId={academyId}
          classData={selectedClass}
          onClose={() => {
            setShowModal(false);
            setSelectedClass(null);
            loadData();
          }}
        />
      )}
    </>
  );
}
