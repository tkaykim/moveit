"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { ChevronLeft, ChevronRight, MapPin, Clock, User } from 'lucide-react';
import { ClassInfo } from '@/types';
import { formatKSTTime, getKSTDateParts, getKSTDay, convertKSTInputToUTC } from '@/lib/utils/kst-time';

interface AcademyWeeklyScheduleViewProps {
  academyId: string;
  onClassClick: (classInfo: ClassInfo & { time?: string }) => void;
}

const DAYS_KR = ["월", "화", "수", "목", "금", "토", "일"];
const DAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

// 난이도별 색상
const LEVEL_COLORS: Record<string, { bg: string; border: string; text: string; dot: string }> = {
  BEGINNER: { bg: 'bg-emerald-50 dark:bg-emerald-900/20', border: 'border-emerald-300 dark:border-emerald-700', text: 'text-emerald-700 dark:text-emerald-400', dot: 'bg-emerald-500' },
  INTERMEDIATE: { bg: 'bg-amber-50 dark:bg-amber-900/20', border: 'border-amber-300 dark:border-amber-700', text: 'text-amber-700 dark:text-amber-400', dot: 'bg-amber-500' },
  ADVANCED: { bg: 'bg-rose-50 dark:bg-rose-900/20', border: 'border-rose-300 dark:border-rose-700', text: 'text-rose-700 dark:text-rose-400', dot: 'bg-rose-500' },
};

// Schedule을 ClassInfo로 변환
function transformSchedule(scheduleData: any): ClassInfo & { time?: string; startTime?: string; endTime?: string; hallName?: string } {
  const classInfo = scheduleData.classes;
  const instructor = scheduleData.instructors?.name_kr || scheduleData.instructors?.name_en || classInfo?.instructors?.name_kr || classInfo?.instructors?.name_en || '강사 미정';
  const genre = classInfo?.genre || '';
  const level = classInfo?.difficulty_level || 'All Level';
  const maxStudents = scheduleData.max_students || classInfo?.max_students || 0;
  const currentStudents = scheduleData.current_students || 0;
  const isFull = maxStudents > 0 && currentStudents >= maxStudents;
  const status = isFull ? 'FULL' : 'AVAILABLE';
  const hallName = scheduleData.halls?.name || classInfo?.halls?.name || '';

  const time = scheduleData.start_time ? formatKSTTime(scheduleData.start_time) : '';

  return {
    id: classInfo?.id || scheduleData.class_id,
    schedule_id: scheduleData.id,
    instructor,
    genre,
    level,
    status,
    price: 0,
    class_title: classInfo?.title || '',
    hall_name: hallName,
    academy: {
      id: classInfo?.academies?.id || classInfo?.academy_id || '',
      name: classInfo?.academies?.name_kr || classInfo?.academies?.name_en || '',
    },
    time,
    startTime: scheduleData.start_time,
    endTime: scheduleData.end_time,
    maxStudents,
    currentStudents,
    hallName,
  };
}

// 주간 스케줄을 요일별로 그룹화
function groupSchedulesByDay(schedules: any[]) {
  const grid: Record<string, (ClassInfo & { time?: string; hallName?: string })[]> = {
    MON: [], TUE: [], WED: [], THU: [], FRI: [], SAT: [], SUN: []
  };

  schedules.forEach((scheduleData: any) => {
    if (!scheduleData.start_time) return;
    const startTime = new Date(scheduleData.start_time);
    const dayIndex = (getKSTDay(startTime) + 6) % 7;
    const day = DAYS[dayIndex];
    const classInfo = transformSchedule(scheduleData);
    grid[day].push(classInfo);
  });

  // 시간순 정렬
  Object.keys(grid).forEach((day) => {
    grid[day].sort((a, b) => (a.time || '').localeCompare(b.time || ''));
  });

  return grid;
}

const getLevelColor = (level: string) => {
  const upperLevel = level?.toUpperCase() || '';
  if (upperLevel.includes('BEGINNER') || upperLevel.includes('초급')) return LEVEL_COLORS.BEGINNER;
  if (upperLevel.includes('INTERMEDIATE') || upperLevel.includes('중급')) return LEVEL_COLORS.INTERMEDIATE;
  if (upperLevel.includes('ADVANCED') || upperLevel.includes('고급')) return LEVEL_COLORS.ADVANCED;
  return { bg: 'bg-neutral-100 dark:bg-neutral-800', border: 'border-neutral-300 dark:border-neutral-700', text: 'text-neutral-600 dark:text-neutral-400', dot: 'bg-neutral-400' };
};

const getLevelLabel = (level: string) => {
  const upperLevel = level?.toUpperCase() || '';
  if (upperLevel.includes('BEGINNER') || upperLevel.includes('초급')) return '초급';
  if (upperLevel.includes('INTERMEDIATE') || upperLevel.includes('중급')) return '중급';
  if (upperLevel.includes('ADVANCED') || upperLevel.includes('고급')) return '고급';
  return 'All';
};

export const AcademyWeeklyScheduleView = ({ academyId, onClassClick }: AcademyWeeklyScheduleViewProps) => {
  const [schedules, setSchedules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [scheduleGrid, setScheduleGrid] = useState<Record<string, (ClassInfo & { time?: string; hallName?: string })[]>>({
    MON: [], TUE: [], WED: [], THU: [], FRI: [], SAT: [], SUN: []
  });
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => {
    const now = new Date();
    const startOfWeek = new Date(now);
    const dayOfWeek = now.getDay();
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    startOfWeek.setDate(now.getDate() - daysToMonday);
    startOfWeek.setHours(0, 0, 0, 0);
    return startOfWeek;
  });
  const [selectedDayIndex, setSelectedDayIndex] = useState<number>(() => {
    const now = new Date();
    const dayOfWeek = now.getDay();
    return dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  });
  
  const dayScrollRef = useRef<HTMLDivElement>(null);

  // 오늘의 요일 인덱스 (월=0, 일=6)
  const getTodayDayIndex = useCallback(() => {
    const now = new Date();
    const dayOfWeek = now.getDay();
    return dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  }, []);

  // 오늘이 현재 주에 포함되는지 확인
  const isCurrentWeek = useCallback(() => {
    const now = new Date();
    const weekEnd = new Date(currentWeekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);
    return now >= currentWeekStart && now <= weekEnd;
  }, [currentWeekStart]);

  // 각 날짜 가져오기
  const getDateForDay = useCallback((dayIndex: number) => {
    const date = new Date(currentWeekStart);
    date.setDate(date.getDate() + dayIndex);
    return date;
  }, [currentWeekStart]);

  const loadSchedules = useCallback(async (signal?: AbortSignal) => {
    try {
      setLoading(true);
      const kstStartParts = getKSTDateParts(currentWeekStart);
      const kstEndDate = new Date(currentWeekStart.getTime() + 6 * 24 * 60 * 60 * 1000);
      const kstNextDayDate = new Date(kstEndDate.getTime() + 24 * 60 * 60 * 1000);
      const kstNextDayParts = getKSTDateParts(kstNextDayDate);
      
      const kstStartString = `${kstStartParts.year}-${String(kstStartParts.month).padStart(2, '0')}-${String(kstStartParts.day).padStart(2, '0')}T00:00`;
      const kstNextDayString = `${kstNextDayParts.year}-${String(kstNextDayParts.month).padStart(2, '0')}-${String(kstNextDayParts.day).padStart(2, '0')}T00:00`;
      
      const utcStart = convertKSTInputToUTC(kstStartString);
      const utcEndNextDay = convertKSTInputToUTC(kstNextDayString);

      if (!utcStart || !utcEndNextDay) {
        setLoading(false);
        return;
      }

      const { getSupabaseClient } = await import('@/lib/utils/supabase-client');
      const supabase = getSupabaseClient();
      if (!supabase) {
        setLoading(false);
        return;
      }

      const { data: academyClasses, error: classesError } = await supabase
        .from('classes')
        .select('id')
        .eq('academy_id', academyId)
        .eq('is_canceled', false)
        .or('is_active.is.null,is_active.eq.true');

      if (classesError) throw classesError;
      
      const classIds = (academyClasses || []).map((c: { id: string }) => c.id);
      
      if (classIds.length === 0) {
        if (signal?.aborted) return;
        setSchedules([]);
        setScheduleGrid({ MON: [], TUE: [], WED: [], THU: [], FRI: [], SAT: [], SUN: [] });
        setLoading(false);
        return;
      }

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
            genre,
            difficulty_level,
            max_students,
            academy_id,
            is_active,
            video_url,
            thumbnail_url,
            description,
            academies (
              id,
              name_kr,
              name_en
            ),
            instructors (
              id,
              name_kr,
              name_en,
              profile_image_url
            ),
            halls (
              id,
              name
            )
          ),
          instructors (
            id,
            name_kr,
            name_en,
            profile_image_url
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
      setScheduleGrid(groupSchedulesByDay(allSchedules || []));
    } catch (error) {
      if (signal?.aborted) return;
      console.error('Error loading schedules:', error);
      setSchedules([]);
      setScheduleGrid({ MON: [], TUE: [], WED: [], THU: [], FRI: [], SAT: [], SUN: [] });
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  }, [academyId, currentWeekStart]);

  useEffect(() => {
    const abortController = new AbortController();
    loadSchedules(abortController.signal);
    return () => abortController.abort();
  }, [loadSchedules]);

  // 주가 바뀌면 오늘 요일 또는 월요일로 선택
  useEffect(() => {
    if (isCurrentWeek()) {
      setSelectedDayIndex(getTodayDayIndex());
    } else {
      setSelectedDayIndex(0); // 월요일
    }
  }, [currentWeekStart, isCurrentWeek, getTodayDayIndex]);

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
    const dayOfWeek = now.getDay();
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    startOfWeek.setDate(now.getDate() - daysToMonday);
    startOfWeek.setHours(0, 0, 0, 0);
    setCurrentWeekStart(startOfWeek);
    setSelectedDayIndex(getTodayDayIndex());
  };

  // 월/년 표시 포맷
  const getMonthDisplay = () => {
    const weekEnd = new Date(currentWeekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    
    const startMonth = currentWeekStart.getMonth() + 1;
    const endMonth = weekEnd.getMonth() + 1;
    const year = currentWeekStart.getFullYear();
    
    if (startMonth === endMonth) {
      return `${year}년 ${startMonth}월`;
    }
    return `${startMonth}월 ~ ${endMonth}월`;
  };

  const todayIndex = getTodayDayIndex();
  const inCurrentWeek = isCurrentWeek();
  const selectedDay = DAYS[selectedDayIndex];
  const selectedDaySchedules = scheduleGrid[selectedDay] || [];

  // 홀별로 그룹화
  const schedulesByHall = selectedDaySchedules.reduce((acc, schedule) => {
    const hallName = (schedule as any).hallName || schedule.hall_name || '미지정';
    if (!acc[hallName]) {
      acc[hallName] = [];
    }
    acc[hallName].push(schedule);
    return acc;
  }, {} as Record<string, typeof selectedDaySchedules>);

  const hallNames = Object.keys(schedulesByHall).sort();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary dark:border-[#CCFF00] border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 주간 네비게이션 */}
      <div className="flex items-center justify-between">
        <button
          onClick={goToPreviousWeek}
          className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-full transition-colors"
        >
          <ChevronLeft size={20} className="text-neutral-600 dark:text-neutral-400" />
        </button>
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold text-black dark:text-white">{getMonthDisplay()}</span>
          <button
            onClick={goToToday}
            className="text-xs px-3 py-1.5 bg-primary/10 dark:bg-[#CCFF00]/10 text-primary dark:text-[#CCFF00] rounded-full font-medium hover:bg-primary/20 dark:hover:bg-[#CCFF00]/20 transition-colors"
          >
            오늘
          </button>
        </div>
        <button
          onClick={goToNextWeek}
          className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-full transition-colors"
        >
          <ChevronRight size={20} className="text-neutral-600 dark:text-neutral-400" />
        </button>
      </div>

      {/* 요일 선택 탭 (가로 스크롤) */}
      <div 
        ref={dayScrollRef}
        className="flex gap-2 overflow-x-auto scrollbar-hide pb-1 -mx-1 px-1"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {DAYS.map((day, index) => {
          const date = getDateForDay(index);
          const isToday = inCurrentWeek && index === todayIndex;
          const isSelected = index === selectedDayIndex;
          const dayDate = date.getDate();
          const hasClasses = (scheduleGrid[day] || []).length > 0;
          
          return (
            <button
              key={day}
              onClick={() => setSelectedDayIndex(index)}
              className={`flex-shrink-0 flex flex-col items-center py-2 px-4 rounded-xl transition-all ${
                isSelected
                  ? 'bg-primary dark:bg-[#CCFF00] text-white dark:text-black shadow-lg'
                  : isToday
                    ? 'bg-primary/20 dark:bg-[#CCFF00]/20 text-primary dark:text-[#CCFF00]'
                    : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
              }`}
            >
              <span className="text-[10px] font-medium opacity-80">{DAYS_KR[index]}</span>
              <span className="text-lg font-bold">{dayDate}</span>
              {hasClasses && !isSelected && (
                <div className="w-1.5 h-1.5 rounded-full bg-primary dark:bg-[#CCFF00] mt-0.5"></div>
              )}
              {isSelected && hasClasses && (
                <div className="w-1.5 h-1.5 rounded-full bg-white dark:bg-black mt-0.5"></div>
              )}
            </button>
          );
        })}
      </div>

      {/* 선택된 요일의 수업 목록 */}
      <div className="space-y-4">
        {selectedDaySchedules.length === 0 ? (
          <div className="text-center py-12 bg-neutral-50 dark:bg-neutral-900/50 rounded-2xl">
            <p className="text-neutral-500 dark:text-neutral-400 text-sm">
              {DAYS_KR[selectedDayIndex]}요일에는 예정된 수업이 없습니다
            </p>
          </div>
        ) : (
          <>
            {/* 홀별로 그룹화하여 표시 */}
            {hallNames.map((hallName) => (
              <div key={hallName} className="space-y-2">
                {/* 홀이 여러개인 경우에만 홀 이름 표시 */}
                {hallNames.length > 1 && (
                  <div className="flex items-center gap-2 px-1">
                    <MapPin size={12} className="text-neutral-400" />
                    <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
                      {hallName}
                    </span>
                  </div>
                )}
                
                {/* 해당 홀의 수업 목록 */}
                <div className="space-y-2">
                  {schedulesByHall[hallName].map((classInfo, idx) => {
                    const levelColor = getLevelColor(classInfo.level);
                    const isFull = classInfo.status === 'FULL';
                    const endTimeStr = classInfo.endTime 
                      ? new Date(classInfo.endTime).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })
                      : null;
                    
                    return (
                      <button
                        key={`${classInfo.schedule_id || classInfo.id}-${idx}`}
                        onClick={() => onClassClick(classInfo)}
                        className={`w-full p-4 rounded-2xl border-2 text-left transition-all hover:shadow-md active:scale-[0.98] ${levelColor.bg} ${levelColor.border} ${
                          isFull ? 'opacity-60' : ''
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          {/* 시간 */}
                          <div className="flex-shrink-0 text-center">
                            <div className={`text-lg font-black ${levelColor.text}`}>
                              {classInfo.time}
                            </div>
                            {endTimeStr && (
                              <div className="text-[10px] text-neutral-500 dark:text-neutral-400">
                                ~{endTimeStr}
                              </div>
                            )}
                          </div>
                          
                          {/* 구분선 */}
                          <div className={`w-0.5 self-stretch rounded-full ${levelColor.dot} opacity-50`}></div>
                          
                          {/* 수업 정보 */}
                          <div className="flex-1 min-w-0">
                            {/* 수업명 */}
                            <div className="font-bold text-black dark:text-white text-base leading-tight">
                              {classInfo.class_title || classInfo.genre || '수업'}
                            </div>
                            
                            {/* 강사 & 장르 */}
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              <div className="flex items-center gap-1">
                                <User size={12} className="text-neutral-400" />
                                <span className="text-sm text-neutral-600 dark:text-neutral-300">
                                  {classInfo.instructor}
                                </span>
                              </div>
                              {classInfo.genre && classInfo.class_title && (
                                <span className="text-xs px-2 py-0.5 bg-black/5 dark:bg-white/10 rounded-full text-neutral-600 dark:text-neutral-300">
                                  {classInfo.genre}
                                </span>
                              )}
                            </div>
                            
                            {/* 홀 정보 (홀이 1개인 경우에만 여기 표시) */}
                            {hallNames.length === 1 && hallName !== '미지정' && (
                              <div className="flex items-center gap-1 mt-1.5">
                                <MapPin size={11} className="text-neutral-400" />
                                <span className="text-xs text-neutral-500 dark:text-neutral-400">
                                  {hallName}
                                </span>
                              </div>
                            )}
                          </div>
                          
                          {/* 난이도 & 상태 */}
                          <div className="flex-shrink-0 flex flex-col items-end gap-1">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${levelColor.text} bg-white/50 dark:bg-black/20`}>
                              {getLevelLabel(classInfo.level)}
                            </span>
                            {isFull && (
                              <span className="text-[10px] font-bold text-rose-500 dark:text-rose-400">
                                마감
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      {/* 범례 */}
      <div className="flex items-center justify-center gap-4 pt-2 border-t border-neutral-200 dark:border-neutral-800">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
          <span className="text-[10px] text-neutral-500 dark:text-neutral-400">초급</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-amber-500"></div>
          <span className="text-[10px] text-neutral-500 dark:text-neutral-400">중급</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-rose-500"></div>
          <span className="text-[10px] text-neutral-500 dark:text-neutral-400">고급</span>
        </div>
      </div>
    </div>
  );
};
