"use client";

import Image from 'next/image';
import { ChevronLeft } from 'lucide-react';
import { LevelBadge } from '@/components/common/level-badge';
import { ClassPreviewModal } from '@/components/modals/class-preview-modal';
import { AddClassModal } from '@/components/modals/add-class-modal';
import { Academy, ClassInfo, ViewState } from '@/types';
import { useState, useEffect, useRef, useCallback } from 'react';
import { getSupabaseClient } from '@/lib/utils/supabase-client';
import { ThemeToggle } from '@/components/common/theme-toggle';
import { AcademyWeeklyScheduleView } from './academy-weekly-schedule-view';
import { AcademyMonthlyScheduleView } from './academy-monthly-schedule-view';

interface AcademyDetailViewProps {
  academy: Academy | null;
  onBack: () => void;
  onClassBook: (classInfo: ClassInfo & { time?: string; price?: number }) => void;
}

export const AcademyDetailView = ({ academy, onBack, onClassBook }: AcademyDetailViewProps) => {
  const [previewClass, setPreviewClass] = useState<(ClassInfo & { time?: string }) | null>(null);
  const [activeTab, setActiveTab] = useState<'home' | 'schedule' | 'reviews'>('schedule');
  const [scheduleViewMode, setScheduleViewMode] = useState<'week' | 'month'>('week');
  const [showAddClassModal, setShowAddClassModal] = useState(false);
  const [selectedDay, setSelectedDay] = useState<string>('');
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [selectedHallId, setSelectedHallId] = useState<string | null>(null);
  const [recentVideos, setRecentVideos] = useState<any[]>([]);
  const [videosLoading, setVideosLoading] = useState(false);
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
    let ticking = false;
    
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
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
          
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
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


  // 최근 수업 영상 로드
  const loadRecentVideos = useCallback(async () => {
    if (!academy) return;
    
    try {
      setVideosLoading(true);
      const supabase = getSupabaseClient();
      if (!supabase) {
        setVideosLoading(false);
        return;
      }

      // academy ID 추출 (합성 ID에서 원본 추출)
      const academyId = (academy as any).academyId || academy.id;

      // 최근 수업 영상 가져오기 (video_url이 있는 것만, start_time 기준 최신순)
      const { data: videos, error: videosError } = await supabase
        .from('classes')
        .select(`
          id,
          title,
          video_url,
          start_time,
          thumbnail_url,
          genre,
          difficulty_level,
          instructor_id,
          instructors (
            name_kr,
            name_en
          )
        `)
        .eq('academy_id', academyId)
        .not('video_url', 'is', null)
        .neq('video_url', '')
        .order('start_time', { ascending: false, nullsLast: true })
        .limit(10);

      if (videosError) throw videosError;
      setRecentVideos(videos || []);
    } catch (error) {
      console.error('Error loading recent videos:', error);
    } finally {
      setVideosLoading(false);
    }
  }, [academy]);

  useEffect(() => {
    loadRecentVideos();
  }, [loadRecentVideos]);

  if (!academy) return null;

  const handleClassClick = (classInfo: ClassInfo & { time?: string }) => {
    setPreviewClass(classInfo);
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
    // 스케줄 뷰가 자동으로 새로고침됨
  };

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

          {/* 최근 수업 영상 섹션 */}
          <div className="mt-6">
            <h3 className="text-black dark:text-white font-bold text-lg mb-4">최근 수업 영상</h3>
            {videosLoading ? (
              <div className="text-center py-8 text-neutral-500">로딩 중...</div>
            ) : recentVideos.length === 0 ? (
              <div className="text-center py-8 text-neutral-500">등록된 수업 영상이 없습니다.</div>
            ) : (
              <div className="space-y-3">
                {recentVideos.map((video) => {
                  const instructorName = video.instructors?.name_kr || video.instructors?.name_en || '강사 정보 없음';
                  const videoDate = video.start_time 
                    ? new Date(video.start_time).toLocaleDateString('ko-KR', { 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                      })
                    : '날짜 정보 없음';

                  return (
                    <div 
                      key={video.id}
                      className="bg-neutral-100 dark:bg-neutral-900 rounded-2xl p-4 hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors"
                    >
                      <a
                        href={video.video_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block"
                      >
                        <div className="flex gap-3">
                          {video.thumbnail_url ? (
                            <div className="relative w-24 h-24 flex-shrink-0 rounded-lg overflow-hidden bg-neutral-200 dark:bg-neutral-800">
                              <Image
                                src={video.thumbnail_url}
                                alt={video.title || '수업 영상'}
                                fill
                                className="object-cover"
                              />
                              <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                                <svg 
                                  className="w-8 h-8 text-white" 
                                  fill="currentColor" 
                                  viewBox="0 0 20 20"
                                >
                                  <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                                </svg>
                              </div>
                            </div>
                          ) : (
                            <div className="w-24 h-24 flex-shrink-0 rounded-lg bg-neutral-200 dark:bg-neutral-800 flex items-center justify-center">
                              <svg 
                                className="w-8 h-8 text-neutral-400" 
                                fill="currentColor" 
                                viewBox="0 0 20 20"
                              >
                                <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                              </svg>
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <h4 className="text-sm font-bold text-black dark:text-white mb-1 line-clamp-2">
                              {video.title || '제목 없음'}
                            </h4>
                            <p className="text-xs text-neutral-600 dark:text-neutral-400 mb-1">
                              {instructorName}
                            </p>
                            <div className="flex items-center gap-2 mb-1">
                              {video.genre && (
                                <span className="text-[10px] bg-neutral-200 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 px-2 py-0.5 rounded">
                                  {video.genre}
                                </span>
                              )}
                              {video.difficulty_level && (
                                <LevelBadge level={video.difficulty_level} simple />
                              )}
                            </div>
                            <p className="text-[10px] text-neutral-500 dark:text-neutral-500">
                              {videoDate}
                            </p>
                          </div>
                        </div>
                      </a>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* 시간표 섹션 */}
        <div ref={scheduleRef} className="p-5 scroll-mt-20">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-black dark:text-white font-bold text-lg">시간표</h3>
            <div className="flex gap-2 bg-neutral-100 dark:bg-neutral-900 rounded-lg p-1">
              <button
                onClick={() => setScheduleViewMode('week')}
                className={`px-3 py-1.5 text-xs font-bold rounded transition-colors ${
                  scheduleViewMode === 'week'
                    ? 'bg-white dark:bg-neutral-800 text-black dark:text-white shadow-sm'
                    : 'text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white'
                }`}
              >
                주간
              </button>
              <button
                onClick={() => setScheduleViewMode('month')}
                className={`px-3 py-1.5 text-xs font-bold rounded transition-colors ${
                  scheduleViewMode === 'month'
                    ? 'bg-white dark:bg-neutral-800 text-black dark:text-white shadow-sm'
                    : 'text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white'
                }`}
              >
                월간
              </button>
            </div>
          </div>
          {scheduleViewMode === 'week' ? (
            <AcademyWeeklyScheduleView
              academyId={(academy as any).academyId || academy.id}
              onClassClick={handleClassClick}
              onAddClassClick={handleAddClassClick}
            />
          ) : (
            <AcademyMonthlyScheduleView
              academyId={(academy as any).academyId || academy.id}
              onClassClick={handleClassClick}
            />
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

