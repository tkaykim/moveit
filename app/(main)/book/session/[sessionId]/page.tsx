"use client";

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getSupabaseClient } from '@/lib/utils/supabase-client';
import { fetchWithAuth } from '@/lib/api/auth-fetch';
import { ChevronLeft, Calendar, Clock, MapPin, User, Users, Wallet, CheckCircle, CreditCard, Building2, LogIn, AlertCircle, Ticket, Gift, CalendarDays, ChevronRight, Loader2, AlertTriangle, X } from 'lucide-react';
import Image from 'next/image';
import { formatKSTTime, formatKSTDate } from '@/lib/utils/kst-time';
import { MyTab } from '@/components/auth/MyTab';
import { TicketRechargeModal } from '@/components/modals/ticket-recharge-modal';
import { useLocale } from '@/contexts/LocaleContext';
import { getTicketPaymentSuccessUrl, getTicketPaymentFailUrl } from '@/lib/toss/payment-urls';
import { requestTossPaymentRedirect } from '@/lib/toss/request-payment-redirect';

interface SessionData {
  id: string;
  start_time: string;
  end_time: string;
  max_students: number;
  current_students: number;
  is_canceled: boolean;
  /** 대강 시 표시용 이름 (schedules.instructor_name_text) */
  instructor_name_text?: string | null;
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
  productKey?: string; // count_options용: 'ticketId_count'
  name: string;
  price: number;
  ticket_type: 'PERIOD' | 'COUNT';
  total_count?: number;
  valid_days?: number | null;
  is_general: boolean;
  is_coupon: boolean;
  ticket_category?: 'regular' | 'popup' | 'workshop';
  countOptionIndex?: number; // 쿠폰제 count_options 옵션 인덱스
}

type PaymentMethod = 'ticket' | 'purchase' | 'onsite';

export default function SessionBookingPage() {
  const params = useParams();
  const router = useRouter();
  const { t, language } = useLocale();
  const sessionId = params.sessionId as string;

  const [session, setSession] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [error, setError] = useState('');

  // 결제 방법 (미선택이 기본)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);

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

  // 모달 (비로그인 시 회원가입/로그인 유도용 초기 탭)
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalInitialTab, setAuthModalInitialTab] = useState<'login' | 'signup'>('login');
  const [isTicketPurchaseModalOpen, setIsTicketPurchaseModalOpen] = useState(false);
  const [showOnsiteWarning, setShowOnsiteWarning] = useState(false);

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
            id, title, genre, difficulty_level, price, academy_id, class_type, access_config, poster_url,
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
      setError(t('sessionBooking.sessionLoadFailed'));
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
          instructor_name_text,
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

  // 세션 로드 후: ticket_classes 1회 조회 → 보유/구매 수강권 병렬 로드 (체감 속도 개선)
  useEffect(() => {
    if (!session?.classes?.id) return;

    if (!user) {
      setUserTickets([]);
      setSelectedUserTicketId('');
      setLoadingUserTickets(false);
      if (paymentMethod === 'ticket' || paymentMethod === 'purchase') {
        setPaymentMethod(null);
      }
    }

    const classId = session.classes.id;
    const academyId = session.classes.academy_id;
    const allowCoupon = session.classes.access_config?.allowCoupon === true || session.classes.access_config?.allowPopup === true;
    const supabase = getSupabaseClient();
    if (!supabase) return;

    let cancelled = false;

    const run = async () => {
      setLoadingUserTickets(!!user);
      setLoadingPurchasableTickets(true);

      try {
        // 1. ticket_classes 1회만 조회
        const { data: ticketClassesData, error: tcError } = await (supabase as any)
          .from('ticket_classes')
          .select('ticket_id')
          .eq('class_id', classId);

        if (tcError) {
          console.error('ticket_classes 클라이언트 쿼리 오류:', tcError);
        }
        const linkedTicketIds = (ticketClassesData || []).map((tc: any) => tc.ticket_id);
        const linkedSet = new Set(linkedTicketIds);

        // 2. 보유 수강권 / 구매 가능 수강권 병렬 조회
        const today = new Date().toISOString().split('T')[0];

        const [userTicketsResult, ticketsResult] = await Promise.all([
          user
            ? (supabase as any)
                .from('user_tickets')
                .select(`
                  *,
                  tickets (
                    id, name, ticket_type, total_count, valid_days, is_general, is_coupon, access_group, ticket_category, academy_id
                  )
                `)
                .eq('user_id', user.id)
                .eq('status', 'ACTIVE')
                .or('remaining_count.gt.0,remaining_count.is.null')
                .order('created_at', { ascending: false })
            : Promise.resolve({ data: [], error: null }),
          (supabase as any)
            .from('tickets')
            .select('id, name, price, ticket_type, total_count, valid_days, is_general, is_coupon, academy_id, ticket_category, access_group, count_options')
            .eq('is_on_sale', true)
            .eq('academy_id', session.classes.academy_id)
            .or('is_public.eq.true,is_public.is.null'),
        ]);

        if (cancelled) return;

        // 3. 보유 수강권 필터/설정
        if (user && userTicketsResult.error == null) {
          const raw = (userTicketsResult.data || []).filter((row: any) => {
            const exp = row.expiry_date;
            const start = row.start_date;
            return (exp == null || exp >= today) && (start == null || start <= today);
          });
          const filtered: UserTicket[] = raw.filter((item: any) => {
            const ticket = item.tickets;
            if (!ticket) return false;
            if (academyId && ticket.academy_id && ticket.academy_id !== academyId) return false;
            if (linkedSet.has(ticket.id)) return true;
            if (ticket.is_general === true) return true;
            if (ticket.is_coupon === true) return allowCoupon;
            return false;
          });
          setUserTickets(filtered);
          if (filtered.length > 0) {
            setSelectedUserTicketId(filtered[0].id);
            setPaymentMethod('ticket');
          }
        } else if (user) {
          setUserTickets([]);
        }
        setLoadingUserTickets(false);

        // 4. 구매 가능 수강권 필터/확장/설정
        if (ticketsResult.error) throw ticketsResult.error;
        const ticketsData = ticketsResult.data || [];
        const filteredTickets = ticketsData.filter((ticket: any) => {
          if (linkedTicketIds.includes(ticket.id)) return true;
          if (ticket.is_general === true) return true;
          if (ticket.is_coupon && allowCoupon) return true;
          return false;
        });
        filteredTickets.sort((a: any, b: any) => {
          const aL = linkedTicketIds.includes(a.id);
          const bL = linkedTicketIds.includes(b.id);
          if (aL && !bL) return -1;
          if (!aL && bL) return 1;
          if (a.is_coupon && !b.is_coupon) return 1;
          if (!a.is_coupon && b.is_coupon) return -1;
          return 0;
        });

        const expanded: PurchasableTicket[] = [];
        for (const ticket of filteredTickets) {
          const opts = (ticket.count_options as { count?: number; price?: number; valid_days?: number | null }[] | null) || [];
          const hasCountOptions = opts.length > 0 && (ticket.ticket_category === 'popup' || ticket.access_group === 'popup');
          if (hasCountOptions) {
            opts.forEach((o: any, idx: number) => {
              const count = Number(o?.count ?? 1);
              if (count > 0) {
                expanded.push({
                  id: ticket.id,
                  productKey: `${ticket.id}_${count}`,
                  name: `${ticket.name} ${count}회권`,
                  price: Number(o?.price ?? 0),
                  ticket_type: 'COUNT',
                  total_count: count,
                  valid_days: o?.valid_days ?? ticket.valid_days ?? null,
                  is_general: ticket.is_general,
                  is_coupon: ticket.is_coupon,
                  ticket_category: ticket.ticket_category,
                  countOptionIndex: idx,
                });
              }
            });
          } else {
            expanded.push({
              id: ticket.id,
              name: ticket.name,
              price: ticket.price ?? 0,
              ticket_type: ticket.ticket_type ?? 'PERIOD',
              total_count: ticket.total_count,
              valid_days: ticket.valid_days,
              is_general: ticket.is_general,
              is_coupon: ticket.is_coupon,
              ticket_category: ticket.ticket_category,
            });
          }
        }
        setPurchasableTickets(expanded);
        if (expanded.length > 0) {
          setSelectedPurchaseTicketId(expanded[0].productKey ?? expanded[0].id);
        }
      } catch (err) {
        console.error('Error loading tickets:', err);
      } finally {
        if (!cancelled) setLoadingPurchasableTickets(false);
      }
    };

    run();
    return () => { cancelled = true; };
  }, [session?.classes?.id, user?.id]);

  // 모달/외부에서 수강권 목록 갱신 시 호출용 (기존 함수명 유지)
  const loadUserTickets = async () => {
    if (!session?.classes?.id || !user) return;
    setLoadingUserTickets(true);
    try {
      const supabase = getSupabaseClient();
      if (!supabase) return;
      const { data: ticketClassesData } = await (supabase as any)
        .from('ticket_classes')
        .select('ticket_id')
        .eq('class_id', session.classes.id);
      const linkedSet = new Set((ticketClassesData || []).map((tc: any) => tc.ticket_id));
      const today = new Date().toISOString().split('T')[0];
      const { data: rawUserTickets, error: utError } = await (supabase as any)
        .from('user_tickets')
        .select(`*, tickets (id, name, ticket_type, total_count, valid_days, is_general, is_coupon, access_group, ticket_category, academy_id)`)
        .eq('user_id', user.id)
        .eq('status', 'ACTIVE')
        .or('remaining_count.gt.0,remaining_count.is.null')
        .order('created_at', { ascending: false });
      if (utError) return;
      const allowCoupon = session.classes.access_config?.allowCoupon === true || session.classes.access_config?.allowPopup === true;
      const academyId = session.classes.academy_id;
      const validTickets = (rawUserTickets || []).filter((row: any) => {
        const exp = row.expiry_date;
        const start = row.start_date;
        return (exp == null || exp >= today) && (start == null || start <= today);
      });
      const filteredTickets: UserTicket[] = validTickets.filter((item: any) => {
        const ticket = item.tickets;
        if (!ticket) return false;
        if (academyId && ticket.academy_id && ticket.academy_id !== academyId) return false;
        if (linkedSet.has(ticket.id)) return true;
        if (ticket.is_general === true) return true;
        if (ticket.is_coupon === true) return allowCoupon;
        return false;
      });
      setUserTickets(filteredTickets);
      if (filteredTickets.length > 0) {
        setSelectedUserTicketId(filteredTickets[0].id);
        setPaymentMethod('ticket');
      }
    } finally {
      setLoadingUserTickets(false);
    }
  };

  const loadPurchasableTickets = async () => {
    if (!session?.classes?.id) return;
    setLoadingPurchasableTickets(true);
    try {
      const supabase = getSupabaseClient();
      if (!supabase) return;
      const { data: ticketClassesData } = await (supabase as any)
        .from('ticket_classes')
        .select('ticket_id')
        .eq('class_id', session.classes.id);
      const linkedTicketIds = (ticketClassesData || []).map((tc: any) => tc.ticket_id);
      const allowCoupon = session.classes.access_config?.allowCoupon === true || session.classes.access_config?.allowPopup === true;
      const { data: ticketsData, error } = await (supabase as any)
        .from('tickets')
        .select('id, name, price, ticket_type, total_count, valid_days, is_general, is_coupon, academy_id, ticket_category, access_group, count_options')
        .eq('is_on_sale', true)
        .eq('academy_id', session.classes.academy_id)
        .or('is_public.eq.true,is_public.is.null');
      if (error) throw error;
      const filteredTickets = (ticketsData || []).filter((ticket: any) => {
        if (linkedTicketIds.includes(ticket.id)) return true;
        if (ticket.is_general === true) return true;
        if (ticket.is_coupon && allowCoupon) return true;
        return false;
      });
      filteredTickets.sort((a: any, b: any) => {
        const aL = linkedTicketIds.includes(a.id);
        const bL = linkedTicketIds.includes(b.id);
        if (aL && !bL) return -1;
        if (!aL && bL) return 1;
        if (a.is_coupon && !b.is_coupon) return 1;
        if (!a.is_coupon && b.is_coupon) return -1;
        return 0;
      });
      const expanded: PurchasableTicket[] = [];
      for (const ticket of filteredTickets) {
        const opts = (ticket.count_options as { count?: number; price?: number; valid_days?: number | null }[] | null) || [];
        const hasCountOptions = opts.length > 0 && (ticket.ticket_category === 'popup' || ticket.access_group === 'popup');
        if (hasCountOptions) {
          opts.forEach((o: any, idx: number) => {
            const count = Number(o?.count ?? 1);
            if (count > 0) {
              expanded.push({
                id: ticket.id,
                productKey: `${ticket.id}_${count}`,
                name: `${ticket.name} ${count}회권`,
                price: Number(o?.price ?? 0),
                ticket_type: 'COUNT',
                total_count: count,
                valid_days: o?.valid_days ?? ticket.valid_days ?? null,
                is_general: ticket.is_general,
                is_coupon: ticket.is_coupon,
                ticket_category: ticket.ticket_category,
                countOptionIndex: idx,
              });
            }
          });
        } else {
          expanded.push({
            id: ticket.id,
            name: ticket.name,
            price: ticket.price ?? 0,
            ticket_type: ticket.ticket_type ?? 'PERIOD',
            total_count: ticket.total_count,
            valid_days: ticket.valid_days,
            is_general: ticket.is_general,
            is_coupon: ticket.is_coupon,
            ticket_category: ticket.ticket_category,
          });
        }
      }
      setPurchasableTickets(expanded);
      if (expanded.length > 0) setSelectedPurchaseTicketId(expanded[0].productKey ?? expanded[0].id);
    } finally {
      setLoadingPurchasableTickets(false);
    }
  };

  // 수강권으로 예약
  const handleTicketBooking = async () => {
    if (!selectedUserTicketId) {
      setError(t('sessionBooking.selectTicketError'));
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const response = await fetchWithAuth('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scheduleId: sessionId,
          userTicketId: selectedUserTicketId,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || t('sessionBooking.bookingFailed'));
      }

      router.push(`/book/session/${sessionId}/success?type=ticket`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // 수강권 구매 후 예약 (카드/계좌 = Toss 결제창, 그 외는 기존 구매 API)
  const handlePurchaseBooking = async () => {
    if (!selectedPurchaseTicketId || !selectedPurchaseTicket) {
      setError(t('sessionBooking.selectTicketError'));
      return;
    }

    const useTossPayment = purchasePaymentType === 'card' || purchasePaymentType === 'account';
    setSubmitting(true);
    setError('');

    try {
      if (useTossPayment) {
        // Toss Payments: 주문 생성 후 결제위젯 모달 오픈 (새 창 없이 모달 내 결제)
        const orderRes = await fetchWithAuth('/api/tickets/payment-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ticketId: selectedPurchaseTicket.id,
            scheduleId: sessionId,
            ...(typeof selectedPurchaseTicket.countOptionIndex === 'number' && { countOptionIndex: selectedPurchaseTicket.countOptionIndex }),
          }),
        });
        if (!orderRes.ok) {
          const data = await orderRes.json();
          throw new Error(data.error || t('sessionBooking.purchaseFailed'));
        }
        const { orderId, amount, orderName } = await orderRes.json();
        const clientKey = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY;
        if (!clientKey) {
          throw new Error('결제 설정이 완료되지 않았습니다.');
        }
        const successUrl = getTicketPaymentSuccessUrl({ sessionId, returnTo: 'session' });
        const failUrl = getTicketPaymentFailUrl({ sessionId });
        const method = purchasePaymentType === 'card' ? 'CARD' : 'TRANSFER';
        await requestTossPaymentRedirect({
          clientKey,
          method,
          orderId,
          orderName,
          amount,
          successUrl,
          failUrl,
        });
        setSubmitting(false);
        return;
      }

      // 기존: 수강권 즉시 구매(테스트 등) 후 예약
      const purchaseResponse = await fetchWithAuth('/api/tickets/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticketId: selectedPurchaseTicket.id,
          paymentMethod: purchasePaymentType,
          ...(typeof selectedPurchaseTicket.countOptionIndex === 'number' && { countOptionIndex: selectedPurchaseTicket.countOptionIndex }),
        }),
      });

      if (!purchaseResponse.ok) {
        const data = await purchaseResponse.json();
        throw new Error(data.error || t('sessionBooking.purchaseFailed'));
      }

      const purchaseResult = await purchaseResponse.json();
      const userTicketId = purchaseResult.data?.id;

      if (!userTicketId) {
        throw new Error(t('sessionBooking.purchaseInfoFailed'));
      }

      const bookingResponse = await fetchWithAuth('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scheduleId: sessionId,
          userTicketId: userTicketId,
          paymentMethod: purchasePaymentType === 'card' ? 'CARD_DEMO' : purchasePaymentType,
          paymentStatus: purchasePaymentType === 'card' ? 'COMPLETED' : 'PENDING',
        }),
      });

      if (!bookingResponse.ok) {
        const data = await bookingResponse.json();
        throw new Error(data.error || t('sessionBooking.bookingFailed'));
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
      setError(t('sessionBooking.nameError'));
      return;
    }
    if (!guestPhone.trim()) {
      setError(t('sessionBooking.contactError'));
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
        throw new Error(data.error || t('sessionBooking.bookingFailed'));
      }

      router.push(`/book/session/${sessionId}/success?type=guest&name=${encodeURIComponent(guestName)}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = () => {
    if (paymentMethod === null) return;
    if (paymentMethod === 'ticket') {
      handleTicketBooking();
    } else if (paymentMethod === 'purchase') {
      handlePurchaseBooking();
    } else {
      // 현장 결제: '그래도 현장결제 할래요'로 선택된 경우에만 submit 가능
      handleOnsiteBooking();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-neutral-950">
        <div className="text-neutral-500">{t('sessionBooking.loadingSession')}</div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white dark:bg-neutral-950 p-6">
        <div className="text-red-500 text-lg mb-4">{t('sessionBooking.sessionNotFound')}</div>
        <button
          onClick={() => router.push('/')}
          className="px-6 py-2 bg-neutral-200 dark:bg-neutral-800 rounded-lg text-neutral-700 dark:text-neutral-300"
        >
          {t('sessionBooking.goHome')}
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
  const selectedPurchaseTicket = purchasableTickets.find(t => (t.productKey ?? t.id) === selectedPurchaseTicketId);

  return (
    <div className="min-h-screen bg-white dark:bg-neutral-950 pt-8 px-5 pb-48 relative">
      {/* 예약/구매 처리 중 로딩 오버레이 */}
      {submitting && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/50 dark:bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl p-8 flex flex-col items-center gap-4 min-w-[240px]">
            <Loader2 size={40} className="text-primary dark:text-[#CCFF00] animate-spin" />
            <p className="text-base font-semibold text-black dark:text-white text-center">
              {paymentMethod === 'purchase' ? t('sessionBooking.processingPurchase') : paymentMethod === 'ticket' ? t('sessionBooking.processingTicket') : t('sessionBooking.processingGuest')}
            </p>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 text-center">
              {t('sessionBooking.processingGeneral')}
            </p>
          </div>
        </div>
      )}

      {/* 헤더 */}
      <div className="flex items-center gap-4 mb-8">
        <button onClick={() => router.back()} className="p-2 -ml-2">
          <ChevronLeft className="text-black dark:text-white" />
        </button>
        <h2 className="text-xl font-bold text-black dark:text-white">{t('sessionBooking.title')}</h2>
      </div>

      {/* 포스터 */}
      {(session.classes as any)?.poster_url && (
        <div className="relative w-full rounded-2xl overflow-hidden mb-4 bg-neutral-100 dark:bg-neutral-800">
          <Image
            src={(session.classes as any).poster_url}
            alt={session.classes?.title || '수업 포스터'}
            width={400}
            height={560}
            className="w-full h-auto object-contain max-h-[320px]"
          />
        </div>
      )}

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
            <span className="font-medium">{session.instructor_name_text || session.instructors?.name_kr || session.instructors?.name_en || t('sessionBooking.instructorTbd')}</span>
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
          {isFull && (
            <div className="flex items-center gap-3">
              <Users size={18} className="text-red-400" />
              <span className="text-red-500 font-medium">
                {t('sessionBooking.closed')}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* 예약 불가 상태 */}
      {!canBook && (
        <div className="mb-6 space-y-4">
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 text-center">
            <span className="text-red-600 dark:text-red-400 font-medium">
              {isCanceled ? t('sessionBooking.canceled') : isPast ? t('sessionBooking.past') : t('sessionBooking.full')}
            </span>
          </div>

          {/* 종료된 수업일 때만: 다음 날짜 예약 유도 */}
          {isPast && session?.classes?.id && (
            <div className="bg-primary/5 dark:bg-[#CCFF00]/5 border border-primary/30 dark:border-[#CCFF00]/30 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <CalendarDays className="text-primary dark:text-[#CCFF00] flex-shrink-0" size={20} />
                <h4 className="font-bold text-black dark:text-white">{t('sessionBooking.otherDates')}</h4>
              </div>
              <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4">
                {t('sessionBooking.otherDatesDesc')}
              </p>
              {loadingUpcoming ? (
                <div className="text-center py-6 text-neutral-500 text-sm">{t('sessionBooking.loadingUpcoming')}</div>
              ) : upcomingSessions.length === 0 ? (
                <p className="text-sm text-neutral-500 dark:text-neutral-400 text-center py-4">
                  {t('sessionBooking.noUpcoming')}
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
                              {full && <><span>·</span><span className="text-red-500">{t('sessionBooking.closed')}</span></>}
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
          {/* 비로그인: 수강권 선택·결제를 위해 회원가입/로그인 유도 (메인 CTA) */}
          {!user && (
            <div className="bg-primary/10 dark:bg-[#CCFF00]/10 border-2 border-primary/30 dark:border-[#CCFF00]/30 rounded-xl p-5">
              <p className="text-sm font-bold text-black dark:text-white mb-1">
                {t('sessionBooking.loginOrSignupForTicket')}
              </p>
              <p className="text-xs text-neutral-600 dark:text-neutral-400 mb-4">
                {t('sessionBooking.loginOrSignupBenefit')}
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setAuthModalInitialTab('signup');
                    setIsAuthModalOpen(true);
                  }}
                  className="flex-1 py-3 rounded-xl bg-primary dark:bg-[#CCFF00] text-black font-bold text-sm hover:opacity-90 transition-opacity"
                >
                  {t('sessionBooking.signupButton')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAuthModalInitialTab('login');
                    setIsAuthModalOpen(true);
                  }}
                  className="flex-1 py-3 rounded-xl border-2 border-neutral-800 dark:border-neutral-200 text-neutral-800 dark:text-neutral-200 font-bold text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                >
                  {t('sessionBooking.loginButton')}
                </button>
              </div>
            </div>
          )}

          {/* 결제 방법 선택 */}
          <div className="space-y-3">
            <h4 className="font-bold text-black dark:text-white">{t('sessionBooking.paymentMethod')}</h4>

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
                    <div className="text-black dark:text-white font-bold">{t('sessionBooking.useTicket')}</div>
                    <div className="text-xs text-neutral-500">
                      {loadingUserTickets ? t('common.loading') : userTickets.length > 0 ? t('sessionBooking.haveCount', { count: userTickets.length }) : t('sessionBooking.noAvailableTicket')}
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

            {/* 2. 수강권 구매 후 예약 (로그인 시 항상 자리 확보, 로딩 중에는 플레이스홀더) */}
            {user && (
              <button
                onClick={() => !loadingPurchasableTickets && setPaymentMethod('purchase')}
                disabled={loadingPurchasableTickets || purchasableTickets.length === 0}
                className={`w-full rounded-xl p-4 flex justify-between items-center border-2 transition-colors text-left ${
                  paymentMethod === 'purchase'
                    ? 'bg-primary/10 dark:bg-[#CCFF00]/10 border-primary dark:border-[#CCFF00]'
                    : loadingPurchasableTickets || purchasableTickets.length === 0
                    ? 'bg-neutral-50 dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 opacity-70'
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
                    <div className="text-black dark:text-white font-bold">{t('sessionBooking.purchaseAndBook')}</div>
                    <div className="text-xs text-neutral-500">
                      {loadingPurchasableTickets ? t('common.loading') : purchasableTickets.length > 0 ? t('sessionBooking.purchasableCount', { count: purchasableTickets.length }) : t('sessionBooking.noAvailableTicket')}
                    </div>
                  </div>
                </div>
                {paymentMethod === 'purchase' && purchasableTickets.length > 0 && (
                  <div className="w-5 h-5 rounded-full bg-primary dark:bg-[#CCFF00] flex items-center justify-center">
                    <CheckCircle size={14} className="text-black" />
                  </div>
                )}
                {(loadingPurchasableTickets || purchasableTickets.length === 0) && (
                  <AlertCircle size={18} className="text-neutral-400 flex-shrink-0" />
                )}
              </button>
            )}

            {/* 3. 현장 결제 - 클릭 시 항상 경고 표시, '그래도 현장결제 할래요' 선택 시에만 적용 */}
            <button
              onClick={() => setShowOnsiteWarning(true)}
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
                  <div className="text-black dark:text-white font-bold">{t('sessionBooking.onSitePayment')}</div>
                  <div className="text-xs text-neutral-500">{t('sessionBooking.payOnVisit')}</div>
                </div>
              </div>
              {paymentMethod === 'onsite' && (
                <div className="w-5 h-5 rounded-full bg-primary dark:bg-[#CCFF00] flex items-center justify-center">
                  <CheckCircle size={14} className="text-black" />
                </div>
              )}
            </button>
          </div>

          {/* 수강권 선택 (수강권 사용 선택 시, 로그인 필요) */}
          {user && paymentMethod === 'ticket' && userTickets.length > 0 && (
            <div className="space-y-3">
              <h4 className="font-bold text-black dark:text-white">{t('sessionBooking.selectOwnedTicket')}</h4>
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
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-10 h-10 flex-shrink-0 rounded-full flex items-center justify-center ${
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
                      <div className="min-w-0 flex-1">
                        <div className="text-black dark:text-white font-medium flex items-center gap-2 flex-wrap">
                          <span className="break-words [word-break:keep-all]">{ut.tickets?.name}</span>
                          {isCoupon && (
                            <span className="text-xs px-2 py-0.5 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 rounded-full">
                              {t('bookingConfirm.couponName')}
                            </span>
                          )}
                          {isPeriodTicket && !isCoupon && (
                            <span className="text-xs px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-full">
                              {t('sessionBooking.periodTicket')}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-neutral-500">
                          {isPeriodTicket ? (
                            // 기간권: 시작일 ~ 만료일 표시
                            ut.start_date && ut.expiry_date
                              ? `${formatDate(ut.start_date)} ~ ${t('sessionBooking.expiryDateLabel')}${formatDate(ut.expiry_date)}`
                              : ut.expiry_date
                                ? `${t('sessionBooking.expiryDateLabel')}${formatDate(ut.expiry_date)}`
                                : '-'
                          ) : (
                            // 횟수권: 잔여 횟수 + 만료일 표시
                            ut.expiry_date
                              ? `${t('sessionBooking.remaining', { count: ut.remaining_count ?? 0 })} · ${t('sessionBooking.expiryDateLabel')}${formatDate(ut.expiry_date)}`
                              : t('sessionBooking.remaining', { count: ut.remaining_count ?? 0 })
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
              <h4 className="font-bold text-black dark:text-white">{t('sessionBooking.selectPurchaseTicket')}</h4>

              {loadingPurchasableTickets ? (
                <div className="text-center py-8 text-neutral-500">{t('common.loading')}</div>
              ) : purchasableTickets.length === 0 ? (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 text-center">
                  <p className="text-sm text-amber-700 dark:text-amber-400">
                    {t('sessionBooking.noClassTickets')}
                  </p>
                </div>
              ) : (
                <>
                  {purchasableTickets.map((ticket) => {
                    const selKey = ticket.productKey ?? ticket.id;
                    const category = ticket.ticket_category || (ticket.is_coupon ? 'popup' : 'regular');
                    const categoryLabel = category === 'regular' ? t('my.periodTicket') : category === 'popup' ? t('my.countTicket') : t('my.workshopTicket');
                    const categoryColor = category === 'regular' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : category === 'popup' ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400' : 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400';
                    return (
                      <button
                        key={selKey}
                        onClick={() => setSelectedPurchaseTicketId(selKey)}
                        className={`w-full rounded-xl p-4 flex justify-between items-center border-2 transition-colors text-left ${
                          selectedPurchaseTicketId === selKey
                            ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-500'
                            : 'bg-neutral-50 dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 hover:border-neutral-300'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-10 h-10 flex-shrink-0 rounded-full flex items-center justify-center ${
                            category === 'regular' ? 'bg-blue-100 dark:bg-blue-900/30' : category === 'popup' ? 'bg-purple-100 dark:bg-purple-900/30' : 'bg-amber-100 dark:bg-amber-900/30'
                          }`}>
                            {category === 'regular' ? (
                              <Ticket size={18} className="text-blue-600 dark:text-blue-400" />
                            ) : category === 'popup' ? (
                              <Gift size={18} className="text-purple-600 dark:text-purple-400" />
                            ) : (
                              <Ticket size={18} className="text-amber-600 dark:text-amber-400" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-black dark:text-white font-medium flex items-center gap-2 flex-wrap">
                              <span className="break-words [word-break:keep-all]">{ticket.name}</span>
                              <span className={`text-xs px-2 py-0.5 rounded-full ${categoryColor}`}>
                                {categoryLabel}
                              </span>
                            </div>
                            <div className="text-xs text-neutral-500">
                              {ticket.ticket_type === 'COUNT'
                                ? `${ticket.total_count ?? 0}${t('ticketRecharge.count')}`
                                : `${ticket.valid_days ?? 0}${t('ticketRecharge.days')}`}
                              {' · '}
                              <span className="font-bold text-primary dark:text-[#CCFF00]">
                                {ticket.price.toLocaleString()}원
                              </span>
                            </div>
                          </div>
                        </div>
                        {selectedPurchaseTicketId === selKey && (
                          <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center">
                            <CheckCircle size={14} className="text-white" />
                          </div>
                        )}
                      </button>
                    );
                  })}

                  {/* 결제 방식 선택 */}
                  <div className="pt-4 border-t border-neutral-200 dark:border-neutral-800">
                    <p className="text-sm text-neutral-500 mb-3">{t('sessionBooking.paymentType')}</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setPurchasePaymentType('card')}
                        className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                          purchasePaymentType === 'card'
                            ? 'bg-primary dark:bg-[#CCFF00] text-black'
                            : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400'
                        }`}
                      >
                        {t('sessionBooking.cardPayment')}
                      </button>
                      <button
                        onClick={() => setPurchasePaymentType('account')}
                        className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                          purchasePaymentType === 'account'
                            ? 'bg-primary dark:bg-[#CCFF00] text-black'
                            : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400'
                        }`}
                      >
                        {t('sessionBooking.bankTransfer')}
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
              <h4 className="font-bold text-black dark:text-white">{t('sessionBooking.guestInfo')}</h4>
              {!user && (
                <button
                  onClick={() => setIsAuthModalOpen(true)}
                  className="text-xs text-primary dark:text-[#CCFF00] font-medium underline mb-2"
                >
                  {t('sessionBooking.login')}
                </button>
              )}

              <div>
                <label className="block text-sm text-neutral-600 dark:text-neutral-400 mb-2">
                  {t('sessionBooking.name')} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  placeholder={t('sessionBooking.nameRequired')}
                  className="w-full px-4 py-3 rounded-xl bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-black dark:text-white placeholder-neutral-400"
                />
              </div>

              <div>
                <label className="block text-sm text-neutral-600 dark:text-neutral-400 mb-2">
                  {t('sessionBooking.contact')} <span className="text-red-500">*</span>
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
                {t('sessionBooking.onSiteNote')}
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

      {/* 하단 고정 버튼 (하단 네비게이션 80px 위에 배치) */}
      {canBook && (
        <div className="fixed bottom-[80px] left-1/2 -translate-x-1/2 w-full max-w-[420px] p-4 bg-white/95 dark:bg-neutral-950/95 backdrop-blur-lg border-t border-neutral-200 dark:border-neutral-800 z-50">
          {/* 결제 금액 표시 */}
          <div className="flex justify-between items-center mb-3">
            <span className="text-sm text-neutral-500">
              {paymentMethod === null
                ? t('sessionBooking.selectPaymentMethod')
                : paymentMethod === 'ticket'
                ? t('sessionBooking.ticketUse')
                : paymentMethod === 'purchase'
                ? t('sessionBooking.ticketPurchase')
                : t('sessionBooking.onSitePayment')}
            </span>
            <span className="text-lg font-bold text-primary dark:text-[#CCFF00]">
              {paymentMethod === null
                ? ''
                : paymentMethod === 'purchase' && selectedPurchaseTicket
                ? `${selectedPurchaseTicket.price.toLocaleString()}${language === 'ko' ? '원' : ' KRW'}`
                : paymentMethod === 'ticket'
                ? t('sessionBooking.ticketDeduction')
                : `${(session.classes?.price || 0).toLocaleString()}${language === 'ko' ? '원' : ' KRW'}`}
            </span>
          </div>

          <button
            onClick={handleSubmit}
            disabled={
              submitting ||
              paymentMethod === null ||
              (paymentMethod === 'ticket' && !selectedUserTicketId) ||
              (paymentMethod === 'purchase' && !selectedPurchaseTicketId)
            }
            className="w-full bg-primary dark:bg-[#CCFF00] text-black font-bold py-3.5 rounded-xl text-base shadow-lg active:scale-[0.98] transition-transform disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <Loader2 size={20} className="animate-spin flex-shrink-0" />
                <span>
                  {paymentMethod === 'purchase' ? t('sessionBooking.processingPurchase') : paymentMethod === 'ticket' ? t('sessionBooking.processingTicket') : t('sessionBooking.processingGuest')}
                </span>
              </>
            ) : paymentMethod === null ? (
              t('sessionBooking.selectPaymentMethod')
            ) : paymentMethod === 'ticket' ? (
              t('sessionBooking.bookWithTicket')
            ) : paymentMethod === 'purchase' ? (
              t('sessionBooking.purchaseAndBookButton')
            ) : (
              t('sessionBooking.requestBooking')
            )}
          </button>
        </div>
      )}

      {/* 현장결제 경고 팝업 */}
      {showOnsiteWarning && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowOnsiteWarning(false)} />
          <div className="relative bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl max-w-sm w-full p-6 animate-in zoom-in-95 duration-200">
            {/* 닫기 버튼 */}
            <button
              onClick={() => setShowOnsiteWarning(false)}
              className="absolute top-4 right-4 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
            >
              <X size={20} />
            </button>

            {/* 아이콘 */}
            <div className="flex justify-center mb-4">
              <div className="w-14 h-14 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                <AlertTriangle size={28} className="text-amber-500" />
              </div>
            </div>

            {/* 제목 */}
            <h3 className="text-lg font-bold text-black dark:text-white text-center mb-3">
              {t('sessionBooking.onsiteWarningTitle')}
            </h3>

            {/* 경고 메시지 */}
            <div className="space-y-2 mb-6 text-sm text-neutral-600 dark:text-neutral-400">
              <p>1. {t('sessionBooking.onsiteWarningMessage1')}</p>
              <p>2. {t('sessionBooking.onsiteWarningMessage2')}</p>
            </div>

            {/* 수강권 구매하고 사전예약하기 (메인 버튼) */}
            <button
              onClick={() => {
                setShowOnsiteWarning(false);
                if (user && purchasableTickets.length > 0) {
                  setPaymentMethod('purchase');
                } else if (user && purchasableTickets.length === 0) {
                  setIsTicketPurchaseModalOpen(true);
                } else {
                  setIsAuthModalOpen(true);
                }
              }}
              className="w-full py-3.5 bg-primary dark:bg-[#CCFF00] text-black font-bold rounded-xl transition-colors flex items-center justify-center gap-2 mb-3"
            >
              <Ticket size={18} />
              {t('sessionBooking.onsiteWarningBuyTicket')}
            </button>

            {/* 그래도 현장결제 할래요 - 클릭 시에만 현장결제 선택됨 */}
            <button
              onClick={() => {
                setPaymentMethod('onsite');
                setShowOnsiteWarning(false);
              }}
              className="w-full py-1.5 text-xs text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300 underline underline-offset-2 transition-colors"
            >
              {t('sessionBooking.onsiteWarningProceed')}
            </button>
          </div>
        </div>
      )}

      {/* 로그인/회원가입 모달 */}
      <MyTab
        isOpen={isAuthModalOpen}
        onClose={() => {
          setIsAuthModalOpen(false);
          checkAuth();
        }}
        initialTab={authModalInitialTab}
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
