"use client";

import { ChevronLeft, CreditCard, Calendar, CheckCircle, XCircle, Clock } from 'lucide-react';
import { useState, useEffect } from 'react';
import { LanguageToggle } from '@/components/common/language-toggle';
import { useAuth } from '@/contexts/AuthContext';
import { fetchWithAuth } from '@/lib/api/auth-fetch';
import { getPaymentMethodDisplayLabel } from '@/lib/toss/payment-method';

interface PaymentHistoryViewProps {
  onBack: () => void;
}

interface PaymentRecord {
  id: string;
  type: 'PURCHASE' | 'BOOKING';
  date: string;
  title: string;
  academy_name: string;
  amount: number;
  status: string;
  payment_method?: string;
}

export const PaymentHistoryView = ({ onBack }: PaymentHistoryViewProps) => {
  const { user } = useAuth();
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'ALL' | 'PURCHASE' | 'BOOKING'>('ALL');

  useEffect(() => {
    async function loadPayments() {
      if (!user) {
        setPayments([]);
        setLoading(false);
        return;
      }
      try {
        const res = await fetchWithAuth('/api/payment-history');
        const json = await res.json();
        if (!res.ok) {
          setPayments([]);
          setLoading(false);
          return;
        }
        setPayments(json.data || []);
      } catch (error) {
        console.error('Error loading payments:', error);
        setPayments([]);
      } finally {
        setLoading(false);
      }
    }
    loadPayments();
  }, [user]);

  const filteredPayments = payments.filter(payment => {
    if (filter === 'ALL') return true;
    return payment.type === filter;
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

  const getPaymentMethodLabel = (method?: string) => {
    if (!method) return null;
    const label = getPaymentMethodDisplayLabel(method);
    return label || method;
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-neutral-950 min-h-screen pt-8 px-5 animate-in slide-in-from-bottom duration-300">
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
    <div className="bg-white dark:bg-neutral-950 min-h-screen pt-8 px-5 pb-24 animate-in slide-in-from-bottom duration-300">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 -ml-2 text-black dark:text-white">
            <ChevronLeft />
          </button>
          <h2 className="text-xl font-bold text-black dark:text-white">결제내역</h2>
        </div>
        <LanguageToggle />
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
          onClick={() => setFilter('PURCHASE')}
          className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${
            filter === 'PURCHASE'
              ? 'bg-primary dark:bg-[#CCFF00] text-black'
              : 'bg-neutral-100 dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400'
          }`}
        >
          결제
        </button>
        <button
          onClick={() => setFilter('BOOKING')}
          className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${
            filter === 'BOOKING'
              ? 'bg-primary dark:bg-[#CCFF00] text-black'
              : 'bg-neutral-100 dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400'
          }`}
        >
          출석
        </button>
      </div>

      {/* 결제 내역 목록 */}
      {!user ? (
        <div className="text-center py-20">
          <CreditCard className="mx-auto mb-4 text-neutral-400 dark:text-neutral-600" size={48} />
          <p className="text-neutral-500 dark:text-neutral-400 mb-2">로그인이 필요합니다</p>
          <p className="text-xs text-neutral-400 dark:text-neutral-500">결제 내역을 보려면 로그인해 주세요</p>
        </div>
      ) : filteredPayments.length === 0 ? (
        <div className="text-center py-20">
          <CreditCard className="mx-auto mb-4 text-neutral-400 dark:text-neutral-600" size={48} />
          <p className="text-neutral-500 dark:text-neutral-400 mb-2">결제 내역이 없습니다</p>
          <p className="text-xs text-neutral-400 dark:text-neutral-500">수강권 구매 또는 클래스 예약 시 여기에 표시됩니다</p>
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
                      {payment.title}
                    </h3>
                    {payment.type === 'BOOKING' && (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-primary/10 dark:bg-[#CCFF00]/20 text-primary dark:text-[#CCFF00] font-bold">
                        출석
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-1">
                    {payment.academy_name}
                  </p>
                  <div className="flex items-center gap-1 text-xs text-neutral-400 dark:text-neutral-500">
                    <Calendar size={12} />
                    {formatDate(payment.date)}
                    {payment.type === 'PURCHASE' && getPaymentMethodLabel(payment.payment_method) && (
                      <span className="ml-1">· {getPaymentMethodLabel(payment.payment_method)}</span>
                    )}
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





