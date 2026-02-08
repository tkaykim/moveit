"use client";

import Image from 'next/image';
import { ChevronLeft, User, Instagram, Heart, Ticket, Calendar, Clock, MapPin } from 'lucide-react';
import { Dancer, ClassInfo } from '@/types';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseClient } from '@/lib/utils/supabase-client';
import { useAuth } from '@/contexts/AuthContext';
import { TicketPurchaseModal } from '@/components/modals/ticket-purchase-modal';
import { LanguageToggle } from '@/components/common/language-toggle';

interface DancerDetailViewProps {
  dancer: Dancer | null;
  onBack: () => void;
}

export const DancerDetailView = ({ dancer, onBack }: DancerDetailViewProps) => {
  const router = useRouter();
  const [schedules, setSchedules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFavorited, setIsFavorited] = useState(false);
  const [favoriteLoading, setFavoriteLoading] = useState(false);
  const [academyIds, setAcademyIds] = useState<string[]>([]);
  const [selectedAcademyId, setSelectedAcademyId] = useState<string | null>(null);
  const [showTicketPurchaseModal, setShowTicketPurchaseModal] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    async function loadInstructorSchedules() {
      if (!dancer) return;
      
      try {
        const supabase = getSupabaseClient();
        if (!supabase) {
          setLoading(false);
          return;
        }

        // 현재 시간 이후의 모든 스케줄 가져오기
        const now = new Date();
        const { data: instructorSchedules, error } = await (supabase as any)
          .from('schedules')
          .select(`
            *,
            classes (
              *,
              academies (*)
            ),
            instructors (*),
            halls (*)
          `)
          .eq('instructor_id', dancer.id)
          .eq('is_canceled', false)
          .gte('start_time', now.toISOString())
          .order('start_time', { ascending: true });

        if (error) throw error;
        setSchedules(instructorSchedules || []);
        
        // 학원 ID 수집 (중복 제거)
        const uniqueAcademyIds = [...new Set(
          (instructorSchedules || [])
            .map((s: any) => s.classes?.academy_id)
            .filter(Boolean)
        )] as string[];
        setAcademyIds(uniqueAcademyIds);
        
        if (uniqueAcademyIds.length > 0) {
          setSelectedAcademyId(uniqueAcademyIds[0]);
        }
      } catch (error) {
        console.error('Error loading instructor schedules:', error);
      } finally {
        setLoading(false);
      }
    }
    loadInstructorSchedules();
  }, [dancer]);

  // 찜 상태 확인
  useEffect(() => {
    const checkFavoriteStatus = async () => {
      if (!user || !dancer) {
        setIsFavorited(false);
        return;
      }

      try {
        const response = await fetch('/api/favorites?type=instructor');
        if (response.ok) {
          const data = await response.json();
          const isFavorite = (data.data || []).some((item: any) => 
            item.instructors?.id === dancer.id
          );
          setIsFavorited(isFavorite);
        }
      } catch (error) {
        console.error('Error checking favorite status:', error);
      }
    };

    checkFavoriteStatus();
  }, [user, dancer]);

  // 찜 토글 함수
  const handleToggleFavorite = async () => {
    if (!user || !dancer || favoriteLoading) return;

    try {
      setFavoriteLoading(true);
      const response = await fetch('/api/favorites', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ type: 'instructor', id: dancer.id }),
      });

      if (response.ok) {
        const result = await response.json();
        setIsFavorited(result.isFavorited);
      }
    } catch (error) {
      console.error('Error toggling favorite:', error);
    } finally {
      setFavoriteLoading(false);
    }
  };

  if (!dancer) return null;

  return (
    <div className="bg-white dark:bg-neutral-950 min-h-screen pb-24 animate-in slide-in-from-right duration-300">
      <div className="relative h-80 overflow-hidden">
        <Image 
          src={dancer.img || `https://picsum.photos/seed/dancer${dancer.id}/800/320`}
          alt={dancer.name}
          fill
          className="object-cover"
        />
        <div className="absolute top-12 left-5 right-5 z-20 flex justify-between items-center">
          <button 
            onClick={onBack} 
            className="p-2 bg-black/30 backdrop-blur rounded-full text-white"
          >
            <ChevronLeft />
          </button>
          <div className="flex items-center gap-2">
            {user && (
              <button
                onClick={handleToggleFavorite}
                disabled={favoriteLoading}
                className="p-2 bg-black/30 backdrop-blur rounded-full text-white hover:bg-black/50 transition-colors disabled:opacity-50"
              >
                <Heart 
                  size={20} 
                  fill={isFavorited ? 'currentColor' : 'none'} 
                  className={isFavorited ? 'text-red-500' : ''}
                />
              </button>
            )}
            <LanguageToggle />
          </div>
        </div>
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

        {/* 수강권 구매 버튼 */}
        {academyIds.length > 0 && (
          <div className="mb-4">
            <button
              onClick={() => setShowTicketPurchaseModal(true)}
              className="w-full flex items-center justify-center gap-2 py-3 bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl text-black dark:text-white font-bold hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors"
            >
              <Ticket size={18} />
              수강권 구매하기
            </button>
          </div>
        )}

        <div>
          <h3 className="text-black dark:text-white font-bold mb-3">개설된 클래스</h3>
          {loading ? (
            <div className="text-center py-8 text-neutral-500">로딩 중...</div>
          ) : schedules.length === 0 ? (
            <div className="text-center py-8 text-neutral-500">예정된 클래스가 없습니다.</div>
          ) : (
            <div className="space-y-3">
              {schedules.map((schedule: any) => {
                if (!schedule.start_time) return null;
                const startTime = new Date(schedule.start_time);
                const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
                const dayName = dayNames[startTime.getDay()];
                const time = startTime.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
                const classData = schedule.classes || {};
                const academy = classData.academies || { name: '학원 정보 없음' };

                const handleBookSchedule = () => {
                  // 새 예약 페이지로 이동
                  router.push(`/book/session/${schedule.id}`);
                };

                const dateStr = startTime.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });

                return (
                  <div 
                    key={schedule.id} 
                    className="bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 p-4 rounded-2xl flex justify-between items-center"
                  >
                    <div className="flex items-center gap-4">
                      <div className="text-center min-w-[50px]">
                        <div className="text-[10px] text-neutral-500 dark:text-neutral-500">{dateStr}</div>
                        <div className="text-xs text-neutral-400">{dayName}</div>
                        <div className="text-lg font-bold text-black dark:text-white">{time}</div>
                      </div>
                      <div>
                        <div className="text-black dark:text-white font-bold">
                          {classData.title || `${dancer.genre || 'ALL'} 클래스`}
                        </div>
                        <div className="text-xs text-neutral-500 dark:text-neutral-500 flex items-center gap-1">
                          <MapPin size={10} />
                          {academy.name_kr || academy.name_en || academy.name || '학원 정보 없음'}
                        </div>
                      </div>
                    </div>
                    <button 
                      onClick={handleBookSchedule}
                      className="bg-primary dark:bg-[#CCFF00] text-black text-xs font-bold px-4 py-2 rounded-full hover:bg-primary/90 dark:hover:bg-[#b8e600] transition-colors"
                    >
                      신청
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 수강권 구매 모달 */}
      {selectedAcademyId && (
        <TicketPurchaseModal
          isOpen={showTicketPurchaseModal}
          onClose={() => setShowTicketPurchaseModal(false)}
          academyId={selectedAcademyId}
          onPurchaseComplete={() => {
            // 구매 완료 후 처리
          }}
        />
      )}
    </div>
  );
};

