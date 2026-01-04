"use client";

import Image from 'next/image';
import { Star, MapPin, Search, X, Heart } from 'lucide-react';
import { useEffect, useState, useMemo } from 'react';
import { getSupabaseClient } from '@/lib/utils/supabase-client';
import { Academy, ViewState } from '@/types';
import { ThemeToggle } from '@/components/common/theme-toggle';
import { AcademyFilterModal, AcademyFilter } from '@/components/modals/academy-filter-modal';
import { calculateDistance, parseAddressToCoordinates, formatDistance } from '@/lib/utils/distance';
import { useAuth } from '@/contexts/AuthContext';

interface AcademyListViewProps {
  onAcademyClick: (academy: Academy) => void;
}

type SortOption = 'default' | 'distance' | 'price_asc' | 'price_desc';

// DB 데이터를 UI 타입으로 변환
function transformAcademy(dbAcademy: any): Academy {
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
  };
}

export const AcademyListView = ({ onAcademyClick }: AcademyListViewProps) => {
  const [academies, setAcademies] = useState<Academy[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOption, setSortOption] = useState<SortOption>('default');
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [filter, setFilter] = useState<AcademyFilter>({
    tags: [],
    priceRange: { min: null, max: null },
  });
  const [userLocation, setUserLocation] = useState<{ lat: number; lon: number } | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [favoritedAcademies, setFavoritedAcademies] = useState<Set<string>>(new Set());
  const { user } = useAuth();

  // 사용자 위치 가져오기
  useEffect(() => {
    if (sortOption === 'distance' && !userLocation) {
      setLocationLoading(true);
      let isMounted = true;
      
      if (navigator.geolocation) {
        const timeoutId = setTimeout(() => {
          if (isMounted) {
            // 타임아웃 시 서울 중심 좌표 사용
            setUserLocation({ lat: 37.5665, lon: 126.9780 });
            setLocationLoading(false);
          }
        }, 5000); // 5초 타임아웃
        
        navigator.geolocation.getCurrentPosition(
          (position) => {
            clearTimeout(timeoutId);
            if (isMounted) {
              setUserLocation({
                lat: position.coords.latitude,
                lon: position.coords.longitude,
              });
              setLocationLoading(false);
            }
          },
          (error) => {
            clearTimeout(timeoutId);
            if (isMounted) {
              console.error('Error getting location:', error);
              // 위치를 가져올 수 없으면 서울 중심 좌표 사용
              setUserLocation({ lat: 37.5665, lon: 126.9780 });
              setLocationLoading(false);
            }
          },
          {
            timeout: 5000,
            maximumAge: 60000, // 1분간 캐시 사용
            enableHighAccuracy: false, // 배터리 절약
          }
        );
      } else {
        // Geolocation을 지원하지 않으면 서울 중심 좌표 사용
        setUserLocation({ lat: 37.5665, lon: 126.9780 });
        setLocationLoading(false);
      }
      
      return () => {
        isMounted = false;
      };
    }
  }, [sortOption, userLocation]);

  useEffect(() => {
    let isMounted = true;
    
    async function loadAcademies() {
      try {
        const supabase = getSupabaseClient();
        if (!supabase) {
          if (isMounted) setLoading(false);
          return;
        }

        // 필요한 필드만 선택하여 성능 최적화 (중첩 쿼리 제거)
        const { data, error } = await supabase
          .from('academies')
          .select(`
            id,
            name_kr,
            name_en,
            tags,
            logo_url,
            address,
            images,
            created_at
          `)
          .eq('is_active', true)
          .order('created_at', { ascending: false })
          .limit(200); // 최대 200개만

        if (error) throw error;
        
        if (!isMounted) return;
        
        // 가격 정보를 별도로 병렬 로드
        const academyIds = (data || []).map((a: any) => a.id);
        let priceMap = new Map<string, number>();
        
        if (academyIds.length > 0) {
          const { data: classesData } = await supabase
            .from('classes')
            .select('academy_id, price')
            .in('academy_id', academyIds)
            .not('price', 'is', null)
            .gt('price', 0)
            .limit(500); // 최대 500개만
          
          if (!isMounted) return;
          
          (classesData || []).forEach((cls: any) => {
            if (cls.academy_id && cls.price) {
              const current = priceMap.get(cls.academy_id);
              if (!current || cls.price < current) {
                priceMap.set(cls.academy_id, cls.price);
              }
            }
          });
        }
        
        // 각 학원을 변환 (가격 정보 포함)
        const transformed = (data || []).map((dbAcademy: any) => {
          const academy = transformAcademy({ ...dbAcademy, classes: [] });
          const minPrice = priceMap.get(dbAcademy.id);
          if (minPrice) {
            academy.price = minPrice;
          }
          return academy;
        });
        
        if (isMounted) {
          setAcademies(transformed);
        }
      } catch (error) {
        console.error('Error loading academies:', error);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    
    loadAcademies();
    
    return () => {
      isMounted = false;
    };
  }, []);

  // 찜한 학원 목록 로드
  useEffect(() => {
    const loadFavoritedAcademies = async () => {
      if (!user) {
        setFavoritedAcademies(new Set());
        return;
      }

      try {
        const response = await fetch('/api/favorites?type=academy');
        if (response.ok) {
          const data = await response.json();
          const favoriteIds = new Set((data.data || []).map((item: any) => item.academies?.id).filter(Boolean));
          setFavoritedAcademies(favoriteIds);
        }
      } catch (error) {
        console.error('Error loading favorited academies:', error);
      }
    };

    loadFavoritedAcademies();
  }, [user]);

  // 찜 토글 함수
  const handleToggleFavorite = async (e: React.MouseEvent, academyId: string) => {
    e.stopPropagation();
    if (!user) return;

    try {
      const response = await fetch('/api/favorites', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ type: 'academy', id: academyId }),
      });

      if (response.ok) {
        const result = await response.json();
        if (result.isFavorited) {
          setFavoritedAcademies(prev => new Set([...prev, academyId]));
        } else {
          setFavoritedAcademies(prev => {
            const newSet = new Set(prev);
            newSet.delete(academyId);
            return newSet;
          });
        }
      }
    } catch (error) {
      console.error('Error toggling favorite:', error);
    }
  };

  // 사용 가능한 태그 추출
  const availableTags = useMemo(() => {
    const tagSet = new Set<string>();
    academies.forEach(academy => {
      if (academy.tags) {
        academy.tags.split(',').forEach(tag => {
          const trimmed = tag.trim();
          if (trimmed) tagSet.add(trimmed);
        });
      }
    });
    return Array.from(tagSet).sort();
  }, [academies]);

  // 필터링 및 정렬된 학원 목록
  const filteredAndSortedAcademies = useMemo(() => {
    let filtered = [...academies];

    // 검색 필터
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(academy => {
        const nameMatch = academy.name.toLowerCase().includes(query);
        const tagMatch = academy.tags?.toLowerCase().includes(query);
        const addressMatch = academy.address?.toLowerCase().includes(query);
        return nameMatch || tagMatch || addressMatch;
      });
    }

    // 태그 필터
    if (filter.tags.length > 0) {
      filtered = filtered.filter(academy => {
        if (!academy.tags) return false;
        const academyTags = academy.tags.split(',').map(t => t.trim().toLowerCase());
        return filter.tags.some(filterTag => 
          academyTags.includes(filterTag.toLowerCase())
        );
      });
    }

    // 가격대 필터
    if (filter.priceRange.min !== null || filter.priceRange.max !== null) {
      filtered = filtered.filter(academy => {
        if (!academy.price) return false;
        const price = academy.price;
        const minOk = filter.priceRange.min === null || price >= filter.priceRange.min;
        const maxOk = filter.priceRange.max === null || price <= filter.priceRange.max;
        return minOk && maxOk;
      });
    }

    // 거리 계산 및 정렬
    if (sortOption === 'distance' && userLocation) {
      filtered = filtered.map(academy => {
        const coords = parseAddressToCoordinates(academy.address);
        if (coords) {
          const distance = calculateDistance(
            userLocation.lat,
            userLocation.lon,
            coords[0],
            coords[1]
          );
          return {
            ...academy,
            dist: formatDistance(distance),
            distanceKm: distance, // 정렬용
          };
        }
        return {
          ...academy,
          distanceKm: Infinity, // 좌표를 알 수 없으면 맨 뒤로
        };
      }).sort((a, b) => {
        const distA = (a as any).distanceKm || Infinity;
        const distB = (b as any).distanceKm || Infinity;
        return distA - distB;
      });
    } else if (sortOption === 'price_asc') {
      filtered.sort((a, b) => {
        const priceA = a.price || Infinity;
        const priceB = b.price || Infinity;
        return priceA - priceB;
      });
    } else if (sortOption === 'price_desc') {
      filtered.sort((a, b) => {
        const priceA = a.price || 0;
        const priceB = b.price || 0;
        return priceB - priceA;
      });
    }

    return filtered;
  }, [academies, searchQuery, filter, sortOption, userLocation]);

  const handleSortToggle = () => {
    const options: SortOption[] = ['default', 'distance', 'price_asc', 'price_desc'];
    const currentIndex = options.indexOf(sortOption);
    const nextIndex = (currentIndex + 1) % options.length;
    setSortOption(options[nextIndex]);
  };

  const getSortLabel = () => {
    switch (sortOption) {
      case 'distance':
        return '거리순';
      case 'price_asc':
        return '가격 낮은순';
      case 'price_desc':
        return '가격 높은순';
      default:
        return '기본순';
    }
  };

  const activeFilterCount = filter.tags.length + (filter.priceRange.min !== null || filter.priceRange.max !== null ? 1 : 0);

  if (loading) {
    return (
      <div className="pb-24 pt-14 px-5 animate-in slide-in-from-right-10 duration-300">
        <div className="text-center py-12 text-neutral-500">로딩 중...</div>
      </div>
    );
  }

  return (
    <div className="pb-24 pt-14 px-5 animate-in slide-in-from-right-10 duration-300">
      {/* 검색 바 */}
      <div className="mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={18} />
          <input
            type="text"
            placeholder="학원명, 태그, 주소로 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-10 py-3 bg-neutral-100 dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 text-black dark:text-white placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary dark:focus:ring-[#CCFF00]"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-black dark:hover:text-white"
            >
              <X size={18} />
            </button>
          )}
        </div>
      </div>

      {/* 헤더 및 정렬/필터 버튼 */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-black dark:text-white">댄스학원</h2>
        <div className="flex gap-2 items-center">
          <ThemeToggle />
          <button
            onClick={handleSortToggle}
            className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
              sortOption !== 'default'
                ? 'bg-primary dark:bg-[#CCFF00] text-black border-primary dark:border-[#CCFF00]'
                : 'bg-neutral-100 dark:bg-neutral-800 text-black dark:text-white border-neutral-200 dark:border-neutral-700'
            }`}
            disabled={locationLoading && sortOption === 'distance'}
          >
            {locationLoading && sortOption === 'distance' ? '위치 확인 중...' : getSortLabel()}
          </button>
          <button
            onClick={() => setIsFilterModalOpen(true)}
            className={`text-xs px-3 py-1.5 rounded-full border relative transition-all ${
              activeFilterCount > 0
                ? 'bg-primary dark:bg-[#CCFF00] text-black border-primary dark:border-[#CCFF00]'
                : 'bg-neutral-100 dark:bg-neutral-800 text-black dark:text-white border-neutral-200 dark:border-neutral-700'
            }`}
          >
            필터
            {activeFilterCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* 검색 결과 카운트 */}
      {searchQuery && (
        <div className="mb-4 text-sm text-neutral-600 dark:text-neutral-400">
          {filteredAndSortedAcademies.length}개의 학원을 찾았습니다
        </div>
      )}

      {/* 학원 목록 */}
      <div className="space-y-4">
        {filteredAndSortedAcademies.length === 0 ? (
          <div className="text-center py-12 text-neutral-500">
            {searchQuery || activeFilterCount > 0
              ? '검색 결과가 없습니다.'
              : '등록된 학원이 없습니다.'}
          </div>
        ) : (
          filteredAndSortedAcademies.map(academy => {
            // 할인 정보 계산 (예시)
            const hasDiscount = academy.price && academy.price < 100000;
            const discount = hasDiscount ? {
              originalPrice: academy.price! + Math.floor(academy.price! * 0.15),
              discountPercent: 15,
              finalPrice: academy.price!
            } : null;

            return (
              <div 
                key={academy.id} 
                onClick={() => onAcademyClick(academy)} 
                className="bg-white dark:bg-neutral-900 rounded-2xl overflow-hidden border border-neutral-200 dark:border-neutral-800 active:scale-[0.98] transition-transform shadow-sm"
              >
                <div className="h-40 relative overflow-hidden bg-neutral-100 dark:bg-neutral-800">
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
                  {academy.tags && (
                    <div className="absolute top-3 left-3 bg-black/70 backdrop-blur px-2 py-1 rounded-full text-[10px] text-white font-bold">
                      {academy.tags.split(',')[0]?.trim() || ''}
                    </div>
                  )}
                  {/* 찜 버튼 */}
                  {user && (
                    <button
                      onClick={(e) => handleToggleFavorite(e, (academy as any).academyId || academy.id)}
                      className="absolute top-3 right-3 p-2 bg-black/30 backdrop-blur rounded-full text-white hover:bg-black/50 transition-colors"
                    >
                      <Heart 
                        size={18} 
                        fill={favoritedAcademies.has((academy as any).academyId || academy.id) ? 'currentColor' : 'none'}
                        className={favoritedAcademies.has((academy as any).academyId || academy.id) ? 'text-red-500' : ''}
                      />
                    </button>
                  )}
                  {/* 할인 배지 */}
                  {hasDiscount && (
                    <div className={`absolute ${user ? 'top-12' : 'top-3'} right-3 bg-neutral-900 dark:bg-neutral-800 text-white text-[10px] font-bold px-2 py-1 rounded-full`}>
                      특가
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-bold text-black dark:text-white truncate">{academy.name}</h3>
                      {academy.address && (
                        <div className="flex items-center gap-1 text-xs text-neutral-600 dark:text-neutral-400 mt-1">
                          <MapPin size={10} />
                          <span className="truncate">{academy.address}</span>
                          {academy.dist && <span>• {academy.dist}</span>}
                        </div>
                      )}
                    </div>
                    {academy.rating && (
                      <div className="flex items-center gap-1 text-neutral-800 dark:text-[#CCFF00] text-xs font-bold flex-shrink-0 ml-2">
                        <Star size={12} fill="currentColor" /> {academy.rating}
                      </div>
                    )}
                  </div>
                  
                  {/* 가격 정보 */}
                  <div className="flex items-center justify-between mt-3">
                    <div className="flex gap-2 flex-wrap">
                      {academy.badges?.map(b => (
                        <span 
                          key={b} 
                          className="text-[9px] text-neutral-600 dark:text-neutral-400 bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 rounded-full"
                        >
                          {b}
                        </span>
                      ))}
                    </div>
                    {discount ? (
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-xs text-neutral-400 line-through">
                          {discount.originalPrice.toLocaleString()}원
                        </span>
                        <span className="text-sm font-bold text-red-500">
                          {discount.discountPercent}% {discount.finalPrice.toLocaleString()}원
                        </span>
                      </div>
                    ) : academy.price ? (
                      <span className="text-sm font-bold text-neutral-800 dark:text-[#CCFF00]">
                        {academy.price.toLocaleString()}원~
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 필터 모달 */}
      <AcademyFilterModal
        isOpen={isFilterModalOpen}
        onClose={() => setIsFilterModalOpen(false)}
        onApply={(newFilter) => {
          setFilter(newFilter);
        }}
        currentFilter={filter}
        availableTags={availableTags}
      />
    </div>
  );
};

