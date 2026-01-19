"use client";

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getSupabaseClient } from '@/lib/utils/supabase-client';
import { ChevronLeft, Calendar, Clock, MapPin, User, Users, Wallet, CheckCircle } from 'lucide-react';
import { formatKSTTime, formatKSTDate } from '@/lib/utils/kst-time';

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
  
  // 게스트 폼 상태
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [error, setError] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'ticket' | 'guest'>('guest');

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
            id, title, genre, difficulty_level, price, academy_id,
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
      setPaymentMethod('ticket');
      loadUserTickets(authUser.id);
    }
  };

  const loadUserTickets = async (userId: string) => {
    if (!session?.classes?.academy_id) return;
    
    try {
      const response = await fetch(`/api/user-tickets?academyId=${session.classes.academy_id}`);
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
    }
  };

  useEffect(() => {
    if (user && session?.classes?.academy_id) {
      loadUserTickets(user.id);
    }
  }, [session?.classes?.academy_id, user]);

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

  const handleSubmit = () => {
    if (paymentMethod === 'guest') {
      handleGuestBooking();
    } else {
      handleTicketBooking();
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
          <span className="text-neutral-500">수업료</span>
          <span className="text-xl font-bold text-primary dark:text-[#CCFF00]">
            {(session.classes?.price || 0).toLocaleString()}원
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
          {/* 로그인 사용자: 결제 방법 선택 */}
          {user && tickets.length > 0 && (
            <div className="space-y-3">
              <h4 className="font-bold text-black dark:text-white">결제 방법</h4>
              
              {/* 수강권 사용 */}
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
                    <div className="text-xs text-neutral-500">보유 수강권으로 결제</div>
                  </div>
                </div>
                {paymentMethod === 'ticket' && (
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
            </div>
          )}

          {/* 수강권 선택 (수강권 결제 시) */}
          {paymentMethod === 'ticket' && tickets.length > 0 && (
            <div className="space-y-3">
              <h4 className="font-bold text-black dark:text-white">수강권 선택</h4>
              {tickets.map((ticket) => (
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
              ))}
            </div>
          )}

          {/* 게스트 예약 폼 (비회원 또는 현장 결제 선택 시) */}
          {(paymentMethod === 'guest' || !user) && (
            <div className="space-y-4">
              <h4 className="font-bold text-black dark:text-white">예약자 정보</h4>
              
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
            disabled={submitting}
            className="w-full bg-primary dark:bg-[#CCFF00] text-black font-bold py-3.5 rounded-xl text-base shadow-lg active:scale-[0.98] transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? '처리 중...' : paymentMethod === 'ticket' ? '수강권으로 예약하기' : '예약 신청하기'}
          </button>
        </div>
      )}
    </div>
  );
}
