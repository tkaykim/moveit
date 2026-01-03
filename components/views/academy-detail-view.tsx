"use client";

import Image from 'next/image';
import { ChevronLeft, Plus } from 'lucide-react';
import { LevelBadge } from '@/components/common/level-badge';
import { ClassPreviewModal } from '@/components/modals/class-preview-modal';
import { AddClassModal } from '@/components/modals/add-class-modal';
import { Academy, ClassInfo, ViewState } from '@/types';
import { useState, useEffect, useRef, useCallback } from 'react';
import { getSupabaseClient } from '@/lib/utils/supabase-client';
import { formatKSTTime } from '@/lib/utils/kst-time';
import { ThemeToggle } from '@/components/common/theme-toggle';

interface AcademyDetailViewProps {
  academy: Academy | null;
  onBack: () => void;
  onClassBook: (classInfo: ClassInfo & { time?: string; price?: number }) => void;
}

const DAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

// Schedule을 ClassInfo로 변환
function transformSchedule(schedule: any): ClassInfo {
  const instructor = schedule.instructors?.name_kr || schedule.instructors?.name_en || '강사 정보 없음';
  const classData = schedule.classes || {};
  const genre = classData.genre || 'ALL';
  const level = classData.difficulty_level || 'All Level';
  const isFull = schedule.current_students >= (schedule.max_students || 0);
  const isAlmostFull = schedule.current_students >= (schedule.max_students || 0) * 0.8;
  const status = isFull ? 'FULL' : isAlmostFull ? 'ALMOST_FULL' : 'AVAILABLE';

  return {
    id: schedule.id,
    schedule_id: schedule.id,
    instructor,
    genre,
    level,
    status,
    price: classData.price || 0,
    class_title: classData.title,
    hall_name: schedule.halls?.name,
    academy: {
      id: classData.academies?.id || '',
      name: classData.academies?.name_kr || classData.academies?.name_en || '',
    },
    maxStudents: schedule.max_students,
    currentStudents: schedule.current_students,
    endTime: schedule.end_time,
  };
}

// 주간 스케줄을 그리드로 변환
function buildScheduleGrid(schedules: any[]) {
  const grid: Record<string, ClassInfo[]> = {
    MON: [], TUE: [], WED: [], THU: [], FRI: [], SAT: [], SUN: []
  };

  schedules.forEach((schedule: any) => {
    if (!schedule.start_time) return;
    const startTime = new Date(schedule.start_time);
    const dayIndex = (startTime.getDay() + 6) % 7; // 월요일을 0으로
    const day = DAYS[dayIndex];
    // UTC를 KST로 변환하여 시간 표시
    const time = formatKSTTime(schedule.start_time);
    
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

export const AcademyDetailView = ({ academy, onBack, onClassBook }: AcademyDetailViewProps) => {
  const [previewClass, setPreviewClass] = useState<(ClassInfo & { time?: string }) | null>(null);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'home' | 'schedule' | 'reviews'>('schedule');
  const [scheduleGrid, setScheduleGrid] = useState<Record<string, ClassInfo[]>>({
    MON: [], TUE: [], WED: [], THU: [], FRI: [], SAT: [], SUN: []
  });
  const [showAddClassModal, setShowAddClassModal] = useState(false);
  const [selectedDay, setSelectedDay] = useState<string>('');
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [selectedHallId, setSelectedHallId] = useState<string | null>(null);
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay() + 1); // 월요일
    startOfWeek.setHours(0, 0, 0, 0);
    return startOfWeek;
  });
  const homeRef = useRef<HTMLDivElement>(null);
  const scheduleRef = useRef<HTMLDivElement>(null);
  const reviewsRef = useRef<HTMLDivElement>(null);

  // 스크롤 감지하여 탭 업데이트
  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      const homeTop = homeRef.current?.offsetTop || 0;
      const scheduleTop = scheduleRef.current?.offsetTop || 0;
      const reviewsTop = reviewsRef.current?.offsetTop || 0;

      if (reviewsRef.current && scrollTop >= reviewsTop - 150) {
        setActiveTab('reviews');
      } else if (scheduleRef.current && scrollTop >= scheduleTop - 150) {
        setActiveTab('schedule');
      } else if (homeRef.current && scrollTop >= homeTop - 150) {
        setActiveTab('home');
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // 탭 클릭 시 해당 섹션으로 스크롤
  const scrollToTab = useCallback((tab: 'home' | 'schedule' | 'reviews') => {
    const ref = tab === 'home' ? homeRef : tab === 'schedule' ? scheduleRef : reviewsRef;
    if (ref.current) {
      const offset = 120; // sticky 탭 높이 고려
      const targetTop = ref.current.offsetTop - offset;
      window.scrollTo({ top: targetTop, behavior: 'smooth' });
      setActiveTab(tab);
    }
  }, []);

  const loadSchedules = useCallback(async () => {
    if (!academy) return;
    
    try {
      setLoading(true);
      // 현재 주의 시작과 끝 날짜 계산
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

        // academy ID 추출 (합성 ID에서 원본 추출)
        const academyId = (academy as any).academyId || academy.id;

        // academy의 schedules 가져오기 (classes를 통해 academy_id 필터링)
        const { data: schedules, error: schedulesError } = await supabase
          .from('schedules')
          .select(`
            *,
            classes (
              *,
              academies (*)
            ),
            instructors (*),
            halls (*)
          `)
          .eq('is_canceled', false)
          .eq('classes.academy_id', academyId)
          .gte('start_time', startOfWeek.toISOString())
          .lte('start_time', endOfWeek.toISOString())
          .order('start_time', { ascending: true });

        if (schedulesError) throw schedulesError;

        setSchedules(schedules || []);
        const grid = buildScheduleGrid(schedules || []);
        setScheduleGrid(grid);
      } catch (error) {
        console.error('Error loading schedules:', error);
      } finally {
        setLoading(false);
      }
  }, [academy, currentWeekStart]);

  useEffect(() => {
    loadSchedules();
  }, [loadSchedules]);

  if (!academy) return null;

  const handleClassClick = (classInfo: ClassInfo, time: string) => {
    setPreviewClass({ ...classInfo, time });
  };

  const handleBook = (classInfo: ClassInfo & { time?: string }) => {
    if (classInfo.status === 'FULL') {
      alert("이미 마감된 클래스입니다.");
      return;
    }
    const classWithPrice = { ...classInfo, price: classInfo.price || academy.price || 0, startTime: classInfo.time || '' };
    setPreviewClass(null);
    onClassBook(classWithPrice);
  };

  const handleAddClassClick = (day: string, time: string, hallId?: string | null) => {
    setSelectedDay(day);
    setSelectedTime(time);
    setSelectedHallId(hallId || null);
    setShowAddClassModal(true);
  };

  const handleAddClassSubmit = () => {
    loadSchedules();
  };

  // 시간대 추출 (모든 스케줄에서) - 기본 시간대도 포함
  const existingTimeSlots = Array.from(new Set(
    schedules
      .filter((s: any) => s.start_time)
      .map((s: any) => formatKSTTime(s.start_time))
  )).sort();
  
  // 기본 시간대 추가 (09:00 ~ 22:00, 1시간 간격)
  const defaultTimeSlots: string[] = [];
  for (let hour = 9; hour <= 22; hour++) {
    defaultTimeSlots.push(`${hour.toString().padStart(2, '0')}:00`);
  }
  
  // 기존 시간대와 기본 시간대 합치기
  const allTimeSlots = Array.from(new Set([...existingTimeSlots, ...defaultTimeSlots])).sort();

  // 각 요일별로 시간대별로 그룹화된 스케줄 생성 (같은 시간대에 여러 수업 가능)
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

  return (
    <>
      <div className="bg-white dark:bg-neutral-950 min-h-screen pb-24 animate-in slide-in-from-right duration-300 relative">
        <div className="relative h-64 overflow-hidden bg-neutral-100 dark:bg-neutral-800">
          {(academy.img || academy.logo_url) ? (
            <Image 
              src={academy.img || academy.logo_url || ''}
              alt={academy.name}
              fill
              className="object-cover"
            />
          ) : (
            <div className="w-full h-full bg-neutral-100 dark:bg-neutral-800" />
          )}
          <div className="absolute top-12 left-5 right-5 z-20 flex justify-between items-center">
            <button 
              onClick={onBack} 
              className="p-2 bg-black/30 backdrop-blur rounded-full text-white"
            >
              <ChevronLeft />
            </button>
            <ThemeToggle />
          </div>
          <div className="absolute bottom-0 left-0 w-full h-32 bg-gradient-to-t from-white dark:from-neutral-950 to-transparent" />
          <div className="absolute bottom-6 left-6">
            <span className="bg-neutral-900 dark:bg-transparent text-white dark:text-[#CCFF00] text-xs font-bold border border-neutral-900 dark:border-[#CCFF00] px-2 py-0.5 rounded mb-2 inline-block">
              Premium Partner
            </span>
            <h1 className="text-3xl font-black text-black dark:text-white italic">{academy.name}</h1>
            {academy.address && (
              <p className="text-neutral-600 dark:text-neutral-400 text-sm mt-1">{academy.address}</p>
            )}
          </div>
        </div>
        <div className="sticky top-0 bg-white dark:bg-neutral-950 z-20 border-b border-neutral-200 dark:border-neutral-800 flex text-sm font-bold text-neutral-500 dark:text-neutral-500">
          <button 
            onClick={() => scrollToTab('home')}
            className={`flex-1 py-4 border-b-2 transition-colors ${
              activeTab === 'home'
                ? 'border-neutral-800 dark:border-[#CCFF00] text-black dark:text-white'
                : 'border-transparent hover:text-black dark:hover:text-white'
            }`}
          >
            홈
          </button>
          <button 
            onClick={() => scrollToTab('schedule')}
            className={`flex-1 py-4 border-b-2 transition-colors ${
              activeTab === 'schedule'
                ? 'border-neutral-800 dark:border-[#CCFF00] text-black dark:text-white'
                : 'border-transparent hover:text-black dark:hover:text-white'
            }`}
          >
            시간표
          </button>
          <button 
            onClick={() => scrollToTab('reviews')}
            className={`flex-1 py-4 border-b-2 transition-colors ${
              activeTab === 'reviews'
                ? 'border-neutral-800 dark:border-[#CCFF00] text-black dark:text-white'
                : 'border-transparent hover:text-black dark:hover:text-white'
            }`}
          >
            리뷰
          </button>
        </div>

        {/* 홈 섹션 */}
        <div ref={homeRef} className="p-5 scroll-mt-20">
          <h3 className="text-black dark:text-white font-bold text-lg mb-4">학원 정보</h3>
          <div className="space-y-4">
            <div className="bg-neutral-100 dark:bg-neutral-900 rounded-2xl p-4">
              <h4 className="text-sm font-bold text-black dark:text-white mb-2">소개</h4>
              <p className="text-xs text-neutral-600 dark:text-neutral-400">
                {academy.name}에 오신 것을 환영합니다. 최고의 댄스 교육을 제공합니다.
              </p>
            </div>
            {academy.tags && (
              <div>
                <h4 className="text-sm font-bold text-black dark:text-white mb-2">태그</h4>
                <div className="flex flex-wrap gap-2">
                  {academy.tags.split(',').map((tag, idx) => (
                    <span key={idx} className="text-xs bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 px-3 py-1 rounded-full">
                      {tag.trim()}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 시간표 섹션 */}
        <div ref={scheduleRef} className="p-5 scroll-mt-20">
          <h3 className="text-black dark:text-white font-bold text-lg mb-4">주간 시간표</h3>
          {loading ? (
            <div className="text-center py-12 text-neutral-500">로딩 중...</div>
          ) : (
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
                allTimeSlots.map((time: string) => (
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
                          const sDayIndex = (sTime.getDay() + 6) % 7;
                          const sTimeStr = formatKSTTime(s.start_time);
                          return DAYS[sDayIndex] === day && sTimeStr === time && s.id === classInfos[0].id;
                        });
                        firstHallId = firstSchedule?.hall_id || null;
                      }

                      return (
                        <div key={`${day}-${time}`} className="flex-1 p-0.5 min-w-0 flex flex-col gap-0.5">
                          {isEmpty ? (
                            <button
                              onClick={() => handleAddClassClick(day, time)}
                              className="h-full min-h-[40px] bg-neutral-100/30 dark:bg-neutral-900/30 rounded-lg border border-neutral-200/50 dark:border-neutral-800/50 hover:bg-neutral-100/50 dark:hover:bg-neutral-900/50 hover:border-neutral-800 dark:hover:border-[#CCFF00] transition-all flex items-center justify-center group"
                            >
                              <Plus size={16} className="text-neutral-400 dark:text-neutral-600 group-hover:text-neutral-800 dark:group-hover:text-[#CCFF00] transition-colors" />
                            </button>
                          ) : (
                            <>
                              {classInfos.map((classInfo, index) => {
                                const isFull = classInfo.status === 'FULL';
                                // 각 수업의 홀 ID 찾기
                                const schedule = schedules.find((s: any) => s.id === classInfo.id);
                                const hallId = schedule?.hall_id || null;
                                
                                return (
                                  <button 
                                    key={`${classInfo.id}-${index}`}
                                    onClick={() => handleClassClick(classInfo, time)}
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
                              <button
                                onClick={() => handleAddClassClick(day, time, firstHallId)}
                                className="w-full min-h-[24px] bg-neutral-100/50 dark:bg-neutral-900/50 rounded border border-neutral-200/50 dark:border-neutral-800/50 hover:bg-neutral-100 dark:hover:bg-neutral-900 hover:border-neutral-800 dark:hover:border-[#CCFF00] transition-all flex items-center justify-center group"
                              >
                                <Plus size={12} className="text-neutral-400 dark:text-neutral-600 group-hover:text-neutral-800 dark:group-hover:text-[#CCFF00] transition-colors" />
                              </button>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* 리뷰 섹션 */}
        <div ref={reviewsRef} className="p-5 scroll-mt-20">
          <h3 className="text-black dark:text-white font-bold text-lg mb-4">리뷰</h3>
          <div className="text-center py-12 text-neutral-500">
            아직 리뷰가 없습니다.
          </div>
        </div>
      </div>
      <ClassPreviewModal
        classInfo={previewClass}
        onClose={() => setPreviewClass(null)}
        onBook={handleBook}
      />
      <AddClassModal
        isOpen={showAddClassModal}
        onClose={() => {
          setShowAddClassModal(false);
          setSelectedHallId(null);
        }}
        onSubmit={handleAddClassSubmit}
        academy={academy}
        day={selectedDay}
        time={selectedTime}
        weekStartDate={currentWeekStart}
        defaultHallId={selectedHallId}
      />
    </>
  );
};

