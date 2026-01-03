"use client";

import { useState, useEffect, useMemo } from 'react';
import { Users, Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import { ClassModal } from './classes/class-modal';
import { HallModal } from './classes/hall-modal';
import { getSupabaseClient } from '@/lib/utils/supabase-client';
import { formatKSTTime } from '@/lib/utils/kst-time';

interface ClassesViewProps {
  academyId: string;
}

const DAYS = ['일', '월', '화', '수', '목', '금', '토'];

const DIFFICULTY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  BEGINNER: {
    bg: 'bg-green-50 dark:bg-green-900/20',
    text: 'text-green-700 dark:text-green-400',
    border: 'border-green-200 dark:border-green-800',
  },
  INTERMEDIATE: {
    bg: 'bg-yellow-50 dark:bg-yellow-900/20',
    text: 'text-yellow-700 dark:text-yellow-400',
    border: 'border-yellow-200 dark:border-yellow-800',
  },
  ADVANCED: {
    bg: 'bg-red-50 dark:bg-red-900/20',
    text: 'text-red-700 dark:text-red-400',
    border: 'border-red-200 dark:border-red-800',
  },
};

const DIFFICULTY_LABELS: Record<string, string> = {
  BEGINNER: '초급',
  INTERMEDIATE: '중급',
  ADVANCED: '고급',
};

export function ClassesView({ academyId }: ClassesViewProps) {
  const [classes, setClasses] = useState<any[]>([]);
  const [halls, setHalls] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showClassModal, setShowClassModal] = useState(false);
  const [showHallModal, setShowHallModal] = useState(false);
  const [selectedClass, setSelectedClass] = useState<any>(null);
  const [selectedHall, setSelectedHall] = useState<any>(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedHallFilter, setSelectedHallFilter] = useState<string>('all'); // 'all' or hall id

  // 현재 월의 모든 날짜 배열 생성
  const monthDays = useMemo(() => {
    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay(); // 0 (일요일) ~ 6 (토요일)

    const days: (Date | null)[] = [];
    
    // 첫 주의 빈 칸 추가
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    
    // 실제 날짜 추가
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day));
    }
    
    return days;
  }, [selectedDate]);

  useEffect(() => {
    loadData();
  }, [academyId, selectedDate]);

  const loadData = async () => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      setLoading(false);
      return;
    }

    try {
      // 홀 목록 로드
      const { data: hallsData, error: hallsError } = await supabase
        .from('halls')
        .select('*')
        .eq('academy_id', academyId)
        .order('name', { ascending: true });

      if (hallsError) throw hallsError;
      setHalls(hallsData || []);

      // 이번 달의 시작일과 종료일 계산
      const year = selectedDate.getFullYear();
      const month = selectedDate.getMonth();
      const startOfMonth = new Date(year, month, 1);
      startOfMonth.setHours(0, 0, 0, 0);

      const endOfMonth = new Date(year, month + 1, 0);
      endOfMonth.setHours(23, 59, 59, 999);

      // 먼저 academy_id에 해당하는 클래스 ID 목록 가져오기
      const { data: classesData, error: classesError } = await supabase
        .from('classes')
        .select('id')
        .eq('academy_id', academyId);

      if (classesError) throw classesError;
      const classIds = (classesData || []).map((c: any) => c.id);

      // schedules 테이블에서 데이터 가져오기 (실제 스케줄)
      const { data: schedulesData, error: schedulesError } = await supabase
        .from('schedules')
        .select(`
          *,
          classes (
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
          )
        `)
        .eq('is_canceled', false)
        .in('class_id', classIds.length > 0 ? classIds : [''])
        .gte('start_time', startOfMonth.toISOString())
        .lte('start_time', endOfMonth.toISOString())
        .order('start_time', { ascending: true });

      if (schedulesError) throw schedulesError;
      
      // schedules 데이터를 classes 형태로 변환 (기존 코드와의 호환성)
      const transformedData = (schedulesData || []).map((schedule: any) => ({
        ...schedule.classes,
        start_time: schedule.start_time,
        end_time: schedule.end_time,
        schedule_id: schedule.id,
        id: schedule.id, // schedule id를 id로 사용 (편집 시 필요)
        instructor_id: schedule.instructor_id || schedule.classes?.instructor_id,
        hall_id: schedule.hall_id || schedule.classes?.hall_id,
        max_students: schedule.max_students || schedule.classes?.max_students,
      }));
      
      setClasses(transformedData);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };


  // 특정 날짜와 홀에 대한 모든 클래스 가져오기 (난이도 구분 없이)
  const getClassesForDateAndHall = (date: Date | null, hallId?: string) => {
    if (!date) return [];

    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    return classes.filter((classItem) => {
      if (!classItem.start_time) return false;
      const classDate = new Date(classItem.start_time);
      const isInDay = classDate >= startOfDay && classDate <= endOfDay;
      const matchesHall = !hallId || classItem.hall_id === hallId;
      return isInDay && matchesHall;
    });
  };

  const formatTime = (dateString: string) => {
    // UTC를 KST로 변환하여 표시
    return formatKSTTime(dateString);
  };

  const getDifficultyColor = (difficulty: string) => {
    return DIFFICULTY_COLORS[difficulty] || DIFFICULTY_COLORS.BEGINNER;
  };

  const renderScheduleGrid = (hallId?: string) => {
    const filteredHalls = hallId ? halls.filter((h) => h.id === hallId) : halls;
    const showAllHalls = !hallId;

    // 홀이 없을 때만 메시지 표시
    if (halls.length === 0) {
      return (
        <div className="col-span-full flex flex-col items-center justify-center py-20 px-4">
          <div className="text-center space-y-4">
            <p className="text-gray-500 dark:text-gray-400 text-lg">
              아직 홀(강의실)이 등록되지 않았습니다.
            </p>
            <p className="text-gray-400 dark:text-gray-500 text-sm">
              강의실(홀)을 등록해주세요
            </p>
            <button
              onClick={() => {
                setSelectedHall(null);
                setShowHallModal(true);
              }}
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors font-medium mt-4"
            >
              <Plus size={20} /> 홀 추가하기
            </button>
          </div>
        </div>
      );
    }

    // 홀별로 달력 렌더링 (난이도 구분 없이 하나의 달력)
    return (
      <div className="col-span-full space-y-6">
        {filteredHalls.map((hall) => (
          <div key={hall.id} className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-base font-bold text-gray-900 dark:text-white">
                {hall.name} {hall.capacity ? `(${hall.capacity}명)` : ''}
              </h4>
              {showAllHalls ? (
                <button
                  onClick={() => setSelectedHallFilter(hall.id)}
                  className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                >
                  이 홀만 보기
                </button>
              ) : (
                <button
                  onClick={() => setSelectedHallFilter('all')}
                  className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                >
                  전체 보기
                </button>
              )}
            </div>
            <div className="grid grid-cols-7 gap-1 sm:gap-2 min-w-0">
              {/* 요일 헤더 */}
              {DAYS.map((day) => (
                <div key={day} className="font-bold text-gray-800 dark:text-white py-2 bg-gray-100 dark:bg-neutral-800 rounded-lg text-xs sm:text-sm text-center">
                  {day}
                </div>
              ))}
              {/* 날짜 셀 - 모든 난이도의 클래스를 하나의 달력에 색깔로 구분하여 표시 */}
              {monthDays.map((date, index) => {
                if (!date) {
                  return <div key={`empty-${index}`} className="min-h-[100px] sm:min-h-[150px]"></div>;
                }
                // 해당 날짜와 홀의 모든 클래스 가져오기 (난이도 구분 없이)
                const dayClasses = getClassesForDateAndHall(date, hall.id);
                const isToday = date.toDateString() === new Date().toDateString();
                return (
                  <div
                    key={date.toISOString()}
                    className={`min-h-[100px] sm:min-h-[150px] border border-gray-200 dark:border-neutral-700 rounded-lg p-1 sm:p-2 ${
                      isToday ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700' : 'bg-white dark:bg-neutral-900'
                    }`}
                  >
                    <div className={`text-xs sm:text-sm font-bold mb-1 ${isToday ? 'text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300'}`}>
                      {date.getDate()}
                    </div>
                    <div className="space-y-1 overflow-y-auto max-h-[120px] sm:max-h-[130px]">
                      {dayClasses.map((classItem) => {
                        const classDifficulty = getDifficultyColor(classItem.difficulty_level || 'BEGINNER');
                        return (
                          <div
                            key={classItem.id || classItem.schedule_id}
                            className={`${classDifficulty.bg} ${classDifficulty.border} p-1.5 sm:p-2 rounded border text-left hover:shadow-md transition-shadow cursor-pointer relative overflow-hidden group flex items-center gap-1.5`}
                            onClick={() => {
                              setSelectedClass(classItem);
                              setShowClassModal(true);
                            }}
                          >
                            <div className={`absolute top-0 left-0 w-1 h-full ${classDifficulty.text.replace('text-', 'bg-')}`}></div>
                            <span className="text-[9px] sm:text-xs font-bold text-gray-700 dark:text-gray-300 whitespace-nowrap">
                              {formatTime(classItem.start_time)}
                            </span>
                            <span className="font-bold text-gray-800 dark:text-white text-[9px] sm:text-xs truncate flex-1">
                              {classItem.title || '-'}
                            </span>
                          </div>
                        );
                      })}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedClass(null);
                          setSelectedDate(date);
                          setSelectedHallFilter(hall.id);
                          setShowClassModal(true);
                        }}
                        className="w-full mt-1 p-1.5 sm:p-2 border-2 border-dashed border-gray-300 dark:border-neutral-600 rounded hover:border-blue-500 dark:hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors flex items-center justify-center gap-1 text-xs text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
                      >
                        <Plus size={14} />
                        <span>클래스 추가</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    );
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
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <h2 className="text-xl font-bold text-gray-800 dark:text-white">클래스 / 시간표 관리</h2>
          <button
            onClick={() => {
              setSelectedClass(null);
              setShowClassModal(true);
            }}
            className="bg-gray-900 dark:bg-gray-100 hover:bg-gray-800 dark:hover:bg-gray-200 text-white dark:text-gray-900 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors shadow-sm"
          >
            <Plus size={16} /> 클래스 추가
          </button>
        </div>

        {/* 홀 필터 토글 */}
        {halls.length > 0 && (
          <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-sm border border-gray-100 dark:border-neutral-800 p-4">
            <div className="flex flex-wrap gap-2 items-center">
              <button
                onClick={() => setSelectedHallFilter('all')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  selectedHallFilter === 'all'
                    ? 'bg-blue-600 dark:bg-blue-500 text-white'
                    : 'bg-gray-100 dark:bg-neutral-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-neutral-700'
                }`}
              >
                전체
              </button>
              {halls.map((hall) => (
                <button
                  key={hall.id}
                  onClick={() => setSelectedHallFilter(hall.id)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    selectedHallFilter === hall.id
                      ? 'bg-blue-600 dark:bg-blue-500 text-white'
                      : 'bg-gray-100 dark:bg-neutral-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-neutral-700'
                  }`}
                >
                  {hall.name}
                </button>
              ))}
              <button
                onClick={() => {
                  setSelectedHall(null);
                  setShowHallModal(true);
                }}
                className="bg-gray-100 dark:bg-neutral-800 hover:bg-gray-200 dark:hover:bg-neutral-700 text-gray-700 dark:text-gray-300 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors shadow-sm"
              >
                <Plus size={16} /> 홀 추가
              </button>
            </div>
          </div>
        )}

        <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-sm border border-gray-100 dark:border-neutral-800 p-4 sm:p-6 overflow-x-auto">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2 sm:gap-4">
              <button
                onClick={() => {
                  const prevMonth = new Date(selectedDate);
                  prevMonth.setMonth(prevMonth.getMonth() - 1);
                  setSelectedDate(prevMonth);
                }}
                className="p-2 hover:bg-gray-100 dark:hover:bg-neutral-800 rounded-full transition-colors"
                aria-label="이전 달"
              >
                <ChevronLeft size={20} className="text-gray-600 dark:text-gray-400" />
              </button>
              <div className="text-center">
                <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white">
                  {selectedDate.toLocaleDateString('ko-KR', { month: 'long', year: 'numeric' })}
                </h3>
              </div>
              <button
                onClick={() => {
                  const nextMonth = new Date(selectedDate);
                  nextMonth.setMonth(nextMonth.getMonth() + 1);
                  setSelectedDate(nextMonth);
                }}
                className="p-2 hover:bg-gray-100 dark:hover:bg-neutral-800 rounded-full transition-colors"
                aria-label="다음 달"
              >
                <ChevronRight size={20} className="text-gray-600 dark:text-gray-400" />
              </button>
            </div>
          </div>

          {/* 난이도 범주 범례 - 하나만 표시 */}
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            {['BEGINNER', 'INTERMEDIATE', 'ADVANCED'].map((difficulty) => {
              const difficultyColor = getDifficultyColor(difficulty);
              const difficultyLabel = DIFFICULTY_LABELS[difficulty];
              return (
                <div key={difficulty} className={`${difficultyColor.bg} ${difficultyColor.border} border rounded-full px-3 py-1.5 inline-flex items-center gap-2`}>
                  <div className={`w-2 h-2 rounded-full ${difficultyColor.text.replace('text-', 'bg-')}`}></div>
                  <span className={`text-sm font-semibold ${difficultyColor.text}`}>
                    {difficultyLabel}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-7 gap-1 sm:gap-2 min-w-[700px] sm:min-w-0">
            {renderScheduleGrid(selectedHallFilter === 'all' ? undefined : selectedHallFilter)}
          </div>
        </div>
      </div>

      {showClassModal && (
        <ClassModal
          academyId={academyId}
          classData={selectedClass}
          defaultDate={selectedDate}
          defaultHallId={selectedHallFilter !== 'all' ? selectedHallFilter : undefined}
          onClose={() => {
            setShowClassModal(false);
            setSelectedClass(null);
            loadData();
          }}
        />
      )}

      {showHallModal && (
        <HallModal
          academyId={academyId}
          hall={selectedHall}
          onClose={() => {
            setShowHallModal(false);
            setSelectedHall(null);
            loadData();
          }}
        />
      )}
    </>
  );
}
