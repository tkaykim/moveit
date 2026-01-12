"use client";

import { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { ClassInfo, Academy } from '@/types';
import { LevelBadge } from '@/components/common/level-badge';
import { formatKSTTime, getKSTDateParts, getKSTDay, convertKSTInputToUTC } from '@/lib/utils/kst-time';

interface AcademyMonthlyScheduleViewProps {
  academyId: string;
  onClassClick: (classInfo: ClassInfo & { time?: string }) => void;
}

const DAY_NAMES = ["일", "월", "화", "수", "목", "금", "토"];

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

export const AcademyMonthlyScheduleView = ({ academyId, onClassClick }: AcademyMonthlyScheduleViewProps) => {
  const [schedules, setSchedules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState<Date>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const loadSchedules = useCallback(async () => {
    try {
      setLoading(true);
      const { getSupabaseClient } = await import('@/lib/utils/supabase-client');
      const supabase = getSupabaseClient();
      if (!supabase) {
        setLoading(false);
        return;
      }

      // 현재 월의 시작과 끝 계산 (KST 기준)
      const year = currentMonth.getFullYear();
      const month = currentMonth.getMonth();
      
      // KST 기준으로 월의 시작일과 종료일 계산
      const kstStartString = `${year}-${String(month + 1).padStart(2, '0')}-01T00:00`;
      const nextMonth = month === 11 ? 0 : month + 1;
      const nextYear = month === 11 ? year + 1 : year;
      const kstEndString = `${nextYear}-${String(nextMonth + 1).padStart(2, '0')}-01T00:00`;

      const utcStart = convertKSTInputToUTC(kstStartString);
      const utcEnd = convertKSTInputToUTC(kstEndString);

      if (!utcStart || !utcEnd) {
        console.error('날짜 변환 실패');
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
        setSchedules([]);
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
        .lt('start_time', utcEnd)
        .order('start_time', { ascending: true });

      if (schedulesError) throw schedulesError;
      setSchedules(allSchedules || []);
    } catch (error) {
      console.error('Error loading schedules:', error);
      setSchedules([]);
    } finally {
      setLoading(false);
    }
  }, [academyId, currentMonth]);

  useEffect(() => {
    loadSchedules();
  }, [loadSchedules]);

  const goToPreviousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const goToToday = () => {
    const now = new Date();
    setCurrentMonth(new Date(now.getFullYear(), now.getMonth(), 1));
  };

  // 캘린더 그리드 생성
  const getCalendarGrid = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - startDate.getDay()); // 일요일로 시작

    const grid: Date[] = [];
    const current = new Date(startDate);
    
    // 6주치 날짜 생성 (42일)
    for (let i = 0; i < 42; i++) {
      grid.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }

    return grid;
  };

  // 특정 날짜의 스케줄 가져오기
  const getSchedulesForDate = (date: Date) => {
    const dateParts = getKSTDateParts(date);
    return schedules.filter((scheduleData: any) => {
      if (!scheduleData.start_time) return false;
      const scheduleDate = new Date(scheduleData.start_time);
      const scheduleParts = getKSTDateParts(scheduleDate);
      return scheduleParts.year === dateParts.year &&
             scheduleParts.month === dateParts.month &&
             scheduleParts.day === dateParts.day;
    });
  };

  const calendarGrid = getCalendarGrid();
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const monthName = `${year}년 ${month + 1}월`;

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
          onClick={goToPreviousMonth}
          className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
        >
          <ChevronLeft size={20} className="text-neutral-600 dark:text-neutral-400" />
        </button>
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-bold text-black dark:text-white">{monthName}</h3>
          <button
            onClick={goToToday}
            className="text-xs px-2 py-1 bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 rounded hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
          >
            오늘
          </button>
        </div>
        <button
          onClick={goToNextMonth}
          className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
        >
          <ChevronRight size={20} className="text-neutral-600 dark:text-neutral-400" />
        </button>
      </div>

      {/* 캘린더 그리드 */}
      <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden">
        {/* 요일 헤더 */}
        <div className="grid grid-cols-7 border-b border-neutral-200 dark:border-neutral-800">
          {DAY_NAMES.map((day) => (
            <div
              key={day}
              className="p-2 text-center text-xs font-bold text-neutral-500 dark:text-neutral-500 bg-neutral-50 dark:bg-neutral-950"
            >
              {day}
            </div>
          ))}
        </div>

        {/* 날짜 그리드 */}
        <div className="grid grid-cols-7">
          {calendarGrid.map((date, index) => {
            const dateParts = getKSTDateParts(date);
            const isCurrentMonth = dateParts.month === month + 1;
            const isToday = new Date().getFullYear() === dateParts.year &&
                          new Date().getMonth() + 1 === dateParts.month &&
                          new Date().getDate() === dateParts.day;
            const daySchedules = getSchedulesForDate(date);

            return (
              <div
                key={index}
                className={`min-h-[100px] border-r border-b border-neutral-200 dark:border-neutral-800 p-1 ${
                  isCurrentMonth
                    ? 'bg-white dark:bg-neutral-900'
                    : 'bg-neutral-50 dark:bg-neutral-950'
                }`}
              >
                <div
                  className={`text-xs font-bold mb-1 ${
                    isCurrentMonth
                      ? isToday
                        ? 'text-primary dark:text-[#CCFF00]'
                        : 'text-black dark:text-white'
                      : 'text-neutral-400 dark:text-neutral-600'
                  }`}
                >
                  {dateParts.day}
                </div>
                <div className="space-y-1">
                  {daySchedules.slice(0, 3).map((scheduleData: any) => {
                    const classInfo = transformSchedule(scheduleData);
                    const isFull = classInfo.status === 'FULL';
                    return (
                      <button
                        key={scheduleData.id}
                        onClick={() => onClassClick(classInfo)}
                        className={`w-full text-left px-1.5 py-0.5 rounded text-[9px] truncate ${
                          isFull
                            ? 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-500'
                            : 'bg-neutral-200 dark:bg-neutral-700 text-black dark:text-white hover:bg-neutral-300 dark:hover:bg-neutral-600'
                        }`}
                      >
                        <div className="font-bold truncate">{classInfo.instructor}</div>
                        <div className="text-[8px] text-neutral-500 dark:text-neutral-400 truncate">
                          {classInfo.time}
                        </div>
                      </button>
                    );
                  })}
                  {daySchedules.length > 3 && (
                    <div className="text-[8px] text-neutral-500 dark:text-neutral-400 px-1.5">
                      +{daySchedules.length - 3}개 더
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

