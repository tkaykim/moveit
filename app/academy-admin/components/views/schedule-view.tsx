"use client";

import { useState, useEffect, useMemo } from 'react';
import { Plus, ChevronLeft, ChevronRight, Repeat, Zap, Lock } from 'lucide-react';
import { SectionHeader } from '../common/section-header';
import { RecurringScheduleModal } from './schedule/recurring-schedule-modal';
import { SessionModal } from './schedule/session-modal';
import { getSupabaseClient } from '@/lib/utils/supabase-client';
import { formatKSTTime } from '@/lib/utils/kst-time';

interface ScheduleViewProps {
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

export function ScheduleView({ academyId }: ScheduleViewProps) {
  const [sessions, setSessions] = useState<any[]>([]);
  const [halls, setHalls] = useState<any[]>([]);
  const [classMasters, setClassMasters] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRecurringModal, setShowRecurringModal] = useState(false);
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [selectedSession, setSelectedSession] = useState<any>(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedHallFilter, setSelectedHallFilter] = useState<string>('all');

  // 현재 월의 모든 날짜 배열 생성
  const monthDays = useMemo(() => {
    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days: (Date | null)[] = [];
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
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
      // 홀 목록
      const { data: hallsData } = await supabase
        .from('halls')
        .select('*')
        .eq('academy_id', academyId)
        .order('name', { ascending: true });
      setHalls(hallsData || []);

      // 클래스 마스터 목록
      const { data: classesData } = await supabase
        .from('classes')
        .select('id, title, genre, difficulty_level, access_config, instructor_id, instructors(name_kr, name_en)')
        .eq('academy_id', academyId)
        .eq('is_canceled', false);
      setClassMasters(classesData || []);

      // 이번 달의 시작일과 종료일
      const year = selectedDate.getFullYear();
      const month = selectedDate.getMonth();
      const startOfMonth = new Date(year, month, 1);
      const endOfMonth = new Date(year, month + 1, 0, 23, 59, 59, 999);

      // 세션(schedules) 조회
      const { data: sessionsData, error } = await supabase
        .from('schedules')
        .select(`
          *,
          classes (
            id,
            title,
            genre,
            difficulty_level,
            access_config,
            class_type
          ),
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
        .eq('is_canceled', false)
        .gte('start_time', startOfMonth.toISOString())
        .lte('start_time', endOfMonth.toISOString())
        .order('start_time', { ascending: true });

      if (error) throw error;
      
      // academy_id로 필터링 (classes를 통해)
      const filteredSessions = (sessionsData || []).filter((session: any) => {
        return classMasters.some((c: any) => c.id === session.class_id);
      });
      
      setSessions(sessionsData || []);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getSessionsForDate = (date: Date | null, hallId?: string) => {
    if (!date) return [];

    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    return sessions.filter((session) => {
      if (!session.start_time) return false;
      const sessionDate = new Date(session.start_time);
      const isInDay = sessionDate >= startOfDay && sessionDate <= endOfDay;
      const matchesHall = !hallId || session.hall_id === hallId;
      return isInDay && matchesHall;
    });
  };

  const formatTime = (dateString: string) => {
    return formatKSTTime(dateString);
  };

  const getDifficultyColor = (difficulty: string) => {
    return DIFFICULTY_COLORS[difficulty] || DIFFICULTY_COLORS.BEGINNER;
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
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h2 className="text-xl font-bold text-gray-800 dark:text-white">스케줄 관리</h2>
          <div className="flex gap-2">
            <button
              onClick={() => setShowRecurringModal(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
            >
              <Repeat size={16} /> 스케줄 생성
            </button>
          </div>
        </div>

        {classMasters.length === 0 ? (
          <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-sm border border-gray-100 dark:border-neutral-800 p-12 text-center">
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              먼저 클래스(반)를 등록해주세요.
            </p>
            <a
              href={`/academy-admin/${academyId}/class-masters`}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus size={16} /> 클래스 등록하기
            </a>
          </div>
        ) : (
          <>
            {/* 홀 필터 */}
            {halls.length > 0 && (
              <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-sm border border-gray-100 dark:border-neutral-800 p-4">
                <div className="flex flex-wrap gap-2 items-center">
                  <button
                    onClick={() => setSelectedHallFilter('all')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      selectedHallFilter === 'all'
                        ? 'bg-blue-600 text-white'
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
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 dark:bg-neutral-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-neutral-700'
                      }`}
                    >
                      {hall.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 달력 */}
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
                  >
                    <ChevronLeft size={20} className="text-gray-600 dark:text-gray-400" />
                  </button>
                  <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white">
                    {selectedDate.toLocaleDateString('ko-KR', { month: 'long', year: 'numeric' })}
                  </h3>
                  <button
                    onClick={() => {
                      const nextMonth = new Date(selectedDate);
                      nextMonth.setMonth(nextMonth.getMonth() + 1);
                      setSelectedDate(nextMonth);
                    }}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-neutral-800 rounded-full transition-colors"
                  >
                    <ChevronRight size={20} className="text-gray-600 dark:text-gray-400" />
                  </button>
                </div>
              </div>

              {/* 난이도 범례 */}
              <div className="flex items-center gap-3 mb-4 flex-wrap">
                {['BEGINNER', 'INTERMEDIATE', 'ADVANCED'].map((difficulty) => {
                  const color = getDifficultyColor(difficulty);
                  return (
                    <div key={difficulty} className={`${color.bg} ${color.border} border rounded-full px-3 py-1 inline-flex items-center gap-2`}>
                      <div className={`w-2 h-2 rounded-full ${color.text.replace('text-', 'bg-')}`}></div>
                      <span className={`text-sm font-semibold ${color.text}`}>
                        {difficulty === 'BEGINNER' ? '초급' : difficulty === 'INTERMEDIATE' ? '중급' : '고급'}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* 달력 그리드 */}
              <div className="grid grid-cols-7 gap-1 sm:gap-2 min-w-[700px]">
                {/* 요일 헤더 */}
                {DAYS.map((day) => (
                  <div key={day} className="font-bold text-gray-800 dark:text-white py-2 bg-gray-100 dark:bg-neutral-800 rounded-lg text-xs sm:text-sm text-center">
                    {day}
                  </div>
                ))}

                {/* 날짜 셀 */}
                {monthDays.map((date, index) => {
                  if (!date) {
                    return <div key={`empty-${index}`} className="min-h-[100px] sm:min-h-[150px]"></div>;
                  }

                  const daySessions = getSessionsForDate(date, selectedHallFilter === 'all' ? undefined : selectedHallFilter);
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
                        {daySessions.map((session) => {
                          const difficulty = session.classes?.difficulty_level || 'BEGINNER';
                          const color = getDifficultyColor(difficulty);
                          const hasAccessRestriction = session.classes?.access_config?.requiredGroup;

                          return (
                            <div
                              key={session.id}
                              className={`${color.bg} ${color.border} p-1.5 sm:p-2 rounded border text-left hover:shadow-md transition-shadow cursor-pointer relative overflow-hidden group`}
                              onClick={() => {
                                setSelectedSession(session);
                                setShowSessionModal(true);
                              }}
                            >
                              <div className={`absolute top-0 left-0 w-1 h-full ${color.text.replace('text-', 'bg-')}`}></div>
                              <div className="flex items-center gap-1">
                                <span className="text-[9px] sm:text-xs font-bold text-gray-700 dark:text-gray-300">
                                  {formatTime(session.start_time)}
                                </span>
                                {hasAccessRestriction && (
                                  <Lock size={10} className="text-indigo-500" />
                                )}
                              </div>
                              <div className="font-bold text-gray-800 dark:text-white text-[9px] sm:text-xs truncate">
                                {session.classes?.title || '-'}
                              </div>
                              <div className="text-[8px] sm:text-[10px] text-gray-500 dark:text-gray-400 truncate">
                                {session.instructors?.name_kr || session.instructors?.name_en || ''}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>

      {showRecurringModal && (
        <RecurringScheduleModal
          academyId={academyId}
          classMasters={classMasters}
          halls={halls}
          onClose={() => {
            setShowRecurringModal(false);
            loadData();
          }}
        />
      )}

      {showSessionModal && selectedSession && (
        <SessionModal
          session={selectedSession}
          onClose={() => {
            setShowSessionModal(false);
            setSelectedSession(null);
            loadData();
          }}
        />
      )}
    </>
  );
}
