"use client";

import { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { ClassInfo } from '@/types';
import { LevelBadge } from '@/components/common/level-badge';
import { formatKSTTime, getKSTDateParts, getKSTDay, convertKSTInputToUTC, formatKSTDateRange } from '@/lib/utils/kst-time';

interface AcademyWeeklyScheduleViewProps {
  academyId: string;
  onClassClick: (classInfo: ClassInfo & { time?: string }) => void;
  onAddClassClick?: (day: string, time: string, hallId?: string | null) => void;
}

const DAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

// Schedule을 ClassInfo로 변환
function transformSchedule(scheduleData: any): ClassInfo & { time?: string; startTime?: string; endTime?: string } {
  const classInfo = scheduleData.classes;
  const instructor = scheduleData.instructors?.name_kr || scheduleData.instructors?.name_en || classInfo?.instructors?.name_kr || classInfo?.instructors?.name_en || '강사 정보 없음';
  const genre = classInfo?.genre || 'ALL';
  const level = classInfo?.difficulty_level || 'All Level';
  const maxStudents = scheduleData.max_students || classInfo?.max_students || 0;
  const currentStudents = scheduleData.current_students || 0;
  const isFull = maxStudents > 0 && currentStudents >= maxStudents;
  const isAlmostFull = maxStudents > 0 && currentStudents >= maxStudents * 0.8;
  const status = isFull ? 'FULL' : isAlmostFull ? 'ALMOST_FULL' : 'AVAILABLE';

  const time = scheduleData.start_time ? formatKSTTime(scheduleData.start_time) : '';

  return {
    id: classInfo?.id || scheduleData.class_id,
    schedule_id: scheduleData.id,
    instructor,
    genre,
    level,
    status,
    price: 0, // 가격은 수강권에서 관리
    class_title: classInfo?.title || classInfo?.name_kr || classInfo?.name_en || '',
    hall_name: scheduleData.halls?.name || classInfo?.halls?.name,
    academy: {
      id: classInfo?.academies?.id || classInfo?.academy_id || '',
      name: classInfo?.academies?.name_kr || classInfo?.academies?.name_en || '',
    },
    time,
    startTime: scheduleData.start_time,
    endTime: scheduleData.end_time,
    maxStudents,
    currentStudents,
  };
}

// 주간 스케줄을 그리드로 변환
function buildScheduleGrid(schedules: any[]) {
  const grid: Record<string, ClassInfo[]> = {
    MON: [], TUE: [], WED: [], THU: [], FRI: [], SAT: [], SUN: []
  };

  schedules.forEach((scheduleData: any) => {
    if (!scheduleData.start_time) return;
    const startTime = new Date(scheduleData.start_time);
    // KST 기준으로 요일 계산
    const dayIndex = (getKSTDay(startTime) + 6) % 7; // 월요일을 0으로
    const day = DAYS[dayIndex];
    // UTC를 KST로 변환하여 시간 표시
    const time = formatKSTTime(scheduleData.start_time);
    
    const classInfo = transformSchedule(scheduleData);
    classInfo.time = time;
    
    grid[day].push(classInfo);
  });

  // 시간순으로 정렬
  Object.keys(grid).forEach((day: string) => {
    grid[day].sort((a, b) => {
      const timeA = a.time || '00:00';
      const timeB = b.time || '00:00';
      return timeA.localeCompare(timeB);
    });
  });

  return grid;
}

export const AcademyWeeklyScheduleView = ({ academyId, onClassClick, onAddClassClick }: AcademyWeeklyScheduleViewProps) => {
  const [schedules, setSchedules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [scheduleGrid, setScheduleGrid] = useState<Record<string, ClassInfo[]>>({
    MON: [], TUE: [], WED: [], THU: [], FRI: [], SAT: [], SUN: []
  });
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay() + 1); // 월요일
    startOfWeek.setHours(0, 0, 0, 0);
    return startOfWeek;
  });

  const loadSchedules = useCallback(async (signal?: AbortSignal) => {
    try {
      setLoading(true);
      // KST 기준으로 이번 주의 시작과 끝 날짜 계산
      const kstStartParts = getKSTDateParts(currentWeekStart);
      const kstEndDate = new Date(currentWeekStart.getTime() + 6 * 24 * 60 * 60 * 1000);
      const kstNextDayDate = new Date(kstEndDate.getTime() + 24 * 60 * 60 * 1000);
      const kstNextDayParts = getKSTDateParts(kstNextDayDate);
      
      const kstStartString = `${kstStartParts.year}-${String(kstStartParts.month).padStart(2, '0')}-${String(kstStartParts.day).padStart(2, '0')}T00:00`;
      const kstNextDayString = `${kstNextDayParts.year}-${String(kstNextDayParts.month).padStart(2, '0')}-${String(kstNextDayParts.day).padStart(2, '0')}T00:00`;
      
      const utcStart = convertKSTInputToUTC(kstStartString);
      const utcEndNextDay = convertKSTInputToUTC(kstNextDayString);

      if (!utcStart || !utcEndNextDay) {
        console.error('날짜 변환 실패');
        setLoading(false);
        return;
      }

      const { getSupabaseClient } = await import('@/lib/utils/supabase-client');
      const supabase = getSupabaseClient();
      if (!supabase) {
        setLoading(false);
        return;
      }

      // 먼저 해당 학원의 클래스 ID들을 가져옴
      const { data: academyClasses, error: classesError } = await supabase
        .from('classes')
        .select('id')
        .eq('academy_id', academyId)
        .eq('is_active', true);

      if (classesError) throw classesError;
      
      const classIds = (academyClasses || []).map((c: { id: string }) => c.id);
      
      if (classIds.length === 0) {
        if (signal?.aborted) return;
        setSchedules([]);
        setScheduleGrid({ MON: [], TUE: [], WED: [], THU: [], FRI: [], SAT: [], SUN: [] });
        setLoading(false);
        return;
      }

      // schedules 테이블에서 해당 클래스들의 스케줄 조회
      const { data: allSchedules, error: schedulesError } = await supabase
        .from('schedules')
        .select(`
          id,
          class_id,
          hall_id,
          instructor_id,
          start_time,
          end_time,
          max_students,
          current_students,
          is_canceled,
          classes (
            id,
            title,
            name_kr,
            name_en,
            genre,
            difficulty_level,
            max_students,
            academy_id,
            academies (
              id,
              name_kr,
              name_en
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
        .in('class_id', classIds)
        .eq('is_canceled', false)
        .gte('start_time', utcStart)
        .lt('start_time', utcEndNextDay)
        .order('start_time', { ascending: true });

      if (schedulesError) throw schedulesError;
      
      if (signal?.aborted) return;

      setSchedules(allSchedules || []);
      const grid = buildScheduleGrid(allSchedules || []);
      setScheduleGrid(grid);
    } catch (error) {
      if (signal?.aborted) return;
      console.error('Error loading schedules:', error);
      setSchedules([]);
      setScheduleGrid({
        MON: [], TUE: [], WED: [], THU: [], FRI: [], SAT: [], SUN: []
      });
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  }, [academyId, currentWeekStart]);

  useEffect(() => {
    const abortController = new AbortController();
    loadSchedules(abortController.signal);
    
    return () => {
      abortController.abort();
    };
  }, [loadSchedules]);

  const goToPreviousWeek = () => {
    const newWeekStart = new Date(currentWeekStart);
    newWeekStart.setDate(newWeekStart.getDate() - 7);
    setCurrentWeekStart(newWeekStart);
  };

  const goToNextWeek = () => {
    const newWeekStart = new Date(currentWeekStart);
    newWeekStart.setDate(newWeekStart.getDate() + 7);
    setCurrentWeekStart(newWeekStart);
  };

  const goToToday = () => {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay() + 1); // 월요일
    startOfWeek.setHours(0, 0, 0, 0);
    setCurrentWeekStart(startOfWeek);
  };

  // 실제 수업이 있는 시간대만 추출 (가장 이른 시간부터 가장 늦은 시간까지)
  const existingTimeSlots = Array.from(new Set(
    schedules
      .filter((s: any) => s.start_time)
      .map((s: any) => formatKSTTime(s.start_time))
  )).sort();
  
  // 실제 수업이 있는 시간대만 사용 (기본 시간대 제거)
  const allTimeSlots = existingTimeSlots;

  // 각 요일별로 시간대별로 그룹화된 스케줄 생성 (실제 수업이 있는 시간대만)
  const scheduleByTimeAndDay: Record<string, Record<string, ClassInfo[]>> = {};
  allTimeSlots.forEach((time: string) => {
    scheduleByTimeAndDay[time] = {};
    DAYS.forEach((day: string) => {
      const daySchedules = scheduleGrid[day] || [];
      const schedules = daySchedules.filter((s: ClassInfo) => s.time === time);
      if (schedules.length > 0) {
        scheduleByTimeAndDay[time][day] = schedules;
      }
    });
  });

  const weekEndDate = new Date(currentWeekStart);
  weekEndDate.setDate(currentWeekStart.getDate() + 6);
  const displayDateRange = formatKSTDateRange(currentWeekStart, weekEndDate);

  if (loading) {
    return (
      <div className="text-center py-12 text-neutral-500">로딩 중...</div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <button
          onClick={goToPreviousWeek}
          className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
        >
          <ChevronLeft size={20} className="text-neutral-600 dark:text-neutral-400" />
        </button>
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-bold text-black dark:text-white">{displayDateRange}</h3>
          <button
            onClick={goToToday}
            className="text-xs px-2 py-1 bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 rounded hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
          >
            오늘
          </button>
        </div>
        <button
          onClick={goToNextWeek}
          className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
        >
          <ChevronRight size={20} className="text-neutral-600 dark:text-neutral-400" />
        </button>
      </div>

      {/* 시간표 그리드 */}
      <div className="overflow-hidden">
        <div className="flex mb-2">
          <div className="w-12 flex-shrink-0"></div>
          {DAYS.map((day: string) => (
            <div key={day} className="flex-1 text-center text-xs font-bold text-neutral-500 dark:text-neutral-500 py-2 min-w-0">
              {day}
            </div>
          ))}
        </div>
        {allTimeSlots.length === 0 ? (
          <div className="text-center py-12 text-neutral-500">이번 주 스케줄이 없습니다.</div>
        ) : (
          allTimeSlots.map((time: string) => {
            // 이 시간대에 실제로 수업이 있는지 확인 (모든 요일 체크)
            const hasAnyClass = DAYS.some((day: string) => {
              const classInfos = scheduleByTimeAndDay[time]?.[day] || [];
              return classInfos.length > 0;
            });

            // 실제 수업이 있는 시간대만 표시
            if (!hasAnyClass) return null;

            return (
              <div key={time} className="flex mb-2">
                <div className="w-12 flex-shrink-0 flex flex-col items-center justify-center text-[10px] font-bold text-neutral-600 dark:text-neutral-400 bg-neutral-100/50 dark:bg-neutral-900/50 rounded-l-lg border-y border-l border-neutral-200 dark:border-neutral-800">
                  {time}
                </div>
                {DAYS.map((day: string) => {
                  const classInfos = scheduleByTimeAndDay[time]?.[day] || [];
                  const isEmpty = classInfos.length === 0;
                  // 첫 번째 수업의 홀 ID 가져오기
                  let firstHallId: string | null = null;
                  if (classInfos.length > 0) {
                    const firstSchedule = schedules.find((s: any) => {
                      if (!s.start_time) return false;
                      const sTime = new Date(s.start_time);
                      const sDayIndex = (getKSTDay(sTime) + 6) % 7;
                      const sTimeStr = formatKSTTime(s.start_time);
                      return DAYS[sDayIndex] === day && sTimeStr === time && s.id === classInfos[0].schedule_id;
                    });
                    firstHallId = firstSchedule?.hall_id || null;
                  }

                  return (
                    <div key={`${day}-${time}`} className="flex-1 p-0.5 min-w-0 flex flex-col gap-0.5">
                      {isEmpty ? (
                        onAddClassClick ? (
                          <button
                            onClick={() => onAddClassClick(day, time)}
                            className="h-full min-h-[40px] bg-neutral-100/30 dark:bg-neutral-900/30 rounded-lg border border-neutral-200/50 dark:border-neutral-800/50 hover:bg-neutral-100/50 dark:hover:bg-neutral-900/50 hover:border-neutral-800 dark:hover:border-[#CCFF00] transition-all flex items-center justify-center group"
                          >
                            <Plus size={16} className="text-neutral-400 dark:text-neutral-600 group-hover:text-neutral-800 dark:group-hover:text-[#CCFF00] transition-colors" />
                          </button>
                        ) : (
                          <div className="h-full min-h-[40px] bg-neutral-100/30 dark:bg-neutral-900/30 rounded-lg border border-neutral-200/50 dark:border-neutral-800/50" />
                        )
                      ) : (
                        <>
                          {classInfos.map((classInfo, index) => {
                            const isFull = classInfo.status === 'FULL';
                            // 각 수업의 홀 ID 찾기
                            const scheduleData = schedules.find((s: any) => s.id === classInfo.schedule_id);
                            const hallId = scheduleData?.hall_id || null;
                            
                            return (
                              <button 
                                key={`${classInfo.id}-${index}`}
                                onClick={() => onClassClick(classInfo)}
                                className={`w-full min-h-[40px] rounded-lg border p-1.5 flex items-center gap-1.5 text-left transition-all active:scale-95 ${
                                  isFull 
                                    ? 'bg-neutral-100 dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 opacity-60' 
                                    : 'bg-neutral-200 dark:bg-neutral-800 border-neutral-300 dark:border-neutral-700 hover:border-neutral-800 dark:hover:border-[#CCFF00] hover:bg-neutral-300 dark:hover:bg-neutral-700'
                                }`}
                              >
                                <span className={`text-[9px] font-bold truncate flex-1 ${isFull ? 'text-neutral-500 dark:text-neutral-500' : 'text-black dark:text-white'}`}>
                                  {classInfo.instructor}
                                </span>
                                <LevelBadge level={classInfo.level} simple />
                                <span className="text-[8px] text-neutral-500 dark:text-neutral-500 truncate max-w-[50px]">
                                  {classInfo.genre}
                                </span>
                                {isFull && (
                                  <span className="text-[8px] text-red-500 dark:text-red-400 font-bold whitespace-nowrap">
                                    FULL
                                  </span>
                                )}
                              </button>
                            );
                          })}
                          {onAddClassClick && (
                            <button
                              onClick={() => onAddClassClick(day, time, firstHallId)}
                              className="w-full min-h-[24px] bg-neutral-100/50 dark:bg-neutral-900/50 rounded border border-neutral-200/50 dark:border-neutral-800/50 hover:bg-neutral-100 dark:hover:bg-neutral-900 hover:border-neutral-800 dark:hover:border-[#CCFF00] transition-all flex items-center justify-center group"
                            >
                              <Plus size={12} className="text-neutral-400 dark:text-neutral-600 group-hover:text-neutral-800 dark:group-hover:text-[#CCFF00] transition-colors" />
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

