"use client";

import Image from 'next/image';
import { Bell, Search, Play, MapPin, Tag, Percent, Calendar, CreditCard, TrendingDown, User, Flame } from 'lucide-react';
import { ViewState } from '@/types';
import { useState, useEffect } from 'react';
import { getSupabaseClient } from '@/lib/utils/supabase-client';
import { Academy, Dancer } from '@/types';
import { ThemeToggle } from '@/components/common/theme-toggle';

interface HomeViewProps {
  onNavigate: (view: ViewState, query?: string) => void;
  onAcademyClick?: (academy: Academy) => void;
  onDancerClick?: (dancer: Dancer) => void;
}

interface InstructorWithFavorites extends Dancer {
  favoriteCount: number;
  price?: number;
}

export const HomeView = ({ onNavigate, onAcademyClick, onDancerClick }: HomeViewProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [recentAcademies, setRecentAcademies] = useState<Academy[]>([]);
  const [nearbyAcademies, setNearbyAcademies] = useState<Academy[]>([]);
  const [hotInstructors, setHotInstructors] = useState<InstructorWithFavorites[]>([]);

  useEffect(() => {
    // 최근 본 학원 로드 (localStorage에서)
    const loadRecentAcademies = () => {
      try {
        const recent = localStorage.getItem('recent_academies');
        if (recent) {
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
          .select(`
            *,
            classes (*)
          `)
          .limit(5)
          .order('created_at', { ascending: false });

        if (error) throw error;

        // 각 학원을 변환
        const transformed = (data || []).map((dbAcademy: any) => {
          const name = dbAcademy.name_kr || dbAcademy.name_en || '이름 없음';
          const classes = dbAcademy.classes || [];
          const images = (dbAcademy.images && Array.isArray(dbAcademy.images)) ? dbAcademy.images : [];
          const minPrice = classes.length > 0 
            ? Math.min(...classes.map((c: any) => c.price || 0))
            : 0;

          // order로 정렬하여 첫 번째 이미지 또는 로고 사용
          const sortedImages = images.sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
          const imageUrl = sortedImages.length > 0 
            ? sortedImages[0].url 
            : dbAcademy.logo_url;

          return {
            id: dbAcademy.id,
            name_kr: dbAcademy.name_kr,
            name_en: dbAcademy.name_en,
            tags: dbAcademy.tags,
            logo_url: dbAcademy.logo_url,
            name,
            dist: undefined,
            rating: undefined,
            price: minPrice > 0 ? minPrice : undefined,
            badges: [],
            img: imageUrl || undefined,
            academyId: dbAcademy.id,
            address: dbAcademy.address,
          } as any;
        });

        setNearbyAcademies(transformed);
      } catch (error) {
        console.error('Error loading nearby academies:', error);
      }
    };

    // HOT한 강사 로드 (찜이 많은 순서대로)
    const loadHotInstructors = async () => {
      try {
        const supabase = getSupabaseClient();
        if (!supabase) return;

        // 먼저 instructor_favorites 테이블 존재 여부 확인
        let hasFavoritesTable = false;
        try {
          const { error: checkError } = await (supabase as any)
            .from('instructor_favorites')
            .select('id')
            .limit(1);
          hasFavoritesTable = !checkError;
        } catch {
          hasFavoritesTable = false;
        }

        // 모든 강사 가져오기 (찜 테이블이 있으면 조인, 없으면 기본 정보만)
        let instructorsData: any[] = [];
        let instructorsError: any = null;

        if (hasFavoritesTable) {
          const result = await (supabase as any)
            .from('instructors')
            .select(`
              *,
              instructor_favorites (id)
            `);
          instructorsData = result.data || [];
          instructorsError = result.error;
        } else {
          // 찜 테이블이 없으면 기본 정보만 가져오기
          const result = await (supabase as any)
            .from('instructors')
            .select('*');
          instructorsData = result.data || [];
          instructorsError = result.error;
        }

        // 에러가 발생하면 빈 배열 반환 (조용히 처리)
        if (instructorsError) {
          // PGRST200 에러는 테이블이 없을 때 발생하는 정상적인 경우이므로 무시
          if (instructorsError.code !== 'PGRST200') {
            console.warn('Error loading hot instructors:', instructorsError);
          }
          return;
        }

        // 찜 개수 계산 및 변환
        const instructorsWithFavorites = (instructorsData || []).map((instructor: any) => {
          const name = instructor.name_kr || instructor.name_en || '이름 없음';
          const specialties = instructor.specialties || '';
          const genre = specialties.split(',')[0]?.trim() || 'ALL';
          const crew = specialties.split(',')[1]?.trim() || '';
          // 찜 테이블이 있으면 찜 개수, 없으면 0 또는 랜덤 값 (시연용)
          const favoriteCount = hasFavoritesTable 
            ? (instructor.instructor_favorites?.length || 0)
            : Math.floor(Math.random() * 50) + 10; // 시연용 랜덤 값

          return {
            id: instructor.id,
            name_kr: instructor.name_kr,
            name_en: instructor.name_en,
            bio: instructor.bio,
            instagram_url: instructor.instagram_url,
            specialties: instructor.specialties,
            name,
            crew: crew || undefined,
            genre: genre || undefined,
            followers: undefined,
            img: instructor.profile_image_url || undefined,
            favoriteCount,
          } as InstructorWithFavorites;
        });

        // 찜 개수로 정렬하고 상위 10명만 선택
        const sorted = (instructorsWithFavorites as InstructorWithFavorites[])
          .sort((a, b) => b.favoriteCount - a.favoriteCount)
          .slice(0, 10);

        // 클래스 정보를 가져와서 가격 정보 추가
        const instructorIds = sorted.map(i => i.id);
        if (instructorIds.length > 0) {
          const { data: classesData } = await (supabase as any)
            .from('classes')
            .select('instructor_id, price')
            .in('instructor_id', instructorIds)
            .not('price', 'is', null)
            .gt('price', 0);

          // 강사별 최소 가격 계산
          const priceMap = new Map<string, number>();
          (classesData || []).forEach((cls: any) => {
            if (cls.instructor_id && cls.price) {
              const current = priceMap.get(cls.instructor_id);
              if (!current || cls.price < current) {
                priceMap.set(cls.instructor_id, cls.price);
              }
            }
          });

          // 가격 정보 추가
          sorted.forEach(instructor => {
            const minPrice = priceMap.get(instructor.id);
            if (minPrice) {
              instructor.price = minPrice;
            }
          });
        }

        setHotInstructors(sorted);
      } catch (error) {
        console.error('Error loading hot instructors:', error);
      }
    };

    loadRecentAcademies();
    loadNearbyAcademies();
    loadHotInstructors();
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      onNavigate('SEARCH_RESULTS', searchQuery);
    }
  };

  const handleAcademyClickInternal = (academy: Academy) => {
    // 최근 본 학원에 추가
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
    <div className="space-y-6 pb-24 animate-in fade-in duration-300">
      <header className="px-5 pt-8 pb-4 sticky top-0 bg-white/80 dark:bg-neutral-950/80 backdrop-blur-md z-30 border-b border-neutral-200 dark:border-neutral-800">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-xl font-black italic tracking-tighter">
            MOVE<span className="text-neutral-800 dark:text-[#CCFF00]">.</span>IT
          </h1>
          <div className="flex gap-3 items-center">
            <ThemeToggle />
            <button className="relative">
              <Bell className="text-neutral-600 dark:text-neutral-400" />
              <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full"></span>
            </button>
            <button onClick={() => onNavigate('MY')}>
              <MapPin className="text-neutral-600 dark:text-neutral-400" />
            </button>
          </div>
        </div>
        <form onSubmit={handleSearch} className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 dark:text-neutral-500" size={18} />
          <input 
            type="text" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="장르, 강사, 학원 검색" 
            className="w-full bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-full py-3 pl-10 pr-4 text-sm text-black dark:text-white focus:border-neutral-800 dark:focus:border-[#CCFF00] outline-none" 
          />
        </form>
      </header>

      {/* 카테고리 버튼 */}
      <div className="grid grid-cols-2 gap-3 px-5">
        <button 
          onClick={() => onNavigate('ACADEMY')} 
          className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-4 flex items-center gap-3 active:scale-[0.98] transition-transform h-full"
        >
          <div className="w-12 h-12 rounded-xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center flex-shrink-0">
            <Percent className="text-black dark:text-white" size={24} />
          </div>
          <div className="text-left min-w-0">
            <div className="text-sm font-bold text-black dark:text-white">회원권</div>
            <div className="text-xs text-neutral-600 dark:text-neutral-400">정기 수강</div>
          </div>
        </button>
        <button 
          onClick={() => onNavigate('ACADEMY')} 
          className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-4 flex items-center gap-3 active:scale-[0.98] transition-transform h-full"
        >
          <div className="w-12 h-12 rounded-xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center flex-shrink-0">
            <Tag className="text-black dark:text-white" size={24} />
          </div>
          <div className="text-left min-w-0">
            <div className="text-sm font-bold text-black dark:text-white">원데이 클래스</div>
            <div className="text-xs text-neutral-600 dark:text-neutral-400">체험 수업</div>
          </div>
        </button>
      </div>

      {/* 주요 기능 카드 */}
      <div className="px-5 grid grid-cols-2 gap-3">
        <button 
          onClick={() => onNavigate('ACADEMY')}
          className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-4 text-left active:scale-[0.98] transition-transform h-full"
        >
          <div className="text-lg font-bold text-black dark:text-white mb-2">내 주변 댄스학원</div>
          <div className="text-xs text-neutral-500 dark:text-neutral-400 mb-2">주변 학원 둘러보기</div>
          <div className="h-24 bg-neutral-100 dark:bg-neutral-800 rounded-xl flex items-center justify-center">
            <MapPin className="text-neutral-400" size={32} />
          </div>
        </button>
        <div className="space-y-3 flex flex-col">
          <button 
            onClick={() => onNavigate('ACADEMY')}
            className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-3 text-left active:scale-[0.98] transition-transform flex-1"
          >
            <div className="text-sm font-bold text-black dark:text-white">지도에서 찾기</div>
            <div className="h-16 bg-neutral-100 dark:bg-neutral-800 rounded-lg mt-2 flex items-center justify-center">
              <MapPin className="text-neutral-400" size={20} />
            </div>
          </button>
          <button 
            onClick={() => onNavigate('DANCER')}
            className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-3 text-left active:scale-[0.98] transition-transform flex-1"
          >
            <div className="text-sm font-bold text-black dark:text-white">강사 찾기</div>
            <div className="h-16 bg-neutral-100 dark:bg-neutral-800 rounded-lg mt-2 flex items-center justify-center">
              <User className="text-neutral-400" size={20} />
            </div>
          </button>
        </div>
      </div>

      {/* 혜택 배너 */}
      <div className="mx-5 bg-neutral-900 dark:bg-neutral-800 rounded-2xl p-5 text-white">
        <div className="text-lg font-bold mb-1">소득공제 신청 가능</div>
        <div className="text-sm text-neutral-300">댄스 클래스 수강 시 소득공제 혜택을 받아보세요</div>
      </div>

      {/* 요새 가장 HOT한 강사 */}
      {hotInstructors.length > 0 && (
        <div className="px-5">
          <div className="flex items-center gap-2 mb-3">
            <Flame className="text-red-500" size={20} />
            <h2 className="text-lg font-bold text-black dark:text-white">요새 가장 HOT한 강사</h2>
          </div>
          <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-2">
            {hotInstructors.map(instructor => (
              <div
                key={instructor.id}
                onClick={() => handleDancerClickInternal(instructor)}
                className="flex-shrink-0 w-40 bg-white dark:bg-neutral-900 rounded-2xl overflow-hidden border border-neutral-200 dark:border-neutral-800 active:scale-[0.98] transition-transform"
              >
                <div className="h-32 relative">
                  <Image
                    src={instructor.img || `https://picsum.photos/seed/instructor${instructor.id}/200/200`}
                    alt={instructor.name}
                    fill
                    sizes="160px"
                    className="object-cover"
                  />
                  {/* HOT 배지 */}
                  <div className="absolute top-1 left-1 bg-red-500 text-white text-[8px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1">
                    <Flame size={8} />
                    HOT
                  </div>
                  {/* 찜 개수 */}
                  <div className="absolute bottom-1 right-1 bg-black/50 backdrop-blur text-white text-[10px] font-bold px-2 py-1 rounded-full">
                    찜 {instructor.favoriteCount}
                  </div>
                </div>
                <div className="p-3">
                  <h3 className="text-sm font-bold text-black dark:text-white truncate mb-1">{instructor.name}</h3>
                  {instructor.genre && (
                    <p className="text-xs text-neutral-600 dark:text-neutral-400 truncate mb-1">{instructor.genre}</p>
                  )}
                  {instructor.price && (
                    <div className="text-xs font-bold text-neutral-800 dark:text-[#CCFF00]">
                      {instructor.price.toLocaleString()}원~
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 최근 본 댄스학원 */}
      {recentAcademies.length > 0 && (
        <div className="px-5">
          <h2 className="text-lg font-bold text-black dark:text-white mb-3">최근 본 학원</h2>
          <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-2">
            {recentAcademies.map(academy => (
              <div
                key={academy.id}
                onClick={() => handleAcademyClickInternal(academy)}
                className="flex-shrink-0 w-48 bg-white dark:bg-neutral-900 rounded-2xl overflow-hidden border border-neutral-200 dark:border-neutral-800 active:scale-[0.98] transition-transform"
              >
                <div className="h-32 relative bg-neutral-100 dark:bg-neutral-800">
                  {(academy.img || academy.logo_url) ? (
                    <Image
                      src={academy.img || academy.logo_url || ''}
                      alt={academy.name}
                      fill
                      sizes="192px"
                      className="object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-neutral-100 dark:bg-neutral-800" />
                  )}
                </div>
                <div className="p-3">
                  <h3 className="text-sm font-bold text-black dark:text-white truncate">{academy.name}</h3>
                  {academy.address && (
                    <p className="text-xs text-neutral-600 dark:text-neutral-400 truncate">{academy.address}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 내 주변 댄스학원 */}
      {nearbyAcademies.length > 0 && (
        <div className="px-5">
          <h2 className="text-lg font-bold text-black dark:text-white mb-3">내 주변 댄스학원</h2>
          <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-2">
            {nearbyAcademies.map(academy => (
              <div
                key={academy.id}
                onClick={() => handleAcademyClickInternal(academy)}
                className="flex-shrink-0 w-48 bg-white dark:bg-neutral-900 rounded-2xl overflow-hidden border border-neutral-200 dark:border-neutral-800 active:scale-[0.98] transition-transform"
              >
                <div className="h-32 relative bg-neutral-100 dark:bg-neutral-800">
                  {(academy.img || academy.logo_url) ? (
                    <Image
                      src={academy.img || academy.logo_url || ''}
                      alt={academy.name}
                      fill
                      sizes="192px"
                      className="object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-neutral-100 dark:bg-neutral-800" />
                  )}
                </div>
                <div className="p-3">
                  <h3 className="text-sm font-bold text-black dark:text-white truncate">{academy.name}</h3>
                  {academy.address && (
                    <p className="text-xs text-neutral-600 dark:text-neutral-400 truncate">{academy.address}</p>
                  )}
                  {academy.price && (
                    <div className="text-xs font-bold text-neutral-800 dark:text-[#CCFF00] mt-1">
                      {academy.price.toLocaleString()}원~
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 추가 혜택 */}
      <div className="grid grid-cols-3 gap-3 px-5">
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-3 text-center">
          <TrendingDown className="text-neutral-600 dark:text-neutral-400 mx-auto mb-2" size={20} />
          <div className="text-xs font-bold text-black dark:text-white">특가 혜택</div>
        </div>
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-3 text-center">
          <Calendar className="text-neutral-600 dark:text-neutral-400 mx-auto mb-2" size={20} />
          <div className="text-xs font-bold text-black dark:text-white">예약 가능</div>
        </div>
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-3 text-center">
          <CreditCard className="text-neutral-600 dark:text-neutral-400 mx-auto mb-2" size={20} />
          <div className="text-xs font-bold text-black dark:text-white">간편 결제</div>
        </div>
      </div>
    </div>
  );
};

