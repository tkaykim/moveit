"use client";

import { useState, useEffect } from 'react';
import { Plus, Settings, Lock, Unlock, BookOpen, ToggleLeft, ToggleRight } from 'lucide-react';
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

type FilterTab = 'all' | 'active' | 'inactive';
type ClassTypeFilter = 'all' | 'regular' | 'popup' | 'workshop';

export function ClassMastersView({ academyId }: ClassMastersViewProps) {
  const [classMasters, setClassMasters] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedClass, setSelectedClass] = useState<any>(null);
  const [filterTab, setFilterTab] = useState<FilterTab>('active');
  const [classTypeFilter, setClassTypeFilter] = useState<ClassTypeFilter>('all');

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

  const toggleClassActive = async (e: React.MouseEvent, classItem: any) => {
    e.stopPropagation();
    const supabase = getSupabaseClient();
    if (!supabase) return;

    const newIsActive = !(classItem.is_active !== false);

    try {
      const { error } = await supabase
        .from('classes')
        .update({ is_active: newIsActive })
        .eq('id', classItem.id);

      if (error) throw error;
      
      // 로컬 상태 업데이트
      setClassMasters((prev) =>
        prev.map((c) =>
          c.id === classItem.id ? { ...c, is_active: newIsActive } : c
        )
      );
    } catch (error) {
      console.error('Error toggling class active status:', error);
      alert('활성화 상태 변경에 실패했습니다.');
    }
  };

  // 필터링된 클래스 목록
  const filteredClasses = classMasters.filter((classItem) => {
    const isActive = classItem.is_active !== false; // null이나 true면 활성화로 간주
    
    // 활성화 필터
    if (filterTab === 'active' && !isActive) return false;
    if (filterTab === 'inactive' && isActive) return false;
    
    // 클래스 유형 필터
    if (classTypeFilter !== 'all') {
      const classType = classItem.class_type || 'regular';
      // 정규화: 기존 값들을 세 가지 유형으로 매핑
      const normalizedType = 
        classType === 'regular' || classType === 'REGULAR' ? 'regular' :
        classType === 'popup' ? 'popup' :
        'workshop'; // 기타 모든 값은 workshop으로 처리
      
      if (normalizedType !== classTypeFilter) return false;
    }
    
    return true;
  });
  
  // 유형별 개수 계산
  const regularCount = classMasters.filter(c => {
    const type = c.class_type || 'regular';
    return type === 'regular' || type === 'REGULAR';
  }).length;
  const popupCount = classMasters.filter(c => c.class_type === 'popup').length;
  const workshopCount = classMasters.filter(c => {
    const type = c.class_type;
    return type && type !== 'regular' && type !== 'REGULAR' && type !== 'popup';
  }).length;

  // 각 탭별 카운트
  const activeCount = classMasters.filter((c) => c.is_active !== false).length;
  const inactiveCount = classMasters.filter((c) => c.is_active === false).length;

  const getAccessConfigDisplay = (classItem: any) => {
    const classType = classItem.class_type || 'regular';
    const accessConfig = classItem.access_config as AccessConfig | null;
    
    // access_config에서 허용 설정 확인
    const allowRegular = accessConfig?.allowRegularTicket !== false;
    const allowCoupon = accessConfig?.allowCoupon === true;
    const allowPopup = accessConfig?.allowPopup === true || allowCoupon; // 쿠폰 허용 = 팝업 허용
    const allowWorkshop = accessConfig?.allowWorkshop === true;
    
    // 허용되는 수강권 목록 생성
    const allowedTypes: string[] = [];
    if (allowRegular) allowedTypes.push('정규');
    if (allowPopup) allowedTypes.push('팝업');
    if (allowWorkshop) allowedTypes.push('워크샵');
    
    // 클래스 타입별 기본 색상
    const typeColors: Record<string, { color: string; icon: typeof Lock | typeof Unlock }> = {
      regular: { color: 'text-blue-600 dark:text-blue-400', icon: Unlock },
      popup: { color: 'text-purple-600 dark:text-purple-400', icon: Unlock },
      workshop: { color: 'text-amber-600 dark:text-amber-400', icon: Unlock },
    };
    
    // 특정 그룹 전용인 경우
    if (accessConfig?.requiredGroup) {
      return {
        icon: Lock,
        text: `${accessConfig.requiredGroup} 전용`,
        color: 'text-indigo-600 dark:text-indigo-400',
        allowedTypes: [],
      };
    }
    
    // 복수 유형 허용시 표시
    if (allowedTypes.length > 1) {
      return {
        icon: Unlock,
        text: allowedTypes.join(' + '),
        color: 'text-green-600 dark:text-green-400',
        allowedTypes,
      };
    }
    
    // 단일 유형만 허용
    if (allowedTypes.length === 1) {
      const singleType = allowedTypes[0];
      if (singleType === '정규') {
        return { icon: Unlock, text: '정규 수강권', color: typeColors.regular.color, allowedTypes };
      }
      if (singleType === '팝업') {
        return { icon: Unlock, text: '팝업 수강권', color: typeColors.popup.color, allowedTypes };
      }
      if (singleType === '워크샵') {
        return { icon: Unlock, text: '워크샵 수강권', color: typeColors.workshop.color, allowedTypes };
      }
    }
    
    // 클래스 타입에 따른 기본값
    const defaultConfig = typeColors[classType] || typeColors.regular;
    const defaultText = classType === 'popup' ? '팝업 수강권' :
                        classType === 'workshop' ? '워크샵 수강권' : '정규 수강권';
    
    return { 
      icon: defaultConfig.icon, 
      text: defaultText, 
      color: defaultConfig.color,
      allowedTypes: [classType === 'popup' ? '팝업' : classType === 'workshop' ? '워크샵' : '정규'],
    };
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

          {/* 활성화 필터 탭 */}
          <div className="flex gap-2 mb-4 border-b dark:border-neutral-700 pb-3">
            <button
              onClick={() => setFilterTab('active')}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                filterTab === 'active'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-neutral-700'
              }`}
            >
              활성화 ({activeCount})
            </button>
            <button
              onClick={() => setFilterTab('inactive')}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                filterTab === 'inactive'
                  ? 'bg-gray-600 text-white'
                  : 'bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-neutral-700'
              }`}
            >
              비활성화 ({inactiveCount})
            </button>
            <button
              onClick={() => setFilterTab('all')}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                filterTab === 'all'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-neutral-700'
              }`}
            >
              전체 ({classMasters.length})
            </button>
          </div>
          
          {/* 클래스 유형 필터 */}
          <div className="flex gap-2 mb-6">
            <button
              onClick={() => setClassTypeFilter('all')}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                classTypeFilter === 'all'
                  ? 'bg-primary dark:bg-[#CCFF00] text-black'
                  : 'bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-neutral-700'
              }`}
            >
              전체
            </button>
            <button
              onClick={() => setClassTypeFilter('regular')}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                classTypeFilter === 'regular'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-neutral-700'
              }`}
            >
              Regular ({regularCount})
            </button>
            <button
              onClick={() => setClassTypeFilter('popup')}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                classTypeFilter === 'popup'
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-neutral-700'
              }`}
            >
              Popup ({popupCount})
            </button>
            <button
              onClick={() => setClassTypeFilter('workshop')}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                classTypeFilter === 'workshop'
                  ? 'bg-amber-600 text-white'
                  : 'bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-neutral-700'
              }`}
            >
              Workshop ({workshopCount})
            </button>
          </div>
          
          {filteredClasses.length === 0 ? (
            <div className="text-center py-12">
              <BookOpen className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
              <p className="text-gray-500 dark:text-gray-400 mb-4">
                {filterTab === 'active' && '활성화된 클래스가 없습니다.'}
                {filterTab === 'inactive' && '비활성화된 클래스가 없습니다.'}
                {filterTab === 'all' && '등록된 클래스가 없습니다.'}
              </p>
              {classMasters.length === 0 && (
                <button
                  onClick={() => {
                    setSelectedClass(null);
                    setShowModal(true);
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Plus size={16} /> 첫 클래스 만들기
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredClasses.map((classItem) => {
                const accessDisplay = getAccessConfigDisplay(classItem);
                const AccessIcon = accessDisplay.icon;
                const isActive = classItem.is_active !== false;
                
                return (
                  <div
                    key={classItem.id}
                    className={`border rounded-xl p-4 transition-colors cursor-pointer group ${
                      isActive
                        ? 'border-gray-200 dark:border-neutral-700 hover:border-blue-300 dark:hover:border-blue-600 bg-white dark:bg-neutral-900'
                        : 'border-gray-200 dark:border-neutral-800 bg-gray-50 dark:bg-neutral-950 opacity-70'
                    }`}
                    onClick={() => {
                      setSelectedClass(classItem);
                      setShowModal(true);
                    }}
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className={`font-bold text-lg ${
                            isActive
                              ? 'text-gray-900 dark:text-white'
                              : 'text-gray-500 dark:text-gray-500'
                          }`}>
                            {classItem.title || '제목 없음'}
                          </h3>
                          {!isActive && (
                            <span className="text-xs px-2 py-0.5 bg-gray-200 dark:bg-neutral-700 text-gray-500 dark:text-gray-400 rounded">
                              비활성화
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {classItem.instructors?.name_kr || classItem.instructors?.name_en || '강사 미지정'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {/* 활성화 토글 버튼 */}
                        <button
                          onClick={(e) => toggleClassActive(e, classItem)}
                          className={`transition-colors ${
                            isActive
                              ? 'text-blue-500 hover:text-blue-600'
                              : 'text-gray-400 hover:text-gray-500'
                          }`}
                          title={isActive ? '비활성화하기' : '활성화하기'}
                        >
                          {isActive ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}
                        </button>
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
                      {classItem.class_type && (
                        <span className={`text-xs px-2 py-1 rounded font-medium ${
                          classItem.class_type === 'regular' 
                            ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                            : classItem.class_type === 'popup'
                            ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400'
                            : classItem.class_type === 'workshop'
                            ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                            : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-400'
                        }`}>
                          {classItem.class_type === 'regular' ? 'Regular' :
                           classItem.class_type === 'popup' ? 'Popup' :
                           classItem.class_type === 'workshop' ? 'Workshop' : classItem.class_type}
                        </span>
                      )}
                    </div>

                    <div className={`flex items-center gap-1.5 text-xs ${accessDisplay.color}`}>
                      <AccessIcon size={14} />
                      <span>{accessDisplay.text}</span>
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
