"use client";

import Image from 'next/image';
import { Play, User, MapPin, Star, Heart, Filter, Tag, Clock, Users } from 'lucide-react';
import { useState, useEffect } from 'react';
import { getSupabaseClient } from '@/lib/utils/supabase-client';
import { Dancer } from '@/types';
import { ThemeToggle } from '@/components/common/theme-toggle';

interface DancerListViewProps {
  onDancerClick: (dancer: Dancer) => void;
}

interface InstructorWithDetails extends Dancer {
  price?: number;
  location?: string;
  rating?: number;
  discount?: { originalPrice: number; discountPercent: number; finalPrice: number };
}

// DB 데이터를 UI 타입으로 변환
function transformInstructor(dbInstructor: any, classes: any[]): InstructorWithDetails {
  const name = dbInstructor.name_kr || dbInstructor.name_en || '이름 없음';
  const specialties = dbInstructor.specialties || '';
  const genre = specialties.split(',')[0]?.trim() || 'ALL';
  const crew = specialties.split(',')[1]?.trim() || '';

  // 가격 정보 추출
  const prices = classes.filter(c => c.price && c.price > 0).map(c => c.price);
  const minPrice = prices.length > 0 ? Math.min(...prices) : undefined;

  // 할인 정보 (예시 - 실제로는 DB에서 가져와야 함)
  const discount = minPrice && minPrice < 70000 ? {
    originalPrice: minPrice + Math.floor(minPrice * 0.1),
    discountPercent: 10,
    finalPrice: minPrice
  } : undefined;

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
    price: minPrice,
    location: '서울 마포구 합정동', // 실제로는 스케줄에서 가져와야 함
    rating: 5.0, // 실제로는 리뷰에서 계산해야 함
    discount,
  };
}

export const DancerListView = ({ onDancerClick }: DancerListViewProps) => {
  const [dancers, setDancers] = useState<InstructorWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [dancerFilter, setDancerFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    async function loadInstructors() {
      try {
        const supabase = getSupabaseClient();
        if (!supabase) {
          setLoading(false);
          return;
        }

        // instructors 테이블에서 직접 데이터를 가져옴
        const { data: instructorsData, error: instructorsError } = await supabase
          .from('instructors')
          .select(`
            *,
            classes (
              id,
              price,
              academy_id,
              academies (
                id,
                address
              )
            )
          `)
          .order('created_at', { ascending: false });

        if (instructorsError) {
          console.error('Error loading instructors:', instructorsError);
          throw instructorsError;
        }

        // 데이터 변환
        const transformed = (instructorsData || []).map((instructor: any) => {
          const classes = instructor.classes || [];
          
          // 가격 정보 추출
          const prices = classes
            .filter((c: any) => c.price && c.price > 0)
            .map((c: any) => c.price);
          const minPrice = prices.length > 0 ? Math.min(...prices) : undefined;

          // 위치 정보 추출 (academies에서 첫 번째 주소 사용)
          const addresses = classes
            .map((c: any) => c.academies?.address)
            .filter((addr: any) => addr);
          const location = addresses[0] || '서울 마포구 합정동';

          const instructorData = transformInstructor(instructor, classes);
          instructorData.location = location;
          return instructorData;
        });

        setDancers(transformed);
      } catch (error) {
        console.error('Error loading instructors:', error);
        setDancers([]);
      } finally {
        setLoading(false);
      }
    }
    loadInstructors();
  }, []);

  const filteredDancers = dancers.filter(d => {
    if (dancerFilter !== 'ALL' && d.genre?.toUpperCase() !== dancerFilter) {
      return false;
    }
    if (searchQuery.trim() && !d.name.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    return true;
  });

  // 사용 가능한 장르 목록 추출
  const availableGenres = ['ALL', ...Array.from(new Set(dancers.map(d => d.genre?.toUpperCase()).filter((g): g is string => !!g)))];

  if (loading) {
    return (
      <div className="h-full flex flex-col pb-24 animate-in slide-in-from-right-10 duration-300">
        <div className="text-center py-12 text-neutral-500">로딩 중...</div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col pb-24 animate-in slide-in-from-right-10 duration-300">
      <div className="px-5 pt-12 pb-4 bg-white dark:bg-neutral-950 sticky top-0 z-20 border-b border-neutral-200 dark:border-neutral-800">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-black dark:text-white">트레이너</h2>
          <div className="flex gap-2 items-center">
            <ThemeToggle />
            <button className="text-xs bg-neutral-100 dark:bg-neutral-800 text-black dark:text-white px-3 py-1.5 rounded-full border border-neutral-200 dark:border-neutral-700 flex items-center gap-1">
              <Filter size={12} />
              필터
            </button>
            <button className="text-xs bg-neutral-100 dark:bg-neutral-800 text-black dark:text-white px-3 py-1.5 rounded-full border border-neutral-200 dark:border-neutral-700 flex items-center gap-1">
              <Tag size={12} />
              지업권
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

      {/* 목록 형태로 표시 */}
      <div className="px-4 space-y-3 overflow-y-auto pb-24">
        {filteredDancers.length === 0 ? (
          <div className="text-center py-12 text-neutral-500">등록된 강사가 없습니다.</div>
        ) : (
          filteredDancers.map(dancer => (
            <div
              key={dancer.id}
              onClick={() => onDancerClick(dancer)}
              className="bg-white dark:bg-neutral-900 rounded-2xl overflow-hidden border border-neutral-200 dark:border-neutral-800 active:scale-[0.98] transition-transform"
            >
              <div className="flex gap-3 p-3">
                {/* 이미지 */}
                <div className="relative w-24 h-24 rounded-xl overflow-hidden flex-shrink-0">
                  <Image
                    src={dancer.img || `https://picsum.photos/seed/dancer${dancer.id}/200/200`}
                    alt={dancer.name}
                    fill
                    className="object-cover"
                  />
                  {/* 소득공제 태그 */}
                  <div className="absolute top-1 left-1 bg-neutral-900 dark:bg-neutral-800 text-white text-[8px] font-bold px-1.5 py-0.5 rounded">
                    소득공제
                  </div>
                  {/* 찜 버튼 */}
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      // 찜 기능 구현
                    }}
                    className="absolute top-1 right-1 w-6 h-6 bg-black/30 backdrop-blur rounded-full flex items-center justify-center"
                  >
                    <Heart size={12} className="text-white" />
                  </button>
                </div>

                {/* 정보 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between mb-1">
                    <div>
                      <h3 className="text-base font-bold text-black dark:text-white truncate">{dancer.name}</h3>
                      {dancer.rating && (
                        <div className="flex items-center gap-1 text-xs text-neutral-600 dark:text-neutral-400">
                          <Star size={10} fill="currentColor" className="text-yellow-500" />
                          {dancer.rating} (1)
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 위치 */}
                  {dancer.location && (
                    <div className="flex items-center gap-1 text-xs text-neutral-600 dark:text-neutral-400 mb-2">
                      <MapPin size={10} />
                      <span className="truncate">{dancer.location}</span>
                    </div>
                  )}

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
                    ) : null}
                    <span className="text-xs text-neutral-500">,회</span>
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

