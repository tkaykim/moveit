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

// 디자인의 STATS 3-card 그리드용 컴포넌트
function StatCard({ value, label }: { value: number; label: string }) {
  return (
    <div className="bg-surface-2 rounded-[10px] py-4 px-2 flex flex-col items-center justify-center min-h-[80px]">
      <div className="font-mono text-[24px] font-semibold leading-none text-text tracking-[-0.02em]">
        {value}
      </div>
      <div className="text-[11px] text-text-3 mt-1.5 text-center">{label}</div>
    </div>
  );
}

// 디자인의 clean list row — 좌측 아이콘 / 라벨 / 우측 chevron, divider로 구분
function MenuRow({
  icon: Icon,
  label,
  onClick,
  divider = true,
}: {
  icon: any;
  label: string;
  onClick?: () => void;
  divider?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 py-3.5 px-1 hover:bg-surface-2 transition-colors ${divider ? 'border-b border-border' : ''}`}
    >
      <Icon size={18} className="text-text-3 shrink-0" />
      <span className="flex-1 text-left text-[14px] text-text">{label}</span>
      <ChevronRight size={16} className="text-text-4 shrink-0" />
    </button>
  );
}

export const MyPageView = ({ onNavigate }: MyPageViewProps) => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, profile, isInstructor, loading: authLoading, refreshProfile } = useAuth();
  const profileRefreshDoneRef = useRef(false);
  const { t, language } = useLocale();
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  // 쿼리 ?auth=open 또는 ?tab=signup/login 이면 로그인 모달 자동 오픈.
  // B-3 (2026-04-21): 비회원 결제 성공 화면의 가입 CTA가 /my?tab=signup&email=...&name=...&phone=...
  // 로 이동하므로 해당 쿼리 진입 시 가입 탭을 연 상태로 프리필 전달.
  useEffect(() => {
    if (!user && searchParams) {
      const authQ = searchParams.get('auth');
      const tabQ = searchParams.get('tab');
      if (authQ === 'open' || tabQ === 'signup' || tabQ === 'login') {
        setIsAuthModalOpen(true);
      }
    }
  }, [searchParams, user]);

  const authInitialTab: 'login' | 'signup' = searchParams?.get('tab') === 'signup' ? 'signup' : 'login';
  const authInitialEmail = searchParams?.get('email') || undefined;
  const authInitialName = searchParams?.get('name') || undefined;
  const authInitialPhone = searchParams?.get('phone') || undefined;

  // 로그인된 상태인데 instructor_id가 없으면 프로필 재조회 (강사 연결 반영)
  useEffect(() => {
    if (!user || authLoading || profileRefreshDoneRef.current) return;
    if (profile && profile.instructor_id) return;
    profileRefreshDoneRef.current = true;
    refreshProfile();
  }, [user, authLoading, profile?.instructor_id, refreshProfile]);

  // 로그인 후 비회원 시절 예약을 현재 사용자에 매핑 (1회). 연동 완료 후 loadData 호출해 레이스 제거.
  const linkGuestDoneRef = useRef(false);
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

  // 데이터 로드 effect — 비회원 예약 연동(link-guest-bookings)을 먼저 수행한 뒤 loadData 호출해 첫 로드에서 연동된 예약이 보이도록 함
  useEffect(() => {
    mountedRef.current = true;

    if (!user) {
      linkGuestDoneRef.current = false;
      setTicketSummary({ regular: 0, popup: 0, workshop: 0, total: 0 });
      setNextClass(null);
      setWeekSchedule([]);
      setTotalUpcoming(0);
      setLoading(false);
      setDataError(false);
      return;
    }

    let cancelled = false;
    (async () => {
      if (!linkGuestDoneRef.current) {
        linkGuestDoneRef.current = true;
        try {
          await fetchWithAuth('/api/me/link-guest-bookings', { method: 'POST' });
        } catch (_) {
          // 매핑 실패가 화면 로딩을 막지 않음
        }
      }
      if (!cancelled) loadData();
    })();

    return () => {
      mountedRef.current = false;
      cancelled = true;
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
      <div className="min-h-screen bg-bg pb-24">
        {/* 헤더 — 토글만 우상단 */}
        <div className="px-5 pt-6 pb-2 flex items-center justify-end gap-3">
          {user && (
            <button
              onClick={() => router.push('/notifications')}
              className="relative p-1 text-text-3 active:opacity-70"
            >
              <Bell size={18} />
              <NotificationBadge />
            </button>
          )}
          <LanguageToggle />
          <ThemeToggle />
          {user && <UserMenu />}
        </div>

        {/* 프로필 — 중앙 큰 아바타 (디자인 패턴) */}
        <div className="px-5 pt-2 pb-6">
          {authLoading ? (
            <div className="flex flex-col items-center gap-3">
              <div className="w-20 h-20 rounded-full bg-surface-3 animate-pulse" />
              <div className="h-6 bg-surface-3 rounded w-24 animate-pulse" />
              <div className="h-4 bg-surface-3 rounded w-32 animate-pulse" />
            </div>
          ) : user ? (
            <button
              onClick={() => onNavigate?.('SETTINGS')}
              className="w-full flex flex-col items-center gap-2"
            >
              <div className="w-20 h-20 rounded-full bg-surface-2 border border-border flex items-center justify-center overflow-hidden">
                {profileImage ? (
                  <img src={profileImage} alt={displayName} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-[28px] font-semibold text-text-3 tracking-[-0.02em]">
                    {displayName?.[0] ?? '·'}
                  </span>
                )}
              </div>
              <h2 className="text-[18px] font-semibold tracking-[-0.02em] text-text mt-1">{displayName}</h2>
              {user.email && (
                <p className="text-[13px] text-text-3">{user.email}</p>
              )}
            </button>
          ) : (
            <button
              onClick={() => setIsAuthModalOpen(true)}
              className="w-full flex items-center gap-3 border border-dashed border-border-strong rounded-[10px] p-4 hover:bg-surface-2 transition-colors"
            >
              <div className="w-12 h-12 rounded-full bg-surface-2 flex items-center justify-center">
                <User className="text-text-4" size={20} />
              </div>
              <div className="flex-1 text-left">
                <h2 className="text-[14px] font-semibold text-text">{t('my.login')}</h2>
                <p className="text-[12px] text-text-3 mt-0.5">{t('my.loginForMore')}</p>
              </div>
              <ChevronRight className="text-text-4" size={18} />
            </button>
          )}
        </div>

        {/* STATS — 디자인의 3-card 그리드 */}
        {user && (
          <div className="px-5 mb-3">
            <div className="section-label mb-2">STATS</div>
            <div className="grid grid-cols-3 gap-2">
              <StatCard
                value={totalUpcoming}
                label={language === 'en' ? 'upcoming' : '예약'}
              />
              <StatCard
                value={ticketSummary.total}
                label={language === 'en' ? 'passes' : '수강권'}
              />
              <StatCard
                value={weekSchedule.reduce((s, d) => s + d.count, 0)}
                label={language === 'en' ? 'this week' : '이번주'}
              />
            </div>
          </div>
        )}

        {/* 다음 수업 — 디자인 패턴 mini 카드 */}
        {user && nextClass && (
          <div className="px-5 mb-3">
            <div className="section-label mb-2">{language === 'en' ? 'NEXT CLASS' : '다음 수업'}</div>
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
              className="w-full bg-surface border border-border rounded-[10px] p-3.5 flex items-center gap-3 hover:bg-surface-2 transition-colors text-left"
            >
              <div className="w-11 h-11 rounded-md bg-accent-soft text-accent flex items-center justify-center shrink-0">
                <Play size={16} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[14px] font-semibold text-text truncate tracking-[-0.01em]">{nextClass.className}</div>
                <div className="font-mono text-[11px] text-text-3 mt-0.5 truncate">
                  {formatDateTime(nextClass.startTime)}
                  {nextClass.academyName && <> · {nextClass.academyName}</>}
                </div>
              </div>
              <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-text text-bg text-[10px] font-semibold shrink-0">
                <QrCode size={12} /> QR
              </div>
            </button>
          </div>
        )}

        {/* 메뉴 — 디자인의 clean list rows */}
        <div className="px-5 mt-2">
          {user && isInstructor && (
            <MenuRow
              icon={BookOpen}
              label={language === 'en' ? 'My Classes (Instructor)' : '내 수업 관리 (강사용)'}
              onClick={() => router.push('/instructor-dashboard')}
            />
          )}
          {user && (
            <MenuRow
              icon={Calendar}
              label={language === 'en' ? 'My Bookings' : '내 예약 내역'}
              onClick={() => router.push('/my/bookings')}
            />
          )}
          <MenuRow
            icon={CreditCard}
            label={t('my.paymentHistory')}
            onClick={() => onNavigate?.('PAYMENT_HISTORY')}
          />
          <MenuRow
            icon={Bell}
            label={t('my.notices')}
            onClick={() => onNavigate?.('NOTICES')}
          />
          <MenuRow
            icon={HelpCircle}
            label={t('my.faq')}
            onClick={() => onNavigate?.('FAQ')}
          />
          <MenuRow
            icon={Settings}
            label={t('my.settings')}
            onClick={() => onNavigate?.('SETTINGS')}
            divider={false}
          />
        </div>

        {/* 앱 정보 */}
        <div className="px-5 mt-8 mb-4">
          <div className="text-center font-mono text-[10px] uppercase tracking-[0.1em] text-text-4">
            MOVE.IT v1.0.0
          </div>
        </div>
      </div>

      <MyTab
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        initialTab={authInitialTab}
        initialEmail={authInitialEmail}
        initialName={authInitialName}
        initialPhone={authInitialPhone}
      />

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
