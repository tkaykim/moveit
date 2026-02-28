"use client";

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getSupabaseClient } from '@/lib/utils/supabase-client';
import { fetchWithAuth } from '@/lib/api/auth-fetch';
import { ChevronLeft, Calendar, Clock, MapPin, User, Users, Wallet, CheckCircle, CreditCard, Building2, LogIn, AlertCircle, Ticket, Gift, CalendarDays, ChevronRight, Loader2, AlertTriangle, X, Copy } from 'lucide-react';
import Image from 'next/image';
import { formatKSTTime, formatKSTDate } from '@/lib/utils/kst-time';
import { MyTab } from '@/components/auth/MyTab';
import { TicketRechargeModal } from '@/components/modals/ticket-recharge-modal';
import { TicketTossPaymentModal } from '@/components/modals/ticket-toss-payment-modal';
import { useLocale } from '@/contexts/LocaleContext';
import { ENABLE_TOSS_PAYMENT } from '@/lib/constants/payment';
import { useTicketLabels } from '@/lib/hooks/useTicketLabels';

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
  description?: string | null;
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
  const academyId = session?.classes?.academy_id;
  const { labels: ticketLabels } = useTicketLabels(academyId);
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

  // 계좌이체 신청 완료 시 표시할 계좌 정보 (복사용)
  const [bankTransferResult, setBankTransferResult] = useState<{
    orderId: string;
    amount: number;
    orderName: string;
    bankName: string;
    bankAccountNumber: string;
    bankDepositorName: string;
    ordererName?: string;
  } | null>(null);
  const [bankCopyFeedback, setBankCopyFeedback] = useState(false);

  // 계좌이체 시: 비로그인 선택 모달 / 비회원 폼 / 입금자명 모달
  const [bankTransferAuthModalOpen, setBankTransferAuthModalOpen] = useState(false);
  const [bankTransferGuestFormOpen, setBankTransferGuestFormOpen] = useState(false);
  const [guestOrderer, setGuestOrderer] = useState<{ name: string; phone: string; email: string } | null>(null);
  const [depositorModalOpen, setDepositorModalOpen] = useState(false);
  const [depositorName, setDepositorName] = useState('');
  const [depositorModalPreFillLoading, setDepositorModalPreFillLoading] = useState(false);
  const [pendingBankTransfer, setPendingBankTransfer] = useState<{
    ticketId: string;
    scheduleId: string;
    countOptionIndex?: number;
  } | null>(null);
  // 비회원 폼 입력값
  const [guestFormName, setGuestFormName] = useState('');
  const [guestFormPhone, setGuestFormPhone] = useState('');
  const [guestFormEmail, setGuestFormEmail] = useState('');

  // 결제 위젯 모달 (수강권 구매 후 예약 — 앱 내 결제 유지)
  const [widgetModalOpen, setWidgetModalOpen] = useState(false);
  const [widgetOrder, setWidgetOrder] = useState<{
    orderId: string;
    amount: number;
    orderName: string;
    successUrl: string;
    failUrl: string;
    customerKey: string;
    /** 토스 requestPayment용. 숫자만 8~15자 (하이픈 없음) */
    customerMobilePhone?: string;
  } | null>(null);

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

  // 세션 로드 후 사용자 수강권 및 구매 가능 수강권 로드
  useEffect(() => {
    if (session?.classes?.id) {
      // 보유 수강권은 로그인한 사용자만 조회
      if (user) {
        loadUserTickets();
      } else {
        // 로그인하지 않은 경우 수강권 데이터 초기화, 결제 방법 미선택으로
        setUserTickets([]);
        setSelectedUserTicketId('');
        if (paymentMethod === 'ticket' || paymentMethod === 'purchase') {
          setPaymentMethod(null);
        }
      }
      loadPurchasableTickets();
    }
  }, [session?.classes?.id, user]);

  // 사용자 보유 수강권 로드 - 클라이언트 Supabase에서 직접 조회 (서버 API 인증 문제 방지)
  const loadUserTickets = async () => {
    if (!session?.classes?.id || !user) return;

    setLoadingUserTickets(true);
    try {
      const supabase = getSupabaseClient();
      if (!supabase) return;

      const classId = session.classes.id;
      const academyId = session.classes.academy_id;
      const allowCoupon = session.classes.access_config?.allowCoupon === true || session.classes.access_config?.allowPopup === true;
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

      // 1. 사용자의 ACTIVE 수강권 조회 (remaining_count > 0 또는 기간권 null)
      const { data: rawUserTickets, error: utError } = await (supabase as any)
        .from('user_tickets')
        .select(`
          *,
          tickets (
            id,
            name,
            ticket_type,
            total_count,
            valid_days,
            is_general,
            is_coupon,
            access_group,
            ticket_category,
            academy_id
          )
        `)
        .eq('user_id', user.id)
        .eq('status', 'ACTIVE')
        .or('remaining_count.gt.0,remaining_count.is.null')
        .order('created_at', { ascending: false });

      if (utError) {
        console.error('user_tickets 클라이언트 쿼리 오류:', utError);
        return;
      }

      // 2. 유효기간 및 시작일 필터링
      const validTickets = (rawUserTickets || []).filter((row: any) => {
        const exp = row.expiry_date;
        const start = row.start_date;
        const expValid = exp == null || exp >= today;
        const startValid = start == null || start <= today;
        return expValid && startValid;
      });

      // 3. ticket_classes에서 해당 클래스에 연결된 ticket_id 목록 조회
      const { data: ticketClassesData, error: tcError } = await (supabase as any)
        .from('ticket_classes')
        .select('ticket_id')
        .eq('class_id', classId);

      if (tcError) {
        console.error('ticket_classes 클라이언트 쿼리 오류:', tcError);
      }

      const linkedTicketIds = new Set((ticketClassesData || []).map((tc: any) => tc.ticket_id));

      // 4. 필터: ticket_classes 연결, is_general, 쿠폰(allowCoupon) 기준
      const filteredTickets: UserTicket[] = validTickets.filter((item: any) => {
        const ticket = item.tickets;
        if (!ticket) return false;

        const ticketId = ticket.id;
        const isCoupon = ticket.is_coupon === true;
        const isGeneral = ticket.is_general === true;
        const ticketAcademyId = ticket.academy_id;

        // 다른 학원의 수강권 제외
        if (academyId && ticketAcademyId && ticketAcademyId !== academyId) {
          return false;
        }

        // ticket_classes에 연결된 수강권 → 해당 수업에서 사용 가능
        if (linkedTicketIds.has(ticketId)) {
          return true;
        }

        // is_general 수강권 → 같은 학원이면 모든 수업에서 사용 가능
        if (isGeneral) {
          return true;
        }

        // 쿠폰: allowCoupon이 true인 수업에서만 사용 가능
        if (isCoupon) {
          return allowCoupon;
        }

        return false;
      });

      setUserTickets(filteredTickets);

      // 수강권이 있으면 기본값으로 선택
      if (filteredTickets.length > 0) {
        setSelectedUserTicketId(filteredTickets[0].id);
        setPaymentMethod('ticket');
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

      // 2. 연결된 수강권 + is_general + (allowCoupon이면 쿠폰) 조회 (count_options 포함)
      const { data: ticketsData, error } = await (supabase as any)
        .from('tickets')
        .select('id, name, description, price, ticket_type, total_count, valid_days, is_general, is_coupon, academy_id, ticket_category, access_group, count_options')
        .eq('is_on_sale', true)
        .eq('academy_id', session.classes.academy_id)
        .or('is_public.eq.true,is_public.is.null');

      if (error) throw error;

      const filteredTickets = (ticketsData || []).filter((ticket: any) => {
        // ticket_classes에 직접 연결된 수강권
        if (linkedTicketIds.includes(ticket.id)) return true;
        // is_general 수강권은 같은 학원의 모든 클래스에서 구매/사용 가능
        if (ticket.is_general === true) return true;
        // 쿠폰(팝업 등): 클래스에서 허용한 경우
        if (ticket.is_coupon && allowCoupon) return true;
        return false;
      });

      filteredTickets.sort((a: any, b: any) => {
        const aLinked = linkedTicketIds.includes(a.id);
        const bLinked = linkedTicketIds.includes(b.id);
        if (aLinked && !bLinked) return -1;
        if (!aLinked && bLinked) return 1;
        if (a.is_coupon && !b.is_coupon) return 1;
        if (!a.is_coupon && b.is_coupon) return -1;
        return 0;
      });

      // count_options가 있으면 옵션별로 확장 (쿠폰제)
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
                description: ticket.description ?? null,
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
            description: ticket.description ?? null,
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
      console.error('Error loading purchasable tickets:', err);
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

  // 계좌이체: 입금자명 모달에서 신청하기 클릭 시 실제 API 호출
  const submitBankTransferOrder = async (ordererName: string, ordererPhone?: string | null, ordererEmail?: string | null) => {
    if (!pendingBankTransfer || !selectedPurchaseTicket) return;
    setSubmitting(true);
    setError('');
    try {
      const body: Record<string, unknown> = {
        ticketId: pendingBankTransfer.ticketId,
        scheduleId: pendingBankTransfer.scheduleId,
        ordererName: ordererName.trim(),
        ...(typeof pendingBankTransfer.countOptionIndex === 'number' && { countOptionIndex: pendingBankTransfer.countOptionIndex }),
      };
      if (ordererPhone?.trim()) body.ordererPhone = ordererPhone.trim();
      if (ordererEmail?.trim()) body.ordererEmail = ordererEmail.trim();
      const isGuest = !!guestOrderer;
      const orderRes = isGuest
        ? await fetch('/api/tickets/bank-transfer-order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          })
        : await fetchWithAuth('/api/tickets/bank-transfer-order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          });
      if (!orderRes.ok) {
        const data = await orderRes.json();
        throw new Error(data.error || t('sessionBooking.purchaseFailed'));
      }
      const data = await orderRes.json();
      setBankTransferResult({
        orderId: data.orderId,
        amount: data.amount,
        orderName: data.orderName,
        bankName: data.bankName,
        bankAccountNumber: data.bankAccountNumber,
        bankDepositorName: data.bankDepositorName,
        ordererName: data.ordererName,
      });
      setDepositorModalOpen(false);
      setPendingBankTransfer(null);
      setGuestOrderer(null);
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

    const useTossPayment = ENABLE_TOSS_PAYMENT && (purchasePaymentType === 'card' || purchasePaymentType === 'account');
    const useBankTransfer = !ENABLE_TOSS_PAYMENT || purchasePaymentType === 'account';
    setError('');

    if (useBankTransfer) {
      const payload = {
        ticketId: selectedPurchaseTicket.id,
        scheduleId: sessionId,
        ...(typeof selectedPurchaseTicket.countOptionIndex === 'number' && { countOptionIndex: selectedPurchaseTicket.countOptionIndex }),
      };
      setPendingBankTransfer(payload);
      if (!user) {
        setBankTransferAuthModalOpen(true);
        return;
      }
      setDepositorModalPreFillLoading(true);
      setDepositorModalOpen(true);
      try {
        const profileRes = await fetchWithAuth('/api/auth/profile');
        if (profileRes.ok) {
          const data = await profileRes.json();
          const name = data?.profile?.name ?? data?.profile?.name_en ?? '';
          setDepositorName(String(name).trim() || '');
        } else {
          setDepositorName('');
        }
      } catch {
        setDepositorName('');
      } finally {
        setDepositorModalPreFillLoading(false);
      }
      return;
    }

    setSubmitting(true);
    try {

      if (useTossPayment) {
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

        const origin = window.location.origin;
        const successUrl = `${origin}/payment/ticket/success?returnTo=session&sessionId=${sessionId}`;
        const failUrl = `${origin}/payment/ticket/fail?sessionId=${sessionId}`;
        const customerKey = user?.id ?? `anon_${orderId}`;

        let customerMobilePhone: string | undefined;
        if (user?.id) {
          try {
            const profileRes = await fetchWithAuth('/api/auth/profile');
            if (profileRes.ok) {
              const data = await profileRes.json();
              const raw = data?.profile?.phone;
              if (typeof raw === 'string' && raw.trim()) {
                const digits = raw.replace(/\D/g, '');
                if (digits.length >= 8 && digits.length <= 15) customerMobilePhone = digits;
              }
            }
          } catch {
            // 프로필 조회 실패 시 전화번호 없이 진행
          }
        }

        setWidgetOrder({
          orderId,
          amount,
          orderName,
          successUrl,
          failUrl,
          customerKey,
          customerMobilePhone,
        });
        setWidgetModalOpen(true);
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
                    <div className="text-black dark:text-white font-bold">{t('sessionBooking.purchaseAndBook')}</div>
                    <div className="text-xs text-neutral-500">
                      {loadingPurchasableTickets ? t('common.loading') : t('sessionBooking.purchasableCount', { count: purchasableTickets.length })}
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
                    const categoryLabel = category === 'regular' ? ticketLabels.regular : category === 'popup' ? ticketLabels.popup : ticketLabels.workshop;
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
                            {ticket.description && (
                              <p className="mt-1 text-xs text-neutral-400 line-clamp-2">{ticket.description}</p>
                            )}
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

                  {/* 결제 방식 선택 — 토스 비활성화 시 계좌이체만 표시 */}
                  <div className="pt-4 border-t border-neutral-200 dark:border-neutral-800">
                    <p className="text-sm text-neutral-500 mb-3">{t('sessionBooking.paymentType')}</p>
                    {ENABLE_TOSS_PAYMENT ? (
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
                    ) : (
                      <div className="py-2.5 rounded-lg text-sm font-medium bg-primary/20 dark:bg-[#CCFF00]/20 text-primary dark:text-[#CCFF00] text-center">
                        {t('sessionBooking.bankTransfer')} ({language === 'ko' ? '입금 확인 후 예약 확정' : 'Confirm after transfer'})
                      </div>
                    )}
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
          <div className="relative bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl max-w-xl w-full p-5 animate-in zoom-in-95 duration-200">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
                <AlertTriangle size={24} className="text-amber-500" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <h3 className="text-lg font-bold text-black dark:text-white">
                    {t('sessionBooking.onsiteWarningTitle')}
                  </h3>
                  <button
                    onClick={() => setShowOnsiteWarning(false)}
                    className="p-1.5 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 rounded-lg"
                  >
                    <X size={18} />
                  </button>
                </div>
                <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4">
                  1. {t('sessionBooking.onsiteWarningMessage1')} 2. {t('sessionBooking.onsiteWarningMessage2')}
                </p>
                <div className="flex flex-wrap items-center gap-2">
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
                    className="py-2.5 px-4 bg-primary dark:bg-[#CCFF00] text-black font-bold rounded-xl text-sm transition-colors flex items-center gap-2"
                  >
                    <Ticket size={16} />
                    {t('sessionBooking.onsiteWarningBuyTicket')}
                  </button>
                  <button
                    onClick={() => {
                      setPaymentMethod('onsite');
                      setShowOnsiteWarning(false);
                    }}
                    className="py-2 text-xs text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300 underline underline-offset-2"
                  >
                    {t('sessionBooking.onsiteWarningProceed')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 계좌이체 시 비로그인: 로그인/회원가입/비회원 선택 */}
      {bankTransferAuthModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setBankTransferAuthModalOpen(false)} />
          <div className="relative bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl max-w-xl w-full p-5">
            <h3 className="text-lg font-bold text-black dark:text-white mb-1">
              {language === 'ko' ? '수강권 구매 및 예약' : 'Ticket & booking'}
            </h3>
            <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4">
              {language === 'ko' ? '로그인하시겠습니까? 비회원으로 진행하시면 이름·연락처를 입력해 주세요.' : 'Log in or continue as guest with name and contact.'}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => {
                  setBankTransferAuthModalOpen(false);
                  setAuthModalInitialTab('login');
                  setIsAuthModalOpen(true);
                }}
                className="py-2.5 px-5 rounded-xl bg-primary dark:bg-[#CCFF00] text-black font-bold text-sm"
              >
                {t('sessionBooking.loginButton')}
              </button>
              <button
                onClick={() => {
                  setBankTransferAuthModalOpen(false);
                  setAuthModalInitialTab('signup');
                  setIsAuthModalOpen(true);
                }}
                className="py-2.5 px-5 rounded-xl border-2 border-neutral-300 dark:border-neutral-600 text-neutral-800 dark:text-neutral-200 font-medium text-sm"
              >
                {t('sessionBooking.signupButton')}
              </button>
              <button
                onClick={() => {
                  setBankTransferAuthModalOpen(false);
                  setBankTransferGuestFormOpen(true);
                  setGuestFormName('');
                  setGuestFormPhone('');
                  setGuestFormEmail('');
                }}
                className="py-2.5 px-4 text-sm text-neutral-600 dark:text-neutral-400 underline underline-offset-2"
              >
                {language === 'ko' ? '비회원으로 계속하기' : 'Continue as guest'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 비회원 정보 입력 (이름, 연락처, 이메일 — 연락처 또는 이메일 필수) */}
      {bankTransferGuestFormOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setBankTransferGuestFormOpen(false)} />
          <div className="relative bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl max-w-2xl w-full p-5">
            <h3 className="text-lg font-bold text-black dark:text-white mb-1">
              {language === 'ko' ? '비회원 정보 입력' : 'Guest information'}
            </h3>
            <p className="text-xs text-neutral-500 mb-3">
              {language === 'ko' ? '연락처 또는 이메일 중 하나는 필수입니다.' : 'Phone or email is required.'}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
              <div>
                <label className="block text-xs text-neutral-600 dark:text-neutral-400 mb-0.5">{language === 'ko' ? '이름' : 'Name'} *</label>
                <input
                  type="text"
                  value={guestFormName}
                  onChange={(e) => setGuestFormName(e.target.value)}
                  placeholder={language === 'ko' ? '이름' : 'Name'}
                  className="w-full px-3 py-2 rounded-lg bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-black dark:text-white text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-neutral-600 dark:text-neutral-400 mb-0.5">{language === 'ko' ? '연락처' : 'Phone'}</label>
                <input
                  type="tel"
                  value={guestFormPhone}
                  onChange={(e) => setGuestFormPhone(e.target.value)}
                  placeholder="010-0000-0000"
                  className="w-full px-3 py-2 rounded-lg bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-black dark:text-white text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-neutral-600 dark:text-neutral-400 mb-0.5">{language === 'ko' ? '이메일' : 'Email'}</label>
                <input
                  type="email"
                  value={guestFormEmail}
                  onChange={(e) => setGuestFormEmail(e.target.value)}
                  placeholder="email@example.com"
                  className="w-full px-3 py-2 rounded-lg bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-black dark:text-white text-sm"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setBankTransferGuestFormOpen(false)}
                className="py-2 px-4 rounded-xl border border-neutral-300 dark:border-neutral-600 text-sm"
              >
                {language === 'ko' ? '취소' : 'Cancel'}
              </button>
              <button
                onClick={() => {
                  if (!guestFormName.trim()) {
                    setError(language === 'ko' ? '이름을 입력해 주세요.' : 'Enter name.');
                    return;
                  }
                  if (!guestFormPhone.trim() && !guestFormEmail.trim()) {
                    setError(language === 'ko' ? '연락처 또는 이메일 중 하나를 입력해 주세요.' : 'Enter phone or email.');
                    return;
                  }
                  setGuestOrderer({
                    name: guestFormName.trim(),
                    phone: guestFormPhone.trim(),
                    email: guestFormEmail.trim(),
                  });
                  setBankTransferGuestFormOpen(false);
                  setDepositorName(guestFormName.trim());
                  setDepositorModalOpen(true);
                }}
                className="py-2 px-5 rounded-xl bg-primary dark:bg-[#CCFF00] text-black font-bold text-sm"
              >
                {language === 'ko' ? '다음' : 'Next'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 입금자명 입력 + 입금 안내 드로어 (계좌이체: 아래에서 올라오는 패널) */}
      {((depositorModalOpen && pendingBankTransfer) || bankTransferResult) && (
        <div className="fixed inset-0 z-[60] flex flex-col justify-end">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => {
              if (bankTransferResult) { setBankTransferResult(null); setBankCopyFeedback(false); }
              else { setDepositorModalOpen(false); setPendingBankTransfer(null); setGuestOrderer(null); }
            }}
            aria-hidden
          />
          <div
            className="relative bg-white dark:bg-neutral-900 rounded-t-2xl shadow-2xl w-full max-h-[90vh] flex flex-col overflow-hidden"
            role="dialog"
            aria-label={language === 'ko' ? '입금 안내' : 'Transfer details'}
          >
            {/* 드로어 핸들 */}
            <div className="shrink-0 flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-neutral-300 dark:bg-neutral-600" />
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
              {bankTransferResult ? (
                /* Phase 2: 신청 완료 — 입금 안내 + 한꺼번에 복사 */
                <>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-bold text-black dark:text-white">
                      {language === 'ko' ? '입금 안내' : 'Transfer details'}
                    </h3>
                    <button
                      type="button"
                      onClick={() => { setBankTransferResult(null); setBankCopyFeedback(false); }}
                      className="p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-400"
                      aria-label={language === 'ko' ? '닫기' : 'Close'}
                    >
                      <X size={20} />
                    </button>
                  </div>
                  <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4">
                    {language === 'ko'
                      ? '아래 계좌로 입금해 주시면 학원에서 확인 후 예약이 확정됩니다.'
                      : 'Transfer the amount to the account below. Your booking will be confirmed after the academy verifies.'}
                  </p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 p-4 text-sm mb-4">
                    <span className="text-neutral-500">{language === 'ko' ? '금액' : 'Amount'}</span>
                    <span className="font-semibold">{bankTransferResult.amount.toLocaleString()}원</span>
                    <span className="text-neutral-500">{language === 'ko' ? '은행' : 'Bank'}</span>
                    <span>{bankTransferResult.bankName}</span>
                    <span className="text-neutral-500">{language === 'ko' ? '계좌번호' : 'Account'}</span>
                    <span className="font-mono break-all">{bankTransferResult.bankAccountNumber}</span>
                    <span className="text-neutral-500">{language === 'ko' ? '예금주' : 'Holder'}</span>
                    <span>{bankTransferResult.bankDepositorName}</span>
                    {bankTransferResult.ordererName && (
                      <>
                        <span className="text-neutral-500">{language === 'ko' ? '입금자명' : 'Depositor'}</span>
                        <span className="font-medium">{bankTransferResult.ordererName}</span>
                      </>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const lines = [
                        `${language === 'ko' ? '은행' : 'Bank'}: ${bankTransferResult.bankName}`,
                        `${language === 'ko' ? '계좌번호' : 'Account'}: ${bankTransferResult.bankAccountNumber}`,
                        `${language === 'ko' ? '예금주' : 'Holder'}: ${bankTransferResult.bankDepositorName}`,
                      ];
                      navigator.clipboard.writeText(lines.join('\n'));
                      setBankCopyFeedback(true);
                      setTimeout(() => setBankCopyFeedback(false), 2000);
                    }}
                    className="w-full py-3 rounded-xl border-2 border-primary dark:border-[#CCFF00] bg-primary/10 dark:bg-[#CCFF00]/10 text-black dark:text-white font-medium flex items-center justify-center gap-2 mb-3"
                  >
                    <Copy size={18} />
                    {bankCopyFeedback
                      ? (language === 'ko' ? '클립보드에 복사되었습니다' : 'Copied to clipboard')
                      : (language === 'ko' ? '계좌번호 복사' : 'Copy account')}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setBankTransferResult(null); setBankCopyFeedback(false); }}
                    className="w-full py-3 rounded-xl bg-primary dark:bg-[#CCFF00] text-black font-medium"
                  >
                    {language === 'ko' ? '확인' : 'OK'}
                  </button>
                </>
              ) : (
                /* Phase 1: 입금자명 입력 + 입금 안내 문구 + 신청하기 */
                <>
                  <h3 className="text-lg font-bold text-black dark:text-white mb-2">
                    {language === 'ko' ? '입금 안내' : 'Transfer details'}
                  </h3>
                  <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4">
                    {language === 'ko'
                      ? '아래 계좌로 입금해 주시면 학원에서 확인 후 예약이 확정됩니다. 입금자명을 입력한 뒤 신청해 주세요.'
                      : 'Transfer the amount to the account below. Your booking will be confirmed after the academy verifies. Enter the depositor name and submit.'}
                  </p>
                  <div className="mb-4">
                    <label className="block text-sm font-bold text-black dark:text-white mb-1">
                      {language === 'ko' ? '입금자명' : 'Depositor name'}
                    </label>
                    {depositorModalPreFillLoading ? (
                      <div className="py-2 flex items-center gap-2">
                        <Loader2 className="animate-spin text-primary dark:text-[#CCFF00]" size={20} />
                        <span className="text-sm text-neutral-500">...</span>
                      </div>
                    ) : (
                      <input
                        type="text"
                        value={depositorName}
                        onChange={(e) => setDepositorName(e.target.value)}
                        placeholder={language === 'ko' ? '입금 시 사용할 이름' : 'Name for transfer'}
                        className="w-full px-3 py-2.5 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-black dark:text-white text-sm"
                      />
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setDepositorModalOpen(false); setPendingBankTransfer(null); setGuestOrderer(null); }}
                      className="flex-1 py-2.5 px-4 rounded-xl border border-neutral-300 dark:border-neutral-600 text-sm font-medium"
                    >
                      {language === 'ko' ? '취소' : 'Cancel'}
                    </button>
                    <button
                      disabled={submitting || !depositorName.trim() || depositorModalPreFillLoading}
                      onClick={() => {
                        if (guestOrderer) {
                          submitBankTransferOrder(depositorName, guestOrderer.phone || null, guestOrderer.email || null);
                        } else {
                          submitBankTransferOrder(depositorName);
                        }
                      }}
                      className="flex-1 py-2.5 px-5 rounded-xl bg-primary dark:bg-[#CCFF00] text-black font-bold text-sm disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {submitting ? <Loader2 size={18} className="animate-spin" /> : (language === 'ko' ? '신청하기' : 'Submit')}
                    </button>
                  </div>
                </>
              )}
            </div>
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

      {/* 수강권 결제 위젯 모달 (앱 내 결제 유지) — 토스 활성화 시에만 노출 */}
      {ENABLE_TOSS_PAYMENT && widgetOrder && (
        <TicketTossPaymentModal
          isOpen={widgetModalOpen}
          onClose={() => {
            setWidgetModalOpen(false);
            setWidgetOrder(null);
          }}
          onSuccess={() => {}}
          onError={(msg) => {
            setError(msg);
            setWidgetModalOpen(false);
            setWidgetOrder(null);
          }}
          clientKey={process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY}
          orderId={widgetOrder.orderId}
          amount={widgetOrder.amount}
          orderName={widgetOrder.orderName}
          customerKey={widgetOrder.customerKey}
          successUrl={widgetOrder.successUrl}
          failUrl={widgetOrder.failUrl}
          customerMobilePhone={widgetOrder.customerMobilePhone}
        />
      )}
    </div>
  );
}
