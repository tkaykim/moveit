"use client";

import Image from 'next/image';
import { useState, useEffect } from 'react';
import { Heart } from 'lucide-react';
import { getSupabaseClient } from '@/lib/utils/supabase-client';
import { Academy, Dancer, ViewState } from '@/types';

interface SavedViewProps {
  onNavigate?: (view: ViewState) => void;
}

export const SavedView = ({ onNavigate }: SavedViewProps) => {
  const [savedTab, setSavedTab] = useState<'ACADEMY' | 'DANCER'>('ACADEMY');
  const [savedAcademies, setSavedAcademies] = useState<Academy[]>([]);
  const [savedDancers, setSavedDancers] = useState<Dancer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadSavedItems() {
      try {
        const supabase = getSupabaseClient();
        if (!supabase) {
          setLoading(false);
          return;
        }

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setLoading(false);
          return;
        }

        // TODO: 실제로는 saved_academies, saved_instructors 같은 테이블이 필요합니다
        // 현재는 빈 배열로 설정
        setSavedAcademies([]);
        setSavedDancers([]);
      } catch (error) {
        console.error('Error loading saved items:', error);
      } finally {
        setLoading(false);
      }
    }
    loadSavedItems();
  }, []);

  if (loading) {
    return (
      <div className="h-full pt-12 px-5 pb-24 animate-in fade-in">
        <div className="text-center py-12 text-neutral-500">로딩 중...</div>
      </div>
    );
  }

  return (
    <div className="h-full pt-12 px-5 pb-24 animate-in fade-in">
      <h2 className="text-xl font-bold text-black dark:text-white mb-6">찜한 목록</h2>
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
                <button className="text-primary dark:text-[#CCFF00] p-2">
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
                <button className="text-primary dark:text-[#CCFF00] p-2">
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

