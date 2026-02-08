"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, Clock, MapPin } from 'lucide-react';
import { getSupabaseClient } from '@/lib/utils/supabase-client';
import { ClassInfo, Academy } from '@/types';
import { ClassPreviewModal } from '@/components/modals/class-preview-modal';
import { LevelBadge } from '@/components/common/level-badge';
import { LanguageToggle } from '@/components/common/language-toggle';
import { 
  formatKSTTime, 
  getKSTWeekStart, 
  getKSTDay, 
  getKSTDateParts,
  formatKSTDateRange,
  isKSTToday,
  getKSTDayOfMonth,
  getKSTNow,
  convertKSTInputToUTC
} from '@/lib/utils/kst-time';

interface CalendarViewProps {
  onAcademyClick?: (academy: Academy) => void;
  onClassBook?: (classInfo: ClassInfo & { time?: string; price?: number }) => void;
}

const DAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
const DAY_NAMES = ["월", "화", "수", "목", "금", "토", "일"];

// Schedule을 ClassInfo로 변환
function transformSchedule(scheduleData: any): ClassInfo & { academy?: Academy; time?: string; endTimeFormatted?: string; startTime?: string; endTime?: string; maxStudents?: number; currentStudents?: number } {
  const classData = scheduleData.classes || {};
  const instructor = scheduleData.instructors?.name_kr || scheduleData.instructors?.name_en || classData.instructors?.name_kr || '';
  const genre = classData.genre || 'ALL';
  const level = classData.difficulty_level || 'All Level';
  const maxStudents = scheduleData.max_students || classData.max_students || 0;
  const currentStudents = scheduleData.current_students || 0;
  const isFull = maxStudents > 0 && currentStudents >= maxStudents;
  const isAlmostFull = maxStudents > 0 && currentStudents >= maxStudents * 0.8;
  const status = isFull ? 'FULL' : isAlmostFull ? 'ALMOST_FULL' : 'AVAILABLE';

  // Academy 정보 생성
  const academyData = classData.academies;
  const academy: Academy | undefined = academyData ? {
    id: academyData.id,
    name_kr: academyData.name_kr,
    name_en: academyData.name_en,
    tags: academyData.tags,
    logo_url: academyData.logo_url,
    name: academyData.name_kr || academyData.name_en || '학원 정보 없음',
    address: academyData.address,
  } : undefined;

  // 시간 정보 (UTC를 KST로 변환하여 표시)
  const startTimeStr = scheduleData.start_time ? formatKSTTime(scheduleData.start_time) : '';
  const endTimeStr = scheduleData.end_time ? formatKSTTime(scheduleData.end_time) : '';

  return {
    id: classData.id || scheduleData.id,
    schedule_id: scheduleData.id,
    instructor,
    genre,
    level,
    status,
    price: 0,
    class_title: classData.title || '클래스',
    hall_name: scheduleData.halls?.name || classData.halls?.name,
    poster_url: classData.poster_url || null,
    academy,
    time: startTimeStr,
    endTimeFormatted: endTimeStr,
    startTime: scheduleData.start_time,
    endTime: scheduleData.end_time,
    maxStudents,
    currentStudents,
  };
}

// 주간 스케줄을 그리드로 변환
function buildScheduleGrid(schedules: any[]) {
  const grid: Record<string, (ClassInfo & { academy?: Academy; time?: string; kstStartTime?: number })[]> = {
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
    
    // KST 기준 시작 시간 (밀리초) - 정렬용
    const kstStartTime = startTime.getTime() + (9 * 60 * 60 * 1000);
    
    const classInfo = transformSchedule(scheduleData);
    classInfo.time = time;
    (classInfo as any).kstStartTime = kstStartTime;
    
    grid[day].push(classInfo);
  });

  // KST 기준 시간순으로 정렬
  Object.keys(grid).forEach((day: string) => {
    grid[day].sort((a, b) => {
      // KST 기준 시작 시간으로 정렬
      const timeA = (a as any).kstStartTime || 0;
      const timeB = (b as any).kstStartTime || 0;
      return timeA - timeB;
    });
  });

  return grid;
}

export const CalendarView = ({ onAcademyClick, onClassBook }: CalendarViewProps) => {
  const router = useRouter();
  const [schedules, setSchedules] = useState<any[]>([]);
  const [scheduleGrid, setScheduleGrid] = useState<Record<string, (ClassInfo & { academy?: Academy; time?: string })[]>>({
    MON: [], TUE: [], WED: [], THU: [], FRI: [], SAT: [], SUN: []
  });
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [previewClass, setPreviewClass] = useState<(ClassInfo & { time?: string }) | null>(null);
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => {
    // KST 기준으로 주의 시작(월요일) 계산
    return getKSTWeekStart();
  });

  useEffect(() => {
    async function loadSchedules() {
      try {
        setLoading(true);
        
        // KST 기준으로 이번 주의 시작과 끝 날짜 계산
        const kstStartParts = getKSTDateParts(currentWeekStart);
        const kstEndDate = new Date(currentWeekStart.getTime() + 6 * 24 * 60 * 60 * 1000);
        
        // 일요일 다음 날 계산 (월 넘어감 처리)
        const kstNextDayDate = new Date(kstEndDate.getTime() + 24 * 60 * 60 * 1000);
        const kstNextDayParts = getKSTDateParts(kstNextDayDate);
        
        // KST 기준 날짜/시간 문자열 생성
        const kstStartString = `${kstStartParts.year}-${String(kstStartParts.month).padStart(2, '0')}-${String(kstStartParts.day).padStart(2, '0')}T00:00`;
        const kstNextDayString = `${kstNextDayParts.year}-${String(kstNextDayParts.month).padStart(2, '0')}-${String(kstNextDayParts.day).padStart(2, '0')}T00:00`;
        
        // UTC 변환
        const utcStart = convertKSTInputToUTC(kstStartString);
        const utcEndNextDay = convertKSTInputToUTC(kstNextDayString);

        if (!utcStart || !utcEndNextDay) {
          console.error('날짜 변환 실패');
          setLoading(false);
          return;
        }

        const supabase = getSupabaseClient();
        if (!supabase) {
          setLoading(false);
          return;
        }

        // schedules 테이블에서 가져오기
        const { data: allSchedules, error: schedulesError } = await (supabase as any)
          .from('schedules')
          .select(`
            id,
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
              class_type,
              poster_url,
              academies (
                id,
                name_kr,
                name_en,
                tags,
                logo_url,
                address
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
          .eq('is_canceled', false)
          .gte('start_time', utcStart)
          .lt('start_time', utcEndNextDay)
          .order('start_time', { ascending: true })
          .limit(200);

        if (schedulesError) {
          console.error('Error loading schedules:', schedulesError);
          setSchedules([]);
        } else {
          // KST 기준으로 정렬
          const sortedSchedules = (allSchedules || []).sort((a: any, b: any) => {
            if (!a.start_time || !b.start_time) return 0;
            const aKST = new Date(a.start_time).getTime() + (9 * 60 * 60 * 1000);
            const bKST = new Date(b.start_time).getTime() + (9 * 60 * 60 * 1000);
            return aKST - bKST;
          });
          
          setSchedules(sortedSchedules);
          const grid = buildScheduleGrid(sortedSchedules);
          setScheduleGrid(grid);
        }
      } catch (error) {
        console.error('Error loading schedules:', error);
        setSchedules([]);
      } finally {
        setLoading(false);
      }
    }
    loadSchedules();
  }, [currentWeekStart]);

  const goToPreviousWeek = () => {
    // KST 기준으로 이전 주 계산
    const kstStart = new Date(currentWeekStart.getTime() + (9 * 60 * 60 * 1000));
    kstStart.setUTCDate(kstStart.getUTCDate() - 7);
    kstStart.setUTCHours(0, 0, 0, 0);
    setCurrentWeekStart(new Date(kstStart.getTime() - (9 * 60 * 60 * 1000)));
  };

  const goToNextWeek = () => {
    // KST 기준으로 다음 주 계산
    const kstStart = new Date(currentWeekStart.getTime() + (9 * 60 * 60 * 1000));
    kstStart.setUTCDate(kstStart.getUTCDate() + 7);
    kstStart.setUTCHours(0, 0, 0, 0);
    setCurrentWeekStart(new Date(kstStart.getTime() - (9 * 60 * 60 * 1000)));
  };

  const goToToday = () => {
    // KST 기준으로 오늘의 주 시작(월요일) 계산
    setCurrentWeekStart(getKSTWeekStart());
  };

  const getWeekDates = () => {
    // KST 기준으로 주의 날짜들 계산
    const dates = [];
    const kstStart = new Date(currentWeekStart.getTime() + (9 * 60 * 60 * 1000));
    
    for (let i = 0; i < 7; i++) {
      const kstDate = new Date(kstStart);
      kstDate.setUTCDate(kstStart.getUTCDate() + i);
      kstDate.setUTCHours(0, 0, 0, 0);
      // UTC로 변환하여 반환
      dates.push(new Date(kstDate.getTime() - (9 * 60 * 60 * 1000)));
    }
    return dates;
  };

  const getDisplayDateRange = () => {
    // KST 기준으로 날짜 범위 표시
    const start = currentWeekStart;
    const kstStart = new Date(start.getTime() + (9 * 60 * 60 * 1000));
    const kstEnd = new Date(kstStart);
    kstEnd.setUTCDate(kstStart.getUTCDate() + 6);
    
    return formatKSTDateRange(
      new Date(kstStart.getTime() - (9 * 60 * 60 * 1000)),
      new Date(kstEnd.getTime() - (9 * 60 * 60 * 1000))
    );
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
    
    // schedule_id가 있으면 새 예약 페이지로 이동
    if (classInfo.schedule_id) {
      router.push(`/book/session/${classInfo.schedule_id}`);
    } else if (onClassBook) {
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

  // 시간대별로 그룹화 (KST 기준)
  const classesByTime: Record<string, (ClassInfo & { academy?: Academy; time?: string; kstStartTime?: number })[]> = {};
  displayClasses.forEach((cls: any) => {
    const time = cls.time || '00:00';
    if (!classesByTime[time]) {
      classesByTime[time] = [];
    }
    classesByTime[time].push(cls);
  });

  // KST 기준 시간순으로 정렬 (시간 문자열을 숫자로 변환하여 정렬)
  const timeSlots = Object.keys(classesByTime).sort((a, b) => {
    const [hoursA, minutesA] = a.split(':').map(Number);
    const [hoursB, minutesB] = b.split(':').map(Number);
    const timeA = hoursA * 60 + minutesA;
    const timeB = hoursB * 60 + minutesB;
    return timeA - timeB;
  });

  return (
    <div className="h-full pt-12 px-5 pb-24 animate-in fade-in">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-black dark:text-white">클래스 일정</h2>
        <LanguageToggle />
      </div>

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
            이번주
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
          const isToday = isKSTToday(date);
          const isSelected = selectedDay === day;
          const classCount = scheduleGrid[day]?.length || 0;
          const dayOfMonth = getKSTDayOfMonth(date);

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
              <span className="text-sm">{dayOfMonth}</span>
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
              {classesByTime[time].map((classInfo) => {
                const endTimeStr = (classInfo as any).endTimeFormatted;

                return (
                  <div
                    key={`${classInfo.schedule_id || classInfo.id}`}
                    className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-4 cursor-pointer active:scale-[0.98] transition-transform"
                    onClick={() => handleClassClick(classInfo)}
                  >
                    {/* 상단: 제목 + 난이도 + 상태 */}
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className="text-base font-bold text-black dark:text-white leading-tight truncate">
                        {classInfo.class_title || `${classInfo.genre} 클래스`}
                      </h4>
                      <LevelBadge level={classInfo.level} />
                      <div className="flex-1" />
                      {classInfo.status === 'FULL' ? (
                        <span className="flex-shrink-0 text-[10px] font-bold px-2 py-1 rounded bg-red-500/10 text-red-500 dark:text-red-400">
                          마감
                        </span>
                      ) : classInfo.status === 'ALMOST_FULL' ? (
                        <span className="flex-shrink-0 text-[10px] font-bold px-2 py-1 rounded bg-orange-500/10 text-orange-500 dark:text-orange-400">
                          마감임박
                        </span>
                      ) : null}
                    </div>

                    {/* 중단: 강사 */}
                    {classInfo.instructor && (
                      <div className="mb-2">
                        <span className="text-sm text-neutral-700 dark:text-neutral-300 font-medium">
                          {classInfo.instructor}
                        </span>
                      </div>
                    )}

                    {/* 하단: 시간 · 학원 · 인원 */}
                    <div className="flex items-center flex-wrap gap-x-3 gap-y-1 text-xs text-neutral-500 dark:text-neutral-400">
                      <span className="inline-flex items-center gap-1">
                        <Clock size={12} />
                        {classInfo.time}{endTimeStr ? ` - ${endTimeStr}` : ''}
                      </span>
                      {classInfo.academy?.name && (
                        <span className="inline-flex items-center gap-1">
                          <MapPin size={12} />
                          {classInfo.academy.name}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
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

