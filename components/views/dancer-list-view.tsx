"use client";

import { fetchWithAuth } from '@/lib/api/auth-fetch';
import Image from 'next/image';
import { Star, Heart, Filter, Tag } from 'lucide-react';
import { useState, useEffect, useCallback, useRef } from 'react';
import { getSupabaseClient } from '@/lib/utils/supabase-client';
import { Dancer } from '@/types';
import { ThemeToggle } from '@/components/common/theme-toggle';
import { LanguageToggle } from '@/components/common/language-toggle';
import { useAuth } from '@/contexts/AuthContext';

interface DancerListViewProps {
  onDancerClick: (dancer: Dancer) => void;
}

interface InstructorWithDetails extends Dancer {
  price?: number;
  location?: string;
  rating?: number;
  discount?: { originalPrice: number; discountPercent: number; finalPrice: number };
  mainGenre?: string;
  upcomingClassesCount?: number;
}

// DB 데이터를 UI 타입으로 변환 (기본 정보만)
function transformInstructorBasic(dbInstructor: any): InstructorWithDetails {
  const name = dbInstructor.name_kr || dbInstructor.name_en || '이름 없음';
  const specialties = dbInstructor.specialties || '';
  const genre = specialties.split(',')[0]?.trim() || 'ALL';
  const crew = specialties.split(',')[1]?.trim() || '';

  return {
    id: dbInstructor.id,
    name_kr: dbInstructor.name_kr,
    name_en: dbInstructor.name_en,
    bio: dbInstructor.bio,
    instagram_url: dbInstructor.instagram_url,
    specialties: dbInstructor.specialties,
    name,
    crew: crew || undefined,
    genre: genre || undefined,
    followers: undefined,
    img: dbInstructor.profile_image_url || undefined,
    mainGenre: genre || undefined,
  };
}

const INITIAL_LOAD_COUNT = 10;

// 스켈레톤 카드 컴포넌트
const InstructorCardSkeleton = () => (
  <div className="bg-white dark:bg-neutral-900 rounded-2xl overflow-hidden border border-neutral-200 dark:border-neutral-800 animate-pulse">
    <div className="flex gap-3 p-3">
      <div className="w-24 h-24 rounded-xl bg-neutral-200 dark:bg-neutral-800 flex-shrink-0" />
      <div className="flex-1 min-w-0 py-1">
        <div className="h-4 bg-neutral-200 dark:bg-neutral-800 rounded w-24 mb-2" />
        <div className="h-3 bg-neutral-200 dark:bg-neutral-800 rounded w-16 mb-3" />
        <div className="flex gap-2">
          <div className="h-5 bg-neutral-200 dark:bg-neutral-800 rounded w-14" />
          <div className="h-5 bg-neutral-200 dark:bg-neutral-800 rounded w-20" />
        </div>
        <div className="h-4 bg-neutral-200 dark:bg-neutral-800 rounded w-20 mt-2" />
      </div>
    </div>
  </div>
);

export const DancerListView = ({ onDancerClick }: DancerListViewProps) => {
  const [dancers, setDancers] = useState<InstructorWithDetails[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [enriching, setEnriching] = useState(false);
  const [dancerFilter, setDancerFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [favoritedInstructors, setFavoritedInstructors] = useState<Set<string>>(new Set());
  const { user } = useAuth();
  const enrichedRef = useRef(false);

  // Phase 1: 기본 강사 정보만 빠르게 로드 (처음 10명 우선)
  useEffect(() => {
    let isMounted = true;

    async function loadInstructorsPhase1() {
      try {
        const supabase = getSupabaseClient();
        if (!supabase) {
          setInitialLoading(false);
          return;
        }

        // 처음 10명만 빠르게 로드
        const { data: initialData, error } = await supabase
          .from('instructors')
          .select(`id, name_kr, name_en, bio, instagram_url, specialties, profile_image_url`)
          .order('created_at', { ascending: false })
          .limit(INITIAL_LOAD_COUNT);

        if (error) throw error;
        if (!isMounted) return;

        const transformed = (initialData || []).map(transformInstructorBasic);
        setDancers(transformed);
        setInitialLoading(false);

        // 나머지 강사를 백그라운드에서 로드
        const { data: allData, error: allError } = await supabase
          .from('instructors')
          .select(`id, name_kr, name_en, bio, instagram_url, specialties, profile_image_url`)
          .order('created_at', { ascending: false })
          .limit(100);

        if (allError) throw allError;
        if (!isMounted) return;

        const allTransformed = (allData || []).map(transformInstructorBasic);
        setDancers(allTransformed);
      } catch (error) {
        console.error('Error loading instructors:', error);
        if (isMounted) {
          setDancers([]);
          setInitialLoading(false);
        }
      }
    }
    
    loadInstructorsPhase1();
    return () => { isMounted = false; };
  }, []);

  // Phase 2: 가격, 수업 개수 등 보조 정보를 백그라운드로 로드
  useEffect(() => {
    if (dancers.length === 0 || initialLoading || enrichedRef.current) return;

    let isMounted = true;
    enrichedRef.current = true;

    async function enrichInstructors() {
      setEnriching(true);
      try {
        const supabase = getSupabaseClient();
        if (!supabase) return;

        const instructorIds = dancers.map(d => d.id);

        // 클래스 정보와 스케줄 정보를 병렬로 가져오기
        const [classesResult, schedulesResult] = await Promise.all([
          supabase
            .from('classes')
            .select('id, instructor_id, academy_id')
            .in('instructor_id', instructorIds)
            .limit(500),
          supabase
            .from('schedules')
            .select('class_id, start_time, is_canceled')
            .gte('start_time', new Date().toISOString())
            .eq('is_canceled', false)
            .limit(1000)
        ]);

        if (!isMounted) return;

        // 클래스 ID로 강사 매핑
        const classToInstructorMap = new Map<string, string>();
        (classesResult.data || []).forEach((cls: any) => {
          if (cls.instructor_id && cls.id) {
            classToInstructorMap.set(cls.id, cls.instructor_id);
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
          const { data: ticketsData } = await supabase
            .from('tickets')
            .select('academy_id, price')
            .in('academy_id', allAcademyIds)
            .eq('is_on_sale', true)
            .or('is_public.eq.true,is_public.is.null')
            .not('price', 'is', null)
            .gt('price', 0)
            .limit(500);
          
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

        // 강사별 진행 예정 수업 개수 계산
        const upcomingCountMap = new Map<string, number>();
        (schedulesResult.data || []).forEach((schedule: any) => {
          const instructorId = classToInstructorMap.get(schedule.class_id);
          if (instructorId) {
            upcomingCountMap.set(instructorId, (upcomingCountMap.get(instructorId) || 0) + 1);
          }
        });

        // 기존 데이터에 보조 정보 병합
        if (isMounted) {
          setDancers(prev => prev.map(dancer => {
            const minPrice = priceMap.get(dancer.id);
            const upcomingClassesCount = upcomingCountMap.get(dancer.id) || 0;
            const discount = minPrice && minPrice < 70000 ? {
              originalPrice: minPrice + Math.floor(minPrice * 0.1),
              discountPercent: 10,
              finalPrice: minPrice
            } : undefined;

            return {
              ...dancer,
              price: minPrice,
              upcomingClassesCount,
              discount,
            };
          }));
        }
      } catch (error) {
        console.error('Error enriching instructors:', error);
      } finally {
        if (isMounted) setEnriching(false);
      }
    }

    enrichInstructors();
    return () => { isMounted = false; };
  }, [dancers.length, initialLoading]);

  // 찜한 강사 목록 로드 (독립적으로 실행)
  useEffect(() => {
    const loadFavoritedInstructors = async () => {
      if (!user) {
        setFavoritedInstructors(new Set());
        return;
      }

      try {
        const response = await fetchWithAuth('/api/favorites?type=instructor');
        if (response.ok) {
          const data = await response.json();
          const favoriteIds = new Set<string>((data.data || []).map((item: any) => item.instructors?.id).filter((id: any): id is string => Boolean(id)));
          setFavoritedInstructors(favoriteIds);
        }
      } catch (error) {
        console.error('Error loading favorited instructors:', error);
      }
    };

    loadFavoritedInstructors();
  }, [user]);

  // 찜 토글 함수
  const handleToggleFavorite = async (e: React.MouseEvent, instructorId: string) => {
    e.stopPropagation();
    if (!user) return;

    try {
      const response = await fetchWithAuth('/api/favorites', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ type: 'instructor', id: instructorId }),
      });

      if (response.ok) {
        const result = await response.json();
        if (result.isFavorited) {
          setFavoritedInstructors(prev => new Set([...prev, instructorId]));
        } else {
          setFavoritedInstructors(prev => {
            const newSet = new Set(prev);
            newSet.delete(instructorId);
            return newSet;
          });
        }
      }
    } catch (error) {
      console.error('Error toggling favorite:', error);
    }
  };

  const filteredDancers = dancers.filter(d => {
    if (dancerFilter !== 'ALL' && d.genre?.toUpperCase() !== dancerFilter) {
      return false;
    }
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const nameKr = (d.name_kr || '').toLowerCase();
      const nameEn = (d.name_en || '').toLowerCase();
      const name = (d.name || '').toLowerCase();
      
      if (!nameKr.includes(query) && !nameEn.includes(query) && !name.includes(query)) {
        return false;
      }
    }
    return true;
  });

  // 사용 가능한 장르 목록 추출
  const availableGenres = ['ALL', ...Array.from(new Set(dancers.map(d => d.genre?.toUpperCase()).filter((g): g is string => !!g)))];

  return (
    <div className="h-full flex flex-col pb-24 animate-in slide-in-from-right-10 duration-300">
      <div className="px-5 pt-12 pb-4 bg-white dark:bg-neutral-950 sticky top-0 z-20 border-b border-neutral-200 dark:border-neutral-800">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-black dark:text-white">강사</h2>
          <div className="flex gap-2 items-center">
            <LanguageToggle />
            <ThemeToggle />
            <button className="text-xs bg-neutral-100 dark:bg-neutral-800 text-black dark:text-white px-3 py-1.5 rounded-full border border-neutral-200 dark:border-neutral-700 flex items-center gap-1">
              <Filter size={12} />
              필터
            </button>
            <button className="text-xs bg-neutral-100 dark:bg-neutral-800 text-black dark:text-white px-3 py-1.5 rounded-full border border-neutral-200 dark:border-neutral-700 flex items-center gap-1">
              <Tag size={12} />
              수강권
            </button>
          </div>
        </div>
        
        {/* 검색바 */}
        <div className="relative mb-4">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="강사명 검색"
            className="w-full bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-full py-2 pl-3 pr-3 text-sm text-black dark:text-white focus:border-primary dark:focus:border-[#CCFF00] outline-none"
          />
        </div>

        {/* 장르 필터 */}
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2">
          {availableGenres.map((g) => (
            <button 
              key={g} 
              onClick={() => setDancerFilter(g)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${
                dancerFilter === g 
                  ? 'bg-black dark:bg-white text-white dark:text-black' 
                  : 'bg-neutral-100 dark:bg-neutral-900 text-neutral-600 dark:text-neutral-500 border border-neutral-200 dark:border-neutral-800'
              }`}
            >
              {g}
            </button>
          ))}
        </div>
      </div>

      {/* 목록 */}
      <div className="px-4 space-y-3 overflow-y-auto pb-24">
        {initialLoading ? (
          // 스켈레톤 UI
          <>
            {Array.from({ length: 6 }).map((_, i) => (
              <InstructorCardSkeleton key={i} />
            ))}
          </>
        ) : filteredDancers.length === 0 ? (
          <div className="text-center py-12 text-neutral-500">등록된 강사가 없습니다.</div>
        ) : (
          filteredDancers.map(dancer => (
            <div
              key={dancer.id}
              onClick={() => onDancerClick(dancer)}
              className="bg-white dark:bg-neutral-900 rounded-2xl overflow-hidden border border-neutral-200 dark:border-neutral-800 active:scale-[0.98] transition-transform"
            >
              <div className="flex gap-3 p-3 relative">
                {/* 이미지 */}
                <div className="relative w-24 h-24 rounded-xl overflow-hidden flex-shrink-0">
                  {dancer.img ? (
                    <Image
                      src={dancer.img}
                      alt={dancer.name}
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-neutral-200 dark:bg-neutral-800 flex items-center justify-center">
                      <span className="text-lg font-bold text-neutral-400 dark:text-neutral-600">
                        {dancer.name}
                      </span>
                    </div>
                  )}
                </div>

                {/* 정보 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between mb-1">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-base font-bold text-black dark:text-white truncate">{dancer.name}</h3>
                    </div>
                    {/* 찜 버튼 */}
                    {user && (
                      <button 
                        onClick={(e) => handleToggleFavorite(e, dancer.id)}
                        className="flex-shrink-0 w-8 h-8 bg-neutral-100 dark:bg-neutral-800 rounded-full flex items-center justify-center border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
                      >
                        <Heart 
                          size={14} 
                          fill={favoritedInstructors.has(dancer.id) ? 'currentColor' : 'none'}
                          className={favoritedInstructors.has(dancer.id) ? 'text-red-500' : 'text-neutral-600 dark:text-neutral-400'}
                        />
                      </button>
                    )}
                  </div>

                  {/* 메인 장르와 진행 예정 수업 개수 */}
                  <div className="flex items-center gap-2 mb-2">
                    {dancer.mainGenre && (
                      <span className="text-xs font-medium text-neutral-700 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 rounded">
                        {dancer.mainGenre}
                      </span>
                    )}
                    {dancer.upcomingClassesCount !== undefined && dancer.upcomingClassesCount > 0 && (
                      <span className="text-xs text-neutral-600 dark:text-neutral-400">
                        진행 예정 {dancer.upcomingClassesCount}개
                      </span>
                    )}
                    {enriching && dancer.upcomingClassesCount === undefined && (
                      <span className="text-xs text-neutral-400 dark:text-neutral-600 animate-pulse">
                        정보 로딩 중...
                      </span>
                    )}
                  </div>

                  {/* 가격 */}
                  <div className="flex items-center gap-2">
                    {dancer.discount ? (
                      <>
                        <span className="text-xs text-neutral-400 line-through">
                          {dancer.discount.originalPrice.toLocaleString()}원
                        </span>
                        <span className="text-xs font-bold text-red-500">
                          {dancer.discount.discountPercent}% {dancer.discount.finalPrice.toLocaleString()}원
                        </span>
                      </>
                    ) : dancer.price ? (
                      <span className="text-sm font-bold text-black dark:text-white">
                        {dancer.price.toLocaleString()}원~
                      </span>
                    ) : enriching ? (
                      <div className="h-4 bg-neutral-100 dark:bg-neutral-800 rounded w-16 animate-pulse" />
                    ) : null}
                    {(dancer.price || dancer.discount) && (
                      <span className="text-xs text-neutral-500">/회</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
