"use client";

import Image from 'next/image';
import { Bell, Search, MapPin, Flame, ChevronRight } from 'lucide-react';
import { ViewState } from '@/types';
import { useState, useEffect } from 'react';
import { getSupabaseClient } from '@/lib/utils/supabase-client';
import { Academy, Dancer } from '@/types';
import { ThemeToggle } from '@/components/common/theme-toggle';
import { BannerCarousel } from '@/components/banner/banner-carousel';
import { useLocale } from '@/contexts/LocaleContext';

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

// 댄스 장르 카테고리
const DANCE_CATEGORIES = [
  { id: 'hiphop', name: 'Hiphop', icon: '🎤' },
  { id: 'kpop', name: 'K-Pop', icon: '🎵' },
  { id: 'jazz', name: 'Jazz', icon: '🎷' },
  { id: 'contemporary', name: 'Contemporary', icon: '🩰' },
  { id: 'waacking', name: 'Waacking', icon: '💃' },
  { id: 'popping', name: 'Popping', icon: '🤖' },
  { id: 'locking', name: 'Locking', icon: '🔒' },
  { id: 'house', name: 'House', icon: '🏠' },
];

export const HomeView = ({ onNavigate, onAcademyClick, onDancerClick }: HomeViewProps) => {
  const { t, language } = useLocale();
  const [searchQuery, setSearchQuery] = useState('');
  const [recentAcademies, setRecentAcademies] = useState<Academy[]>([]);
  const [nearbyAcademies, setNearbyAcademies] = useState<Academy[]>([]);
  const [hotInstructors, setHotInstructors] = useState<InstructorWithFavorites[]>([]);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [bannerSettings, setBannerSettings] = useState<BannerSettings>({
    auto_slide_interval: 5000,
    is_auto_slide_enabled: true,
  });

  useEffect(() => {
    let isMounted = true;
    
    // 최근 본 학원 로드
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

    // 주변 학원 로드
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

        const academyIds = (data || []).map((a: any) => a.id);
        let priceMap = new Map<string, number>();
        
        if (academyIds.length > 0) {
          // 수강권 기반 최저가 조회
          const { data: ticketsData } = await (supabase as any)
            .from('tickets')
            .select('academy_id, price')
            .in('academy_id', academyIds)
            .eq('is_on_sale', true)
            .not('price', 'is', null)
            .gt('price', 0)
            .limit(100);
          
          (ticketsData || []).forEach((ticket: any) => {
            if (ticket.academy_id && ticket.price) {
              const current = priceMap.get(ticket.academy_id);
              if (!current || ticket.price < current) {
                priceMap.set(ticket.academy_id, ticket.price);
              }
            }
          });
        }

        const transformed = (data || []).map((dbAcademy: any) => {
          const name = dbAcademy.name_kr || dbAcademy.name_en || '이름 없음';
          const images = (dbAcademy.images && Array.isArray(dbAcademy.images)) ? dbAcademy.images : [];
          const sortedImages = images.sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
          const imageUrl = sortedImages.length > 0 ? sortedImages[0].url : dbAcademy.logo_url;
          const minPrice = priceMap.get(dbAcademy.id);

          return {
            id: dbAcademy.id,
            name_kr: dbAcademy.name_kr,
            name_en: dbAcademy.name_en,
            tags: dbAcademy.tags,
            logo_url: dbAcademy.logo_url,
            name,
            price: minPrice || undefined,
            img: imageUrl || undefined,
            academyId: dbAcademy.id,
            address: dbAcademy.address,
          } as any;
        });

        if (isMounted) {
          setNearbyAcademies(transformed);
        }
      } catch (error) {
        console.error('Error loading nearby academies:', error);
      }
    };

    // HOT한 강사 로드
    const loadHotInstructors = async () => {
      try {
        const supabase = getSupabaseClient();
        if (!supabase) return;

        const { data: instructorsData, error: instructorsError } = await (supabase as any)
          .from('instructors')
          .select(`id, name_kr, name_en, specialties, profile_image_url`)
          .limit(20);

        if (instructorsError) {
          if (instructorsError.code !== 'PGRST200') {
            console.warn('Error loading hot instructors:', instructorsError);
          }
          return;
        }

        if (!isMounted) return;

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

        const instructorsWithFavorites = (instructorsData || []).map((instructor: any) => {
          const name = instructor.name_kr || instructor.name_en || '이름 없음';
          const specialties = instructor.specialties || '';
          const genre = specialties.split(',')[0]?.trim() || 'ALL';
          const crew = specialties.split(',')[1]?.trim() || '';
          const favoriteCount = favoriteCountMap.get(instructor.id) || Math.floor(Math.random() * 50) + 10;

          return {
            id: instructor.id,
            name_kr: instructor.name_kr,
            name_en: instructor.name_en,
            specialties: instructor.specialties,
            name,
            crew: crew || undefined,
            genre: genre || undefined,
            img: instructor.profile_image_url || undefined,
            favoriteCount,
            price: priceMap.get(instructor.id),
          } as InstructorWithFavorites;
        });

        const sorted = instructorsWithFavorites
          .sort((a: InstructorWithFavorites, b: InstructorWithFavorites) => b.favoriteCount - a.favoriteCount)
          .slice(0, 10);

        if (isMounted) {
          setHotInstructors(sorted);
        }
      } catch (error) {
        console.error('Error loading hot instructors:', error);
      }
    };

    // 배너 로드
    const loadBanners = async () => {
      try {
        const response = await fetch('/api/banners');
        const data = await response.json();
        console.log('Banners loaded:', data);
        if (isMounted) {
          setBanners(data.banners || []);
          if (data.settings) {
            setBannerSettings(data.settings);
          }
        }
      } catch (error) {
        console.error('Error loading banners:', error);
      }
    };

    loadRecentAcademies();
    Promise.all([loadNearbyAcademies(), loadHotInstructors(), loadBanners()]);
    
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

  const handleCategoryClick = (categoryId: string) => {
    onNavigate('SEARCH_RESULTS', categoryId);
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
            <ThemeToggle />
            <button className="relative">
              <Bell className="text-neutral-600 dark:text-neutral-400" size={22} />
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-red-500 rounded-full"></span>
            </button>
          </div>
        </div>
        <form onSubmit={handleSearch} className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" size={18} />
          <input 
            type="text" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={language === 'en' ? 'Search genre, instructor, academy' : '장르, 강사, 학원 검색'} 
            className="w-full bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl py-3 pl-11 pr-4 text-sm text-black dark:text-white focus:border-neutral-400 dark:focus:border-[#CCFF00] outline-none transition-colors" 
          />
        </form>
      </header>

      {/* 배너 캐러셀 */}
      {banners.length > 0 && (
        <div className="px-5 mt-2">
          <BannerCarousel
            banners={banners}
            autoSlideInterval={bannerSettings.auto_slide_interval}
            isAutoSlideEnabled={bannerSettings.is_auto_slide_enabled}
          />
        </div>
      )}

      {/* 카테고리 아이콘 */}
      <div className="px-5 mt-6">
        <div className="flex gap-4 overflow-x-auto scrollbar-hide pb-2">
          {DANCE_CATEGORIES.map(category => (
            <button
              key={category.id}
              onClick={() => handleCategoryClick(category.id)}
              className="flex flex-col items-center gap-2 min-w-[60px] active:scale-95 transition-transform"
            >
              <div className="w-14 h-14 rounded-2xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-2xl">
                {category.icon}
              </div>
              <span className="text-[11px] font-medium text-neutral-700 dark:text-neutral-300 whitespace-nowrap">
                {category.name}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* HOT한 강사 */}
      {hotInstructors.length > 0 && (
        <div className="mt-8">
          <div className="flex items-center justify-between px-5 mb-3">
            <div className="flex items-center gap-2">
              <Flame className="text-red-500" size={20} />
              <h2 className="text-lg font-bold text-black dark:text-white">{language === 'en' ? 'HOT Instructors' : 'HOT 강사'}</h2>
            </div>
            <button 
              onClick={() => onNavigate('DANCER')}
              className="flex items-center gap-1 text-xs text-neutral-500 dark:text-neutral-400"
            >
              {t('common.viewAll')} <ChevronRight size={14} />
            </button>
          </div>
          <div className="flex gap-3 overflow-x-auto scrollbar-hide px-5 pb-2">
            {hotInstructors.map((instructor, index) => (
              <div
                key={instructor.id}
                onClick={() => handleDancerClickInternal(instructor)}
                className="flex-shrink-0 w-32 active:scale-[0.98] transition-transform cursor-pointer"
              >
                <div className="aspect-[3/4] relative rounded-2xl overflow-hidden bg-neutral-100 dark:bg-neutral-800">
                  <Image
                    src={instructor.img || `https://picsum.photos/seed/instructor${instructor.id}/200/300`}
                    alt={instructor.name}
                    fill
                    sizes="128px"
                    className="object-cover"
                  />
                  {/* 순위 배지 */}
                  {index < 3 && (
                    <div className="absolute top-2 left-2 w-6 h-6 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center">
                      {index + 1}
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
        </div>
      )}

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
      {nearbyAcademies.length > 0 && (
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
        </div>
      )}

      {/* 하단 여백 */}
      <div className="h-8" />
    </div>
  );
};
