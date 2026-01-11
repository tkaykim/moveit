"use client";

import Image from 'next/image';
import { Star, MapPin, Search, X, Heart, SlidersHorizontal, ChevronDown } from 'lucide-react';
import { useEffect, useState, useMemo } from 'react';
import { getSupabaseClient } from '@/lib/utils/supabase-client';
import { Academy } from '@/types';
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
  const [isSortDropdownOpen, setIsSortDropdownOpen] = useState(false);
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
            setUserLocation({ lat: 37.5665, lon: 126.9780 });
            setLocationLoading(false);
          }
        }, 5000);
        
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
          () => {
            clearTimeout(timeoutId);
            if (isMounted) {
              setUserLocation({ lat: 37.5665, lon: 126.9780 });
              setLocationLoading(false);
            }
          },
          { timeout: 5000, maximumAge: 60000, enableHighAccuracy: false }
        );
      } else {
        setUserLocation({ lat: 37.5665, lon: 126.9780 });
        setLocationLoading(false);
      }
      
      return () => { isMounted = false; };
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

        const { data, error } = await supabase
          .from('academies')
          .select(`id, name_kr, name_en, tags, logo_url, address, images, created_at`)
          .eq('is_active', true)
          .order('created_at', { ascending: false })
          .limit(200);

        if (error) throw error;
        if (!isMounted) return;
        
        const academyIds = (data || []).map((a: any) => a.id);
        let priceMap = new Map<string, number>();
        
        if (academyIds.length > 0) {
          const { data: classesData } = await supabase
            .from('classes')
            .select('academy_id, price')
            .in('academy_id', academyIds)
            .not('price', 'is', null)
            .gt('price', 0)
            .limit(500);
          
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
    return () => { isMounted = false; };
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
          const favoriteIds = new Set<string>((data.data || []).map((item: any) => item.academies?.id).filter((id: any): id is string => Boolean(id)));
          setFavoritedAcademies(favoriteIds);
        }
      } catch (error) {
        console.error('Error loading favorited academies:', error);
      }
    };

    loadFavoritedAcademies();
  }, [user]);

  const handleToggleFavorite = async (e: React.MouseEvent, academyId: string) => {
    e.stopPropagation();
    if (!user) return;

    try {
      const response = await fetch('/api/favorites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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

  const filteredAndSortedAcademies = useMemo(() => {
    let filtered = [...academies];

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(academy => {
        const nameMatch = academy.name.toLowerCase().includes(query);
        const tagMatch = academy.tags?.toLowerCase().includes(query);
        const addressMatch = academy.address?.toLowerCase().includes(query);
        return nameMatch || tagMatch || addressMatch;
      });
    }

    if (filter.tags.length > 0) {
      filtered = filtered.filter(academy => {
        if (!academy.tags) return false;
        const academyTags = academy.tags.split(',').map(t => t.trim().toLowerCase());
        return filter.tags.some(filterTag => 
          academyTags.includes(filterTag.toLowerCase())
        );
      });
    }

    if (filter.priceRange.min !== null || filter.priceRange.max !== null) {
      filtered = filtered.filter(academy => {
        if (!academy.price) return false;
        const price = academy.price;
        const minOk = filter.priceRange.min === null || price >= filter.priceRange.min;
        const maxOk = filter.priceRange.max === null || price <= filter.priceRange.max;
        return minOk && maxOk;
      });
    }

    if (sortOption === 'distance' && userLocation) {
      filtered = filtered.map(academy => {
        const coords = parseAddressToCoordinates(academy.address);
        if (coords) {
          const distance = calculateDistance(userLocation.lat, userLocation.lon, coords[0], coords[1]);
          return { ...academy, dist: formatDistance(distance), distanceKm: distance };
        }
        return { ...academy, distanceKm: Infinity };
      }).sort((a, b) => {
        const distA = (a as any).distanceKm || Infinity;
        const distB = (b as any).distanceKm || Infinity;
        return distA - distB;
      });
    } else if (sortOption === 'price_asc') {
      filtered.sort((a, b) => (a.price || Infinity) - (b.price || Infinity));
    } else if (sortOption === 'price_desc') {
      filtered.sort((a, b) => (b.price || 0) - (a.price || 0));
    }

    return filtered;
  }, [academies, searchQuery, filter, sortOption, userLocation]);

  const getSortLabel = () => {
    switch (sortOption) {
      case 'distance': return '거리순';
      case 'price_asc': return '가격 낮은순';
      case 'price_desc': return '가격 높은순';
      default: return '기본순';
    }
  };

  const activeFilterCount = filter.tags.length + (filter.priceRange.min !== null || filter.priceRange.max !== null ? 1 : 0);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-neutral-300 dark:border-neutral-600 border-t-primary dark:border-t-[#CCFF00] rounded-full" />
      </div>
    );
  }

  return (
    <div className="pb-24 animate-in fade-in duration-300">
      {/* 헤더 */}
      <div className="sticky top-0 z-30 bg-white/80 dark:bg-neutral-950/80 backdrop-blur-md px-5 pt-14 pb-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold text-black dark:text-white">댄스학원</h1>
          <span className="text-sm text-neutral-500">{filteredAndSortedAcademies.length}개</span>
        </div>
        
        {/* 검색 바 */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" size={18} />
          <input
            type="text"
            placeholder="학원명, 장르, 주소 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-11 pr-10 py-3 bg-neutral-100 dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 text-black dark:text-white placeholder-neutral-400 focus:outline-none focus:border-neutral-400 dark:focus:border-[#CCFF00] transition-colors"
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

        {/* 정렬 & 필터 */}
        <div className="flex gap-2 mt-3">
          <div className="relative">
            <button
              onClick={() => setIsSortDropdownOpen(!isSortDropdownOpen)}
              className="flex items-center gap-1 px-3 py-2 bg-neutral-100 dark:bg-neutral-900 rounded-lg text-sm text-black dark:text-white border border-neutral-200 dark:border-neutral-800"
            >
              {locationLoading && sortOption === 'distance' ? '위치 확인 중...' : getSortLabel()}
              <ChevronDown size={14} className={`transition-transform ${isSortDropdownOpen ? 'rotate-180' : ''}`} />
            </button>
            {isSortDropdownOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setIsSortDropdownOpen(false)} />
                <div className="absolute top-full left-0 mt-1 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg shadow-lg z-50 min-w-[120px]">
                  {[
                    { value: 'default', label: '기본순' },
                    { value: 'distance', label: '거리순' },
                    { value: 'price_asc', label: '가격 낮은순' },
                    { value: 'price_desc', label: '가격 높은순' },
                  ].map(option => (
                    <button
                      key={option.value}
                      onClick={() => {
                        setSortOption(option.value as SortOption);
                        setIsSortDropdownOpen(false);
                      }}
                      className={`w-full text-left px-4 py-2 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800 first:rounded-t-lg last:rounded-b-lg ${
                        sortOption === option.value 
                          ? 'text-primary dark:text-[#CCFF00] font-medium' 
                          : 'text-black dark:text-white'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
          <button
            onClick={() => setIsFilterModalOpen(true)}
            className={`flex items-center gap-1 px-3 py-2 rounded-lg text-sm border transition-colors ${
              activeFilterCount > 0
                ? 'bg-primary dark:bg-[#CCFF00] text-black border-primary dark:border-[#CCFF00]'
                : 'bg-neutral-100 dark:bg-neutral-900 text-black dark:text-white border-neutral-200 dark:border-neutral-800'
            }`}
          >
            <SlidersHorizontal size={14} />
            필터
            {activeFilterCount > 0 && (
              <span className="ml-1 px-1.5 py-0.5 bg-white dark:bg-black text-primary dark:text-[#CCFF00] text-[10px] font-bold rounded-full">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* 학원 목록 */}
      <div className="px-5 mt-4 space-y-3">
        {filteredAndSortedAcademies.length === 0 ? (
          <div className="text-center py-16 text-neutral-500">
            <MapPin className="mx-auto mb-3 text-neutral-400" size={40} />
            <p className="text-sm">
              {searchQuery || activeFilterCount > 0 ? '검색 결과가 없습니다.' : '등록된 학원이 없습니다.'}
            </p>
          </div>
        ) : (
          filteredAndSortedAcademies.map(academy => (
            <div 
              key={academy.id} 
              onClick={() => onAcademyClick(academy)} 
              className="flex gap-4 bg-white dark:bg-neutral-900 rounded-2xl p-3 border border-neutral-200 dark:border-neutral-800 active:scale-[0.99] transition-transform cursor-pointer"
            >
              {/* 썸네일 */}
              <div className="w-24 h-24 relative rounded-xl overflow-hidden bg-neutral-100 dark:bg-neutral-800 flex-shrink-0">
                {(academy.img || academy.logo_url) ? (
                  <Image 
                    src={academy.img || academy.logo_url || ''}
                    alt={academy.name}
                    fill
                    sizes="96px"
                    className="object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <MapPin className="text-neutral-400" size={24} />
                  </div>
                )}
                {/* 찜 버튼 */}
                {user && (
                  <button
                    onClick={(e) => handleToggleFavorite(e, (academy as any).academyId || academy.id)}
                    className="absolute top-1.5 right-1.5 p-1.5 bg-black/40 backdrop-blur rounded-full"
                  >
                    <Heart 
                      size={14} 
                      fill={favoritedAcademies.has((academy as any).academyId || academy.id) ? 'currentColor' : 'none'}
                      className={favoritedAcademies.has((academy as any).academyId || academy.id) ? 'text-red-500' : 'text-white'}
                    />
                  </button>
                )}
              </div>
              
              {/* 정보 */}
              <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                <div>
                  <h3 className="font-bold text-black dark:text-white truncate">{academy.name}</h3>
                  {academy.address && (
                    <div className="flex items-center gap-1 text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                      <MapPin size={10} />
                      <span className="truncate">{academy.address}</span>
                      {academy.dist && <span className="flex-shrink-0">• {academy.dist}</span>}
                    </div>
                  )}
                </div>
                
                <div className="flex items-center justify-between mt-2">
                  {/* 태그 */}
                  <div className="flex gap-1 flex-wrap">
                    {academy.tags && academy.tags.split(',').slice(0, 2).map((tag, i) => (
                      <span 
                        key={i} 
                        className="text-[10px] px-2 py-0.5 bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 rounded-full"
                      >
                        {tag.trim()}
                      </span>
                    ))}
                  </div>
                  
                  {/* 별점 & 가격 */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {academy.rating && (
                      <div className="flex items-center gap-0.5 text-xs text-yellow-500">
                        <Star size={12} fill="currentColor" />
                        <span>{academy.rating}</span>
                      </div>
                    )}
                    {academy.price && (
                      <span className="text-sm font-bold text-neutral-800 dark:text-[#CCFF00]">
                        {academy.price.toLocaleString()}원~
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* 필터 모달 */}
      <AcademyFilterModal
        isOpen={isFilterModalOpen}
        onClose={() => setIsFilterModalOpen(false)}
        onApply={(newFilter) => setFilter(newFilter)}
        currentFilter={filter}
        availableTags={availableTags}
      />
    </div>
  );
};
