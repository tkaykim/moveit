"use client";

import Image from 'next/image';
import { ChevronLeft } from 'lucide-react';
import { LevelBadge } from '@/components/common/level-badge';
import { ClassPreviewModal } from '@/components/modals/class-preview-modal';
import { Academy, ClassInfo, ViewState } from '@/types';
import { useState, useEffect, useRef, useCallback } from 'react';
import { getSupabaseClient } from '@/lib/utils/supabase-client';

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
  const isFull = schedule.current_students >= schedule.max_students;
  const isAlmostFull = schedule.current_students >= schedule.max_students * 0.8;
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
    branch_name: schedule.branches?.name,
    hall_name: schedule.halls?.name,
  };
}

// 주간 스케줄을 그리드로 변환
function buildScheduleGrid(schedules: any[]) {
  const grid: Record<string, ClassInfo[]> = {
    MON: [], TUE: [], WED: [], THU: [], FRI: [], SAT: [], SUN: []
  };

  schedules.forEach(schedule => {
    const startTime = new Date(schedule.start_time);
    const dayIndex = (startTime.getDay() + 6) % 7; // 월요일을 0으로
    const day = DAYS[dayIndex];
    const time = startTime.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
    
    const classInfo = transformSchedule(schedule);
    classInfo.time = time;
    
    grid[day].push(classInfo);
  });

  // 시간순으로 정렬
  Object.keys(grid).forEach(day => {
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

  useEffect(() => {
    async function loadSchedules() {
      if (!academy) return;
      
      try {
        // 이번 주의 시작과 끝 날짜 계산
        const now = new Date();
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay() + 1); // 월요일
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
        const academyId = (academy as any).academyId || academy.id.split('-')[0];
        
        // academy의 branches 가져오기
        const { data: branches, error: branchesError } = await (supabase as any)
          .from('branches')
          .select('*')
          .eq('academy_id', academyId);

        if (branchesError) throw branchesError;
        
        const branchIds = ((branches || []) as any[]).map((b: any) => b.id);

        // 각 branch의 schedules 가져오기
        const allSchedules: any[] = [];
        for (const branchId of branchIds) {
          const { data: branchSchedules, error: schedulesError } = await (supabase as any)
            .from('schedules')
            .select(`
              *,
              classes (*),
              branches (*),
              instructors (*),
              halls (*)
            `)
            .eq('branch_id', branchId)
            .eq('is_canceled', false)
            .gte('start_time', startOfWeek.toISOString())
            .lte('start_time', endOfWeek.toISOString())
            .order('start_time', { ascending: true });

          if (schedulesError) throw schedulesError;
          if (branchSchedules) {
            allSchedules.push(...branchSchedules);
          }
        }

        setSchedules(allSchedules);
        const grid = buildScheduleGrid(allSchedules);
        setScheduleGrid(grid);
      } catch (error) {
        console.error('Error loading schedules:', error);
      } finally {
        setLoading(false);
      }
    }
    loadSchedules();
  }, [academy]);

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

  // 시간대 추출 (모든 스케줄에서)
  const timeSlots = Array.from(new Set(
    schedules.map(s => {
      const time = new Date(s.start_time);
      return time.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
    })
  )).sort();

  // 각 요일별로 시간대별로 그룹화된 스케줄 생성
  const scheduleByTimeAndDay: Record<string, Record<string, ClassInfo>> = {};
  timeSlots.forEach(time => {
    scheduleByTimeAndDay[time] = {};
    DAYS.forEach(day => {
      const daySchedules = scheduleGrid[day] || [];
      const schedule = daySchedules.find(s => s.time === time);
      if (schedule) {
        scheduleByTimeAndDay[time][day] = schedule;
      }
    });
  });

  return (
    <>
      <div className="bg-white dark:bg-neutral-950 min-h-screen pb-24 animate-in slide-in-from-right duration-300 relative">
        <div className="relative h-64 overflow-hidden">
          <Image 
            src={academy.logo_url || `https://picsum.photos/seed/academy${academy.id}/800/256`}
            alt={academy.name}
            fill
            className="object-cover"
          />
          <button 
            onClick={onBack} 
            className="absolute top-12 left-5 z-20 p-2 bg-black/30 backdrop-blur rounded-full text-white"
          >
            <ChevronLeft />
          </button>
          <div className="absolute bottom-0 left-0 w-full h-32 bg-gradient-to-t from-white dark:from-neutral-950 to-transparent" />
          <div className="absolute bottom-6 left-6">
            <span className="text-primary dark:text-[#CCFF00] text-xs font-bold border border-primary dark:border-[#CCFF00] px-2 py-0.5 rounded mb-2 inline-block">
              Premium Partner
            </span>
            <h1 className="text-3xl font-black text-black dark:text-white italic">{academy.name}</h1>
            <p className="text-neutral-600 dark:text-neutral-400 text-sm mt-1">{academy.branch} Branch</p>
          </div>
        </div>
        <div className="sticky top-0 bg-white dark:bg-neutral-950 z-20 border-b border-neutral-200 dark:border-neutral-800 flex text-sm font-bold text-neutral-500 dark:text-neutral-500">
          <button 
            onClick={() => scrollToTab('home')}
            className={`flex-1 py-4 border-b-2 transition-colors ${
              activeTab === 'home'
                ? 'border-primary dark:border-[#CCFF00] text-black dark:text-white'
                : 'border-transparent hover:text-black dark:hover:text-white'
            }`}
          >
            홈
          </button>
          <button 
            onClick={() => scrollToTab('schedule')}
            className={`flex-1 py-4 border-b-2 transition-colors ${
              activeTab === 'schedule'
                ? 'border-primary dark:border-[#CCFF00] text-black dark:text-white'
                : 'border-transparent hover:text-black dark:hover:text-white'
            }`}
          >
            시간표
          </button>
          <button 
            onClick={() => scrollToTab('reviews')}
            className={`flex-1 py-4 border-b-2 transition-colors ${
              activeTab === 'reviews'
                ? 'border-primary dark:border-[#CCFF00] text-black dark:text-white'
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
                {DAYS.map(day => (
                  <div key={day} className="flex-1 text-center text-xs font-bold text-neutral-500 dark:text-neutral-500 py-2 min-w-0">
                    {day}
                  </div>
                ))}
              </div>
              {timeSlots.length === 0 ? (
                <div className="text-center py-12 text-neutral-500">이번 주 스케줄이 없습니다.</div>
              ) : (
                timeSlots.map((time) => (
                  <div key={time} className="flex mb-2">
                    <div className="w-12 flex-shrink-0 flex flex-col items-center justify-center text-[10px] font-bold text-neutral-600 dark:text-neutral-400 bg-neutral-100/50 dark:bg-neutral-900/50 rounded-l-lg border-y border-l border-neutral-200 dark:border-neutral-800">
                      {time}
                    </div>
                    {DAYS.map(day => {
                      const classInfo = scheduleByTimeAndDay[time]?.[day];
                      const isEmpty = !classInfo || classInfo.status === 'NONE';
                      const isFull = classInfo?.status === 'FULL';

                      return (
                        <div key={`${day}-${time}`} className="flex-1 p-0.5 min-w-0">
                          {isEmpty ? (
                            <div className="h-full min-h-[70px] bg-neutral-100/30 dark:bg-neutral-900/30 rounded-lg border border-neutral-200/50 dark:border-neutral-800/50"></div>
                          ) : (
                            <button 
                              onClick={() => handleClassClick(classInfo, time)}
                              className={`w-full h-full min-h-[70px] rounded-lg border p-1 flex flex-col justify-between text-left transition-all active:scale-95 ${
                                isFull 
                                  ? 'bg-neutral-100 dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 opacity-60' 
                                  : 'bg-neutral-200 dark:bg-neutral-800 border-neutral-300 dark:border-neutral-700 hover:border-primary dark:hover:border-[#CCFF00] hover:bg-neutral-300 dark:hover:bg-neutral-700'
                              }`}
                            >
                              <div className="flex justify-between items-start w-full gap-1">
                                <span className={`text-[8px] font-bold truncate flex-1 ${isFull ? 'text-neutral-500 dark:text-neutral-500' : 'text-black dark:text-white'}`}>
                                  {classInfo.instructor}
                                </span>
                                <LevelBadge level={classInfo.level} simple />
                              </div>
                              <div className="mt-0.5">
                                <div className="text-[7px] text-neutral-500 dark:text-neutral-500 truncate">{classInfo.genre}</div>
                                {isFull && <div className="text-[7px] text-red-500 dark:text-red-400 font-bold mt-0.5">FULL</div>}
                              </div>
                            </button>
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
    </>
  );
};

