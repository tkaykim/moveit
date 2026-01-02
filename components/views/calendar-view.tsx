"use client";

import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { getSupabaseClient } from '@/lib/utils/supabase-client';
import { ClassInfo, Academy } from '@/types';
import { ClassPreviewModal } from '@/components/modals/class-preview-modal';

interface CalendarViewProps {
  onAcademyClick?: (academy: Academy) => void;
  onClassBook?: (classInfo: ClassInfo & { time?: string; price?: number }) => void;
}

const DAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
const DAY_NAMES = ["월", "화", "수", "목", "금", "토", "일"];

// Schedule을 ClassInfo로 변환
function transformSchedule(schedule: any): ClassInfo & { academy?: Academy; time?: string; startTime?: string; endTime?: string; maxStudents?: number; currentStudents?: number } {
  const instructor = schedule.instructors?.name_kr || schedule.instructors?.name_en || '강사 정보 없음';
  const classData = schedule.classes || {};
  const genre = classData.genre || 'ALL';
  const level = classData.difficulty_level || 'All Level';
  const isFull = schedule.current_students >= schedule.max_students;
  const isAlmostFull = schedule.current_students >= schedule.max_students * 0.8;
  const status = isFull ? 'FULL' : isAlmostFull ? 'ALMOST_FULL' : 'AVAILABLE';

  // Academy 정보 생성
  const branch = schedule.branches || {};
  const academyData = (branch as any).academies;
  const academy: Academy | undefined = academyData ? {
    id: academyData.id,
    name_kr: academyData.name_kr,
    name_en: academyData.name_en,
    tags: academyData.tags,
    logo_url: academyData.logo_url,
    name: academyData.name_kr || academyData.name_en || '학원 정보 없음',
  } : undefined;

  // 시간 정보
  const startTime = schedule.start_time ? new Date(schedule.start_time) : null;
  const endTime = schedule.end_time ? new Date(schedule.end_time) : null;
  const startTimeStr = startTime ? startTime.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false }) : '';
  const endTimeStr = endTime ? endTime.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false }) : '';

  return {
    id: schedule.id,
    schedule_id: schedule.id,
    instructor,
    genre,
    level,
    status,
    price: classData.price || 0,
    class_title: classData.title,
    branch_name: branch.name,
    hall_name: schedule.halls?.name,
    academy,
    time: startTimeStr,
    startTime: schedule.start_time,
    endTime: schedule.end_time,
    maxStudents: schedule.max_students,
    currentStudents: schedule.current_students,
  };
}

// 주간 스케줄을 그리드로 변환
function buildScheduleGrid(schedules: any[]) {
  const grid: Record<string, (ClassInfo & { academy?: Academy; time?: string })[]> = {
    MON: [], TUE: [], WED: [], THU: [], FRI: [], SAT: [], SUN: []
  };

  schedules.forEach((schedule: any) => {
    if (!schedule.start_time) return;
    const startTime = new Date(schedule.start_time);
    const dayIndex = (startTime.getDay() + 6) % 7; // 월요일을 0으로
    const day = DAYS[dayIndex];
    const time = startTime.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
    
    const classInfo = transformSchedule(schedule);
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

export const CalendarView = ({ onAcademyClick, onClassBook }: CalendarViewProps) => {
  const [schedules, setSchedules] = useState<any[]>([]);
  const [scheduleGrid, setScheduleGrid] = useState<Record<string, (ClassInfo & { academy?: Academy; time?: string })[]>>({
    MON: [], TUE: [], WED: [], THU: [], FRI: [], SAT: [], SUN: []
  });
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [previewClass, setPreviewClass] = useState<(ClassInfo & { time?: string }) | null>(null);
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay() + 1); // 월요일
    startOfWeek.setHours(0, 0, 0, 0);
    return startOfWeek;
  });

  useEffect(() => {
    async function loadSchedules() {
      try {
        // 이번 주의 시작과 끝 날짜 계산
        const startOfWeek = new Date(currentWeekStart);
        startOfWeek.setHours(0, 0, 0, 0);
        
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6); // 일요일
        endOfWeek.setHours(23, 59, 59, 999);

        const supabase = getSupabaseClient();
        if (!supabase) {
          setLoading(false);
          return;
        }

        // 모든 스케줄 가져오기
        const { data: allSchedules, error: schedulesError } = await (supabase as any)
          .from('schedules')
          .select(`
            *,
            classes (*),
            branches (
              *,
              academies (*)
            ),
            instructors (*),
            halls (*)
          `)
          .eq('is_canceled', false)
          .gte('start_time', startOfWeek.toISOString())
          .lte('start_time', endOfWeek.toISOString())
          .order('start_time', { ascending: true });

        if (schedulesError) throw schedulesError;

        setSchedules(allSchedules || []);
        const grid = buildScheduleGrid(allSchedules || []);
        setScheduleGrid(grid);
      } catch (error) {
        console.error('Error loading schedules:', error);
      } finally {
        setLoading(false);
      }
    }
    loadSchedules();
  }, [currentWeekStart]);

  const goToPreviousWeek = () => {
    const newDate = new Date(currentWeekStart);
    newDate.setDate(newDate.getDate() - 7);
    setCurrentWeekStart(newDate);
  };

  const goToNextWeek = () => {
    const newDate = new Date(currentWeekStart);
    newDate.setDate(newDate.getDate() + 7);
    setCurrentWeekStart(newDate);
  };

  const goToToday = () => {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay() + 1);
    startOfWeek.setHours(0, 0, 0, 0);
    setCurrentWeekStart(startOfWeek);
  };

  const getWeekDates = () => {
    const dates = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(currentWeekStart);
      date.setDate(currentWeekStart.getDate() + i);
      dates.push(date);
    }
    return dates;
  };

  const getDisplayDateRange = () => {
    const start = currentWeekStart;
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return `${start.getMonth() + 1}/${start.getDate()} - ${end.getMonth() + 1}/${end.getDate()}`;
  };

  const handleClassClick = (classInfo: ClassInfo & { academy?: Academy; time?: string }) => {
    setPreviewClass(classInfo);
  };

  const handleBook = (classInfo: ClassInfo & { time?: string }) => {
    if (classInfo.status === 'FULL') {
      alert("이미 마감된 클래스입니다.");
      return;
    }
    setPreviewClass(null);
    if (onClassBook) {
      onClassBook(classInfo);
    }
  };

  if (loading) {
    return (
      <div className="h-full pt-12 px-5 pb-24 animate-in fade-in">
        <div className="text-center py-12 text-neutral-500">로딩 중...</div>
      </div>
    );
  }

  const weekDates = getWeekDates();
  const displayClasses = selectedDay 
    ? scheduleGrid[selectedDay] || []
    : Object.values(scheduleGrid).flat();

  // 시간대별로 그룹화
  const classesByTime: Record<string, (ClassInfo & { academy?: Academy; time?: string })[]> = {};
  displayClasses.forEach((cls: any) => {
    const time = cls.time || '00:00';
    if (!classesByTime[time]) {
      classesByTime[time] = [];
    }
    classesByTime[time].push(cls);
  });

  const timeSlots = Object.keys(classesByTime).sort();

  return (
    <div className="h-full pt-12 px-5 pb-24 animate-in fade-in">
      <h2 className="text-xl font-bold text-black dark:text-white mb-6">클래스 일정</h2>

      {/* 주간 네비게이션 */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={goToPreviousWeek}
          className="p-2 text-neutral-500 dark:text-neutral-400 hover:text-black dark:hover:text-white"
        >
          <ChevronLeft size={20} />
        </button>
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold text-black dark:text-white">{getDisplayDateRange()}</span>
          <button
            onClick={goToToday}
            className="text-xs px-3 py-1 bg-neutral-100 dark:bg-neutral-800 text-black dark:text-white rounded-full font-bold"
          >
            오늘
          </button>
        </div>
        <button
          onClick={goToNextWeek}
          className="p-2 text-neutral-500 dark:text-neutral-400 hover:text-black dark:hover:text-white"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      {/* 요일 선택 버튼 */}
      <div className="flex gap-2 mb-6 overflow-x-auto scrollbar-hide pb-2">
        {DAYS.map((day, index) => {
          const date = weekDates[index];
          const isToday = date.toDateString() === new Date().toDateString();
          const isSelected = selectedDay === day;
          const classCount = scheduleGrid[day]?.length || 0;

          return (
            <button
              key={day}
              onClick={() => setSelectedDay(isSelected ? null : day)}
              className={`flex-shrink-0 flex flex-col items-center gap-1 px-4 py-3 rounded-xl font-bold transition-all ${
                isSelected
                  ? 'bg-primary dark:bg-[#CCFF00] text-black'
                  : isToday
                  ? 'bg-neutral-200 dark:bg-neutral-800 text-black dark:text-white'
                  : 'bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400'
              }`}
            >
              <span className="text-xs">{DAY_NAMES[index]}</span>
              <span className="text-sm">{date.getDate()}</span>
              {classCount > 0 && (
                <span className={`text-[10px] ${isSelected ? 'text-black' : 'text-primary dark:text-[#CCFF00]'}`}>
                  {classCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* 클래스 목록 */}
      <div className="space-y-4">
        {timeSlots.length === 0 ? (
          <div className="text-center py-12 text-neutral-500 dark:text-neutral-400">
            {selectedDay ? `${DAY_NAMES[DAYS.indexOf(selectedDay)]}요일 클래스가 없습니다.` : '이번 주 클래스가 없습니다.'}
          </div>
        ) : (
          timeSlots.map((time: string) => (
            <div key={time} className="space-y-2">
              <h3 className="text-sm font-bold text-neutral-600 dark:text-neutral-400 px-2">{time}</h3>
              {classesByTime[time].map((classInfo) => (
                <div
                  key={classInfo.id}
                  className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-4 cursor-pointer active:scale-[0.98] transition-transform"
                  onClick={() => handleClassClick(classInfo)}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1">
                      <h4 className="text-base font-bold text-black dark:text-white mb-1">
                        {classInfo.class_title || `${classInfo.genre} 클래스`}
                      </h4>
                      <p className="text-xs text-neutral-600 dark:text-neutral-400">
                        {classInfo.academy?.name || '학원 정보 없음'} • {classInfo.branch_name || '지점 정보 없음'}
                      </p>
                      <p className="text-xs text-neutral-500 dark:text-neutral-500 mt-1">
                        {classInfo.instructor} • {classInfo.hall_name || '홀 정보 없음'}
                      </p>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-1 rounded ${
                      classInfo.status === 'FULL'
                        ? 'bg-red-500/10 dark:bg-red-500/10 text-red-500 dark:text-red-400'
                        : classInfo.status === 'ALMOST_FULL'
                        ? 'bg-orange-500/10 dark:bg-orange-500/10 text-orange-500 dark:text-orange-400'
                        : 'bg-primary/10 dark:bg-[#CCFF00]/10 text-primary dark:text-[#CCFF00]'
                    }`}>
                      {classInfo.status === 'FULL' ? '마감' : classInfo.status === 'ALMOST_FULL' ? '임박' : '예약 가능'}
                    </span>
                  </div>
                  {classInfo.price !== undefined && classInfo.price > 0 && (
                    <p className="text-sm font-bold text-black dark:text-white mt-2">
                      {classInfo.price.toLocaleString()}원
                    </p>
                  )}
                </div>
              ))}
            </div>
          ))
        )}
      </div>
      <ClassPreviewModal
        classInfo={previewClass}
        onClose={() => setPreviewClass(null)}
        onBook={handleBook}
      />
    </div>
  );
};

