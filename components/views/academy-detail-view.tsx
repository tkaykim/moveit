"use client";

import Image from 'next/image';
import { ChevronLeft, Heart, X, MessageSquare } from 'lucide-react';
import { ClassPreviewModal } from '@/components/modals/class-preview-modal';
import { TicketPurchaseModal } from '@/components/modals/ticket-purchase-modal';
import { ConsultationRequestModal } from '@/components/modals/consultation-request-modal';
import { Academy, ClassInfo } from '@/types';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseClient } from '@/lib/utils/supabase-client';
import { ThemeToggle } from '@/components/common/theme-toggle';
import { LanguageToggle } from '@/components/common/language-toggle';
import { AcademyWeeklyScheduleView } from './academy-weekly-schedule-view';
import { AcademyMonthlyScheduleView } from './academy-monthly-schedule-view';
import { useAuth } from '@/contexts/AuthContext';
import { useLocale } from '@/contexts/LocaleContext';
import { useTranslatedText } from '@/lib/i18n/useTranslation';
import { TranslatedText } from '@/components/common/translated-text';
import { SectionConfig, SectionConfigItem, DEFAULT_SECTION_CONFIG, migrateSectionConfig } from '@/types/database';

interface AcademyDetailViewProps {
  academy: Academy | null;
  onBack: () => void;
  onClassBook: (classInfo: ClassInfo & { time?: string; price?: number }) => void;
}

export const AcademyDetailView = ({ academy, onBack, onClassBook }: AcademyDetailViewProps) => {
  const router = useRouter();
  const [previewClass, setPreviewClass] = useState<(ClassInfo & { time?: string }) | null>(null);
  const [scheduleViewMode, setScheduleViewMode] = useState<'week' | 'month'>('week');
  const [recentVideos, setRecentVideos] = useState<any[]>([]);
  const [videosLoading, setVideosLoading] = useState(false);
  const [isFavorited, setIsFavorited] = useState(false);
  const [favoriteLoading, setFavoriteLoading] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<{ url: string; thumbnail?: string } | null>(null);
  const [showTicketPurchaseModal, setShowTicketPurchaseModal] = useState(false);
  const [showConsultationModal, setShowConsultationModal] = useState(false);
  const { user } = useAuth();
  const { t } = useLocale();
  const translatedAcademyName = useTranslatedText(academy?.name ?? '');
  const homeRef = useRef<HTMLDivElement>(null);
  const scheduleRef = useRef<HTMLDivElement>(null);
  const reviewsRef = useRef<HTMLDivElement>(null);

  // 섹션 설정 파싱 (레거시 호환 포함)
  const sectionConfig = useMemo<SectionConfig>(() => {
    if (academy?.section_config) {
      const config = migrateSectionConfig(academy.section_config);
      // 기본 설정에 새로 추가된 섹션 병합
      const result = [...(config.sections || [])];
      for (const def of DEFAULT_SECTION_CONFIG.sections) {
        if (!result.find(item => item.id === def.id)) {
          result.push({ ...def, order: result.length });
        }
      }
      return { sections: result.sort((a, b) => a.order - b.order) };
    }
    return DEFAULT_SECTION_CONFIG;
  }, [academy?.section_config]);

  // 표시할 섹션 목록 (visible && 순서대로)
  const visibleSections = useMemo(() => {
    return sectionConfig.sections
      .filter(section => section.visible)
      .sort((a, b) => a.order - b.order);
  }, [sectionConfig.sections]);

  // 섹션 ID → ref 매핑
  const sectionRefs: Record<string, React.RefObject<HTMLDivElement | null>> = useMemo(() => ({
    info: homeRef,
    consultation: homeRef,
    tags: homeRef,
    recent_videos: homeRef,
    schedule: scheduleRef,
    reviews: reviewsRef,
  }), []);


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

  // 찜 상태 확인
  useEffect(() => {
    const checkFavoriteStatus = async () => {
      if (!user || !academy) {
        setIsFavorited(false);
        return;
      }

      try {
        const academyId = (academy as any).academyId || academy.id;
        const response = await fetch('/api/favorites?type=academy');
        if (response.ok) {
          const data = await response.json();
          const isFavorite = (data.data || []).some((item: any) => 
            item.academies?.id === academyId
          );
          setIsFavorited(isFavorite);
        }
      } catch (error) {
        console.error('Error checking favorite status:', error);
      }
    };

    checkFavoriteStatus();
  }, [user, academy]);

  // 찜 토글 함수
  const handleToggleFavorite = async () => {
    if (!user || !academy || favoriteLoading) return;

    try {
      setFavoriteLoading(true);
      const academyId = (academy as any).academyId || academy.id;
      const response = await fetch('/api/favorites', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ type: 'academy', id: academyId }),
      });

      if (response.ok) {
        const result = await response.json();
        setIsFavorited(result.isFavorited);
      }
    } catch (error) {
      console.error('Error toggling favorite:', error);
    } finally {
      setFavoriteLoading(false);
    }
  };

  if (!academy) return null;

  const handleClassClick = (classInfo: ClassInfo & { time?: string }) => {
    setPreviewClass(classInfo);
  };

  const handleBook = (classInfo: ClassInfo & { time?: string }) => {
    if (classInfo.status === 'FULL') {
      alert(t('academyDetail.classFull'));
      return;
    }
    // 프리뷰 모달을 닫고 예약 페이지로 이동
    setPreviewClass(null);
    
    // schedule_id가 있으면 새 예약 페이지로 이동
    if (classInfo.schedule_id) {
      router.push(`/book/session/${classInfo.schedule_id}`);
    } else {
      // schedule_id가 없는 경우 (구형 클래스) - 기존 콜백 사용
      onClassBook(classInfo);
    }
  };

  // 유튜브 URL을 embed URL로 변환
  const getYoutubeEmbedUrl = (url: string): string | null => {
    if (!url) return null;
    
    // 이미 embed URL인 경우
    if (url.includes('youtube.com/embed/')) {
      return url;
    }
    
    // 일반 유튜브 URL에서 video ID 추출
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
      /youtube\.com\/watch\?.*v=([^&\n?#]+)/
    ];
    
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        return `https://www.youtube.com/embed/${match[1]}`;
      }
    }
    
    return null;
  };

  const handleVideoClick = (videoUrl: string, thumbnailUrl?: string) => {
    const embedUrl = getYoutubeEmbedUrl(videoUrl);
    if (embedUrl) {
      // autoplay 및 브랜딩 최소화 파라미터 추가
      const autoplayUrl = embedUrl.includes('?') 
        ? `${embedUrl}&autoplay=1&rel=0&modestbranding=1&controls=1&showinfo=0&iv_load_policy=3`
        : `${embedUrl}?autoplay=1&rel=0&modestbranding=1&controls=1&showinfo=0&iv_load_policy=3`;
      setSelectedVideo({ url: autoplayUrl, thumbnail: thumbnailUrl });
    }
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
            <div className="flex items-center gap-2">
              {user && (
                <button
                  onClick={handleToggleFavorite}
                  disabled={favoriteLoading}
                  className="p-2 bg-black/30 backdrop-blur rounded-full text-white hover:bg-black/50 transition-colors disabled:opacity-50"
                >
                  <Heart 
                    size={20} 
                    fill={isFavorited ? 'currentColor' : 'none'} 
                    className={isFavorited ? 'text-red-500' : ''}
                  />
                </button>
              )}
              <LanguageToggle />
              <ThemeToggle />
            </div>
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
        {/* 모든 섹션을 설정 순서대로 렌더링 (탭 없이 플랫) */}
        {visibleSections.map((section, sectionIndex) => {
          switch (section.id) {
            case 'info':
              return (
                <div key="info" ref={homeRef} className="p-5 scroll-mt-20">
                  <h3 className="text-black dark:text-white font-bold text-lg mb-4">{t('academyDetail.academyInfo')}</h3>
                  {academy.introduction_html ? (
                    <div
                      className="prose prose-sm dark:prose-invert max-w-none
                        prose-a:text-blue-600 dark:prose-a:text-blue-400 prose-a:underline
                        prose-img:rounded-lg prose-img:mx-auto prose-img:max-w-full
                        [&_a>img]:hover:opacity-80 [&_a>img]:transition-opacity [&_a]:has-[img]:no-underline [&_a]:has-[img]:block"
                      dangerouslySetInnerHTML={{ __html: academy.introduction_html }}
                    />
                  ) : (
                    <div className="space-y-4">
                      <div className="bg-neutral-100 dark:bg-neutral-900 rounded-2xl p-4">
                        <h4 className="text-sm font-bold text-black dark:text-white mb-2">{t('academyDetail.intro')}</h4>
                        <p className="text-xs text-neutral-600 dark:text-neutral-400">
                          {t('academyDetail.introWelcome', { name: translatedAcademyName })}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              );
            case 'consultation':
              return (
                <div key="consultation" className="px-5 pb-2">
                  <button
                    type="button"
                    onClick={() => setShowConsultationModal(true)}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-primary dark:border-[#CCFF00] text-primary dark:text-[#CCFF00] font-bold text-sm"
                  >
                    <MessageSquare size={18} />
                    {t('academyDetail.requestConsultation')}
                  </button>
                </div>
              );
            case 'tags':
              return academy.tags ? (
                <div key="tags" className="px-5 pb-2">
                  <h4 className="text-sm font-bold text-black dark:text-white mb-2">{t('academyDetail.tags')}</h4>
                  <div className="flex flex-wrap gap-2">
                    {academy.tags.split(',').map((tag, idx) => (
                      <span key={idx} className="text-xs bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 px-3 py-1 rounded-full">
                        <TranslatedText>{tag.trim()}</TranslatedText>
                      </span>
                    ))}
                  </div>
                </div>
              ) : null;
            case 'recent_videos':
              return (
                <div key="recent_videos" className="p-5 scroll-mt-20">
                  <h3 className="text-black dark:text-white font-bold text-lg mb-4">{t('academyDetail.recentVideos')}</h3>
                  {videosLoading ? (
                    <div className="text-center py-8 text-neutral-500">{t('common.loading')}</div>
                  ) : recentVideos.length === 0 ? (
                    <div className="text-center py-8 text-neutral-500">{t('academyDetail.noVideos')}</div>
                  ) : (
                    <div 
                      className="overflow-x-auto -mx-5 px-5 scrollbar-hide"
                      style={{ 
                        WebkitOverflowScrolling: 'touch',
                        touchAction: 'pan-x'
                      }}
                    >
                      <div className="flex gap-3 pb-2 w-max">
                        {recentVideos.map((video) => {
                          const embedUrl = getYoutubeEmbedUrl(video.video_url);
                          
                          return (
                            <div
                              key={video.id}
                              className="flex-shrink-0 w-48 h-32 rounded-lg overflow-hidden bg-neutral-200 dark:bg-neutral-800 cursor-pointer"
                              onClick={() => handleVideoClick(video.video_url, video.thumbnail_url)}
                            >
                              {video.thumbnail_url ? (
                                <div className="relative w-full h-full">
                                  <Image
                                    src={video.thumbnail_url}
                                    alt={video.title || t('academyDetail.classVideo')}
                                    fill
                                    className="object-cover"
                                  />
                                </div>
                              ) : embedUrl ? (
                                <div className="relative w-full h-full">
                                  <iframe
                                    src={embedUrl}
                                    className="w-full h-full"
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                    allowFullScreen
                                    title={video.title || '수업 영상'}
                                  />
                                </div>
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <svg 
                                    className="w-10 h-10 text-neutral-400" 
                                    fill="currentColor" 
                                    viewBox="0 0 20 20"
                                  >
                                    <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                                  </svg>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            case 'schedule':
              return (
                <div key="schedule" ref={scheduleRef} className="p-5 scroll-mt-20">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-black dark:text-white font-bold text-lg">{t('academyDetail.tabSchedule')}</h3>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setShowTicketPurchaseModal(true)}
                        className="px-3 py-1.5 text-xs font-bold bg-neutral-900 dark:bg-[#CCFF00] text-white dark:text-black rounded-lg hover:bg-neutral-800 dark:hover:bg-[#b8e600] transition-colors"
                      >
                        {t('academyDetail.buyTicket')}
                      </button>
                      <div className="flex gap-2 bg-neutral-100 dark:bg-neutral-900 rounded-lg p-1">
                      <button
                        onClick={() => setScheduleViewMode('week')}
                        className={`px-3 py-1.5 text-xs font-bold rounded transition-colors ${
                          scheduleViewMode === 'week'
                            ? 'bg-white dark:bg-neutral-800 text-black dark:text-white shadow-sm'
                            : 'text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white'
                        }`}
                      >
                        {t('academyDetail.week')}
                      </button>
                      <button
                        onClick={() => setScheduleViewMode('month')}
                        className={`px-3 py-1.5 text-xs font-bold rounded transition-colors ${
                          scheduleViewMode === 'month'
                            ? 'bg-white dark:bg-neutral-800 text-black dark:text-white shadow-sm'
                            : 'text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white'
                        }`}
                      >
                        {t('academyDetail.month')}
                      </button>
                      </div>
                    </div>
                  </div>
                  {scheduleViewMode === 'week' ? (
                    <AcademyWeeklyScheduleView
                      academyId={(academy as any).academyId || academy.id}
                      onClassClick={handleClassClick}
                    />
                  ) : (
                    <AcademyMonthlyScheduleView
                      academyId={(academy as any).academyId || academy.id}
                      onClassClick={handleClassClick}
                    />
                  )}
                </div>
              );
            case 'reviews':
              return (
                <div key="reviews" ref={reviewsRef} className="p-5 scroll-mt-20">
                  <h3 className="text-black dark:text-white font-bold text-lg mb-4">{t('academyDetail.reviews')}</h3>
                  <div className="text-center py-12 text-neutral-500">
                    {t('academyDetail.noReviews')}
                  </div>
                </div>
              );
            default:
              return null;
          }
        })}
      </div>
      <ClassPreviewModal
        classInfo={previewClass}
        onClose={() => setPreviewClass(null)}
        onBook={handleBook}
      />
      <TicketPurchaseModal
        isOpen={showTicketPurchaseModal}
        onClose={() => setShowTicketPurchaseModal(false)}
        academyId={(academy as any).academyId || academy.id}
        academyName={academy.name}
        onPurchaseComplete={() => {
          // 구매 완료 후 처리
        }}
      />
      <ConsultationRequestModal
        isOpen={showConsultationModal}
        onClose={() => setShowConsultationModal(false)}
        academyId={(academy as any).academyId || academy.id}
        academyName={academy.name}
      />
      {/* 유튜브 영상 모달 */}
      {selectedVideo && (
        <div 
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 backdrop-blur-sm animate-in fade-in"
          onClick={() => setSelectedVideo(null)}
        >
          <div 
            className="relative w-full max-w-4xl mx-4 bg-black rounded-lg overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <button 
              onClick={() => setSelectedVideo(null)}
              className="absolute top-4 right-4 z-10 p-2 bg-black/50 hover:bg-black/70 rounded-full text-white transition-colors"
            >
              <X size={24} />
            </button>
            <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
              {selectedVideo.thumbnail && (
                <div className="absolute inset-0 z-0">
                  <Image
                    src={selectedVideo.thumbnail}
                    alt={t('academyDetail.videoThumbnail')}
                    fill
                    className="object-cover opacity-0"
                    style={{ display: 'none' }}
                  />
                </div>
              )}
              <iframe
                src={selectedVideo.url}
                className="absolute top-0 left-0 w-full h-full z-10"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                title="YouTube video player"
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
};

