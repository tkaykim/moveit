"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  User, ChevronRight, Ticket, Calendar, 
  CreditCard, HelpCircle, Bell, Settings,
  Clock, MapPin, Play, QrCode, RefreshCw, BookOpen
} from 'lucide-react';
import { ThemeToggle } from '@/components/common/theme-toggle';
import { LanguageToggle } from '@/components/common/language-toggle';
import { useAuth } from '@/contexts/AuthContext';
import { MyTab } from '@/components/auth/MyTab';
import { UserMenu } from '@/components/auth/UserMenu';
import { useRouter, useSearchParams } from 'next/navigation';
import { useLocale } from '@/contexts/LocaleContext';
import { QrModal } from '@/components/modals/qr-modal';
import { fetchWithAuth } from '@/lib/api/auth-fetch';
import { NotificationBadge } from '@/components/notifications/notification-badge';

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
  const searchParams = useSearchParams();
  const { user, profile, isInstructor, loading: authLoading, refreshProfile } = useAuth();
  const profileRefreshDoneRef = useRef(false);
  const { t, language } = useLocale();
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  // 쿼리 ?auth=open 이면 로그인 모달 자동 오픈 (테스트/디버깅용)
  useEffect(() => {
    if (searchParams?.get('auth') === 'open' && !user) {
      setIsAuthModalOpen(true);
    }
  }, [searchParams, user]);

  // 로그인된 상태인데 instructor_id가 없으면 프로필 재조회 (강사 연결 반영)
  useEffect(() => {
    if (!user || authLoading || profileRefreshDoneRef.current) return;
    if (profile && profile.instructor_id) return;
    profileRefreshDoneRef.current = true;
    refreshProfile();
  }, [user, authLoading, profile?.instructor_id, refreshProfile]);
  const [ticketSummary, setTicketSummary] = useState<TicketSummary>({ regular: 0, popup: 0, workshop: 0, total: 0 });
  const [nextClass, setNextClass] = useState<UpcomingBooking | null>(null);
  const [weekSchedule, setWeekSchedule] = useState<WeekSchedule[]>([]);
  const [totalUpcoming, setTotalUpcoming] = useState(0);
  const [loading, setLoading] = useState(true);
  const [dataError, setDataError] = useState(false);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [qrBookingId, setQrBookingId] = useState<string | null>(null);
  const [qrBookingInfo, setQrBookingInfo] = useState<{
    className?: string;
    academyName?: string;
    startTime?: string;
  } | undefined>(undefined);

  // 데이터 로드 중복 방지
  const loadingRef = useRef(false);
  const mountedRef = useRef(true);

  const displayName = profile?.nickname || profile?.name || user?.email?.split('@')[0] || (language === 'en' ? 'User' : '사용자');
  const profileImage = profile?.profile_image || null;

  // 데이터 로드 함수를 분리하여 재시도에 활용
  const loadData = useCallback(async () => {
    if (!user || loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    setDataError(false);
    
    try {
      // 수강권 + 예약을 병렬로 로드 (하나가 실패해도 다른 하나는 성공)
      const [ticketResult, bookingResult] = await Promise.allSettled([
        fetchWithAuth('/api/user-tickets'),
        fetchWithAuth('/api/bookings'),
      ]);

      if (!mountedRef.current) return;

      // 수강권 처리
      if (ticketResult.status === 'fulfilled' && ticketResult.value.ok) {
        const result = await ticketResult.value.json();
        const tickets = result.data || [];
        
        let regular = 0, popup = 0, workshop = 0;
        tickets.forEach((t: any) => {
          if (t.status !== 'ACTIVE') return;
          
          const ticketCategory = t.tickets?.ticket_category;
          const accessGroup = t.tickets?.access_group;
          const isCoupon = t.tickets?.is_coupon;
          
          if (ticketCategory === 'popup') { popup++; }
          else if (ticketCategory === 'workshop') { workshop++; }
          else if (ticketCategory === 'regular') { regular++; }
          else if (accessGroup === 'popup') { popup++; }
          else if (accessGroup === 'workshop') { workshop++; }
          else if (isCoupon && accessGroup !== 'regular') { popup++; }
          else { regular++; }
        });
        
        setTicketSummary({ regular, popup, workshop, total: regular + popup + workshop });
      } else {
        console.warn('Ticket load failed:', ticketResult.status === 'rejected' ? ticketResult.reason : 'not ok');
      }

      // 예약 내역 처리
      if (bookingResult.status === 'fulfilled' && bookingResult.value.ok) {
        const result = await bookingResult.value.json();
        const bookings = result.data || [];
        const now = new Date();
        
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

          const dayLabelsKo = ['일', '월', '화', '수', '목', '금', '토'];
          const dayLabelsEn = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
          const dayLabels = language === 'en' ? dayLabelsEn : dayLabelsKo;
          weekDays.push({
            date,
            dayLabel: dayLabels[date.getDay()],
            count,
            isToday: i === 0,
          });
        }
        
        setWeekSchedule(weekDays);
      } else {
        console.warn('Booking load failed:', bookingResult.status === 'rejected' ? bookingResult.reason : 'not ok');
      }

      // 둘 다 실패한 경우에만 에러 표시
      if (ticketResult.status === 'rejected' && bookingResult.status === 'rejected') {
        setDataError(true);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      if (mountedRef.current) {
        setDataError(true);
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
      loadingRef.current = false;
    }
  }, [user, language]);

  // 데이터 로드 effect
  useEffect(() => {
    mountedRef.current = true;

    if (!user) {
      setTicketSummary({ regular: 0, popup: 0, workshop: 0, total: 0 });
      setNextClass(null);
      setWeekSchedule([]);
      setTotalUpcoming(0);
      setLoading(false);
      setDataError(false);
      return;
    }

    loadData();

    return () => {
      mountedRef.current = false;
    };
  }, [user, loadData]);

  // authLoading이 너무 오래 지속되는 것을 방지 (UI 안전장치)
  useEffect(() => {
    if (!authLoading) return;
    const timer = setTimeout(() => {
      // authLoading이 10초 이상 지속되면 강제로 non-loading UI 표시
      // (AuthContext에도 안전 타임아웃이 있지만 UI 레벨 방어)
      if (mountedRef.current) {
        setLoading(false);
      }
    }, 10000);
    return () => clearTimeout(timer);
  }, [authLoading]);

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const weekdayKo = ['일', '월', '화', '수', '목', '금', '토'][date.getDay()];
    const weekdayEn = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getDay()];
    const hours = date.getHours();
    const minutes = date.getMinutes().toString().padStart(2, '0');
    
    if (language === 'en') {
      return `${month}/${day} (${weekdayEn}) ${hours}:${minutes}`;
    }
    return `${month}/${day}(${weekdayKo}) ${hours}:${minutes}`;
  };

  return (
    <>
      <div className="min-h-screen bg-neutral-50 dark:bg-black pb-24">
        {/* 헤더 */}
        <div className="bg-white dark:bg-neutral-900 px-5 pt-12 pb-6">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-xl font-bold text-black dark:text-white">{t('my.title')}</h1>
            <div className="flex gap-3 items-center">
              {user && (
                <button
                  onClick={() => router.push('/notifications')}
                  className="relative p-1 text-neutral-600 dark:text-neutral-400 active:opacity-70"
                >
                  <Bell size={20} />
                  <NotificationBadge />
                </button>
              )}
              <LanguageToggle />
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
                <p className="text-sm text-neutral-500">{t('settings.editProfile')}</p>
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
                <h2 className="text-base font-bold text-black dark:text-white">{t('my.login')}</h2>
                <p className="text-sm text-neutral-500">{t('my.loginForMore')}</p>
              </div>
              <ChevronRight className="text-neutral-400" size={20} />
            </button>
          )}
        </div>

        {/* 내 수업 관리 (강사용) - 강사 프로필 연결된 유저만 */}
        {user && isInstructor && (
          <div className="px-5 mt-4">
            <button
              type="button"
              onClick={() => router.push('/instructor-dashboard')}
              className="w-full bg-white dark:bg-neutral-900 rounded-2xl p-5 shadow-sm border border-neutral-200 dark:border-neutral-800 text-left hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-primary/20 dark:bg-[#CCFF00]/20 flex items-center justify-center">
                  <BookOpen className="w-6 h-6 text-primary dark:text-[#CCFF00]" />
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-base font-bold text-black dark:text-white">
                    내 수업 관리 (강사용)
                  </h2>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">
                    제가 강사로 진행하는 수업 일정
                  </p>
                </div>
                <ChevronRight className="text-neutral-400 shrink-0" size={20} />
              </div>
            </button>
          </div>
        )}

        {/* 보유 수강권 */}
        <div className="px-5 mt-4">
          <div className="bg-white dark:bg-neutral-900 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-black dark:text-white">{t('my.myTickets')}</h2>
              <button
                onClick={() => onNavigate?.('TICKETS')}
                className="text-sm text-primary dark:text-[#CCFF00] font-medium flex items-center gap-1"
              >
                {t('common.viewAll')} <ChevronRight size={16} />
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
            ) : dataError && user ? (
              <div className="text-center py-6">
                <p className="text-neutral-500 text-sm mb-3">
                  {language === 'en' ? 'Failed to load data' : '데이터를 불러오지 못했습니다'}
                </p>
                <button
                  onClick={() => loadData()}
                  className="inline-flex items-center gap-1.5 text-sm text-primary dark:text-[#CCFF00] font-medium"
                >
                  <RefreshCw size={14} />
                  {language === 'en' ? 'Retry' : '다시 시도'}
                </button>
              </div>
            ) : !user ? (
                <div className="text-center py-6 text-neutral-500 text-sm">
                {t('my.loginToView')}
              </div>
            ) : ticketSummary.total === 0 ? (
              <div className="text-center py-6">
                <Ticket size={40} className="text-neutral-300 dark:text-neutral-700 mx-auto mb-2" />
                <p className="text-neutral-500 text-sm">{t('my.noTickets')}</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 text-center">
                  <div className="text-2xl font-black text-blue-600 dark:text-blue-400 mb-1">
                    {ticketSummary.regular}
                  </div>
                  <div className="text-xs font-medium text-blue-600 dark:text-blue-400">{t('my.periodTicket')}</div>
                </div>
                <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-4 text-center">
                  <div className="text-2xl font-black text-purple-600 dark:text-purple-400 mb-1">
                    {ticketSummary.popup}
                  </div>
                  <div className="text-xs font-medium text-purple-600 dark:text-purple-400">{t('my.countTicket')}</div>
                </div>
                <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4 text-center">
                  <div className="text-2xl font-black text-amber-600 dark:text-amber-400 mb-1">
                    {ticketSummary.workshop}
                  </div>
                  <div className="text-xs font-medium text-amber-600 dark:text-amber-400">{t('my.workshopTicket')}</div>
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
                  <h2 className="text-base font-bold text-black dark:text-white">{t('my.myBookings')}</h2>
                  {totalUpcoming > 0 && (
                    <span className="px-2 py-0.5 text-xs font-bold bg-primary/10 dark:bg-[#CCFF00]/20 text-primary dark:text-[#CCFF00] rounded-full">
                      {totalUpcoming}{language === 'ko' ? '건' : ''}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => router.push('/my/bookings')}
                  className="text-sm text-primary dark:text-[#CCFF00] font-medium flex items-center gap-1"
                >
                  {t('common.viewAll')} <ChevronRight size={16} />
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
              ) : dataError ? (
                <div className="text-center py-6">
                  <p className="text-neutral-500 text-sm mb-3">
                    {language === 'en' ? 'Failed to load bookings' : '예약 정보를 불러오지 못했습니다'}
                  </p>
                  <button
                    onClick={() => loadData()}
                    className="inline-flex items-center gap-1.5 text-sm text-primary dark:text-[#CCFF00] font-medium"
                  >
                    <RefreshCw size={14} />
                    {language === 'en' ? 'Retry' : '다시 시도'}
                  </button>
                </div>
              ) : !nextClass ? (
                <div className="text-center py-6">
                  <Calendar size={40} className="text-neutral-300 dark:text-neutral-700 mx-auto mb-2" />
                  <p className="text-neutral-500 text-sm">{t('my.noBookings')}</p>
                  <button
                    onClick={() => router.push('/search')}
                    className="mt-3 text-sm text-primary dark:text-[#CCFF00] font-medium"
                  >
                    {t('my.findClasses')}
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
                      <span className="text-xs font-bold text-primary dark:text-[#CCFF00]">{t('my.nextClass')}</span>
                    </div>
                    <div className="font-bold text-black dark:text-white text-lg mb-2">
                      {nextClass.className}
                    </div>
                    <div className="flex items-center justify-between">
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
                      <button
                        onClick={() => {
                          setQrBookingId(nextClass.id);
                          setQrBookingInfo({
                            className: nextClass.className,
                            academyName: nextClass.academyName,
                            startTime: nextClass.startTime,
                          });
                          setIsQrModalOpen(true);
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-primary dark:bg-[#CCFF00] text-white dark:text-black text-xs font-bold rounded-lg hover:opacity-90 transition-opacity flex-shrink-0"
                      >
                        <QrCode size={14} />
                        QR 출석
                      </button>
                    </div>
                  </div>

                  {/* 이번 주 일정 미니 캘린더 */}
                  {weekSchedule.length > 0 && (
                    <div>
                      <div className="text-xs font-medium text-neutral-500 mb-2">{t('my.thisWeek')}</div>
                      <div className="grid grid-cols-7 gap-1">
                        {weekSchedule.map((day, idx) => (
                          <button
                            key={idx}
                            onClick={() => router.push('/my/bookings')}
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
              <span className="flex-1 text-left font-medium text-black dark:text-white">{t('my.paymentHistory')}</span>
              <ChevronRight size={18} className="text-neutral-400" />
            </button>
            <button
              onClick={() => onNavigate?.('FAQ')}
              className="w-full flex items-center gap-4 p-4 border-b border-neutral-100 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
            >
              <div className="w-10 h-10 rounded-xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center">
                <HelpCircle size={20} className="text-neutral-600 dark:text-neutral-400" />
              </div>
              <span className="flex-1 text-left font-medium text-black dark:text-white">{t('my.faq')}</span>
              <ChevronRight size={18} className="text-neutral-400" />
            </button>
            <button
              onClick={() => onNavigate?.('NOTICES')}
              className="w-full flex items-center gap-4 p-4 border-b border-neutral-100 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
            >
              <div className="w-10 h-10 rounded-xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center">
                <Bell size={20} className="text-neutral-600 dark:text-neutral-400" />
              </div>
              <span className="flex-1 text-left font-medium text-black dark:text-white">{t('my.notices')}</span>
              <ChevronRight size={18} className="text-neutral-400" />
            </button>
            <button
              onClick={() => onNavigate?.('SETTINGS')}
              className="w-full flex items-center gap-4 p-4 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
            >
              <div className="w-10 h-10 rounded-xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center">
                <Settings size={20} className="text-neutral-600 dark:text-neutral-400" />
              </div>
              <span className="flex-1 text-left font-medium text-black dark:text-white">{t('my.settings')}</span>
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

      {/* QR 출석 모달 */}
      {qrBookingId && (
        <QrModal
          isOpen={isQrModalOpen}
          onClose={() => {
            setIsQrModalOpen(false);
            setQrBookingId(null);
            setQrBookingInfo(undefined);
          }}
          bookingId={qrBookingId}
          bookingInfo={qrBookingInfo}
        />
      )}
    </>
  );
};
