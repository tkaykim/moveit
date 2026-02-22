"use client";

import { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, X, User, MapPin } from 'lucide-react';
import { ClassInfo } from '@/types';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { formatKSTTime, getKSTDateParts, convertKSTInputToUTC } from '@/lib/utils/kst-time';
import { useLocale } from '@/contexts/LocaleContext';

interface AcademyMonthlyScheduleViewProps {
  academyId: string;
  onClassClick: (classInfo: ClassInfo & { time?: string }) => void;
}

const INSTRUCTOR_TBD = '강사 미정';

// 난이도별 색상
const LEVEL_COLORS: Record<string, { bg: string; border: string; text: string; dot: string }> = {
  BEGINNER: { bg: 'bg-emerald-50 dark:bg-emerald-900/20', border: 'border-emerald-300 dark:border-emerald-700', text: 'text-emerald-700 dark:text-emerald-400', dot: 'bg-emerald-500' },
  INTERMEDIATE: { bg: 'bg-amber-50 dark:bg-amber-900/20', border: 'border-amber-300 dark:border-amber-700', text: 'text-amber-700 dark:text-amber-400', dot: 'bg-amber-500' },
  ADVANCED: { bg: 'bg-rose-50 dark:bg-rose-900/20', border: 'border-rose-300 dark:border-rose-700', text: 'text-rose-700 dark:text-rose-400', dot: 'bg-rose-500' },
};

// Schedule을 ClassInfo로 변환
function transformSchedule(scheduleData: any): ClassInfo & { time?: string; startTime?: string; endTime?: string; hallName?: string } {
  const classInfo = scheduleData.classes;
  const instructor = scheduleData.instructors?.name_kr || scheduleData.instructors?.name_en || classInfo?.instructors?.name_kr || classInfo?.instructors?.name_en || INSTRUCTOR_TBD;
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

const getLevelColor = (level: string) => {
  const upperLevel = level?.toUpperCase() || '';
  if (upperLevel.includes('BEGINNER') || upperLevel.includes('초급')) return LEVEL_COLORS.BEGINNER;
  if (upperLevel.includes('INTERMEDIATE') || upperLevel.includes('중급')) return LEVEL_COLORS.INTERMEDIATE;
  if (upperLevel.includes('ADVANCED') || upperLevel.includes('고급')) return LEVEL_COLORS.ADVANCED;
  return { bg: 'bg-neutral-100 dark:bg-neutral-800', border: 'border-neutral-300 dark:border-neutral-700', text: 'text-neutral-600 dark:text-neutral-400', dot: 'bg-neutral-400' };
};

const getLevelLabelKey = (level: string): 'schedule.levelBeginner' | 'schedule.levelIntermediate' | 'schedule.levelAdvanced' | null => {
  const upperLevel = level?.toUpperCase() || '';
  if (upperLevel.includes('BEGINNER') || upperLevel.includes('초급')) return 'schedule.levelBeginner';
  if (upperLevel.includes('INTERMEDIATE') || upperLevel.includes('중급')) return 'schedule.levelIntermediate';
  if (upperLevel.includes('ADVANCED') || upperLevel.includes('고급')) return 'schedule.levelAdvanced';
  return null;
};

export const AcademyMonthlyScheduleView = ({ academyId, onClassClick }: AcademyMonthlyScheduleViewProps) => {
  const { t } = useLocale();
  const [schedules, setSchedules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState<Date>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedDateSchedules, setSelectedDateSchedules] = useState<(ClassInfo & { time?: string; hallName?: string })[]>([]);

  const loadSchedules = useCallback(async () => {
    try {
      setLoading(true);
      const { getSupabaseClient } = await import('@/lib/utils/supabase-client');
      const supabase = getSupabaseClient();
      if (!supabase) {
        setLoading(false);
        return;
      }

      const year = currentMonth.getFullYear();
      const month = currentMonth.getMonth();
      
      const kstStartString = `${year}-${String(month + 1).padStart(2, '0')}-01T00:00`;
      const nextMonth = month === 11 ? 0 : month + 1;
      const nextYear = month === 11 ? year + 1 : year;
      const kstEndString = `${nextYear}-${String(nextMonth + 1).padStart(2, '0')}-01T00:00`;

      const utcStart = convertKSTInputToUTC(kstStartString);
      const utcEnd = convertKSTInputToUTC(kstEndString);

      if (!utcStart || !utcEnd) {
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
        setSchedules([]);
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
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - startDate.getDay());

    const grid: Date[] = [];
    const current = new Date(startDate);
    
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

  // 날짜 클릭 핸들러
  const handleDateClick = (date: Date, daySchedules: any[]) => {
    if (daySchedules.length === 0) return;
    setSelectedDate(date);
    setSelectedDateSchedules(daySchedules.map(transformSchedule));
  };

  // 모달 닫기
  const closeDateModal = () => {
    setSelectedDate(null);
    setSelectedDateSchedules([]);
  };

  // 수업 클릭 핸들러
  const handleClassClick = (classInfo: ClassInfo & { time?: string }) => {
    closeDateModal();
    onClassClick(classInfo);
  };

  const calendarGrid = getCalendarGrid();
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  const dayLabels = [t('schedule.daySun'), t('schedule.dayMon'), t('schedule.dayTue'), t('schedule.dayWed'), t('schedule.dayThu'), t('schedule.dayFri'), t('schedule.daySat')];

  // 오늘 날짜 확인용
  const today = new Date();
  const todayParts = { year: today.getFullYear(), month: today.getMonth() + 1, day: today.getDate() };

  // 선택된 날짜 포맷
  const getSelectedDateString = () => {
    if (!selectedDate) return '';
    const parts = getKSTDateParts(selectedDate);
    const dayOfWeek = selectedDate.getDay();
    return t('schedule.dateWithDay', { month: String(parts.month), day: String(parts.day), dayName: dayLabels[dayOfWeek] });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary dark:border-[#CCFF00] border-t-transparent"></div>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {/* 헤더 */}
        <div className="flex items-center justify-between">
          <button
            onClick={goToPreviousMonth}
            className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-full transition-colors"
          >
            <ChevronLeft size={20} className="text-neutral-600 dark:text-neutral-400" />
          </button>
          <div className="flex items-center gap-3">
            <span className="text-base font-bold text-black dark:text-white">{t('schedule.monthYear', { year: String(year), month: String(month + 1) })}</span>
            <button
              onClick={goToToday}
              className="text-xs px-3 py-1.5 bg-primary/10 dark:bg-[#CCFF00]/10 text-primary dark:text-[#CCFF00] rounded-full font-medium hover:bg-primary/20 dark:hover:bg-[#CCFF00]/20 transition-colors"
            >
              {t('schedule.thisMonth')}
            </button>
          </div>
          <button
            onClick={goToNextMonth}
            className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-full transition-colors"
          >
            <ChevronRight size={20} className="text-neutral-600 dark:text-neutral-400" />
          </button>
        </div>

        {/* 캘린더 */}
        <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden">
          {/* 요일 헤더 */}
          <div className="grid grid-cols-7 border-b border-neutral-200 dark:border-neutral-800">
            {dayLabels.map((day, idx) => (
              <div
                key={idx}
                className={`p-2 text-center text-xs font-bold ${
                  idx === 0 ? 'text-rose-500' : idx === 6 ? 'text-blue-500' : 'text-neutral-600 dark:text-neutral-400'
                } bg-neutral-50 dark:bg-neutral-950`}
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
              const isToday = dateParts.year === todayParts.year && 
                             dateParts.month === todayParts.month && 
                             dateParts.day === todayParts.day;
              const dayOfWeek = date.getDay();
              const isSunday = dayOfWeek === 0;
              const isSaturday = dayOfWeek === 6;
              const daySchedules = getSchedulesForDate(date);
              const hasSchedules = daySchedules.length > 0;

              return (
                <button
                  key={index}
                  onClick={() => handleDateClick(date, daySchedules)}
                  disabled={!hasSchedules}
                  className={`min-h-[70px] border-r border-b border-neutral-100 dark:border-neutral-800 p-1.5 text-left transition-colors ${
                    isCurrentMonth
                      ? hasSchedules
                        ? 'bg-white dark:bg-neutral-900 hover:bg-neutral-50 dark:hover:bg-neutral-800 cursor-pointer'
                        : 'bg-white dark:bg-neutral-900'
                      : 'bg-neutral-50 dark:bg-neutral-950'
                  } ${isToday ? 'ring-2 ring-inset ring-primary dark:ring-[#CCFF00]' : ''}`}
                >
                  {/* 날짜 숫자 */}
                  <div
                    className={`text-xs font-bold mb-1 w-6 h-6 flex items-center justify-center rounded-full ${
                      isToday
                        ? 'bg-primary dark:bg-[#CCFF00] text-white dark:text-black'
                        : isCurrentMonth
                          ? isSunday
                            ? 'text-rose-500'
                            : isSaturday
                              ? 'text-blue-500'
                              : 'text-black dark:text-white'
                          : 'text-neutral-300 dark:text-neutral-600'
                    }`}
                  >
                    {dateParts.day}
                  </div>

                  {/* 수업 개수 표시 */}
                  {hasSchedules && (
                    <div className="space-y-0.5">
                      {/* 난이도별 도트 표시 */}
                      <div className="flex flex-wrap gap-0.5">
                        {daySchedules.slice(0, 4).map((schedule: any, idx: number) => {
                          const levelColor = getLevelColor(schedule.classes?.difficulty_level || '');
                          return (
                            <div
                              key={idx}
                              className={`w-2 h-2 rounded-full ${levelColor.dot}`}
                            />
                          );
                        })}
                        {daySchedules.length > 4 && (
                          <span className="text-[9px] text-neutral-500 dark:text-neutral-400 ml-0.5">
                            +{daySchedules.length - 4}
                          </span>
                        )}
                      </div>
                      {/* 수업 개수 */}
                      <div className="text-[10px] text-primary dark:text-[#CCFF00] font-medium">
                        {t('schedule.classesCount', { count: String(daySchedules.length) })}
                      </div>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* 범례 */}
        <div className="flex items-center justify-center gap-4 pt-2">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
            <span className="text-[10px] text-neutral-500 dark:text-neutral-400">{t('schedule.levelBeginner')}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-amber-500"></div>
            <span className="text-[10px] text-neutral-500 dark:text-neutral-400">{t('schedule.levelIntermediate')}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-rose-500"></div>
            <span className="text-[10px] text-neutral-500 dark:text-neutral-400">{t('schedule.levelAdvanced')}</span>
          </div>
        </div>
      </div>

      {/* 날짜별 수업 리스트 - shadcn Sheet 하단 드로어 */}
      <Sheet open={!!selectedDate} onOpenChange={(open) => { if (!open) closeDateModal(); }}>
        <SheetContent
          side="bottom"
          showCloseButton={false}
          className="left-0 right-0 w-full max-w-[420px] mx-auto rounded-t-2xl border-neutral-200 dark:border-neutral-800 p-0 flex flex-col animate-in slide-in-from-bottom duration-300"
          style={{ maxHeight: 'min(90dvh, 90vh)', minHeight: '40dvh' }}
        >
          <SheetHeader className="flex-shrink-0 p-4 pb-2 border-b border-neutral-200 dark:border-neutral-800 text-left">
            <div className="w-12 h-1 bg-neutral-300 dark:bg-neutral-700 rounded-full mx-auto mb-3" />
            <div className="flex items-center justify-between">
              <div>
                <SheetTitle className="text-lg font-bold text-black dark:text-white">
                  {selectedDate ? getSelectedDateString() : ''}
                </SheetTitle>
                <SheetDescription className="text-sm text-neutral-500 dark:text-neutral-400">
                  {selectedDate ? t('schedule.classesCountShort', { count: String(selectedDateSchedules.length) }) : ''}
                </SheetDescription>
              </div>
              <button
                type="button"
                onClick={closeDateModal}
                className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-full transition-colors"
              >
                <X size={20} className="text-neutral-500" />
              </button>
            </div>
          </SheetHeader>

          {/* 수업 리스트 */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
            {selectedDateSchedules.map((classInfo, idx) => {
              const levelColor = getLevelColor(classInfo.level);
              const isFull = classInfo.status === 'FULL';
              const endTimeStr = classInfo.endTime
                ? new Date(classInfo.endTime).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })
                : null;
              const hallName = (classInfo as any).hallName || classInfo.hall_name;

              return (
                <button
                  key={`${classInfo.schedule_id || classInfo.id}-${idx}`}
                  onClick={() => handleClassClick(classInfo)}
                  className={`w-full p-4 rounded-2xl border-2 text-left transition-all hover:shadow-md active:scale-[0.98] ${levelColor.bg} ${levelColor.border} ${
                    isFull ? 'opacity-60' : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 text-center min-w-[50px]">
                      <div className={`text-lg font-black ${levelColor.text}`}>
                        {classInfo.time}
                      </div>
                      {endTimeStr && (
                        <div className="text-[10px] text-neutral-500 dark:text-neutral-400">
                          ~{endTimeStr}
                        </div>
                      )}
                    </div>
                    <div className={`w-0.5 self-stretch rounded-full ${levelColor.dot} opacity-50`} />
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-black dark:text-white text-base leading-tight">
                        {classInfo.class_title || classInfo.genre || t('schedule.classLabel')}
                      </div>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <div className="flex items-center gap-1">
                          <User size={12} className="text-neutral-400" />
                          <span className="text-sm text-neutral-600 dark:text-neutral-300">
                            {classInfo.instructor === INSTRUCTOR_TBD ? t('schedule.instructorTbd') : classInfo.instructor}
                          </span>
                        </div>
                        {classInfo.genre && classInfo.class_title && (
                          <span className="text-xs px-2 py-0.5 bg-black/5 dark:bg-white/10 rounded-full text-neutral-600 dark:text-neutral-300">
                            {classInfo.genre}
                          </span>
                        )}
                      </div>
                      {hallName && (
                        <div className="flex items-center gap-1 mt-1.5">
                          <MapPin size={11} className="text-neutral-400" />
                          <span className="text-xs text-neutral-500 dark:text-neutral-400">
                            {hallName}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="flex-shrink-0 flex flex-col items-end gap-1">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${levelColor.text} bg-white/50 dark:bg-black/20`}>
                        {getLevelLabelKey(classInfo.level) ? t(getLevelLabelKey(classInfo.level)!) : 'All'}
                      </span>
                      {isFull && (
                        <span className="text-[10px] font-bold text-rose-500 dark:text-rose-400">
                          {t('schedule.full')}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
};
