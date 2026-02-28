"use client";

import Image from 'next/image';
import { Bell, Search, MapPin, Flame, ChevronRight, Navigation, LayoutGrid } from 'lucide-react';
import { ViewState } from '@/types';
import { useState, useEffect, useCallback } from 'react';
import { getSupabaseClient } from '@/lib/utils/supabase-client';
import { Academy, Dancer } from '@/types';
import { ThemeToggle } from '@/components/common/theme-toggle';
import { LanguageToggle } from '@/components/common/language-toggle';
import { BannerCarousel } from '@/components/banner/banner-carousel';
import { useLocale } from '@/contexts/LocaleContext';
import { useTranslation } from '@/lib/i18n/useTranslation';
import { NotificationBadge } from '@/components/notifications/notification-badge';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface HomeViewProps {
  onNavigate: (view: ViewState, query?: string) => void;
  onAcademyClick?: (academy: Academy) => void;
  onDancerClick?: (dancer: Dancer) => void;
}

interface InstructorWithFavorites extends Dancer {
  favoriteCount: number;
  price?: number;
}

interface Banner {
  id: string;
  title: string;
  image_url: string;
  link_url: string | null;
}

interface BannerSettings {
  auto_slide_interval: number;
  is_auto_slide_enabled: boolean;
}


// 섹션별 스켈레톤 컴포넌트들
const InstructorCarouselSkeleton = () => (
  <div className="flex gap-3 overflow-x-auto scrollbar-hide px-5 pb-2">
    {Array.from({ length: 4 }).map((_, i) => (
      <div key={i} className="flex-shrink-0 w-32 animate-pulse">
        <div className="aspect-[3/4] rounded-2xl bg-neutral-200 dark:bg-neutral-800" />
      </div>
    ))}
  </div>
);

const AcademyListSkeleton = () => (
  <div className="px-5 space-y-3">
    {Array.from({ length: 3 }).map((_, i) => (
      <div key={i} className="flex gap-3 bg-white dark:bg-neutral-900 rounded-2xl p-3 border border-neutral-200 dark:border-neutral-800 animate-pulse">
        <div className="w-20 h-20 rounded-xl bg-neutral-200 dark:bg-neutral-800 flex-shrink-0" />
        <div className="flex-1 flex flex-col justify-center">
          <div className="h-4 bg-neutral-200 dark:bg-neutral-800 rounded w-28 mb-2" />
          <div className="h-3 bg-neutral-200 dark:bg-neutral-800 rounded w-36" />
        </div>
      </div>
    ))}
  </div>
);

export const HomeView = ({ onNavigate, onAcademyClick, onDancerClick }: HomeViewProps) => {
  const { t, language } = useLocale();
  const { translateTexts, isEnglish } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [recentAcademies, setRecentAcademies] = useState<Academy[]>([]);
  const [nearbyAcademies, setNearbyAcademies] = useState<Academy[]>([]);
  const [hotInstructors, setHotInstructors] = useState<InstructorWithFavorites[]>([]);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [bannerSettings, setBannerSettings] = useState<BannerSettings>({
    auto_slide_interval: 5000,
    is_auto_slide_enabled: true,
  });
  // 섹션별 독립 로딩 상태
  const [instructorsLoading, setInstructorsLoading] = useState(true);
  const [academiesLoading, setAcademiesLoading] = useState(true);
  const [bannersLoading, setBannersLoading] = useState(true);

  // 영어 모드일 때 학원/강사 이름 자동 번역
  const translateContent = useCallback(async () => {
    if (!isEnglish) return;

    const academyNames = [...recentAcademies, ...nearbyAcademies].map(a => a.name);
    const instructorNames = hotInstructors.map(i => i.name);
    const allTexts = [...new Set([...academyNames, ...instructorNames])];

    if (allTexts.length === 0) return;

    const translations = await translateTexts(allTexts);
    const translationMap = new Map<string, string>();
    allTexts.forEach((text, i) => {
      translationMap.set(text, translations[i]);
    });

    setRecentAcademies(prev => prev.map(a => ({
      ...a,
      name: translationMap.get(a.name) || a.name,
    })));
    setNearbyAcademies(prev => prev.map(a => ({
      ...a,
      name: translationMap.get(a.name) || a.name,
    })));
    setHotInstructors(prev => prev.map(i => ({
      ...i,
      name: translationMap.get(i.name) || i.name,
    })));
  }, [isEnglish, recentAcademies, nearbyAcademies, hotInstructors, translateTexts]);

  // 언어 변경 시 번역 실행
  useEffect(() => {
    if (isEnglish && (recentAcademies.length > 0 || nearbyAcademies.length > 0 || hotInstructors.length > 0)) {
      translateContent();
    }
  }, [language]);

  useEffect(() => {
    let isMounted = true;
    
    // 최근 본 학원 (즉시 - localStorage)
    const loadRecentAcademies = () => {
      try {
        const recent = localStorage.getItem('recent_academies');
        if (recent && isMounted) {
          const parsed = JSON.parse(recent);
          setRecentAcademies(parsed.slice(0, 5));
        }
      } catch (e) {
        console.error('Error loading recent academies:', e);
      }
    };

    // 배너 로드 (가벼움 - 우선 로드)
    const loadBanners = async () => {
      try {
        const response = await fetch('/api/banners');
        const data = await response.json();
        if (isMounted) {
          setBanners(data.banners || []);
          if (data.settings) {
            setBannerSettings(data.settings);
          }
        }
      } catch (error) {
        console.error('Error loading banners:', error);
      } finally {
        if (isMounted) setBannersLoading(false);
      }
    };

    // 주변 학원 로드 (Phase 1: 기본 정보만 먼저, Phase 2: 가격)
    const loadNearbyAcademies = async () => {
      try {
        const supabase = getSupabaseClient();
        if (!supabase) return;

        const { data, error } = await (supabase as any)
          .from('academies')
          .select(`id, name_kr, name_en, tags, logo_url, address, images`)
          .eq('is_active', true)
          .limit(6)
          .order('created_at', { ascending: false });

        if (error) throw error;
        if (!isMounted) return;

        // Phase 1: 기본 정보만으로 즉시 표시
        const transformed = (data || []).map((dbAcademy: any) => {
          const name = dbAcademy.name_kr || dbAcademy.name_en || '이름 없음';
          const images = (dbAcademy.images && Array.isArray(dbAcademy.images)) ? dbAcademy.images : [];
          const sortedImages = images.sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
          const imageUrl = sortedImages.length > 0 ? sortedImages[0].url : dbAcademy.logo_url;

          return {
            id: dbAcademy.id,
            name_kr: dbAcademy.name_kr,
            name_en: dbAcademy.name_en,
            tags: dbAcademy.tags,
            logo_url: dbAcademy.logo_url,
            name,
            img: imageUrl || undefined,
            academyId: dbAcademy.id,
            address: dbAcademy.address,
          } as any;
        });

        if (isMounted) {
          setNearbyAcademies(transformed);
          setAcademiesLoading(false);
        }

        // Phase 2: 가격 정보 백그라운드 로드
        const academyIds = (data || []).map((a: any) => a.id);
        if (academyIds.length > 0) {
          const { data: ticketsData } = await (supabase as any)
            .from('tickets')
            .select('academy_id, price')
            .in('academy_id', academyIds)
            .eq('is_on_sale', true)
            .not('price', 'is', null)
            .gt('price', 0)
            .limit(100);
          
          if (!isMounted) return;

          const priceMap = new Map<string, number>();
          (ticketsData || []).forEach((ticket: any) => {
            if (ticket.academy_id && ticket.price) {
              const current = priceMap.get(ticket.academy_id);
              if (!current || ticket.price < current) {
                priceMap.set(ticket.academy_id, ticket.price);
              }
            }
          });

          if (isMounted && priceMap.size > 0) {
            setNearbyAcademies(prev => prev.map(a => ({
              ...a,
              price: priceMap.get(a.id) || (a as any).price,
            })));
          }
        }
      } catch (error) {
        console.error('Error loading nearby academies:', error);
        if (isMounted) setAcademiesLoading(false);
      }
    };

    // HOT한 강사 로드 (Phase 1: 기본만, Phase 2: 가격)
    const loadHotInstructors = async () => {
      try {
        const supabase = getSupabaseClient();
        if (!supabase) return;

        // Phase 1: 기본 강사 정보만 (limit 10)
        const { data: instructorsData, error: instructorsError } = await (supabase as any)
          .from('instructors')
          .select(`id, name_kr, name_en, specialties, profile_image_url`)
          .limit(10);

        if (instructorsError) {
          if (instructorsError.code !== 'PGRST200') {
            console.warn('Error loading hot instructors:', instructorsError);
          }
          return;
        }

        if (!isMounted) return;

        // Phase 1: 기본 정보만으로 즉시 표시
        const basicInstructors = (instructorsData || []).map((instructor: any) => {
          const name = instructor.name_kr || instructor.name_en || '이름 없음';
          const specialties = instructor.specialties || '';
          const genre = specialties.split(',')[0]?.trim() || 'ALL';
          const crew = specialties.split(',')[1]?.trim() || '';

          return {
            id: instructor.id,
            name_kr: instructor.name_kr,
            name_en: instructor.name_en,
            specialties: instructor.specialties,
            name,
            crew: crew || undefined,
            genre: genre || undefined,
            img: instructor.profile_image_url || undefined,
            favoriteCount: 0,
          } as InstructorWithFavorites;
        });

        if (isMounted) {
          setHotInstructors(basicInstructors);
          setInstructorsLoading(false);
        }

        // Phase 2: 찜 수, 가격 정보 백그라운드 로드
        const instructorIds = (instructorsData || []).map((i: any) => i.id);
        
        const [favoritesResult, classesResult] = await Promise.all([
          (supabase as any)
            .from('instructor_favorites')
            .select('instructor_id')
            .in('instructor_id', instructorIds)
            .catch(() => ({ data: [] })),
          (supabase as any)
            .from('classes')
            .select('instructor_id, academy_id')
            .in('instructor_id', instructorIds)
            .limit(100)
        ]);

        if (!isMounted) return;

        const favoriteCountMap = new Map<string, number>();
        (favoritesResult.data || []).forEach((fav: any) => {
          if (fav.instructor_id) {
            favoriteCountMap.set(fav.instructor_id, (favoriteCountMap.get(fav.instructor_id) || 0) + 1);
          }
        });

        // 강사별 학원 ID 수집
        const instructorAcademyMap = new Map<string, Set<string>>();
        (classesResult.data || []).forEach((cls: any) => {
          if (cls.instructor_id && cls.academy_id) {
            if (!instructorAcademyMap.has(cls.instructor_id)) {
              instructorAcademyMap.set(cls.instructor_id, new Set());
            }
            instructorAcademyMap.get(cls.instructor_id)!.add(cls.academy_id);
          }
        });

        // 모든 관련 학원의 수강권 최저가 조회
        const allAcademyIds = Array.from(new Set(
          Array.from(instructorAcademyMap.values()).flatMap(set => Array.from(set))
        ));
        
        const academyPriceMap = new Map<string, number>();
        if (allAcademyIds.length > 0) {
          const { data: ticketsData } = await (supabase as any)
            .from('tickets')
            .select('academy_id, price')
            .in('academy_id', allAcademyIds)
            .eq('is_on_sale', true)
            .or('is_public.eq.true,is_public.is.null')
            .not('price', 'is', null)
            .gt('price', 0)
            .limit(100);
          
          (ticketsData || []).forEach((ticket: any) => {
            if (ticket.academy_id && ticket.price) {
              const current = academyPriceMap.get(ticket.academy_id);
              if (!current || ticket.price < current) {
                academyPriceMap.set(ticket.academy_id, ticket.price);
              }
            }
          });
        }

        if (!isMounted) return;

        // 강사별 최저 가격 계산
        const priceMap = new Map<string, number>();
        instructorAcademyMap.forEach((academyIds, instructorId) => {
          let minPrice: number | undefined;
          academyIds.forEach(academyId => {
            const price = academyPriceMap.get(academyId);
            if (price && (!minPrice || price < minPrice)) {
              minPrice = price;
            }
          });
          if (minPrice) {
            priceMap.set(instructorId, minPrice);
          }
        });

        // Phase 2 업데이트: 찜 수와 가격 병합 후 정렬
        if (isMounted) {
          setHotInstructors(prev => {
            const updated = prev.map(instructor => ({
              ...instructor,
              favoriteCount: favoriteCountMap.get(instructor.id) || Math.floor(Math.random() * 50) + 10,
              price: priceMap.get(instructor.id),
            }));
            return updated
              .sort((a, b) => b.favoriteCount - a.favoriteCount)
              .slice(0, 10);
          });
        }
      } catch (error) {
        console.error('Error loading hot instructors:', error);
        if (isMounted) setInstructorsLoading(false);
      }
    };

    // 즉시 실행 (localStorage - 동기)
    loadRecentAcademies();
    // 병렬 비동기 로드
    loadBanners();
    loadNearbyAcademies();
    loadHotInstructors();
    
    return () => {
      isMounted = false;
    };
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      onNavigate('SEARCH_RESULTS', searchQuery);
    }
  };


  const handleAcademyClickInternal = (academy: Academy) => {
    try {
      const recent = JSON.parse(localStorage.getItem('recent_academies') || '[]');
      const filtered = recent.filter((a: Academy) => a.id !== academy.id);
      const updated = [academy, ...filtered].slice(0, 10);
      localStorage.setItem('recent_academies', JSON.stringify(updated));
    } catch (e) {
      console.error('Error saving recent academy:', e);
    }

    if (onAcademyClick) {
      onAcademyClick(academy);
    }
  };

  const handleDancerClickInternal = (dancer: Dancer) => {
    if (onDancerClick) {
      onDancerClick(dancer);
    }
  };

  return (
    <div className="pb-24 animate-in fade-in duration-300">
      {/* 헤더 */}
      <header className="px-5 pt-8 pb-4 sticky top-0 bg-white/80 dark:bg-neutral-950/80 backdrop-blur-md z-30">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-xl font-black italic tracking-tighter">
            MOVE<span className="text-neutral-800 dark:text-[#CCFF00]">.</span>IT
          </h1>
          <div className="flex gap-3 items-center">
            <LanguageToggle />
            <ThemeToggle />
            <button
              className="relative"
              onClick={() => window.location.href = '/notifications'}
            >
              <Bell className="text-neutral-600 dark:text-neutral-400" size={22} />
              <NotificationBadge />
            </button>
          </div>
        </div>
        <form onSubmit={handleSearch} className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none z-10" size={18} />
          <Input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={language === 'en' ? 'Search genre, instructor, academy' : '장르, 강사, 학원 검색'}
            className="h-11 w-full pl-10 rounded-xl bg-neutral-100 dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 focus-visible:ring-neutral-400 dark:focus-visible:ring-[#CCFF00]"
          />
        </form>
      </header>

      {/* 배너 캐러셀 */}
      {bannersLoading ? (
        <div className="px-5 mt-2">
          <div className="aspect-[2.5/1] rounded-2xl bg-neutral-200 dark:bg-neutral-800 animate-pulse" />
        </div>
      ) : banners.length > 0 ? (
        <div className="px-5 mt-2">
          <BannerCarousel
            banners={banners}
            autoSlideInterval={bannerSettings.auto_slide_interval}
            isAutoSlideEnabled={bannerSettings.is_auto_slide_enabled}
          />
        </div>
      ) : null}

      {/* 학원 찾기 카드 */}
      <section className="px-5 mt-6" aria-label={language === 'en' ? 'Find studios' : '학원 찾기'}>
        <div className="grid grid-cols-2 gap-3">
          <Card
            role="button"
            tabIndex={0}
            onClick={() => onNavigate('ACADEMY')}
            onKeyDown={(e) => e.key === 'Enter' && onNavigate('ACADEMY')}
            className={cn(
              "cursor-pointer overflow-hidden transition-all hover:shadow-md active:scale-[0.98]",
              "border-neutral-200 dark:border-neutral-800",
              "hover:border-blue-300 dark:hover:border-blue-700"
            )}
          >
            <CardContent className="p-4 flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-blue-500 text-white">
                <Navigation size={20} aria-hidden />
              </div>
              <div className="min-w-0 flex-1 text-left">
                <p className="text-sm font-semibold text-neutral-900 dark:text-white truncate">
                  {language === 'en' ? 'Nearby Studios' : '내 주변'}
                </p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">
                  {language === 'en' ? 'Find dance studios near you' : '댄스학원 찾기'}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card
            role="button"
            tabIndex={0}
            onClick={() => onNavigate('SEARCH_RESULTS', 'genre')}
            onKeyDown={(e) => e.key === 'Enter' && onNavigate('SEARCH_RESULTS', 'genre')}
            className={cn(
              "cursor-pointer overflow-hidden transition-all hover:shadow-md active:scale-[0.98]",
              "border-neutral-200 dark:border-neutral-800",
              "hover:border-violet-300 dark:hover:border-violet-700"
            )}
          >
            <CardContent className="p-4 flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-violet-500 text-white">
                <LayoutGrid size={20} aria-hidden />
              </div>
              <div className="min-w-0 flex-1 text-left">
                <p className="text-sm font-semibold text-neutral-900 dark:text-white truncate">
                  {language === 'en' ? 'By Genre' : '장르별'}
                </p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">
                  {language === 'en' ? 'Browse by dance genre' : '댄스학원 찾기'}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* HOT한 강사 */}
      <section className="mt-8" aria-label={language === 'en' ? 'HOT Instructors' : 'HOT 강사'}>
        <div className="flex items-center justify-between px-5 mb-3">
          <div className="flex items-center gap-2">
            <Badge variant="destructive" className="gap-1.5 whitespace-nowrap font-semibold">
              <Flame size={14} className="shrink-0" />
              {language === 'en' ? 'HOT Instructors' : 'HOT 강사'}
            </Badge>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('DANCER')}
            className="inline-flex items-center gap-1 text-sm font-medium text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100 transition-colors"
          >
            {t('common.viewAll')}
            <ChevronRight size={16} className="shrink-0" />
          </button>
        </div>
        {instructorsLoading ? (
          <InstructorCarouselSkeleton />
        ) : hotInstructors.length > 0 ? (
          <div className="flex gap-3 overflow-x-auto scrollbar-hide px-5 pb-2">
            {hotInstructors.map((instructor) => (
              <div
                key={instructor.id}
                onClick={() => handleDancerClickInternal(instructor)}
                className="flex-shrink-0 w-32 active:scale-[0.98] transition-transform cursor-pointer"
              >
                <div className="aspect-[3/4] relative rounded-2xl overflow-hidden bg-neutral-100 dark:bg-neutral-800">
                  {instructor.img ? (
                    <Image
                      src={instructor.img}
                      alt={instructor.name}
                      fill
                      sizes="128px"
                      className="object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-neutral-200 dark:bg-neutral-800 flex items-center justify-center">
                      <span className="text-sm font-bold text-neutral-400 dark:text-neutral-600 text-center px-1">
                        {instructor.name}
                      </span>
                    </div>
                  )}
                  {/* 하단 그라데이션 */}
                  <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/80 to-transparent" />
                  <div className="absolute bottom-2 left-2 right-2">
                    <h3 className="text-white text-sm font-bold truncate">{instructor.name}</h3>
                    {instructor.genre && (
                      <p className="text-white/70 text-[10px] truncate">{instructor.genre}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="px-5 text-center py-6 text-neutral-400 text-sm">
            {language === 'en' ? 'No instructors yet' : '등록된 강사가 없습니다'}
          </div>
        )}
      </section>

      {/* 최근 본 학원 */}
      {recentAcademies.length > 0 && (
        <div className="mt-8">
          <div className="flex items-center justify-between px-5 mb-3">
            <h2 className="text-lg font-bold text-black dark:text-white">{language === 'en' ? 'Recently Viewed' : '최근 본 학원'}</h2>
            <button 
              onClick={() => onNavigate('ACADEMY')}
              className="flex items-center gap-1 text-xs text-neutral-500 dark:text-neutral-400"
            >
              {t('common.viewAll')} <ChevronRight size={14} />
            </button>
          </div>
          <div className="flex gap-3 overflow-x-auto scrollbar-hide px-5 pb-2">
            {recentAcademies.map(academy => (
              <div
                key={academy.id}
                onClick={() => handleAcademyClickInternal(academy)}
                className="flex-shrink-0 w-44 bg-white dark:bg-neutral-900 rounded-2xl overflow-hidden border border-neutral-200 dark:border-neutral-800 active:scale-[0.98] transition-transform cursor-pointer"
              >
                <div className="aspect-[4/3] relative bg-neutral-100 dark:bg-neutral-800">
                  {(academy.img || academy.logo_url) ? (
                    <Image
                      src={academy.img || academy.logo_url || ''}
                      alt={academy.name}
                      fill
                      sizes="176px"
                      className="object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <MapPin className="text-neutral-400" size={24} />
                    </div>
                  )}
                </div>
                <div className="p-3">
                  <h3 className="text-sm font-bold text-black dark:text-white truncate">{academy.name}</h3>
                  {academy.address && (
                    <p className="text-[11px] text-neutral-500 dark:text-neutral-400 truncate mt-0.5">{academy.address}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 주변 학원 */}
      <div className="mt-8">
        <div className="flex items-center justify-between px-5 mb-3">
          <h2 className="text-lg font-bold text-black dark:text-white">{language === 'en' ? 'Nearby Academies' : '주변 댄스학원'}</h2>
          <button 
            onClick={() => onNavigate('ACADEMY')}
            className="flex items-center gap-1 text-xs text-neutral-500 dark:text-neutral-400"
          >
            {t('common.viewAll')} <ChevronRight size={14} />
          </button>
        </div>
        {academiesLoading ? (
          <AcademyListSkeleton />
        ) : nearbyAcademies.length > 0 ? (
          <div className="px-5 space-y-3">
            {nearbyAcademies.slice(0, 4).map(academy => (
              <div
                key={academy.id}
                onClick={() => handleAcademyClickInternal(academy)}
                className="flex gap-3 bg-white dark:bg-neutral-900 rounded-2xl overflow-hidden border border-neutral-200 dark:border-neutral-800 active:scale-[0.99] transition-transform cursor-pointer p-3"
              >
                <div className="w-20 h-20 relative rounded-xl overflow-hidden bg-neutral-100 dark:bg-neutral-800 flex-shrink-0">
                  {(academy.img || academy.logo_url) ? (
                    <Image
                      src={academy.img || academy.logo_url || ''}
                      alt={academy.name}
                      fill
                      sizes="80px"
                      className="object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <MapPin className="text-neutral-400" size={20} />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0 flex flex-col justify-center">
                  <h3 className="text-sm font-bold text-black dark:text-white truncate">{academy.name}</h3>
                  {academy.address && (
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate mt-0.5">{academy.address}</p>
                  )}
                  {academy.tags && (
                    <div className="flex gap-1 mt-2">
                      {academy.tags.split(',').slice(0, 2).map((tag: string, i: number) => (
                        <span key={i} className="text-[10px] px-2 py-0.5 bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 rounded-full">
                          {tag.trim()}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                {academy.price && (
                  <div className="flex-shrink-0 self-center">
                    <span className="text-sm font-bold text-neutral-800 dark:text-[#CCFF00]">
                      {academy.price.toLocaleString()}원~
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="px-5 text-center py-6 text-neutral-400 text-sm">
            {language === 'en' ? 'No academies found' : '학원이 없습니다'}
          </div>
        )}
      </div>

      {/* 하단 여백 */}
      <div className="h-8" />
    </div>
  );
};
