"use client";

import Image from 'next/image';
import { Star, MapPin } from 'lucide-react';
import { useEffect, useState } from 'react';
import { getSupabaseClient } from '@/lib/utils/supabase-client';
import { Academy, ViewState } from '@/types';

interface AcademyListViewProps {
  onAcademyClick: (academy: Academy) => void;
}

// DB 데이터를 UI 타입으로 변환 - 각 지점을 별도 항목으로
function transformAcademyWithBranches(dbAcademy: any): Academy[] {
  const name = dbAcademy.name_kr || dbAcademy.name_en || '이름 없음';
  const branches = dbAcademy.branches || [];
  const classes = dbAcademy.classes || [];
  const minPrice = classes.length > 0 
    ? Math.min(...classes.map((c: any) => c.price || 0))
    : 0;

  // 지점이 없으면 하나의 항목으로 반환
  if (branches.length === 0) {
    return [{
      id: dbAcademy.id,
      name_kr: dbAcademy.name_kr,
      name_en: dbAcademy.name_en,
      tags: dbAcademy.tags,
      logo_url: dbAcademy.logo_url,
      name,
      branch: undefined,
      dist: undefined,
      rating: undefined,
      price: minPrice > 0 ? minPrice : undefined,
      badges: [],
      img: dbAcademy.logo_url || undefined,
      academyId: dbAcademy.id,
    }];
  }

  // 각 지점을 별도 항목으로 변환
  return branches.map((branch: any) => ({
    id: `${dbAcademy.id}-${branch.id}`, // 고유 ID 생성
    name_kr: dbAcademy.name_kr,
    name_en: dbAcademy.name_en,
    tags: dbAcademy.tags,
    logo_url: branch.image_url || dbAcademy.logo_url,
    name,
    branch: branch.name,
    dist: undefined,
    rating: undefined,
    price: minPrice > 0 ? minPrice : undefined,
    badges: [],
    img: branch.image_url || dbAcademy.logo_url || undefined,
    // 원본 데이터 저장 (필요시 사용)
    academyId: dbAcademy.id,
    branchId: branch.id,
  }));
}

export const AcademyListView = ({ onAcademyClick }: AcademyListViewProps) => {
  const [academies, setAcademies] = useState<Academy[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadAcademies() {
      try {
        const supabase = getSupabaseClient();
        if (!supabase) {
          setLoading(false);
          return;
        }

        const { data, error } = await supabase
          .from('academies')
          .select(`
            *,
            branches (*),
            classes (*)
          `)
          .order('created_at', { ascending: false });

        if (error) throw error;
        
        // 각 학원의 모든 지점을 별도 항목으로 변환
        const transformed = (data || []).flatMap(transformAcademyWithBranches);
        setAcademies(transformed);
      } catch (error) {
        console.error('Error loading academies:', error);
      } finally {
        setLoading(false);
      }
    }
    loadAcademies();
  }, []);

  if (loading) {
    return (
      <div className="pb-24 pt-14 px-5 animate-in slide-in-from-right-10 duration-300">
        <div className="text-center py-12 text-neutral-500">로딩 중...</div>
      </div>
    );
  }

  return (
    <div className="pb-24 pt-14 px-5 animate-in slide-in-from-right-10 duration-300">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-black dark:text-white">댄스학원</h2>
        <div className="flex gap-2">
          <button className="text-xs bg-neutral-100 dark:bg-neutral-800 text-black dark:text-white px-3 py-1.5 rounded-full border border-neutral-200 dark:border-neutral-700">
            거리순
          </button>
          <button className="text-xs bg-neutral-100 dark:bg-neutral-800 text-black dark:text-white px-3 py-1.5 rounded-full border border-neutral-200 dark:border-neutral-700">
            필터
          </button>
        </div>
      </div>
      <div className="space-y-4">
        {academies.length === 0 ? (
          <div className="text-center py-12 text-neutral-500">등록된 학원이 없습니다.</div>
        ) : (
          academies.map(academy => {
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
                <div className="h-40 relative overflow-hidden">
                  <Image 
                    src={academy.logo_url || `https://picsum.photos/seed/academy${academy.id}/400/160`}
                    alt={academy.name}
                    fill
                    className="object-cover"
                  />
                  {academy.tags && (
                    <div className="absolute top-3 left-3 bg-black/70 backdrop-blur px-2 py-1 rounded-full text-[10px] text-white font-bold">
                      {academy.tags.split(',')[0]?.trim() || ''}
                    </div>
                  )}
                  {/* 할인 배지 */}
                  {hasDiscount && (
                    <div className="absolute top-3 right-3 bg-neutral-900 dark:bg-neutral-800 text-white text-[10px] font-bold px-2 py-1 rounded-full">
                      특가
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-bold text-black dark:text-white truncate">{academy.name}</h3>
                      {academy.branch && (
                        <div className="flex items-center gap-1 text-xs text-neutral-600 dark:text-neutral-400 mt-1">
                          <MapPin size={10} />
                          <span className="truncate">{academy.branch}</span>
                          {academy.dist && <span>• {academy.dist}</span>}
                        </div>
                      )}
                    </div>
                    {academy.rating && (
                      <div className="flex items-center gap-1 text-primary dark:text-[#CCFF00] text-xs font-bold flex-shrink-0 ml-2">
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
                      <span className="text-sm font-bold text-primary dark:text-[#CCFF00]">
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
    </div>
  );
};

