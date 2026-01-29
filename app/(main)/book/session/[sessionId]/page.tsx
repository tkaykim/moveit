"use client";

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getSupabaseClient } from '@/lib/utils/supabase-client';
import { ChevronLeft, Calendar, Clock, MapPin, User, Users, Wallet, CheckCircle, CreditCard, Building2, LogIn, AlertCircle, Ticket, Gift, CalendarDays, ChevronRight, Loader2 } from 'lucide-react';
import { formatKSTTime, formatKSTDate } from '@/lib/utils/kst-time';
import { MyTab } from '@/components/auth/MyTab';
import { TicketRechargeModal } from '@/components/modals/ticket-recharge-modal';

interface SessionData {
  id: string;
  start_time: string;
  end_time: string;
  max_students: number;
  current_students: number;
  is_canceled: boolean;
  classes: {
    id: string;
    title: string;
    genre: string;
    difficulty_level: string;
    price: number;
    academy_id: string;
    class_type: string | null;
    access_config: {
      allowCoupon?: boolean;
      allowRegularTicket?: boolean;
      allowPopup?: boolean;
    } | null;
    academies: {
      id: string;
      name_kr: string;
      name_en: string;
      address: string;
    };
  };
  instructors: {
    name_kr: string;
    name_en: string;
  };
  halls: {
    name: string;
  };
}

interface UserTicket {
  id: string;
  ticket_id: string;
  remaining_count: number | null;
  start_date: string | null;
  expiry_date: string | null;
  tickets: {
    id: string;
    name: string;
    is_general: boolean;
    is_coupon: boolean;
    academy_id: string | null;
    ticket_type: 'PERIOD' | 'COUNT' | null;
  };
}

interface PurchasableTicket {
  id: string;
  name: string;
  price: number;
  ticket_type: 'PERIOD' | 'COUNT';
  total_count?: number;
  valid_days?: number;
  is_general: boolean;
  is_coupon: boolean;
}

type PaymentMethod = 'ticket' | 'purchase' | 'onsite';

export default function SessionBookingPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.sessionId as string;

  const [session, setSession] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [error, setError] = useState('');

  // 결제 방법
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('onsite');

  // 보유 수강권 (ticket_classes에 연결된 것만)
  const [userTickets, setUserTickets] = useState<UserTicket[]>([]);
  const [selectedUserTicketId, setSelectedUserTicketId] = useState<string>('');
  const [loadingUserTickets, setLoadingUserTickets] = useState(false);

  // 구매 가능한 수강권 (ticket_classes에 연결된 것만)
  const [purchasableTickets, setPurchasableTickets] = useState<PurchasableTicket[]>([]);
  const [selectedPurchaseTicketId, setSelectedPurchaseTicketId] = useState<string>('');
  const [loadingPurchasableTickets, setLoadingPurchasableTickets] = useState(false);
  const [purchasePaymentType, setPurchasePaymentType] = useState<'card' | 'account'>('card');

  // 현장 결제 (게스트)
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');

  // 모달
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isTicketPurchaseModalOpen, setIsTicketPurchaseModalOpen] = useState(false);

  // 종료된 수업일 때 같은 클래스의 다음 가능한 날짜 목록
  const [upcomingSessions, setUpcomingSessions] = useState<Array<{
    id: string;
    start_time: string;
    end_time: string;
    current_students: number;
    max_students: number;
    is_canceled: boolean;
    instructors: { name_kr: string; name_en: string } | null;
    halls: { name: string } | null;
  }>>([]);
  const [loadingUpcoming, setLoadingUpcoming] = useState(false);

  useEffect(() => {
    loadSessionData();
    checkAuth();
  }, [sessionId]);

  const loadSessionData = async () => {
    const supabase = getSupabaseClient();
    if (!supabase) return;

    try {
      const { data, error } = await (supabase as any)
        .from('schedules')
        .select(`
          *,
          classes (
            id, title, genre, difficulty_level, price, academy_id, class_type, access_config,
            academies (id, name_kr, name_en, address)
          ),
          instructors (name_kr, name_en),
          halls (name)
        `)
        .eq('id', sessionId)
        .single();

      if (error) throw error;
      setSession(data);
    } catch (err) {
      console.error('Error loading session:', err);
      setError('세션 정보를 불러올 수 없습니다.');
    } finally {
      setLoading(false);
    }
  };

  const checkAuth = async () => {
    const supabase = getSupabaseClient();
    if (!supabase) return;

    const { data: { user: authUser } } = await (supabase as any).auth.getUser();
    setUser(authUser);
  };

  // 종료된 수업일 때 같은 클래스의 다음 가능한 날짜(세션) 로드
  const loadUpcomingSessions = async (classId: string) => {
    const supabase = getSupabaseClient();
    if (!supabase) return;

    setLoadingUpcoming(true);
    try {
      const now = new Date().toISOString();
      const { data, error } = await (supabase as any)
        .from('schedules')
        .select(`
          id,
          start_time,
          end_time,
          current_students,
          max_students,
          is_canceled,
          instructors (name_kr, name_en),
          halls (name)
        `)
        .eq('class_id', classId)
        .gte('start_time', now)
        .eq('is_canceled', false)
        .order('start_time', { ascending: true })
        .limit(8);

      if (error) throw error;
      setUpcomingSessions(data || []);
    } catch (err) {
      console.error('Error loading upcoming sessions:', err);
      setUpcomingSessions([]);
    } finally {
      setLoadingUpcoming(false);
    }
  };

  // 세션 로드 후: 종료된 수업이면 다음 가능한 날짜 로드
  useEffect(() => {
    if (session && new Date(session.start_time) < new Date() && session.classes?.id) {
      loadUpcomingSessions(session.classes.id);
    } else {
      setUpcomingSessions([]);
    }
  }, [session?.id, session?.classes?.id, session?.start_time]);

  // 세션 로드 후 사용자 수강권 및 구매 가능 수강권 로드
  // 데모 모드: user가 없어도 API에서 데모 사용자로 처리하므로 loadUserTickets 호출
  useEffect(() => {
    if (session?.classes?.id) {
      loadUserTickets();
      loadPurchasableTickets();
    }
  }, [session?.classes?.id, user]);

  // 사용자 보유 수강권 로드 (ticket_classes에 연결된 것만 + allowCoupon 적용)
  // 데모 모드: user가 없어도 API에서 데모 사용자로 처리
  const loadUserTickets = async () => {
    if (!session?.classes?.id) return;

    setLoadingUserTickets(true);
    try {
      const classId = session.classes.id;
      const academyId = session.classes.academy_id;
      const allowCoupon = session.classes.access_config?.allowCoupon === true || session.classes.access_config?.allowPopup === true;

      const queryParams = new URLSearchParams();
      if (academyId) queryParams.append('academyId', academyId);
      if (classId) queryParams.append('classId', classId);
      if (allowCoupon) queryParams.append('allowCoupon', 'true');

      const response = await fetch(`/api/user-tickets?${queryParams.toString()}`);
      if (response.ok) {
        const result = await response.json();
        // 기간권(remaining_count === null) 또는 횟수권(remaining_count > 0) 모두 포함
        const ticketData: UserTicket[] = (result.data || []).filter((item: any) => 
          item.remaining_count === null || item.remaining_count > 0
        );

        setUserTickets(ticketData);

        // 수강권이 있으면 기본값으로 선택
        if (ticketData.length > 0) {
          setSelectedUserTicketId(ticketData[0].id);
          setPaymentMethod('ticket');
        }
      }
    } catch (err) {
      console.error('Error loading user tickets:', err);
    } finally {
      setLoadingUserTickets(false);
    }
  };

  // 구매 가능한 수강권 로드 (ticket_classes에 연결된 것만 + allowCoupon 적용)
  const loadPurchasableTickets = async () => {
    if (!session?.classes?.id) return;

    setLoadingPurchasableTickets(true);
    try {
      const supabase = getSupabaseClient();
      if (!supabase) return;

      const classId = session.classes.id;
      const allowCoupon = session.classes.access_config?.allowCoupon === true || session.classes.access_config?.allowPopup === true;

      // 1. ticket_classes에서 이 클래스와 연결된 ticket_id 목록 조회
      const { data: ticketClassesData } = await (supabase as any)
        .from('ticket_classes')
        .select('ticket_id')
        .eq('class_id', classId);

      const linkedTicketIds = (ticketClassesData || []).map((tc: any) => tc.ticket_id);

      if (linkedTicketIds.length === 0 && !allowCoupon) {
        setPurchasableTickets([]);
        setLoadingPurchasableTickets(false);
        return;
      }

      // 2. 연결된 수강권 + (allowCoupon이면 쿠폰) 조회 (공개 수강권만: 비공개는 유저 구매 불가)
      let query = (supabase as any)
        .from('tickets')
        .select('id, name, price, ticket_type, total_count, valid_days, is_general, is_coupon, academy_id')
        .eq('is_on_sale', true)
        .eq('academy_id', session.classes.academy_id)
        .or('is_public.eq.true,is_public.is.null');

      const { data: ticketsData, error } = await query;

      if (error) throw error;

      // 필터링: ticket_classes에 연결되었거나, 쿠폰이면서 allowCoupon=true
      const filteredTickets = (ticketsData || []).filter((ticket: any) => {
        // ticket_classes에 연결된 수강권
        if (linkedTicketIds.includes(ticket.id)) return true;

        // 쿠폰이면서 allowCoupon=true
        if (ticket.is_coupon && allowCoupon) return true;

        return false;
      });

      // 정렬: 연결된 수강권 우선, 그 다음 쿠폰
      filteredTickets.sort((a: any, b: any) => {
        const aLinked = linkedTicketIds.includes(a.id);
        const bLinked = linkedTicketIds.includes(b.id);
        if (aLinked && !bLinked) return -1;
        if (!aLinked && bLinked) return 1;
        if (a.is_coupon && !b.is_coupon) return 1;
        if (!a.is_coupon && b.is_coupon) return -1;
        return 0;
      });

      setPurchasableTickets(filteredTickets);
      if (filteredTickets.length > 0) {
        setSelectedPurchaseTicketId(filteredTickets[0].id);
      }
    } catch (err) {
      console.error('Error loading purchasable tickets:', err);
    } finally {
      setLoadingPurchasableTickets(false);
    }
  };

  // 수강권으로 예약
  const handleTicketBooking = async () => {
    if (!selectedUserTicketId) {
      setError('수강권을 선택해주세요.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const response = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scheduleId: sessionId,
          userTicketId: selectedUserTicketId,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || '예약에 실패했습니다.');
      }

      router.push(`/book/session/${sessionId}/success?type=ticket`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // 수강권 구매 후 예약
  const handlePurchaseBooking = async () => {
    if (!selectedPurchaseTicketId) {
      setError('수강권을 선택해주세요.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      // 1. 수강권 구매
      const purchaseResponse = await fetch('/api/tickets/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticketId: selectedPurchaseTicketId,
          paymentMethod: purchasePaymentType,
        }),
      });

      if (!purchaseResponse.ok) {
        const data = await purchaseResponse.json();
        throw new Error(data.error || '수강권 구매에 실패했습니다.');
      }

      const purchaseResult = await purchaseResponse.json();
      const userTicketId = purchaseResult.data?.id;

      if (!userTicketId) {
        throw new Error('수강권 구매 후 정보를 가져올 수 없습니다.');
      }

      // 2. 구매한 수강권으로 예약 (카드결제인 경우 데모 결제 상태로 전달)
      const bookingResponse = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scheduleId: sessionId,
          userTicketId: userTicketId,
          paymentMethod: purchasePaymentType === 'card' ? 'CARD_DEMO' : purchasePaymentType, // 데모 결제 표시
          paymentStatus: purchasePaymentType === 'card' ? 'COMPLETED' : 'PENDING', // 카드결제는 데모로 즉시 완료
        }),
      });

      if (!bookingResponse.ok) {
        const data = await bookingResponse.json();
        throw new Error(data.error || '예약에 실패했습니다.');
      }

      router.push(`/book/session/${sessionId}/success?type=purchase`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // 현장 결제 (게스트 예약)
  const handleOnsiteBooking = async () => {
    if (!guestName.trim()) {
      setError('이름을 입력해주세요.');
      return;
    }
    if (!guestPhone.trim()) {
      setError('연락처를 입력해주세요.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const response = await fetch('/api/bookings/guest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scheduleId: sessionId,
          guestName: guestName.trim(),
          guestPhone: guestPhone.trim(),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || '예약에 실패했습니다.');
      }

      router.push(`/book/session/${sessionId}/success?type=guest&name=${encodeURIComponent(guestName)}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = () => {
    if (paymentMethod === 'ticket') {
      handleTicketBooking();
    } else if (paymentMethod === 'purchase') {
      handlePurchaseBooking();
    } else {
      handleOnsiteBooking();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-neutral-950">
        <div className="text-neutral-500">로딩 중...</div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white dark:bg-neutral-950 p-6">
        <div className="text-red-500 text-lg mb-4">세션을 찾을 수 없습니다.</div>
        <button
          onClick={() => router.push('/')}
          className="px-6 py-2 bg-neutral-200 dark:bg-neutral-800 rounded-lg text-neutral-700 dark:text-neutral-300"
        >
          홈으로 돌아가기
        </button>
      </div>
    );
  }

  const isFull = (session.current_students || 0) >= (session.max_students || 20);
  const isPast = new Date(session.start_time) < new Date();
  const isCanceled = session.is_canceled;
  const canBook = !isFull && !isPast && !isCanceled;
  const allowCoupon = session.classes.access_config?.allowCoupon === true || session.classes.access_config?.allowPopup === true;

  // 선택된 구매 수강권 정보
  const selectedPurchaseTicket = purchasableTickets.find(t => t.id === selectedPurchaseTicketId);

  return (
    <div className="min-h-screen bg-white dark:bg-neutral-950 pt-12 px-5 pb-32 relative">
      {/* 예약/구매 처리 중 로딩 오버레이 */}
      {submitting && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/50 dark:bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl p-8 flex flex-col items-center gap-4 min-w-[240px]">
            <Loader2 size={40} className="text-primary dark:text-[#CCFF00] animate-spin" />
            <p className="text-base font-semibold text-black dark:text-white text-center">
              {paymentMethod === 'purchase' ? '수강권 구매 및 예약 중' : paymentMethod === 'ticket' ? '예약 처리 중' : '예약 신청 중'}
            </p>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 text-center">
              잠시만 기다려주세요.
            </p>
          </div>
        </div>
      )}

      {/* 헤더 */}
      <div className="flex items-center gap-4 mb-8">
        <button onClick={() => router.back()} className="p-2 -ml-2">
          <ChevronLeft className="text-black dark:text-white" />
        </button>
        <h2 className="text-xl font-bold text-black dark:text-white">수업 예약</h2>
      </div>

      {/* 세션 정보 카드 */}
      <div className="bg-neutral-100 dark:bg-neutral-900 rounded-2xl p-5 mb-6 border border-neutral-200 dark:border-neutral-800">
        <div className="text-xs text-neutral-500 mb-1">
          {session.classes?.academies?.name_kr || session.classes?.academies?.name_en}
        </div>
        <h3 className="text-xl font-black text-black dark:text-white mb-4">
          {session.classes?.title}
        </h3>

        <div className="space-y-3 text-sm text-neutral-600 dark:text-neutral-400">
          <div className="flex items-center gap-3">
            <User size={18} className="text-neutral-400" />
            <span className="font-medium">{session.instructors?.name_kr || session.instructors?.name_en || '강사 미정'}</span>
          </div>
          <div className="flex items-center gap-3">
            <Calendar size={18} className="text-neutral-400" />
            <span>{formatKSTDate(new Date(session.start_time))}</span>
          </div>
          <div className="flex items-center gap-3">
            <Clock size={18} className="text-neutral-400" />
            <span>
              {formatKSTTime(session.start_time)} - {formatKSTTime(session.end_time)}
            </span>
          </div>
          {session.halls && (
            <div className="flex items-center gap-3">
              <MapPin size={18} className="text-neutral-400" />
              <span>{session.halls.name}</span>
            </div>
          )}
          <div className="flex items-center gap-3">
            <Users size={18} className="text-neutral-400" />
            <span className={isFull ? 'text-red-500 font-medium' : ''}>
              {session.current_students || 0} / {session.max_students || 20}명
              {isFull && ' (마감)'}
            </span>
          </div>
        </div>
      </div>

      {/* 예약 불가 상태 */}
      {!canBook && (
        <div className="mb-6 space-y-4">
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 text-center">
            <span className="text-red-600 dark:text-red-400 font-medium">
              {isCanceled ? '취소된 수업입니다.' : isPast ? '이미 종료된 수업입니다.' : '정원이 마감되었습니다.'}
            </span>
          </div>

          {/* 종료된 수업일 때만: 다음 날짜 예약 유도 */}
          {isPast && session?.classes?.id && (
            <div className="bg-primary/5 dark:bg-[#CCFF00]/5 border border-primary/30 dark:border-[#CCFF00]/30 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <CalendarDays className="text-primary dark:text-[#CCFF00] flex-shrink-0" size={20} />
                <h4 className="font-bold text-black dark:text-white">다른 날짜에 예약하기</h4>
              </div>
              <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4">
                같은 수업의 다음 일정을 선택해 예약할 수 있습니다.
              </p>
              {loadingUpcoming ? (
                <div className="text-center py-6 text-neutral-500 text-sm">다음 일정 불러오는 중...</div>
              ) : upcomingSessions.length === 0 ? (
                <p className="text-sm text-neutral-500 dark:text-neutral-400 text-center py-4">
                  예약 가능한 다음 일정이 없습니다.
                </p>
              ) : (
                <div className="space-y-2">
                  {upcomingSessions.map((s) => {
                    const full = (s.current_students || 0) >= (s.max_students || 20);
                    return (
                      <button
                        key={s.id}
                        onClick={() => router.push(`/book/session/${s.id}`)}
                        disabled={full}
                        className={`w-full flex items-center justify-between gap-3 rounded-xl p-3 text-left border-2 transition-colors ${
                          full
                            ? 'bg-neutral-100 dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 opacity-60 cursor-not-allowed'
                            : 'bg-white dark:bg-neutral-900 border-primary/40 dark:border-[#CCFF00]/40 hover:border-primary dark:hover:border-[#CCFF00] hover:bg-primary/5 dark:hover:bg-[#CCFF00]/5'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <Calendar size={18} className="text-neutral-500 flex-shrink-0" />
                          <div className="min-w-0">
                            <div className="font-medium text-black dark:text-white truncate">
                              {formatKSTDate(new Date(s.start_time))}
                            </div>
                            <div className="text-xs text-neutral-500 flex items-center gap-2">
                              <span>{formatKSTTime(s.start_time)}–{formatKSTTime(s.end_time)}</span>
                              <span>·</span>
                              <span>{s.current_students || 0}/{s.max_students || 20}명</span>
                              {full && <span className="text-red-500">마감</span>}
                            </div>
                          </div>
                        </div>
                        {!full && (
                          <ChevronRight size={18} className="text-primary dark:text-[#CCFF00] flex-shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 예약 폼 */}
      {canBook && (
        <div className="space-y-6">
          {/* 비회원 안내 */}
          {!user && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <LogIn className="text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" size={20} />
                <div className="flex-1">
                  <p className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-1">
                    로그인하시면 수강권을 사용할 수 있습니다
                  </p>
                  <p className="text-xs text-blue-700 dark:text-blue-400 mb-3">
                    보유한 수강권으로 빠르게 예약하세요.
                  </p>
                  <button
                    onClick={() => setIsAuthModalOpen(true)}
                    className="text-xs font-bold text-blue-700 dark:text-blue-300 underline"
                  >
                    로그인하기 →
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 결제 방법 선택 */}
          <div className="space-y-3">
            <h4 className="font-bold text-black dark:text-white">결제 방법</h4>

            {/* 1. 수강권 사용 (로그인 + 보유 수강권 있을 때만) */}
            {user && (
              <button
                onClick={() => setPaymentMethod('ticket')}
                disabled={userTickets.length === 0}
                className={`w-full rounded-xl p-4 flex justify-between items-center border-2 transition-colors text-left ${
                  paymentMethod === 'ticket'
                    ? 'bg-primary/10 dark:bg-[#CCFF00]/10 border-primary dark:border-[#CCFF00]'
                    : userTickets.length === 0
                    ? 'bg-neutral-50 dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 opacity-50'
                    : 'bg-neutral-50 dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    paymentMethod === 'ticket' ? 'bg-primary/20 dark:bg-[#CCFF00]/20' : 'bg-neutral-200 dark:bg-neutral-800'
                  }`}>
                    <Wallet className={paymentMethod === 'ticket' ? 'text-primary dark:text-[#CCFF00]' : 'text-neutral-500'} size={20} />
                  </div>
                  <div>
                    <div className="text-black dark:text-white font-bold">수강권 사용</div>
                    <div className="text-xs text-neutral-500">
                      {loadingUserTickets ? '로딩 중...' : userTickets.length > 0 ? `보유 ${userTickets.length}개` : '사용 가능한 수강권 없음'}
                    </div>
                  </div>
                </div>
                {paymentMethod === 'ticket' && userTickets.length > 0 && (
                  <div className="w-5 h-5 rounded-full bg-primary dark:bg-[#CCFF00] flex items-center justify-center">
                    <CheckCircle size={14} className="text-black" />
                  </div>
                )}
                {userTickets.length === 0 && (
                  <AlertCircle size={18} className="text-neutral-400" />
                )}
              </button>
            )}

            {/* 2. 수강권 구매 후 예약 (로그인 + 구매 가능 수강권 있을 때) */}
            {user && purchasableTickets.length > 0 && (
              <button
                onClick={() => setPaymentMethod('purchase')}
                className={`w-full rounded-xl p-4 flex justify-between items-center border-2 transition-colors text-left ${
                  paymentMethod === 'purchase'
                    ? 'bg-primary/10 dark:bg-[#CCFF00]/10 border-primary dark:border-[#CCFF00]'
                    : 'bg-neutral-50 dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    paymentMethod === 'purchase' ? 'bg-primary/20 dark:bg-[#CCFF00]/20' : 'bg-neutral-200 dark:bg-neutral-800'
                  }`}>
                    <CreditCard className={paymentMethod === 'purchase' ? 'text-primary dark:text-[#CCFF00]' : 'text-neutral-500'} size={20} />
                  </div>
                  <div>
                    <div className="text-black dark:text-white font-bold">수강권 구매 후 예약</div>
                    <div className="text-xs text-neutral-500">
                      {loadingPurchasableTickets ? '로딩 중...' : `${purchasableTickets.length}개 수강권 구매 가능`}
                    </div>
                  </div>
                </div>
                {paymentMethod === 'purchase' && (
                  <div className="w-5 h-5 rounded-full bg-primary dark:bg-[#CCFF00] flex items-center justify-center">
                    <CheckCircle size={14} className="text-black" />
                  </div>
                )}
              </button>
            )}

            {/* 3. 현장 결제 */}
            <button
              onClick={() => setPaymentMethod('onsite')}
              className={`w-full rounded-xl p-4 flex justify-between items-center border-2 transition-colors text-left ${
                paymentMethod === 'onsite'
                  ? 'bg-primary/10 dark:bg-[#CCFF00]/10 border-primary dark:border-[#CCFF00]'
                  : 'bg-neutral-50 dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  paymentMethod === 'onsite' ? 'bg-primary/20 dark:bg-[#CCFF00]/20' : 'bg-neutral-200 dark:bg-neutral-800'
                }`}>
                  <Building2 className={paymentMethod === 'onsite' ? 'text-primary dark:text-[#CCFF00]' : 'text-neutral-500'} size={20} />
                </div>
                <div>
                  <div className="text-black dark:text-white font-bold">현장 결제</div>
                  <div className="text-xs text-neutral-500">방문 시 결제</div>
                </div>
              </div>
              {paymentMethod === 'onsite' && (
                <div className="w-5 h-5 rounded-full bg-primary dark:bg-[#CCFF00] flex items-center justify-center">
                  <CheckCircle size={14} className="text-black" />
                </div>
              )}
            </button>
          </div>

          {/* 수강권 선택 (수강권 사용 선택 시) */}
          {paymentMethod === 'ticket' && userTickets.length > 0 && (
            <div className="space-y-3">
              <h4 className="font-bold text-black dark:text-white">보유 수강권 선택</h4>
              {userTickets.map((ut) => {
                const isCoupon = ut.tickets?.is_coupon === true;
                const isPeriodTicket = ut.tickets?.ticket_type === 'PERIOD' || ut.remaining_count === null;
                
                // 날짜 포맷팅 함수
                const formatDate = (dateStr: string | null) => {
                  if (!dateStr) return '';
                  const date = new Date(dateStr);
                  return `${date.getMonth() + 1}/${date.getDate()}`;
                };
                
                return (
                  <button
                    key={ut.id}
                    onClick={() => setSelectedUserTicketId(ut.id)}
                    className={`w-full rounded-xl p-4 flex justify-between items-center border-2 transition-colors text-left ${
                      selectedUserTicketId === ut.id
                        ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-500'
                        : 'bg-neutral-50 dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 hover:border-neutral-300'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        isCoupon ? 'bg-orange-100 dark:bg-orange-900/30' : 
                        isPeriodTicket ? 'bg-purple-100 dark:bg-purple-900/30' : 
                        'bg-blue-100 dark:bg-blue-900/30'
                      }`}>
                        {isCoupon ? (
                          <Gift size={18} className="text-orange-600 dark:text-orange-400" />
                        ) : isPeriodTicket ? (
                          <Calendar size={18} className="text-purple-600 dark:text-purple-400" />
                        ) : (
                          <Ticket size={18} className="text-blue-600 dark:text-blue-400" />
                        )}
                      </div>
                      <div>
                        <div className="text-black dark:text-white font-medium flex items-center gap-2">
                          {ut.tickets?.name}
                          {isCoupon && (
                            <span className="text-xs px-2 py-0.5 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 rounded-full">
                              쿠폰
                            </span>
                          )}
                          {isPeriodTicket && !isCoupon && (
                            <span className="text-xs px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-full">
                              기간권
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-neutral-500">
                          {isPeriodTicket ? (
                            // 기간권: 시작일 ~ 만료일 표시
                            `${formatDate(ut.start_date)} ~ ${formatDate(ut.expiry_date)}`
                          ) : (
                            // 횟수권: 잔여 횟수 표시
                            `잔여 ${ut.remaining_count}회`
                          )}
                        </div>
                      </div>
                    </div>
                    {selectedUserTicketId === ut.id && (
                      <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center">
                        <CheckCircle size={14} className="text-white" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* 구매할 수강권 선택 (수강권 구매 선택 시) */}
          {paymentMethod === 'purchase' && (
            <div className="space-y-4">
              <h4 className="font-bold text-black dark:text-white">구매할 수강권 선택</h4>

              {loadingPurchasableTickets ? (
                <div className="text-center py-8 text-neutral-500">로딩 중...</div>
              ) : purchasableTickets.length === 0 ? (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 text-center">
                  <p className="text-sm text-amber-700 dark:text-amber-400">
                    이 수업에 사용 가능한 수강권이 없습니다.
                  </p>
                </div>
              ) : (
                <>
                  {purchasableTickets.map((ticket) => {
                    const isCoupon = ticket.is_coupon === true;
                    return (
                      <button
                        key={ticket.id}
                        onClick={() => setSelectedPurchaseTicketId(ticket.id)}
                        className={`w-full rounded-xl p-4 flex justify-between items-center border-2 transition-colors text-left ${
                          selectedPurchaseTicketId === ticket.id
                            ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-500'
                            : 'bg-neutral-50 dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 hover:border-neutral-300'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                            isCoupon ? 'bg-orange-100 dark:bg-orange-900/30' : 'bg-green-100 dark:bg-green-900/30'
                          }`}>
                            {isCoupon ? (
                              <Gift size={18} className="text-orange-600 dark:text-orange-400" />
                            ) : (
                              <Ticket size={18} className="text-green-600 dark:text-green-400" />
                            )}
                          </div>
                          <div>
                            <div className="text-black dark:text-white font-medium flex items-center gap-2">
                              {ticket.name}
                              {isCoupon && (
                                <span className="text-xs px-2 py-0.5 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 rounded-full">
                                  쿠폰
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-neutral-500">
                              {ticket.ticket_type === 'COUNT'
                                ? `${ticket.total_count}회`
                                : `${ticket.valid_days}일`}
                              {' · '}
                              <span className="font-bold text-primary dark:text-[#CCFF00]">
                                {ticket.price.toLocaleString()}원
                              </span>
                            </div>
                          </div>
                        </div>
                        {selectedPurchaseTicketId === ticket.id && (
                          <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center">
                            <CheckCircle size={14} className="text-white" />
                          </div>
                        )}
                      </button>
                    );
                  })}

                  {/* 결제 방식 선택 */}
                  <div className="pt-4 border-t border-neutral-200 dark:border-neutral-800">
                    <p className="text-sm text-neutral-500 mb-3">결제 방식</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setPurchasePaymentType('card')}
                        className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                          purchasePaymentType === 'card'
                            ? 'bg-primary dark:bg-[#CCFF00] text-black'
                            : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400'
                        }`}
                      >
                        카드 결제
                      </button>
                      <button
                        onClick={() => setPurchasePaymentType('account')}
                        className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                          purchasePaymentType === 'account'
                            ? 'bg-primary dark:bg-[#CCFF00] text-black'
                            : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400'
                        }`}
                      >
                        계좌이체
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* 현장 결제 폼 */}
          {paymentMethod === 'onsite' && (
            <div className="space-y-4">
              <h4 className="font-bold text-black dark:text-white">예약자 정보</h4>
              {!user && (
                <button
                  onClick={() => setIsAuthModalOpen(true)}
                  className="text-xs text-primary dark:text-[#CCFF00] font-medium underline mb-2"
                >
                  로그인하기
                </button>
              )}

              <div>
                <label className="block text-sm text-neutral-600 dark:text-neutral-400 mb-2">
                  이름 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  placeholder="이름을 입력하세요"
                  className="w-full px-4 py-3 rounded-xl bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-black dark:text-white placeholder-neutral-400"
                />
              </div>

              <div>
                <label className="block text-sm text-neutral-600 dark:text-neutral-400 mb-2">
                  연락처 <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  value={guestPhone}
                  onChange={(e) => setGuestPhone(e.target.value)}
                  placeholder="010-0000-0000"
                  className="w-full px-4 py-3 rounded-xl bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-black dark:text-white placeholder-neutral-400"
                />
              </div>

              <div className="text-xs text-neutral-500 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-3 rounded-lg">
                예약 후 현장에서 결제해주세요. 수업 시작 전까지 방문 부탁드립니다.
              </div>
            </div>
          )}

          {error && (
            <div className="text-red-500 text-sm bg-red-50 dark:bg-red-900/20 p-3 rounded-lg">
              {error}
            </div>
          )}
        </div>
      )}

      {/* 하단 고정 버튼 */}
      {canBook && (
        <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[420px] p-4 bg-white/95 dark:bg-neutral-950/95 backdrop-blur-lg border-t border-neutral-200 dark:border-neutral-800 z-50">
          {/* 결제 금액 표시 */}
          <div className="flex justify-between items-center mb-3">
            <span className="text-sm text-neutral-500">
              {paymentMethod === 'ticket' ? '수강권 사용' : paymentMethod === 'purchase' ? '수강권 구매' : '현장 결제'}
            </span>
            <span className="text-lg font-bold text-primary dark:text-[#CCFF00]">
              {paymentMethod === 'purchase' && selectedPurchaseTicket
                ? `${selectedPurchaseTicket.price.toLocaleString()}원`
                : paymentMethod === 'ticket'
                ? '수강권 1회 차감'
                : `${(session.classes?.price || 0).toLocaleString()}원`}
            </span>
          </div>

          <button
            onClick={handleSubmit}
            disabled={
              submitting ||
              (paymentMethod === 'ticket' && !selectedUserTicketId) ||
              (paymentMethod === 'purchase' && !selectedPurchaseTicketId)
            }
            className="w-full bg-primary dark:bg-[#CCFF00] text-black font-bold py-3.5 rounded-xl text-base shadow-lg active:scale-[0.98] transition-transform disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <Loader2 size={20} className="animate-spin flex-shrink-0" />
                <span>
                  {paymentMethod === 'purchase' ? '수강권 구매 및 예약 중...' : paymentMethod === 'ticket' ? '예약 처리 중...' : '예약 신청 중...'}
                </span>
              </>
            ) : paymentMethod === 'ticket' ? (
              '수강권으로 예약하기'
            ) : paymentMethod === 'purchase' ? (
              '수강권 구매 및 예약하기'
            ) : (
              '예약 신청하기'
            )}
          </button>
        </div>
      )}

      {/* 로그인 모달 */}
      <MyTab
        isOpen={isAuthModalOpen}
        onClose={() => {
          setIsAuthModalOpen(false);
          checkAuth();
        }}
      />

      {/* 수강권 구매 모달 */}
      <TicketRechargeModal
        isOpen={isTicketPurchaseModalOpen}
        onClose={() => setIsTicketPurchaseModalOpen(false)}
        academyId={session?.classes?.academy_id}
        classId={session?.classes?.id}
        academyName={session?.classes?.academies?.name_kr || session?.classes?.academies?.name_en}
        onPurchaseSuccess={() => {
          if (user) {
            loadUserTickets();
          }
          loadPurchasableTickets();
          setIsTicketPurchaseModalOpen(false);
        }}
      />
    </div>
  );
}
