"use client";

import Image from 'next/image';
import { ChevronLeft, User, Instagram } from 'lucide-react';
import { Dancer } from '@/types';
import { useState, useEffect } from 'react';
import { getSupabaseClient } from '@/lib/utils/supabase-client';

interface DancerDetailViewProps {
  dancer: Dancer | null;
  onBack: () => void;
}

export const DancerDetailView = ({ dancer, onBack }: DancerDetailViewProps) => {
  const [schedules, setSchedules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadInstructorSchedules() {
      if (!dancer) return;
      
      try {
        // 이번 주의 시작과 끝 날짜 계산
        const now = new Date();
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay() + 1); // 월요일
        startOfWeek.setHours(0, 0, 0, 0);
        
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6); // 일요일
        endOfWeek.setHours(23, 59, 59, 999);

        const supabase = getSupabaseClient();
        if (!supabase) {
          setLoading(false);
          return;
        }

        // 강사의 스케줄 가져오기
        const { data: instructorSchedules, error } = await (supabase as any)
          .from('schedules')
          .select(`
            *,
            classes (*),
            branches (*),
            instructors (*),
            halls (*)
          `)
          .eq('instructor_id', dancer.id)
          .eq('is_canceled', false)
          .gte('start_time', startOfWeek.toISOString())
          .lte('start_time', endOfWeek.toISOString())
          .order('start_time', { ascending: true });

        if (error) throw error;
        setSchedules(instructorSchedules || []);
      } catch (error) {
        console.error('Error loading instructor schedules:', error);
      } finally {
        setLoading(false);
      }
    }
    loadInstructorSchedules();
  }, [dancer]);

  if (!dancer) return null;

  return (
    <div className="bg-white dark:bg-neutral-950 min-h-screen pb-24 animate-in slide-in-from-right duration-300">
      <div className="relative h-80 overflow-hidden">
        <Image 
          src={`https://picsum.photos/seed/dancer${dancer.id}/800/320`}
          alt={dancer.name}
          fill
          className="object-cover"
        />
        <button 
          onClick={onBack} 
          className="absolute top-12 left-5 z-20 p-2 bg-black/30 backdrop-blur rounded-full text-white"
        >
          <ChevronLeft />
        </button>
        <div className="absolute inset-0 bg-gradient-to-t from-white dark:from-neutral-950 via-transparent to-transparent" />
        <div className="absolute bottom-0 left-0 w-full p-6">
          <div className="flex gap-2 mb-2">
            {dancer.crew && (
              <span className="bg-black/50 text-white backdrop-blur text-[10px] font-bold px-2 py-1 rounded border border-white/20">
                {dancer.crew}
              </span>
            )}
            {dancer.genre && (
              <span className="bg-primary dark:bg-[#CCFF00] text-black text-[10px] font-bold px-2 py-1 rounded">
                {dancer.genre}
              </span>
            )}
          </div>
          <h1 className="text-4xl font-black text-black dark:text-white italic tracking-tighter mb-1">
            {dancer.name}
          </h1>
          <div className="flex items-center gap-4 text-sm text-neutral-700 dark:text-neutral-300 font-medium">
            {dancer.bio && (
              <span className="flex items-center gap-1">
                <User size={14}/> {dancer.bio.substring(0, 30)}
              </span>
            )}
            {dancer.instagram_url && (
              <a 
                href={dancer.instagram_url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center gap-1 hover:underline"
              >
                <Instagram size={14}/> Instagram
              </a>
            )}
          </div>
        </div>
      </div>
      
      <div className="p-5 space-y-6">
        <div className="flex gap-2">
          <button className="flex-1 bg-black dark:bg-white text-white dark:text-black py-3 rounded-xl font-bold text-sm">
            Follow
          </button>
          <button className="flex-1 bg-neutral-200 dark:bg-neutral-800 text-black dark:text-white py-3 rounded-xl font-bold text-sm border border-neutral-300 dark:border-neutral-700">
            Message
          </button>
        </div>

        <div>
          <h3 className="text-black dark:text-white font-bold mb-3">개설된 클래스</h3>
          {loading ? (
            <div className="text-center py-8 text-neutral-500">로딩 중...</div>
          ) : schedules.length === 0 ? (
            <div className="text-center py-8 text-neutral-500">이번 주 개설된 클래스가 없습니다.</div>
          ) : (
            <div className="space-y-3">
              {schedules.slice(0, 5).map(schedule => {
                const startTime = new Date(schedule.start_time);
                const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
                const dayName = dayNames[startTime.getDay()];
                const time = startTime.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
                const classData = schedule.classes || {};
                const branch = schedule.branches || {};
                const academy = branch.academy_id ? { name: '학원 정보 없음' } : { name: '학원 정보 없음' };

                return (
                  <div 
                    key={schedule.id} 
                    className="bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 p-4 rounded-2xl flex justify-between items-center"
                  >
                    <div className="flex items-center gap-4">
                      <div className="text-center">
                        <div className="text-[10px] text-neutral-500 dark:text-neutral-500">{dayName}</div>
                        <div className="text-lg font-bold text-black dark:text-white">{time}</div>
                      </div>
                      <div>
                        <div className="text-black dark:text-white font-bold">
                          {classData.title || `${dancer.genre || 'ALL'} 클래스`}
                        </div>
                        <div className="text-xs text-neutral-500 dark:text-neutral-500">
                          {branch.name || '지점 정보 없음'}
                        </div>
                      </div>
                    </div>
                    <button className="bg-primary dark:bg-[#CCFF00] text-black text-xs font-bold px-4 py-2 rounded-full">
                      신청
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

