"use client";

import { ChevronLeft, CreditCard, Calendar, CheckCircle, XCircle, Clock } from 'lucide-react';
import { useState, useEffect } from 'react';
import { getSupabaseClient } from '@/lib/utils/supabase-client';

interface PaymentHistoryViewProps {
  onBack: () => void;
}

interface PaymentRecord {
  id: string;
  date: string;
  class_name: string;
  academy_name: string;
  instructor_name: string;
  amount: number;
  status: string;
  payment_method?: string;
}

export const PaymentHistoryView = ({ onBack }: PaymentHistoryViewProps) => {
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'ALL' | 'CONFIRMED' | 'PENDING' | 'CANCELLED'>('ALL');

  useEffect(() => {
    async function loadPayments() {
      try {
        const supabase = getSupabaseClient();
        if (!supabase) {
          setLoading(false);
          return;
        }

        // 인증 기능 제거로 인해 빈 배열로 설정
        setPayments([]);
        setLoading(false);
        return;
      } catch (error) {
        console.error('Error loading payments:', error);
      } finally {
        setLoading(false);
      }
    }
    loadPayments();
  }, []);

  const filteredPayments = payments.filter(payment => {
    if (filter === 'ALL') return true;
    if (filter === 'CONFIRMED') return payment.status === 'CONFIRMED' || payment.status === 'COMPLETED';
    if (filter === 'PENDING') return payment.status === 'PENDING';
    if (filter === 'CANCELLED') return payment.status === 'CANCELLED';
    return true;
  });

  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('ko-KR', { 
      year: 'numeric', 
      month: '2-digit', 
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusIcon = (status: string) => {
    if (status === 'CONFIRMED' || status === 'COMPLETED') {
      return <CheckCircle className="text-primary dark:text-[#CCFF00]" size={16} />;
    }
    if (status === 'CANCELLED') {
      return <XCircle className="text-red-500" size={16} />;
    }
    return <Clock className="text-neutral-400" size={16} />;
  };

  const getStatusText = (status: string) => {
    if (status === 'CONFIRMED' || status === 'COMPLETED') return '완료';
    if (status === 'CANCELLED') return '취소';
    return '대기중';
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-neutral-950 min-h-screen pt-12 px-5 animate-in slide-in-from-bottom duration-300">
        <div className="flex items-center gap-4 mb-8">
          <button onClick={onBack} className="p-2 -ml-2 text-black dark:text-white">
            <ChevronLeft />
          </button>
          <h2 className="text-xl font-bold text-black dark:text-white">결제내역</h2>
        </div>
        <div className="text-center py-12 text-neutral-500">로딩 중...</div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-neutral-950 min-h-screen pt-12 px-5 pb-24 animate-in slide-in-from-bottom duration-300">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={onBack} className="p-2 -ml-2 text-black dark:text-white">
          <ChevronLeft />
        </button>
        <h2 className="text-xl font-bold text-black dark:text-white">결제내역</h2>
      </div>

      {/* 필터 */}
      <div className="flex gap-2 mb-6 overflow-x-auto scrollbar-hide">
        <button
          onClick={() => setFilter('ALL')}
          className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${
            filter === 'ALL'
              ? 'bg-primary dark:bg-[#CCFF00] text-black'
              : 'bg-neutral-100 dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400'
          }`}
        >
          전체
        </button>
        <button
          onClick={() => setFilter('CONFIRMED')}
          className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${
            filter === 'CONFIRMED'
              ? 'bg-primary dark:bg-[#CCFF00] text-black'
              : 'bg-neutral-100 dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400'
          }`}
        >
          완료
        </button>
        <button
          onClick={() => setFilter('PENDING')}
          className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${
            filter === 'PENDING'
              ? 'bg-primary dark:bg-[#CCFF00] text-black'
              : 'bg-neutral-100 dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400'
          }`}
        >
          대기중
        </button>
        <button
          onClick={() => setFilter('CANCELLED')}
          className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${
            filter === 'CANCELLED'
              ? 'bg-primary dark:bg-[#CCFF00] text-black'
              : 'bg-neutral-100 dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400'
          }`}
        >
          취소
        </button>
      </div>

      {/* 결제 내역 목록 */}
      {filteredPayments.length === 0 ? (
        <div className="text-center py-20">
          <CreditCard className="mx-auto mb-4 text-neutral-400 dark:text-neutral-600" size={48} />
          <p className="text-neutral-500 dark:text-neutral-400 mb-2">결제 내역이 없습니다</p>
          <p className="text-xs text-neutral-400 dark:text-neutral-500">클래스를 예약하여 결제 내역을 확인해보세요</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredPayments.map((payment) => (
            <div
              key={payment.id}
              className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-4"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    {getStatusIcon(payment.status)}
                    <h3 className="text-base font-bold text-black dark:text-white">
                      {payment.class_name}
                    </h3>
                  </div>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-1">
                    {payment.academy_name} • {payment.instructor_name}
                  </p>
                  <div className="flex items-center gap-1 text-xs text-neutral-400 dark:text-neutral-500">
                    <Calendar size={12} />
                    {formatDate(payment.date)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-black text-black dark:text-white mb-1">
                    {payment.amount > 0 ? `${payment.amount.toLocaleString()}원` : '수강권 사용'}
                  </div>
                  <div className="text-[10px] text-neutral-500 dark:text-neutral-400">
                    {getStatusText(payment.status)}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};





