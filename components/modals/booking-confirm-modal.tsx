"use client";

import { useState, useEffect } from 'react';
import { X, Ticket, Check, AlertCircle, Gift, ShoppingCart } from 'lucide-react';
import { getSupabaseClient } from '@/lib/utils/supabase-client';
import { ClassInfo } from '@/types';
import { useRouter } from 'next/navigation';

interface UserTicketInfo {
  id: string;
  remaining_count: number;
  expiry_date: string;
  start_date: string;
  status: string;
  tickets: {
    id: string;
    name: string;
    ticket_type: 'PERIOD' | 'COUNT';
    academy_id: string;
    is_general: boolean;
    is_coupon: boolean; // true: 쿠폰(1회 수강권), false: 정규 수강권
  };
}

interface BookingConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  classInfo: ClassInfo & { time?: string; schedule_id?: string } | null;
  academyId: string;
  classId?: string; // 클래스 ID 추가
  onBookingComplete?: () => void;
}

export const BookingConfirmModal = ({
  isOpen,
  onClose,
  classInfo,
  academyId,
  classId,
  onBookingComplete,
}: BookingConfirmModalProps) => {
  const router = useRouter();
  const [userTickets, setUserTickets] = useState<UserTicketInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [booking, setBooking] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && academyId) {
      loadUserTickets();
    }
  }, [isOpen, academyId, classId]);

  const loadUserTickets = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // 클래스 ID와 학원 ID를 모두 전달하여 해당 클래스에 사용 가능한 수강권만 조회
      const queryParams = new URLSearchParams();
      queryParams.append('academyId', academyId);
      if (classId) {
        queryParams.append('classId', classId);
      }
      
      const response = await fetch(`/api/user-tickets?${queryParams.toString()}`);
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || '수강권 조회에 실패했습니다.');
      }

      // 사용 가능한 수강권만 필터링
      const availableTickets = (result.data || []).filter((t: UserTicketInfo) => {
        if (t.status !== 'ACTIVE') return false;
        
        // 기간 체크
        const now = new Date();
        const expiry = new Date(t.expiry_date);
        if (expiry < now) return false;

        // 횟수권인 경우 남은 횟수 체크
        if (t.tickets?.ticket_type === 'COUNT' && t.remaining_count <= 0) {
          return false;
        }

        return true;
      });

      setUserTickets(availableTickets);
      
      // 첫 번째 수강권 자동 선택
      if (availableTickets.length > 0) {
        setSelectedTicketId(availableTickets[0].id);
      }
    } catch (error: any) {
      console.error('Error loading user tickets:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleBooking = async () => {
    if (!classInfo || !selectedTicketId) return;

    try {
      setBooking(true);
      setError(null);

      const response = await fetch('/api/bookings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          classId: classInfo.id,
          scheduleId: classInfo.schedule_id,
          userTicketId: selectedTicketId,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || '예약에 실패했습니다.');
      }

      setBookingSuccess(true);
      
      setTimeout(() => {
        onBookingComplete?.();
        handleClose();
      }, 2000);
    } catch (error: any) {
      console.error('Error booking:', error);
      setError(error.message || '예약에 실패했습니다.');
    } finally {
      setBooking(false);
    }
  };

  const handleClose = () => {
    setSelectedTicketId(null);
    setBookingSuccess(false);
    setError(null);
    onClose();
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  if (!isOpen || !classInfo) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in"
      onClick={handleClose}
    >
      <div 
        className="w-full sm:max-w-lg max-h-[90vh] bg-white dark:bg-neutral-900 rounded-t-3xl sm:rounded-3xl overflow-hidden animate-in slide-in-from-bottom"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between p-4 border-b border-neutral-200 dark:border-neutral-800">
          <div>
            <h2 className="text-lg font-bold text-black dark:text-white">수업 예약</h2>
            <p className="text-sm text-neutral-500">{classInfo.class_title || classInfo.instructor}</p>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-full transition-colors"
          >
            <X size={20} className="text-neutral-600 dark:text-neutral-400" />
          </button>
        </div>

        {/* 컨텐츠 */}
        <div className="p-4 overflow-y-auto max-h-[60vh]">
          {bookingSuccess ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check size={32} className="text-green-600 dark:text-green-400" />
              </div>
              <h3 className="text-xl font-bold text-black dark:text-white mb-2">
                예약 완료!
              </h3>
              <p className="text-neutral-500">
                수업 예약이 성공적으로 완료되었습니다.
              </p>
            </div>
          ) : loading ? (
            <div className="text-center py-12 text-neutral-500">
              로딩 중...
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <AlertCircle size={48} className="text-red-500 mx-auto mb-4" />
              <p className="text-red-500">{error}</p>
            </div>
          ) : userTickets.length === 0 ? (
            <div className="text-center py-12">
              <Ticket size={48} className="text-neutral-400 mx-auto mb-4" />
              <p className="text-neutral-500 mb-2">사용 가능한 수강권이 없습니다.</p>
              <p className="text-sm text-neutral-400 mb-4">수강권을 구매 후 예약해 주세요.</p>
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 mt-4">
                <div className="flex items-start gap-3">
                  <ShoppingCart className="text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" size={20} />
                  <div className="flex-1 text-left">
                    <p className="text-sm font-medium text-amber-800 dark:text-amber-300 mb-1">
                      수강권이 없으신가요?
                    </p>
                    <p className="text-xs text-amber-700 dark:text-amber-400 mb-3">
                      수강권을 구매하시면 더 저렴하게 수업을 이용하실 수 있습니다.
                    </p>
                    <button
                      onClick={() => {
                        handleClose();
                        router.push(`/tickets${academyId ? `?academyId=${academyId}` : ''}`);
                      }}
                      className="text-xs font-bold text-amber-700 dark:text-amber-300 underline hover:text-amber-800 dark:hover:text-amber-200"
                    >
                      수강권 구매하러 가기 →
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* 수업 정보 */}
              <div className="p-4 bg-neutral-100 dark:bg-neutral-800 rounded-xl">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-bold text-black dark:text-white">
                    {classInfo.instructor}
                  </span>
                  <span className="text-xs px-2 py-1 bg-neutral-200 dark:bg-neutral-700 rounded-full text-neutral-600 dark:text-neutral-400">
                    {classInfo.genre}
                  </span>
                </div>
                <p className="text-sm text-neutral-500">
                  {classInfo.time && `${classInfo.time}`}
                </p>
              </div>

              {/* 수강권/쿠폰 선택 */}
              <div>
                <h3 className="text-sm font-bold text-black dark:text-white mb-2">
                  사용할 수강권/쿠폰 선택
                </h3>
                <div className="space-y-2">
                  {userTickets.map((userTicket) => (
                    <button
                      key={userTicket.id}
                      onClick={() => setSelectedTicketId(userTicket.id)}
                      className={`w-full p-4 rounded-xl border transition-all text-left ${
                        selectedTicketId === userTicket.id
                          ? 'border-neutral-800 dark:border-[#CCFF00] bg-neutral-50 dark:bg-neutral-800'
                          : 'border-neutral-200 dark:border-neutral-700 hover:border-neutral-400 dark:hover:border-neutral-600'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {userTicket.tickets?.is_coupon ? (
                            <Gift size={16} className="text-orange-500" />
                          ) : (
                            <Ticket size={16} className="text-neutral-600 dark:text-neutral-400" />
                          )}
                          <span className="font-bold text-black dark:text-white">
                            {userTicket.tickets?.name || (userTicket.tickets?.is_coupon ? '쿠폰' : '수강권')}
                          </span>
                          {userTicket.tickets?.is_coupon && (
                            <span className="text-xs px-2 py-0.5 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 rounded-full">
                              쿠폰
                            </span>
                          )}
                          {userTicket.tickets?.is_general && (
                            <span className="text-xs px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full">
                              전체 이용
                            </span>
                          )}
                        </div>
                        {selectedTicketId === userTicket.id && (
                          <Check size={20} className="text-green-500" />
                        )}
                      </div>
                      <div className="mt-2 text-sm text-neutral-500">
                        {userTicket.tickets?.ticket_type === 'COUNT' ? (
                          <span>잔여 횟수: {userTicket.remaining_count}회</span>
                        ) : (
                          <span>만료일: {formatDate(userTicket.expiry_date)}</span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 하단 버튼 */}
        {!bookingSuccess && userTickets.length > 0 && !error && (
          <div className="p-4 border-t border-neutral-200 dark:border-neutral-800">
            <button
              onClick={handleBooking}
              disabled={booking || !selectedTicketId}
              className="w-full py-3 bg-neutral-900 dark:bg-[#CCFF00] text-white dark:text-black font-bold rounded-xl hover:bg-neutral-800 dark:hover:bg-[#b8e600] transition-colors disabled:opacity-50"
            >
              {booking ? '처리 중...' : '예약 확정하기'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
