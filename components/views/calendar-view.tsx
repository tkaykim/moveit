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
import { getClassColor } from '@/lib/constants/class-colors';

interface CalendarViewProps {
  onAcademyClick?: (academy: Academy) => void;
  onClassBook?: (classInfo: ClassInfo & { time?: string; price?: number }) => void;
}

const DAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
const DAY_NAMES = ["월", "화", "수", "목", "금", "토", "일"];

// Schedule을 ClassInfo로 변환
function transformSchedule(scheduleData: any): ClassInfo & { academy?: Academy; time?: string; endTimeFormatted?: string; startTime?: string; endTime?: string; maxStudents?: number; currentStudents?: number; _colorStyle: ReturnType<typeof getClassColor> } {
  const classData = scheduleData.classes || {};
  const instructor = scheduleData.instructors?.name_kr || scheduleData.instructors?.name_en || classData.instructors?.name_kr || '';
  const genre = classData.genre || 'ALL';
  const level = classData.difficulty_level || '';
  const maxStudents = scheduleData.max_students || classData.max_students || 0;
  const currentStudents = scheduleData.current_students || 0;
  const isFull = maxStudents > 0 && currentStudents >= maxStudents;
  const isAlmostFull = maxStudents > 0 && currentStudents >= maxStudents * 0.8;
  const status = isFull ? 'FULL' : isAlmostFull ? 'ALMOST_FULL' : 'AVAILABLE';
  const colorStyle = getClassColor(scheduleData.card_color ?? classData.card_color, classData.difficulty_level);

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
    _colorStyle: colorStyle,
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
            card_color,
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
              card_color,
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
    <div className="h-full pt-7 px-5 pb-24 animate-in fade-in">
      {/* 헤더 — 디자인 패턴: meta + mono section label */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-accent" />
          <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-text-3">
            THIS WEEK · {getDisplayDateRange()}
          </span>
        </div>
        <LanguageToggle />
      </div>
      <h1 className="text-[28px] font-semibold leading-[1.1] tracking-[-0.03em] text-text mb-5">
        수업 캘린더
      </h1>

      {/* 주간 네비게이션 — 작은 chevron + 이번주 칩 */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={goToPreviousWeek}
          className="p-1.5 text-text-3 hover:text-text"
        >
          <ChevronLeft size={16} />
        </button>
        <button
          onClick={goToToday}
          className="font-mono text-[11px] uppercase tracking-[0.06em] px-2.5 py-1 rounded-md bg-surface-2 text-text-2 hover:bg-surface-3 transition-colors"
        >
          이번주
        </button>
        <button
          onClick={goToNextWeek}
          className="p-1.5 text-text-3 hover:text-text"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {/* 요일 그리드 — 디자인 패턴 7-cell boxed (each cell with individual border) */}
      <div className="grid grid-cols-7 gap-1.5 mb-6">
        {DAYS.map((day, index) => {
          const date = weekDates[index];
          const isToday = isKSTToday(date);
          const isSelected = selectedDay === day;
          const classCount = scheduleGrid[day]?.length || 0;
          const dayOfMonth = getKSTDayOfMonth(date);
          const active = isSelected || (selectedDay === null && isToday);

          return (
            <button
              key={day}
              onClick={() => setSelectedDay(isSelected ? null : day)}
              className={`relative flex flex-col items-center justify-center gap-1 py-3 rounded-[10px] border transition-colors ${
                active
                  ? 'bg-text text-bg border-text'
                  : 'border-border bg-surface text-text-3 hover:border-border-strong'
              }`}
            >
              <span className={`font-mono text-[10px] uppercase tracking-[0.06em] ${active ? 'opacity-80' : ''}`}>
                {day}
              </span>
              <span className={`text-[15px] font-semibold ${active ? '' : 'text-text'}`}>
                {dayOfMonth}
              </span>
              {classCount > 0 && (
                <span
                  className={`absolute bottom-1.5 w-1 h-1 rounded-full ${active ? 'bg-bg/70' : 'bg-accent'}`}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* 클래스 목록 — 디자인 패턴: 좌측 mono 시간(장르 컬러) + 본문 */}
      <div className="space-y-5">
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-surface border border-border rounded-[10px] p-3.5 animate-pulse">
                <div className="flex gap-3">
                  <div className="w-12 space-y-1">
                    <div className="h-3 bg-surface-3 rounded" />
                    <div className="h-2 bg-surface-3 rounded w-8" />
                  </div>
                  <div className="flex-1 space-y-1.5">
                    <div className="h-4 bg-surface-3 rounded w-32" />
                    <div className="h-3 bg-surface-3 rounded w-24" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : timeSlots.length === 0 ? (
          <div className="text-center py-12 text-text-4 text-[13px]">
            {selectedDay ? `${DAY_NAMES[DAYS.indexOf(selectedDay)]}요일 클래스가 없습니다.` : '이번 주 클래스가 없습니다.'}
          </div>
        ) : (
          timeSlots.map((time: string) => (
            <div key={time} className="space-y-2">
              {classesByTime[time].map((classInfo) => {
                const endTimeStr = (classInfo as any).endTimeFormatted;
                const color = (classInfo as any)._colorStyle ?? getClassColor((classInfo as any).card_color, classInfo.level);

                return (
                  <div
                    key={`${classInfo.schedule_id || classInfo.id}`}
                    className={`bg-surface border ${color.border} rounded-[10px] p-3.5 cursor-pointer active:scale-[0.99] transition-transform flex items-stretch gap-3`}
                    onClick={() => handleClassClick(classInfo)}
                  >
                    {/* 좌측: mono start/end 시간 (장르 컬러) */}
                    <div className="font-mono shrink-0 w-12 flex flex-col">
                      <span className={`text-[15px] font-semibold leading-none ${color.text}`}>{classInfo.time}</span>
                      {endTimeStr && (
                        <span className="text-[11px] text-text-4 mt-1 leading-none">{endTimeStr}</span>
                      )}
                    </div>

                    {/* 본문 */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <h4 className="text-[14px] font-semibold text-text tracking-[-0.01em] truncate">
                          {classInfo.class_title || `${classInfo.genre} 클래스`}
                        </h4>
                        {classInfo.level && <LevelBadge level={classInfo.level} />}
                      </div>
                      <div className="mt-1 text-[11px] text-text-3 truncate">
                        {classInfo.genre && <span>{classInfo.genre}</span>}
                        {classInfo.instructor && (
                          <>
                            {classInfo.genre && <> · </>}
                            {classInfo.instructor}
                          </>
                        )}
                      </div>
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

