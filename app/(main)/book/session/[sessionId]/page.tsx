"use client";

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getSupabaseClient } from '@/lib/utils/supabase-client';
import { ChevronLeft, Calendar, Clock, MapPin, User, Users, Wallet, CheckCircle, CreditCard, Building2, ShoppingCart, LogIn, AlertCircle } from 'lucide-react';
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
    class_type: string | null; // regular, popup, workshop
    access_config: {
      allowCoupon?: boolean;
      allowRegularTicket?: boolean;
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

interface TicketOption {
  id: string;
  ticket_id: string;
  remaining_count: number;
  ticket_name: string;
  type: 'general' | 'academy';
}

interface AvailableTicket {
  id: string;
  name: string;
  price: number;
  ticket_type: 'PERIOD' | 'COUNT';
  total_count?: number;
  valid_days?: number;
  is_general: boolean;
  is_coupon: boolean;
  academy_id: string | null;
  class_types?: string[]; // 이 수강권이 사용 가능한 클래스 타입들 (regular, popup, workshop)
}

export default function SessionBookingPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.sessionId as string;
  
  const [session, setSession] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [tickets, setTickets] = useState<TicketOption[]>([]);
  const [selectedTicketId, setSelectedTicketId] = useState<string>('');
  const [availableTickets, setAvailableTickets] = useState<AvailableTicket[]>([]);
  const [selectedTicketForPurchase, setSelectedTicketForPurchase] = useState<string>('');
  const [loadingTickets, setLoadingTickets] = useState(false);
  
  // 게스트 폼 상태
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [error, setError] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'ticket' | 'card' | 'account' | 'guest'>('guest');
  const [immediatePaymentType, setImmediatePaymentType] = useState<'card' | 'account'>('card');
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [loadingTicketsForUser, setLoadingTicketsForUser] = useState(false);
  const [isTicketPurchaseModalOpen, setIsTicketPurchaseModalOpen] = useState(false);

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
    
    if (authUser) {
      loadUserTickets(authUser.id);
      // 수강권이 있으면 수강권 사용을 기본값으로, 없으면 즉시 결제를 기본값으로
      // loadUserTickets 후에 tickets 상태가 업데이트되면 useEffect에서 처리
    }
  };

  const loadUserTickets = async (userId: string) => {
    if (!session?.classes) return;
    
    try {
      setLoadingTicketsForUser(true);
      // 클래스 ID와 학원 ID를 모두 전달하여 해당 클래스에 사용 가능한 수강권만 조회
      const classId = session.classes.id;
      const academyId = session.classes.academy_id;
      
      const queryParams = new URLSearchParams();
      if (academyId) queryParams.append('academyId', academyId);
      if (classId) queryParams.append('classId', classId);
      
      const response = await fetch(`/api/user-tickets?${queryParams.toString()}`);
      if (response.ok) {
        const result = await response.json();
        const ticketData = result.data || [];
        
        const ticketOptions: TicketOption[] = ticketData
          .filter((item: any) => item.remaining_count > 0)
          .map((item: any) => ({
            id: item.id,
            ticket_id: item.ticket_id,
            remaining_count: item.remaining_count,
            ticket_name: item.tickets?.name || '수강권',
            type: item.tickets?.is_general || !item.tickets?.academy_id ? 'general' : 'academy',
          }));
        
        setTickets(ticketOptions);
        if (ticketOptions.length > 0) {
          setSelectedTicketId(ticketOptions[0].id);
        }
      }
    } catch (err) {
      console.error('Error loading tickets:', err);
    } finally {
      setLoadingTicketsForUser(false);
    }
  };

  useEffect(() => {
    if (user && session?.classes?.academy_id) {
      loadUserTickets(user.id);
    }
  }, [session?.classes?.academy_id, user]);

  // 수강권 로드 후 기본 결제 방법 설정
  useEffect(() => {
    if (user && !loadingTicketsForUser) {
      if (tickets.length > 0 && paymentMethod === 'guest') {
        setPaymentMethod('ticket');
      } else if (tickets.length === 0 && paymentMethod === 'ticket') {
        // 수강권이 없으면 즉시 결제로 변경
        setPaymentMethod('card');
      }
    }
  }, [tickets, user, loadingTicketsForUser]);

  // 즉시 결제 선택 시 사용 가능한 수강권 목록 로드
  const loadAvailableTickets = async () => {
    if (!session?.classes?.academy_id) return;
    
    try {
      setLoadingTickets(true);
      
      // 해당 학원에서 생성한 수강권만 조회
      const response = await fetch(`/api/tickets?academyId=${session.classes.academy_id}`);
      
      if (response.ok) {
        const result = await response.json();
        let allTickets: AvailableTicket[] = result.data || [];
        
        // 해당 학원 수강권만 필터링 (academy_id가 일치하는 것만)
        allTickets = allTickets.filter((t: any) => 
          t.academy_id === session.classes.academy_id
        );
        
        const classId = session.classes.id;
        const currentClassType = session.classes.class_type; // regular, popup, workshop
        const allowCoupon = session.classes.access_config?.allowCoupon === true;
        
        // 각 수강권이 사용 가능한 클래스 타입 추출
        const ticketsWithClassTypes = allTickets.map((t: any) => {
          // ticket_classes가 null이거나 undefined인 경우 빈 배열로 처리
          // Supabase는 연결이 없을 때 null 또는 빈 배열을 반환할 수 있음
          const ticketClasses = Array.isArray(t.ticket_classes) 
            ? t.ticket_classes 
            : (t.ticket_classes ? [t.ticket_classes] : []);
          const classTypes = new Set<string>();
          
          // 전체 수강권은 모든 타입에서 사용 가능
          if (t.is_general) {
            classTypes.add('regular');
            classTypes.add('popup');
            classTypes.add('workshop');
          } else {
            // ticket_classes를 통해 연결된 클래스들의 타입 수집
            ticketClasses.forEach((tc: any) => {
              if (tc?.classes?.class_type) {
                classTypes.add(tc.classes.class_type);
              }
            });
          }
          
          return {
            ...t,
            ticket_classes: ticketClasses, // 정규화된 배열로 저장
            class_types: Array.from(classTypes),
          };
        });
        
        // 현재 수업에 사용 가능한 수강권 필터링
        // 1. ticket_classes 테이블에 해당 ticket_id와 class_id가 직접 연결되어 있는 경우 (최우선)
        // 2. allowCoupon이 true인 경우, 쿠폰 수강권(is_coupon = true)도 포함
        // 3. 전체 수강권 (is_general = true)은 ticket_classes에 연결되어 있지 않으면 제외
        const availableForClass = ticketsWithClassTypes.filter((t: any) => {
          if (!classId) return true; // classId가 없으면 모두 표시
          
          // ticket_classes 테이블에서 해당 클래스와 직접 연결되어 있는지 확인 (최우선)
          const ticketClasses = t.ticket_classes || [];
          const isLinkedToClass = ticketClasses.some((tc: any) => tc?.class_id === classId);
          
          // ticket_classes에 직접 연결된 수강권은 항상 표시
          if (isLinkedToClass) return true;
          
          // 쿠폰 수강권인 경우: allowCoupon이 true여야 함
          if (t.is_coupon) {
            return allowCoupon;
          }
          
          // 전체 수강권(is_general = true)은 ticket_classes에 연결되어 있지 않으면 제외
          // (전체 수강권이라도 특정 클래스에 연결되어 있지 않으면 이 수업용으로는 표시하지 않음)
          if (t.is_general) {
            // ticket_classes에 다른 클래스와 연결되어 있더라도, 현재 클래스와는 연결되지 않았으면 제외
            return false;
          }
          
          // 그 외의 경우는 제외
          return false;
        });
        
        // 현재 수업에 사용 가능한 수강권을 우선 정렬
        if (classId) {
          availableForClass.sort((a: any, b: any) => {
            // 1순위: ticket_classes에 직접 연결된 수강권 (특정 클래스 전용)
            const aTicketClasses = a.ticket_classes || [];
            const bTicketClasses = b.ticket_classes || [];
            const aIsClassSpecific = aTicketClasses.some((tc: any) => tc.class_id === classId);
            const bIsClassSpecific = bTicketClasses.some((tc: any) => tc.class_id === classId);
            
            if (aIsClassSpecific && !bIsClassSpecific) return -1;
            if (!aIsClassSpecific && bIsClassSpecific) return 1;
            
            // 2순위: 쿠폰 수강권은 일반 수강권보다 뒤에 배치
            if (a.is_coupon && !b.is_coupon) return 1;
            if (!a.is_coupon && b.is_coupon) return -1;
            
            // 3순위: 전체 수강권 (is_general = true)은 뒤에 배치
            if (a.is_general && !b.is_general) return 1;
            if (!a.is_general && b.is_general) return -1;
            
            return 0;
          });
        }
        
        // 기본적으로는 현재 수업에 사용 가능한 수강권만 표시
        setAvailableTickets(availableForClass);
        if (availableForClass.length > 0) {
          setSelectedTicketForPurchase(availableForClass[0].id);
        }
      }
    } catch (err) {
      console.error('Error loading available tickets:', err);
    } finally {
      setLoadingTickets(false);
    }
  };

  useEffect(() => {
    if ((paymentMethod === 'card' || paymentMethod === 'account') && session?.classes?.academy_id) {
      loadAvailableTickets();
    }
  }, [paymentMethod, session?.classes?.academy_id]);

  const handleGuestBooking = async () => {
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

  const handleTicketBooking = async () => {
    if (!selectedTicketId) {
      setError('수강권을 선택해주세요. 아래 수강권 목록에서 하나를 선택해주세요.');
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
          userTicketId: selectedTicketId,
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

  const handleImmediatePayment = async () => {
    // 수강권 구매 후 예약하는 경우
    if (selectedTicketForPurchase) {
      setSubmitting(true);
      setError('');

      try {
        // 1. 수강권 구매
        const purchaseResponse = await fetch('/api/tickets/purchase', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ticketId: selectedTicketForPurchase,
            paymentMethod: immediatePaymentType,
          }),
        });

        if (!purchaseResponse.ok) {
          const data = await purchaseResponse.json();
          throw new Error(data.error || '수강권 구매에 실패했습니다.');
        }

        const purchaseResult = await purchaseResponse.json();
        const userTicketId = purchaseResult.data?.id;

        if (!userTicketId) {
          throw new Error('수강권 구매 후 예약 정보를 가져올 수 없습니다.');
        }

        // 2. 구매한 수강권으로 예약 생성
        const bookingResponse = await fetch('/api/bookings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            scheduleId: sessionId,
            userTicketId: userTicketId,
          }),
        });

        if (!bookingResponse.ok) {
          const data = await bookingResponse.json();
          throw new Error(data.error || '예약에 실패했습니다.');
        }

        router.push(`/book/session/${sessionId}/success?type=ticket`);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setSubmitting(false);
      }
    } else {
      // 바로 결제 (수강권 구매 없이 바로 예약)
      setSubmitting(true);
      setError('');

      try {
        const bookingResponse = await fetch('/api/bookings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            scheduleId: sessionId,
            paymentMethod: immediatePaymentType,
            paymentStatus: 'PENDING',
          }),
        });

        if (!bookingResponse.ok) {
          const data = await bookingResponse.json();
          throw new Error(data.error || '예약에 실패했습니다.');
        }

        router.push(`/book/session/${sessionId}/success?type=payment`);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setSubmitting(false);
      }
    }
  };

  const handleSubmit = () => {
    if (paymentMethod === 'guest') {
      handleGuestBooking();
    } else if (paymentMethod === 'ticket') {
      handleTicketBooking();
    } else if (paymentMethod === 'card' || paymentMethod === 'account') {
      handleImmediatePayment();
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

  return (
    <div className="min-h-screen bg-white dark:bg-neutral-950 pt-12 px-5 pb-24">
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

        <div className="mt-4 pt-4 border-t border-neutral-200 dark:border-neutral-800 flex justify-between items-center">
          <span className="text-neutral-500">
            {paymentMethod === 'card' || paymentMethod === 'account' 
              ? (selectedTicketForPurchase 
                  ? '수강권 구매 금액' 
                  : '바로 결제 금액')
              : paymentMethod === 'ticket'
                ? '수강권 사용'
                : '수업료'}
          </span>
          <span className="text-xl font-bold text-primary dark:text-[#CCFF00]">
            {paymentMethod === 'card' || paymentMethod === 'account'
              ? (selectedTicketForPurchase
                  ? (availableTickets.find(t => t.id === selectedTicketForPurchase)?.price || 0).toLocaleString()
                  : (session.classes?.price || 0).toLocaleString())
              : paymentMethod === 'ticket'
                ? '수강권 사용'
                : (session.classes?.price || 0).toLocaleString()}원
          </span>
        </div>
      </div>

      {/* 예약 불가 상태 */}
      {!canBook && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 mb-6 text-center">
          <span className="text-red-600 dark:text-red-400 font-medium">
            {isCanceled ? '취소된 수업입니다.' : isPast ? '이미 종료된 수업입니다.' : '정원이 마감되었습니다.'}
          </span>
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
                    로그인하시면 더 많은 혜택을 받으실 수 있습니다
                  </p>
                  <p className="text-xs text-blue-700 dark:text-blue-400 mb-3">
                    로그인 후 수강권 사용 및 즉시 결제 옵션을 이용하실 수 있습니다.
                  </p>
                  <button
                    onClick={() => setIsAuthModalOpen(true)}
                    className="text-xs font-bold text-blue-700 dark:text-blue-300 underline hover:text-blue-800 dark:hover:text-blue-200"
                  >
                    로그인하기 →
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 로그인 사용자: 결제 방법 선택 */}
          {user && (
            <div className="space-y-3">
              <h4 className="font-bold text-black dark:text-white">결제 방법</h4>
              
              {/* 수강권 사용 버튼 - 수강권이 있을 때만 표시 */}
              {tickets.length > 0 ? (
                <button
                  onClick={() => setPaymentMethod('ticket')}
                  className={`w-full rounded-xl p-4 flex justify-between items-center border-2 transition-colors ${
                    paymentMethod === 'ticket'
                      ? 'bg-neutral-200 dark:bg-neutral-800 border-primary dark:border-[#CCFF00]'
                      : 'bg-neutral-100 dark:bg-neutral-900 border-transparent hover:border-neutral-300 dark:hover:border-neutral-700'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      paymentMethod === 'ticket' ? 'bg-primary/20 dark:bg-[#CCFF00]/20' : 'bg-neutral-200 dark:bg-neutral-800'
                    }`}>
                      <Wallet className={paymentMethod === 'ticket' ? 'text-primary dark:text-[#CCFF00]' : 'text-neutral-500'} size={20} />
                    </div>
                    <div className="text-left">
                      <div className="text-black dark:text-white font-bold">수강권 사용</div>
                      <div className="text-xs text-neutral-500">보유 수강권으로 결제 ({tickets.length}개 보유)</div>
                    </div>
                  </div>
                  {paymentMethod === 'ticket' && (
                    <div className="w-5 h-5 rounded-full bg-primary dark:bg-[#CCFF00] flex items-center justify-center">
                      <CheckCircle size={14} className="text-black" />
                    </div>
                  )}
                </button>
              ) : (
                // 수강권이 없을 때 - 비활성화된 버튼과 안내 메시지
                <div className="space-y-2">
                  <button
                    onClick={() => {
                      setPaymentMethod('ticket');
                      setError('이 수업에 사용 가능한 수강권이 없습니다. 수강권을 구매해주세요.');
                    }}
                    disabled
                    className="w-full rounded-xl p-4 flex justify-between items-center border-2 border-neutral-300 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-900 opacity-60 cursor-not-allowed"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center bg-neutral-200 dark:bg-neutral-800">
                        <Wallet className="text-neutral-400" size={20} />
                      </div>
                      <div className="text-left">
                        <div className="text-neutral-500 dark:text-neutral-400 font-bold">수강권 사용</div>
                        <div className="text-xs text-neutral-400">사용 가능한 수강권 없음</div>
                      </div>
                    </div>
                    <AlertCircle size={20} className="text-amber-500" />
                  </button>
                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
                    <div className="flex items-start gap-3">
                      <ShoppingCart className="text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" size={20} />
                      <div className="flex-1">
                        <p className="text-sm font-bold text-blue-800 dark:text-blue-300 mb-2">
                          이 수업에 사용 가능한 수강권이 없습니다
                        </p>
                        <p className="text-xs text-blue-700 dark:text-blue-400 mb-3">
                          아래 옵션 중 하나를 선택하세요:
                        </p>
                        <div className="space-y-2">
                          <button
                            onClick={() => setIsTicketPurchaseModalOpen(true)}
                            className="w-full bg-primary dark:bg-[#CCFF00] text-black font-bold py-2.5 px-4 rounded-lg hover:opacity-90 transition-opacity text-sm"
                          >
                            수강권 구매하기
                          </button>
                          <button
                            onClick={() => {
                              setPaymentMethod('card');
                              setImmediatePaymentType('card');
                              setSelectedTicketForPurchase('');
                            }}
                            className="w-full bg-blue-600 dark:bg-blue-500 text-white font-bold py-2.5 px-4 rounded-lg hover:opacity-90 transition-opacity text-sm"
                          >
                            바로 결제하기 (수강권 없이)
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 즉시 결제 - 카드 */}
              <button
                onClick={() => {
                  setPaymentMethod('card');
                  setImmediatePaymentType('card');
                }}
                className={`w-full rounded-xl p-4 flex justify-between items-center border-2 transition-colors ${
                  paymentMethod === 'card'
                    ? 'bg-neutral-200 dark:bg-neutral-800 border-primary dark:border-[#CCFF00]'
                    : 'bg-neutral-100 dark:bg-neutral-900 border-transparent hover:border-neutral-300 dark:hover:border-neutral-700'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    paymentMethod === 'card' ? 'bg-primary/20 dark:bg-[#CCFF00]/20' : 'bg-neutral-200 dark:bg-neutral-800'
                  }`}>
                    <CreditCard className={paymentMethod === 'card' ? 'text-primary dark:text-[#CCFF00]' : 'text-neutral-500'} size={20} />
                  </div>
                  <div className="text-left">
                    <div className="text-black dark:text-white font-bold">카드 결제</div>
                    <div className="text-xs text-neutral-500">
                      {availableTickets.length > 0 ? '수강권 구매 후 예약 또는 바로 결제' : '바로 결제'}
                    </div>
                  </div>
                </div>
                {paymentMethod === 'card' && (
                  <div className="w-5 h-5 rounded-full bg-primary dark:bg-[#CCFF00] flex items-center justify-center">
                    <CheckCircle size={14} className="text-black" />
                  </div>
                )}
              </button>

              {/* 즉시 결제 - 계좌이체 */}
              <button
                onClick={() => {
                  setPaymentMethod('account');
                  setImmediatePaymentType('account');
                }}
                className={`w-full rounded-xl p-4 flex justify-between items-center border-2 transition-colors ${
                  paymentMethod === 'account'
                    ? 'bg-neutral-200 dark:bg-neutral-800 border-primary dark:border-[#CCFF00]'
                    : 'bg-neutral-100 dark:bg-neutral-900 border-transparent hover:border-neutral-300 dark:hover:border-neutral-700'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    paymentMethod === 'account' ? 'bg-primary/20 dark:bg-[#CCFF00]/20' : 'bg-neutral-200 dark:bg-neutral-800'
                  }`}>
                    <Building2 className={paymentMethod === 'account' ? 'text-primary dark:text-[#CCFF00]' : 'text-neutral-500'} size={20} />
                  </div>
                  <div className="text-left">
                    <div className="text-black dark:text-white font-bold">계좌이체</div>
                    <div className="text-xs text-neutral-500">
                      {availableTickets.length > 0 ? '수강권 구매 후 예약 또는 바로 결제' : '바로 결제'}
                    </div>
                  </div>
                </div>
                {paymentMethod === 'account' && (
                  <div className="w-5 h-5 rounded-full bg-primary dark:bg-[#CCFF00] flex items-center justify-center">
                    <CheckCircle size={14} className="text-black" />
                  </div>
                )}
              </button>

              {/* 현장 결제 */}
              <button
                onClick={() => setPaymentMethod('guest')}
                className={`w-full rounded-xl p-4 flex justify-between items-center border-2 transition-colors ${
                  paymentMethod === 'guest'
                    ? 'bg-neutral-200 dark:bg-neutral-800 border-primary dark:border-[#CCFF00]'
                    : 'bg-neutral-100 dark:bg-neutral-900 border-transparent hover:border-neutral-300 dark:hover:border-neutral-700'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    paymentMethod === 'guest' ? 'bg-primary/20 dark:bg-[#CCFF00]/20' : 'bg-neutral-200 dark:bg-neutral-800'
                  }`}>
                    <User className={paymentMethod === 'guest' ? 'text-primary dark:text-[#CCFF00]' : 'text-neutral-500'} size={20} />
                  </div>
                  <div className="text-left">
                    <div className="text-black dark:text-white font-bold">현장 결제</div>
                    <div className="text-xs text-neutral-500">방문 시 결제</div>
                  </div>
                </div>
                {paymentMethod === 'guest' && (
                  <div className="w-5 h-5 rounded-full bg-primary dark:bg-[#CCFF00] flex items-center justify-center">
                    <CheckCircle size={14} className="text-black" />
                  </div>
                )}
              </button>

              {/* 수강권이 없을 때 구매 유도 (즉시 결제 선택 시) */}
              {tickets.length === 0 && (paymentMethod === 'card' || paymentMethod === 'account') && availableTickets.length > 0 && (
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <ShoppingCart className="text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" size={20} />
                    <div className="flex-1">
                      <p className="text-sm font-bold text-blue-800 dark:text-blue-300 mb-1">
                        수강권을 구매하고 예약하세요
                      </p>
                      <p className="text-xs text-blue-700 dark:text-blue-400 mb-3">
                        아래에서 수강권을 선택하면 구매와 예약이 함께 진행됩니다. 또는 바로 결제 옵션을 선택하실 수 있습니다.
                      </p>
                      <button
                        onClick={() => setIsTicketPurchaseModalOpen(true)}
                        className="text-xs font-bold text-blue-700 dark:text-blue-300 underline hover:text-blue-800 dark:hover:text-blue-200"
                      >
                        더 많은 수강권 보기 →
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 수강권 선택 (보유 수강권 사용 시) */}
          {paymentMethod === 'ticket' && (
            <div className="space-y-3">
              <h4 className="font-bold text-black dark:text-white">수강권 선택</h4>
              {loadingTicketsForUser ? (
                <div className="text-center py-8 text-neutral-500">수강권 목록을 불러오는 중...</div>
              ) : tickets.length === 0 ? (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" size={20} />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-red-800 dark:text-red-300 mb-1">
                        사용 가능한 수강권이 없습니다
                      </p>
                      <p className="text-xs text-red-700 dark:text-red-400 mb-3">
                        이 수업에 사용 가능한 수강권이 없습니다. 아래 즉시 결제 옵션을 통해 수강권을 구매하고 예약하실 수 있습니다.
                      </p>
                      <button
                        onClick={() => {
                          setPaymentMethod('card');
                          setImmediatePaymentType('card');
                        }}
                        className="text-xs font-bold text-red-700 dark:text-red-300 underline hover:text-red-800 dark:hover:text-red-200"
                      >
                        즉시 결제로 변경하기 →
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                tickets.map((ticket) => (
                  <button
                    key={ticket.id}
                    onClick={() => setSelectedTicketId(ticket.id)}
                    className={`w-full rounded-xl p-4 flex justify-between items-center border-2 transition-colors ${
                      selectedTicketId === ticket.id
                        ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-500'
                        : 'bg-neutral-100 dark:bg-neutral-900 border-transparent hover:border-neutral-300'
                    }`}
                  >
                    <div className="text-left">
                      <div className="text-black dark:text-white font-medium">{ticket.ticket_name}</div>
                      <div className="text-xs text-neutral-500">
                        잔여: {ticket.remaining_count}회 | {ticket.type === 'general' ? '전체 수강권' : '학원 전용'}
                      </div>
                    </div>
                    {selectedTicketId === ticket.id && (
                      <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center">
                        <CheckCircle size={14} className="text-white" />
                      </div>
                    )}
                  </button>
                ))
              )}
            </div>
          )}

          {/* 수강권 선택 또는 바로 결제 (즉시 결제 시) */}
          {(paymentMethod === 'card' || paymentMethod === 'account') && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-black dark:text-white">
                  {availableTickets.length > 0 ? '수강권 선택 (선택사항)' : '바로 결제'}
                </h4>
                {availableTickets.length > 0 && (
                  <button
                    onClick={() => setIsTicketPurchaseModalOpen(true)}
                    className="text-xs text-primary dark:text-[#CCFF00] font-medium underline"
                  >
                    더 보기
                  </button>
                )}
              </div>
              
              {/* 바로 결제 옵션 (수강권 없이) */}
              <button
                onClick={() => setSelectedTicketForPurchase('')}
                className={`w-full rounded-xl p-4 flex justify-between items-center border-2 transition-colors text-left ${
                  selectedTicketForPurchase === ''
                    ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-500'
                    : 'bg-neutral-100 dark:bg-neutral-900 border-neutral-200 dark:border-neutral-700 hover:border-neutral-300 dark:hover:border-neutral-600'
                }`}
              >
                <div className="flex-1">
                  <div className="mb-1">
                    <span className="text-xs font-bold px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-full">
                      바로 결제
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-black dark:text-white font-bold">수강권 없이 바로 결제</span>
                  </div>
                  <div className="text-xs text-neutral-500 space-y-1">
                    <div>수강권 구매 없이 이 수업만 결제</div>
                    <div className="font-bold text-primary dark:text-[#CCFF00]">
                      {(session.classes?.price || 0).toLocaleString()}원
                    </div>
                  </div>
                </div>
                {selectedTicketForPurchase === '' && (
                  <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0 ml-3">
                    <CheckCircle size={14} className="text-white" />
                  </div>
                )}
              </button>

              {loadingTickets ? (
                <div className="text-center py-8 text-neutral-500">수강권 목록을 불러오는 중...</div>
              ) : availableTickets.length === 0 ? (
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
                  <p className="text-sm text-blue-800 dark:text-blue-300 mb-2">
                    이 수업에 사용 가능한 수강권이 없습니다.
                  </p>
                  <p className="text-xs text-blue-700 dark:text-blue-400 mb-3">
                    위의 &quot;바로 결제&quot; 옵션을 선택하시거나, 아래 버튼을 통해 다른 수강권을 확인하실 수 있습니다.
                  </p>
                  <button
                    onClick={() => setIsTicketPurchaseModalOpen(true)}
                    className="text-xs font-bold text-blue-700 dark:text-blue-300 underline hover:text-blue-800 dark:hover:text-blue-200"
                  >
                    다른 수강권 보기 →
                  </button>
                </div>
              ) : (
                <>
                  <div className="text-xs text-neutral-500 dark:text-neutral-400 mb-2 px-2">
                    또는 아래 수강권을 구매하고 예약하세요:
                  </div>
                  {availableTickets.map((ticket) => {
                    // 현재 수업에 사용 가능한 수강권인지 확인 (이미 필터링되어 있음)
                    const classId = session?.classes?.id;
                    const ticketClasses = (ticket as any).ticket_classes || [];
                    const isClassSpecific = classId && ticketClasses.some((tc: any) => tc?.class_id === classId);
                    const isCoupon = ticket.is_coupon === true;
                    
                    // 수강권이 사용 가능한 클래스 타입 표시
                    const getClassTypeLabel = (types: string[] | undefined) => {
                      if (!types || types.length === 0) return '';
                      if (types.length === 3 || ticket.is_general) return '전체';
                      const labels: { [key: string]: string } = {
                        'regular': '정규',
                        'popup': '팝업',
                        'workshop': '워크샵'
                      };
                      return types.map(t => labels[t] || t).join(', ');
                    };
                    
                    const classTypeLabel = getClassTypeLabel(ticket.class_types);
                    
                    // 배지 텍스트 결정
                    let badgeText = '이 수업에 사용 가능';
                    if (isClassSpecific) {
                      badgeText = '이 수업 전용';
                    } else if (isCoupon) {
                      badgeText = '쿠폰으로 사용 가능';
                    }
                    
                    return (
                      <button
                        key={ticket.id}
                        onClick={() => setSelectedTicketForPurchase(ticket.id)}
                        className={`w-full rounded-xl p-4 flex justify-between items-center border-2 transition-colors text-left ${
                          selectedTicketForPurchase === ticket.id
                            ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-500'
                            : 'bg-primary/5 dark:bg-[#CCFF00]/5 border-primary/30 dark:border-[#CCFF00]/30'
                        }`}
                      >
                        <div className="flex-1">
                          <div className="mb-1 flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-bold px-2 py-0.5 bg-primary dark:bg-[#CCFF00] text-black rounded-full">
                              {badgeText}
                            </span>
                            {classTypeLabel && (
                              <span className="text-xs font-medium px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-full">
                                {classTypeLabel} 수강권
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-black dark:text-white font-bold">{ticket.name}</span>
                            {ticket.is_coupon && (
                              <span className="text-xs px-2 py-0.5 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 rounded-full">
                                쿠폰
                              </span>
                            )}
                            {ticket.is_general && (
                              <span className="text-xs px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full">
                                전체 이용
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-neutral-500 space-y-1">
                            {ticket.ticket_type === 'COUNT' ? (
                              <div>{ticket.total_count}회 수강권</div>
                            ) : (
                              <div>{ticket.valid_days}일 이용권</div>
                            )}
                            <div className="font-bold text-primary dark:text-[#CCFF00]">
                              {ticket.price.toLocaleString()}원
                            </div>
                          </div>
                        </div>
                        {selectedTicketForPurchase === ticket.id && (
                          <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0 ml-3">
                            <CheckCircle size={14} className="text-white" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </>
              )}
            </div>
          )}

          {/* 게스트 예약 폼 (비회원 또는 현장 결제 선택 시) */}
          {(paymentMethod === 'guest' || !user) && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-black dark:text-white">예약자 정보</h4>
                {!user && (
                  <button
                    onClick={() => setIsAuthModalOpen(true)}
                    className="text-xs text-primary dark:text-[#CCFF00] font-medium underline"
                  >
                    로그인하기
                  </button>
                )}
              </div>
              
              <div>
                <label className="block text-sm text-neutral-600 dark:text-neutral-400 mb-2">
                  이름 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  placeholder="이름을 입력하세요"
                  className="w-full px-4 py-3 rounded-xl bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-black dark:text-white placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary dark:focus:ring-[#CCFF00]"
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
                  className="w-full px-4 py-3 rounded-xl bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-black dark:text-white placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary dark:focus:ring-[#CCFF00]"
                />
              </div>

              <div className="text-xs text-neutral-500 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-3 rounded-lg">
                💡 예약 후 현장에서 결제해주세요. 수업 시작 전까지 방문 부탁드립니다.
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
          <button
            onClick={handleSubmit}
            disabled={
              submitting || 
              (paymentMethod === 'ticket' && !selectedTicketId)
            }
            className="w-full bg-primary dark:bg-[#CCFF00] text-black font-bold py-3.5 rounded-xl text-base shadow-lg active:scale-[0.98] transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting 
              ? '처리 중...' 
              : paymentMethod === 'ticket' 
                ? '수강권으로 예약하기' 
                : paymentMethod === 'card' || paymentMethod === 'account'
                  ? `수강권 구매 및 예약하기`
                  : '예약 신청하기'}
          </button>
        </div>
      )}

      {/* 로그인 모달 */}
      <MyTab 
        isOpen={isAuthModalOpen} 
        onClose={() => {
          setIsAuthModalOpen(false);
          // 로그인 후 사용자 정보 다시 확인
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
          // 수강권 구매 후 사용자 수강권 목록 다시 로드
          if (user) {
            loadUserTickets(user.id);
          }
          // 즉시 결제용 수강권 목록도 다시 로드
          if (paymentMethod === 'card' || paymentMethod === 'account') {
            loadAvailableTickets();
          }
          setIsTicketPurchaseModalOpen(false);
        }}
      />
    </div>
  );
}
