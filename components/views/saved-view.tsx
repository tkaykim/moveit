"use client";

import Image from 'next/image';
import { useState, useEffect } from 'react';
import { Heart } from 'lucide-react';
import { Academy, Dancer, ViewState } from '@/types';
import { LanguageToggle } from '@/components/common/language-toggle';
import { useAuth } from '@/contexts/AuthContext';

interface SavedViewProps {
  onNavigate?: (view: ViewState) => void;
}

interface SavedAcademy extends Academy {
  favoriteId?: string;
}

interface SavedDancer extends Dancer {
  favoriteId?: string;
}

export const SavedView = ({ onNavigate }: SavedViewProps) => {
  const [savedTab, setSavedTab] = useState<'ACADEMY' | 'DANCER'>('ACADEMY');
  const [savedAcademies, setSavedAcademies] = useState<SavedAcademy[]>([]);
  const [savedDancers, setSavedDancers] = useState<SavedDancer[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  // 찜 목록 로드
  useEffect(() => {
    const loadFavorites = async () => {
      if (!user) {
        setSavedAcademies([]);
        setSavedDancers([]);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);

        // 학원 찜 목록 로드
        const academyResponse = await fetch('/api/favorites?type=academy');
        if (academyResponse.ok) {
          const academyData = await academyResponse.json();
          const academies = (academyData.data || []).map((item: any) => {
            const academy = item.academies;
            return {
              id: academy.id,
              name: academy.name_kr || academy.name_en || '이름 없음',
              name_kr: academy.name_kr,
              name_en: academy.name_en,
              address: academy.address,
              logo_url: academy.logo_url,
              tags: academy.tags,
              favoriteId: item.id,
            } as SavedAcademy;
          });
          setSavedAcademies(academies);
        }

        // 강사 찜 목록 로드
        const instructorResponse = await fetch('/api/favorites?type=instructor');
        if (instructorResponse.ok) {
          const instructorData = await instructorResponse.json();
          const dancers = (instructorData.data || []).map((item: any) => {
            const instructor = item.instructors;
            return {
              id: instructor.id,
              name_kr: instructor.name_kr,
              name_en: instructor.name_en,
              bio: instructor.bio,
              instagram_url: instructor.instagram_url,
              specialties: instructor.specialties,
              name: instructor.name_kr || instructor.name_en || '이름 없음',
              img: instructor.profile_image_url,
              genre: instructor.specialties || 'ALL',
              crew: undefined,
              favoriteId: item.id,
            } as SavedDancer;
          });
          setSavedDancers(dancers);
        }
      } catch (error) {
        console.error('Error loading favorites:', error);
      } finally {
        setLoading(false);
      }
    };

    loadFavorites();
  }, [user]);

  // 찜 해제 함수
  const handleToggleFavorite = async (type: 'academy' | 'instructor', id: string) => {
    if (!user) return;

    try {
      const response = await fetch('/api/favorites', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ type, id }),
      });

      if (response.ok) {
        const result = await response.json();
        
        // 목록에서 제거
        if (!result.isFavorited) {
          if (type === 'academy') {
            setSavedAcademies(prev => prev.filter(item => item.id !== id));
          } else {
            setSavedDancers(prev => prev.filter(item => item.id !== id));
          }
        } else {
          // 다시 로드 (추가된 경우)
          const favoritesResponse = await fetch(`/api/favorites?type=${type}`);
          if (favoritesResponse.ok) {
            const favoritesData = await favoritesResponse.json();
            if (type === 'academy') {
              const academies = (favoritesData.data || []).map((item: any) => {
                const academy = item.academies;
                return {
                  id: academy.id,
                  name: academy.name_kr || academy.name_en || '이름 없음',
                  name_kr: academy.name_kr,
                  name_en: academy.name_en,
                  address: academy.address,
                  logo_url: academy.logo_url,
                  tags: academy.tags,
                  favoriteId: item.id,
                } as SavedAcademy;
              });
              setSavedAcademies(academies);
            } else {
              const dancers = (favoritesData.data || []).map((item: any) => {
                const instructor = item.instructors;
                return {
                  id: instructor.id,
                  name_kr: instructor.name_kr,
                  name_en: instructor.name_en,
                  bio: instructor.bio,
                  instagram_url: instructor.instagram_url,
                  specialties: instructor.specialties,
                  name: instructor.name_kr || instructor.name_en || '이름 없음',
                  img: instructor.profile_image_url,
                  genre: instructor.specialties || 'ALL',
                  crew: undefined,
                  favoriteId: item.id,
                } as SavedDancer;
              });
              setSavedDancers(dancers);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error toggling favorite:', error);
    }
  };

  if (loading) {
    return (
      <div className="h-full pt-12 px-5 pb-24 animate-in fade-in">
        <div className="text-center py-12 text-neutral-500">로딩 중...</div>
      </div>
    );
  }

  return (
    <div className="h-full pt-12 px-5 pb-24 animate-in fade-in">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-black dark:text-white">찜한 목록</h2>
        <LanguageToggle />
      </div>
      <div className="flex bg-neutral-100 dark:bg-neutral-900 p-1 rounded-xl mb-6 border border-neutral-200 dark:border-neutral-800">
        <button 
          onClick={() => setSavedTab('ACADEMY')}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
            savedTab === 'ACADEMY' 
              ? 'bg-white dark:bg-neutral-800 text-black dark:text-white shadow-sm' 
              : 'text-neutral-500 dark:text-neutral-500'
          }`}
        >
          학원 ({savedAcademies.length})
        </button>
        <button 
          onClick={() => setSavedTab('DANCER')}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
            savedTab === 'DANCER' 
              ? 'bg-white dark:bg-neutral-800 text-black dark:text-white shadow-sm' 
              : 'text-neutral-500 dark:text-neutral-500'
          }`}
        >
          강사 ({savedDancers.length})
        </button>
      </div>

      <div className="space-y-3">
        {savedTab === 'ACADEMY' && (
          savedAcademies.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-neutral-500 dark:text-neutral-400 mb-4">찜한 학원이 없습니다.</p>
              <button
                onClick={() => onNavigate?.('ACADEMY')}
                className="px-6 py-2 bg-primary dark:bg-[#CCFF00] text-black font-bold rounded-lg hover:opacity-90 transition-opacity"
              >
                찜하러 가기
              </button>
            </div>
          ) : (
            savedAcademies.map(item => (
              <div 
                key={item.id} 
                className="bg-white dark:bg-neutral-900 p-3 rounded-2xl flex gap-3 items-center border border-neutral-200 dark:border-neutral-800"
              >
                <div className="w-16 h-16 rounded-xl flex-shrink-0 relative overflow-hidden">
                  <Image 
                    src={item.logo_url || `https://picsum.photos/seed/academy${item.id}/64/64`}
                    alt={item.name}
                    fill
                    className="object-cover"
                  />
                </div>
                <div className="flex-1">
                  <h3 className="text-black dark:text-white font-bold text-sm">{item.name}</h3>
                  <p className="text-xs text-neutral-500 dark:text-neutral-500">{item.address || '주소 정보 없음'}</p>
                </div>
                <button 
                  onClick={() => handleToggleFavorite('academy', item.id)}
                  className="text-primary dark:text-[#CCFF00] p-2 hover:opacity-80 transition-opacity"
                >
                  <Heart fill="currentColor" size={18} />
                </button>
              </div>
            ))
          )
        )}
        {savedTab === 'DANCER' && (
          savedDancers.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-neutral-500 dark:text-neutral-400 mb-4">찜한 강사가 없습니다.</p>
              <button
                onClick={() => onNavigate?.('DANCER')}
                className="px-6 py-2 bg-primary dark:bg-[#CCFF00] text-black font-bold rounded-lg hover:opacity-90 transition-opacity"
              >
                찜하러 가기
              </button>
            </div>
          ) : (
            savedDancers.map(item => (
              <div 
                key={item.id} 
                className="bg-white dark:bg-neutral-900 p-3 rounded-2xl flex gap-3 items-center border border-neutral-200 dark:border-neutral-800"
              >
                <div className="w-16 h-16 rounded-xl flex-shrink-0 relative overflow-hidden">
                  <Image 
                    src={item.img || `https://picsum.photos/seed/dancer${item.id}/64/64`}
                    alt={item.name}
                    fill
                    className="object-cover"
                  />
                </div>
                <div className="flex-1">
                  <h3 className="text-black dark:text-white font-bold text-sm">{item.name}</h3>
                  <p className="text-xs text-neutral-500 dark:text-neutral-500">
                    {item.genre || 'ALL'} {item.crew ? `• ${item.crew}` : ''}
                  </p>
                </div>
                <button 
                  onClick={() => handleToggleFavorite('instructor', item.id)}
                  className="text-primary dark:text-[#CCFF00] p-2 hover:opacity-80 transition-opacity"
                >
                  <Heart fill="currentColor" size={18} />
                </button>
              </div>
            ))
          )
        )}
      </div>
    </div>
  );
};

