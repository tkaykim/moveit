"use client";

import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { getSupabaseClient } from '@/lib/utils/supabase-client';
import { ClassInfo, Academy } from '@/types';
import { ClassPreviewModal } from '@/components/modals/class-preview-modal';
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

// Class를 ClassInfo로 변환
function transformClass(classData: any): ClassInfo & { academy?: Academy; time?: string; startTime?: string; endTime?: string; maxStudents?: number; currentStudents?: number } {
  const instructor = classData.instructors?.name_kr || classData.instructors?.name_en || '강사 정보 없음';
  const genre = classData.genre || 'ALL';
  const level = classData.difficulty_level || 'All Level';
  const maxStudents = classData.max_students || 0;
  const currentStudents = classData.current_students || 0;
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
  const startTimeStr = classData.start_time ? formatKSTTime(classData.start_time) : '';
  const endTimeStr = classData.end_time ? formatKSTTime(classData.end_time) : '';

  return {
    id: classData.id,
    schedule_id: classData.id,
    instructor,
    genre,
    level,
    status,
    price: classData.price || 0,
    class_title: classData.title,
    hall_name: classData.halls?.name,
    academy,
    time: startTimeStr,
    startTime: classData.start_time,
    endTime: classData.end_time,
    maxStudents,
    currentStudents,
  };
}

// 주간 클래스를 그리드로 변환
function buildClassGrid(classes: any[]) {
  const grid: Record<string, (ClassInfo & { academy?: Academy; time?: string; kstStartTime?: number })[]> = {
    MON: [], TUE: [], WED: [], THU: [], FRI: [], SAT: [], SUN: []
  };

  classes.forEach((classData: any) => {
    if (!classData.start_time) return;
    const startTime = new Date(classData.start_time);
    // KST 기준으로 요일 계산
    const dayIndex = (getKSTDay(startTime) + 6) % 7; // 월요일을 0으로
    const day = DAYS[dayIndex];
    // UTC를 KST로 변환하여 시간 표시
    const time = formatKSTTime(classData.start_time);
    
    // KST 기준 시작 시간 (밀리초) - 정렬용
    const kstStartTime = startTime.getTime() + (9 * 60 * 60 * 1000);
    
    const classInfo = transformClass(classData);
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
  const [classes, setClasses] = useState<any[]>([]);
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
    async function loadClasses() {
      try {
        // KST 기준으로 이번 주의 시작과 끝 날짜 계산 (academy-admin과 동일한 방식)
        const kstStartParts = getKSTDateParts(currentWeekStart);
        const kstEndDate = new Date(currentWeekStart.getTime() + 6 * 24 * 60 * 60 * 1000);
        const kstEndParts = getKSTDateParts(kstEndDate);
        
        // 일요일 다음 날 계산 (월 넘어감 처리)
        const kstNextDayDate = new Date(kstEndDate.getTime() + 24 * 60 * 60 * 1000);
        const kstNextDayParts = getKSTDateParts(kstNextDayDate);
        
        // KST 기준 날짜/시간 문자열 생성 (academy-admin의 convertKSTInputToUTC와 동일한 형식)
        // 월요일 00:00:00 ~ 일요일 23:59:59.999 (다음 날 00:00:00 미만)
        const kstStartString = `${kstStartParts.year}-${String(kstStartParts.month).padStart(2, '0')}-${String(kstStartParts.day).padStart(2, '0')}T00:00`;
        const kstNextDayString = `${kstNextDayParts.year}-${String(kstNextDayParts.month).padStart(2, '0')}-${String(kstNextDayParts.day).padStart(2, '0')}T00:00`;
        
        // academy-admin과 동일한 방식으로 UTC 변환
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

        // classes 테이블에서 직접 가져오기 (필요한 필드만 선택하여 성능 최적화)
        const { data: allClasses, error: classesError } = await (supabase as any)
          .from('classes')
          .select(`
            id,
            title,
            price,
            genre,
            difficulty_level,
            max_students,
            current_students,
            start_time,
            end_time,
            academies (
              id,
              name_kr,
              name_en,
              tags,
              logo_url,
              address
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
          .not('start_time', 'is', null)
          .gte('start_time', utcStart)
          .lt('start_time', utcEndNextDay) // 일요일 23:59:59.999까지 포함
          .limit(200); // 최대 200개만

        if (classesError) {
          console.error('Error loading classes:', classesError);
          setClasses([]);
        } else {
          // KST 기준으로 정렬 (academy-admin과 동일한 방식)
          const sortedClasses = (allClasses || []).sort((a: any, b: any) => {
            if (!a.start_time || !b.start_time) return 0;
            // UTC 시간을 KST로 변환하여 비교
            const aKST = new Date(a.start_time).getTime() + (9 * 60 * 60 * 1000);
            const bKST = new Date(b.start_time).getTime() + (9 * 60 * 60 * 1000);
            return aKST - bKST;
          });
          
          setClasses(sortedClasses);
          const grid = buildClassGrid(sortedClasses);
          setScheduleGrid(grid);
        }
      } catch (error) {
        console.error('Error loading classes:', error);
        setClasses([]);
      } finally {
        setLoading(false);
      }
    }
    loadClasses();
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
                        {classInfo.academy?.name || '학원 정보 없음'} {classInfo.academy?.address && `• ${classInfo.academy.address}`}
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

