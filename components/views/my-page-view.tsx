"use client";

import { useState, useEffect } from 'react';
import { 
  User, ChevronRight, Ticket, Calendar, 
  CreditCard, HelpCircle, Bell, Settings,
  Clock, MapPin, Play
} from 'lucide-react';
import { ThemeToggle } from '@/components/common/theme-toggle';
import { useAuth } from '@/contexts/AuthContext';
import { MyTab } from '@/components/auth/MyTab';
import { UserMenu } from '@/components/auth/UserMenu';
import { useRouter } from 'next/navigation';

interface TicketSummary {
  regular: number;
  popup: number;
  workshop: number;
  total: number;
}

interface UpcomingBooking {
  id: string;
  className: string;
  academyName: string;
  startTime: string;
  hallName?: string;
}

interface WeekSchedule {
  date: Date;
  dayLabel: string;
  count: number;
  isToday: boolean;
}

interface MyPageViewProps {
  onNavigate?: (view: string) => void;
}

export const MyPageView = ({ onNavigate }: MyPageViewProps) => {
  const router = useRouter();
  const { user, profile, loading: authLoading } = useAuth();
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [ticketSummary, setTicketSummary] = useState<TicketSummary>({ regular: 0, popup: 0, workshop: 0, total: 0 });
  const [nextClass, setNextClass] = useState<UpcomingBooking | null>(null);
  const [weekSchedule, setWeekSchedule] = useState<WeekSchedule[]>([]);
  const [totalUpcoming, setTotalUpcoming] = useState(0);
  const [loading, setLoading] = useState(true);

  const displayName = profile?.nickname || profile?.name || user?.email?.split('@')[0] || '사용자';
  const profileImage = profile?.profile_image || null;

  // 데이터 로드
  useEffect(() => {
    if (!user) {
      setTicketSummary({ regular: 0, popup: 0, workshop: 0, total: 0 });
      setNextClass(null);
      setWeekSchedule([]);
      setTotalUpcoming(0);
      setLoading(false);
      return;
    }

    const loadData = async () => {
      setLoading(true);
      try {
        // 수강권 정보 로드
        const ticketRes = await fetch('/api/user-tickets');
        if (ticketRes.ok) {
          const result = await ticketRes.json();
          const tickets = result.data || [];
          
          // 수강권 유형별 집계
          let regular = 0, popup = 0, workshop = 0;
          tickets.forEach((t: any) => {
            if (t.status !== 'ACTIVE') return;
            
            const accessGroup = t.tickets?.access_group || 'general';
            const isCoupon = t.tickets?.is_coupon;
            
            if (accessGroup === 'popup' || (isCoupon && accessGroup !== 'workshop')) {
              popup++;
            } else if (accessGroup === 'workshop') {
              workshop++;
            } else {
              regular++;
            }
          });
          
          setTicketSummary({ regular, popup, workshop, total: regular + popup + workshop });
        }

        // 예약 내역 로드
        const bookingRes = await fetch('/api/bookings');
        if (bookingRes.ok) {
          const result = await bookingRes.json();
          const bookings = result.data || [];
          const now = new Date();
          
          // 미래 예약만 필터링
          const upcomingBookings = bookings
            .filter((b: any) => {
              if (b.status !== 'CONFIRMED') return false;
              const startTime = b.schedules?.start_time || b.classes?.start_time;
              if (!startTime) return false;
              return new Date(startTime) > now;
            })
            .sort((a: any, b: any) => {
              const aTime = a.schedules?.start_time || a.classes?.start_time;
              const bTime = b.schedules?.start_time || b.classes?.start_time;
              return new Date(aTime).getTime() - new Date(bTime).getTime();
            });

          setTotalUpcoming(upcomingBookings.length);

          // 가장 가까운 수업 1개
          if (upcomingBookings.length > 0) {
            const first = upcomingBookings[0];
            setNextClass({
              id: first.id,
              className: first.classes?.title || '클래스',
              academyName: first.classes?.academies?.name_kr || first.classes?.academies?.name_en || '',
              startTime: first.schedules?.start_time || first.classes?.start_time,
              hallName: first.halls?.name,
            });
          } else {
            setNextClass(null);
          }

          // 이번 주 일정 요약 (7일간)
          const weekDays: WeekSchedule[] = [];
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          
          for (let i = 0; i < 7; i++) {
            const date = new Date(today);
            date.setDate(date.getDate() + i);
            const nextDay = new Date(date);
            nextDay.setDate(nextDay.getDate() + 1);
            
            const count = upcomingBookings.filter((b: any) => {
              const startTime = new Date(b.schedules?.start_time || b.classes?.start_time);
              return startTime >= date && startTime < nextDay;
            }).length;

            const dayLabels = ['일', '월', '화', '수', '목', '금', '토'];
            weekDays.push({
              date,
              dayLabel: dayLabels[date.getDay()],
              count,
              isToday: i === 0,
            });
          }
          
          setWeekSchedule(weekDays);
        }
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [user]);

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const weekday = ['일', '월', '화', '수', '목', '금', '토'][date.getDay()];
    const hours = date.getHours();
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${month}/${day}(${weekday}) ${hours}:${minutes}`;
  };

  return (
    <>
      <div className="min-h-screen bg-neutral-50 dark:bg-black pb-24">
        {/* 헤더 */}
        <div className="bg-white dark:bg-neutral-900 px-5 pt-12 pb-6">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-xl font-bold text-black dark:text-white">마이페이지</h1>
            <div className="flex gap-3 items-center">
              <ThemeToggle />
              {user && <UserMenu />}
            </div>
          </div>

          {/* 프로필 */}
          {authLoading ? (
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-neutral-200 dark:bg-neutral-800 animate-pulse" />
              <div className="flex-1">
                <div className="h-5 bg-neutral-200 dark:bg-neutral-800 rounded w-24 mb-2 animate-pulse" />
                <div className="h-4 bg-neutral-200 dark:bg-neutral-800 rounded w-32 animate-pulse" />
              </div>
            </div>
          ) : user ? (
            <button
              onClick={() => onNavigate?.('SETTINGS')}
              className="w-full flex items-center gap-4 hover:bg-neutral-50 dark:hover:bg-neutral-800 rounded-2xl p-2 -mx-2 transition-colors"
            >
              <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-primary dark:from-[#CCFF00] to-green-500 p-[2px]">
                <div className="w-full h-full rounded-full bg-white dark:bg-black flex items-center justify-center overflow-hidden">
                  {profileImage ? (
                    <img src={profileImage} alt={displayName} className="w-full h-full object-cover" />
                  ) : (
                    <User className="text-black dark:text-white" size={24} />
                  )}
                </div>
              </div>
              <div className="flex-1 text-left">
                <h2 className="text-lg font-bold text-black dark:text-white">{displayName}</h2>
                <p className="text-sm text-neutral-500">프로필 설정</p>
              </div>
              <ChevronRight className="text-neutral-400" size={20} />
            </button>
          ) : (
            <button
              onClick={() => setIsAuthModalOpen(true)}
              className="w-full flex items-center gap-4 border-2 border-dashed border-neutral-300 dark:border-neutral-700 rounded-2xl p-4 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
            >
              <div className="w-14 h-14 rounded-full bg-neutral-200 dark:bg-neutral-700 flex items-center justify-center">
                <User className="text-neutral-400" size={24} />
              </div>
              <div className="flex-1 text-left">
                <h2 className="text-base font-bold text-black dark:text-white">로그인하세요</h2>
                <p className="text-sm text-neutral-500">로그인하여 더 많은 기능을 이용하세요</p>
              </div>
              <ChevronRight className="text-neutral-400" size={20} />
            </button>
          )}
        </div>

        {/* 보유 수강권 */}
        <div className="px-5 mt-4">
          <div className="bg-white dark:bg-neutral-900 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-black dark:text-white">보유 수강권</h2>
              <button
                onClick={() => onNavigate?.('TICKETS')}
                className="text-sm text-primary dark:text-[#CCFF00] font-medium flex items-center gap-1"
              >
                전체보기 <ChevronRight size={16} />
              </button>
            </div>

            {loading ? (
              <div className="grid grid-cols-3 gap-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="bg-neutral-100 dark:bg-neutral-800 rounded-xl p-4 animate-pulse">
                    <div className="h-6 bg-neutral-200 dark:bg-neutral-700 rounded mb-2" />
                    <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-16" />
                  </div>
                ))}
              </div>
            ) : !user ? (
              <div className="text-center py-6 text-neutral-500 text-sm">
                로그인 후 확인할 수 있습니다
              </div>
            ) : ticketSummary.total === 0 ? (
              <div className="text-center py-6">
                <Ticket size={40} className="text-neutral-300 dark:text-neutral-700 mx-auto mb-2" />
                <p className="text-neutral-500 text-sm">보유한 수강권이 없습니다</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 text-center">
                  <div className="text-2xl font-black text-blue-600 dark:text-blue-400 mb-1">
                    {ticketSummary.regular}
                  </div>
                  <div className="text-xs font-medium text-blue-600 dark:text-blue-400">정규권</div>
                </div>
                <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-4 text-center">
                  <div className="text-2xl font-black text-purple-600 dark:text-purple-400 mb-1">
                    {ticketSummary.popup}
                  </div>
                  <div className="text-xs font-medium text-purple-600 dark:text-purple-400">팝업</div>
                </div>
                <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4 text-center">
                  <div className="text-2xl font-black text-amber-600 dark:text-amber-400 mb-1">
                    {ticketSummary.workshop}
                  </div>
                  <div className="text-xs font-medium text-amber-600 dark:text-amber-400">워크샵</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 수강 예정 클래스 */}
        {user && (
          <div className="px-5 mt-4">
            <div className="bg-white dark:bg-neutral-900 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-black dark:text-white">수강 예정</h2>
                  {totalUpcoming > 0 && (
                    <span className="px-2 py-0.5 text-xs font-bold bg-primary/10 dark:bg-[#CCFF00]/20 text-primary dark:text-[#CCFF00] rounded-full">
                      {totalUpcoming}건
                    </span>
                  )}
                </div>
                <button
                  onClick={() => router.push('/schedule')}
                  className="text-sm text-primary dark:text-[#CCFF00] font-medium flex items-center gap-1"
                >
                  전체보기 <ChevronRight size={16} />
                </button>
              </div>

              {loading ? (
                <div className="space-y-3">
                  <div className="bg-neutral-100 dark:bg-neutral-800 rounded-xl p-4 animate-pulse">
                    <div className="h-5 bg-neutral-200 dark:bg-neutral-700 rounded w-32 mb-2" />
                    <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-24" />
                  </div>
                  <div className="flex gap-2">
                    {[1,2,3,4,5,6,7].map(i => (
                      <div key={i} className="flex-1 h-14 bg-neutral-100 dark:bg-neutral-800 rounded-lg animate-pulse" />
                    ))}
                  </div>
                </div>
              ) : !nextClass ? (
                <div className="text-center py-6">
                  <Calendar size={40} className="text-neutral-300 dark:text-neutral-700 mx-auto mb-2" />
                  <p className="text-neutral-500 text-sm">예정된 수업이 없습니다</p>
                  <button
                    onClick={() => router.push('/search')}
                    className="mt-3 text-sm text-primary dark:text-[#CCFF00] font-medium"
                  >
                    클래스 찾아보기
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* 다음 수업 */}
                  <div className="bg-neutral-50 dark:bg-neutral-800 rounded-xl p-4 border border-neutral-200 dark:border-neutral-700">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-6 h-6 rounded-full bg-primary dark:bg-[#CCFF00] flex items-center justify-center">
                        <Play size={12} className="text-white dark:text-black ml-0.5" />
                      </div>
                      <span className="text-xs font-bold text-primary dark:text-[#CCFF00]">다음 수업</span>
                    </div>
                    <div className="font-bold text-black dark:text-white text-lg mb-2">
                      {nextClass.className}
                    </div>
                    <div className="flex flex-wrap gap-3 text-sm text-neutral-600 dark:text-neutral-400">
                      <span className="flex items-center gap-1">
                        <Clock size={14} />
                        {formatDateTime(nextClass.startTime)}
                      </span>
                      {nextClass.academyName && (
                        <span className="flex items-center gap-1">
                          <MapPin size={14} />
                          {nextClass.academyName}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* 이번 주 일정 미니 캘린더 */}
                  {weekSchedule.length > 0 && (
                    <div>
                      <div className="text-xs font-medium text-neutral-500 mb-2">이번 주 일정</div>
                      <div className="grid grid-cols-7 gap-1">
                        {weekSchedule.map((day, idx) => (
                          <button
                            key={idx}
                            onClick={() => router.push('/schedule')}
                            className={`
                              flex flex-col items-center py-2 rounded-lg transition-colors
                              ${day.isToday 
                                ? 'bg-primary/10 dark:bg-[#CCFF00]/20 ring-2 ring-primary dark:ring-[#CCFF00]' 
                                : 'bg-neutral-50 dark:bg-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-700'
                              }
                            `}
                          >
                            <span className={`text-xs font-medium ${
                              day.isToday 
                                ? 'text-primary dark:text-[#CCFF00]' 
                                : 'text-neutral-500'
                            }`}>
                              {day.dayLabel}
                            </span>
                            <span className={`text-sm font-bold mt-0.5 ${
                              day.count > 0 
                                ? day.isToday 
                                  ? 'text-primary dark:text-[#CCFF00]'
                                  : 'text-black dark:text-white'
                                : 'text-neutral-300 dark:text-neutral-600'
                            }`}>
                              {day.count > 0 ? day.count : '-'}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 메뉴 */}
        <div className="px-5 mt-4">
          <div className="bg-white dark:bg-neutral-900 rounded-2xl overflow-hidden shadow-sm">
            <button
              onClick={() => onNavigate?.('PAYMENT_HISTORY')}
              className="w-full flex items-center gap-4 p-4 border-b border-neutral-100 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
            >
              <div className="w-10 h-10 rounded-xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center">
                <CreditCard size={20} className="text-neutral-600 dark:text-neutral-400" />
              </div>
              <span className="flex-1 text-left font-medium text-black dark:text-white">결제 내역</span>
              <ChevronRight size={18} className="text-neutral-400" />
            </button>
            <button
              onClick={() => onNavigate?.('FAQ')}
              className="w-full flex items-center gap-4 p-4 border-b border-neutral-100 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
            >
              <div className="w-10 h-10 rounded-xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center">
                <HelpCircle size={20} className="text-neutral-600 dark:text-neutral-400" />
              </div>
              <span className="flex-1 text-left font-medium text-black dark:text-white">자주 묻는 질문</span>
              <ChevronRight size={18} className="text-neutral-400" />
            </button>
            <button
              onClick={() => onNavigate?.('NOTICES')}
              className="w-full flex items-center gap-4 p-4 border-b border-neutral-100 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
            >
              <div className="w-10 h-10 rounded-xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center">
                <Bell size={20} className="text-neutral-600 dark:text-neutral-400" />
              </div>
              <span className="flex-1 text-left font-medium text-black dark:text-white">공지사항</span>
              <ChevronRight size={18} className="text-neutral-400" />
            </button>
            <button
              onClick={() => onNavigate?.('SETTINGS')}
              className="w-full flex items-center gap-4 p-4 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
            >
              <div className="w-10 h-10 rounded-xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center">
                <Settings size={20} className="text-neutral-600 dark:text-neutral-400" />
              </div>
              <span className="flex-1 text-left font-medium text-black dark:text-white">설정</span>
              <ChevronRight size={18} className="text-neutral-400" />
            </button>
          </div>
        </div>

        {/* 앱 정보 */}
        <div className="px-5 mt-6 mb-4">
          <div className="text-center text-xs text-neutral-400">
            MOVE.IT v1.0.0
          </div>
        </div>
      </div>

      <MyTab isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />
    </>
  );
};
