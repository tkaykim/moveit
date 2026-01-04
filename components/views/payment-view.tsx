"use client";

import { ChevronLeft, Wallet, CheckCircle, CreditCard, Building2 } from 'lucide-react';
import { Academy, ClassInfo } from '@/types';
import { useState, useEffect } from 'react';

interface PaymentViewProps {
  academy: Academy | null;
  classInfo: (ClassInfo & { time?: string; price?: number }) | null;
  onBack: () => void;
  onPayment: (paymentMethod: string, userTicketId?: string) => void;
}

interface TicketGroup {
  type: 'general' | 'academy';
  name: string;
  count: number;
  tickets: Array<{
    id: string;
    ticket_id: string;
    remaining_count: number;
    ticket_name: string;
  }>;
}

type PaymentMethod = 'card' | 'account' | 'general_ticket' | 'academy_ticket';

export const PaymentView = ({ academy, classInfo, onBack, onPayment }: PaymentViewProps) => {
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('general_ticket');
  const [ticketGroups, setTicketGroups] = useState<TicketGroup[]>([]);
  const [selectedTicketId, setSelectedTicketId] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadTickets = async () => {
      if (!academy?.id) {
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(`/api/user-tickets?academyId=${academy.id}`);
        if (response.ok) {
          const result = await response.json();
          const tickets = result.data || [];

          // 전체 수강권과 학원별 수강권으로 그룹화
          const generalTickets: TicketGroup['tickets'] = [];
          const academyTickets: TicketGroup['tickets'] = [];
          let generalCount = 0;
          let academyCount = 0;

          tickets.forEach((item: any) => {
            const ticket = item.tickets;
            const isGeneral = ticket?.is_general || ticket?.academy_id === null;
            
            const ticketInfo = {
              id: item.id,
              ticket_id: item.ticket_id,
              remaining_count: item.remaining_count || 0,
              ticket_name: ticket?.name || '수강권',
            };

            if (isGeneral) {
              generalTickets.push(ticketInfo);
              generalCount += item.remaining_count || 0;
            } else if (ticket?.academy_id === academy.id) {
              academyTickets.push(ticketInfo);
              academyCount += item.remaining_count || 0;
            }
          });

          const groups: TicketGroup[] = [];
          if (generalCount > 0) {
            groups.push({
              type: 'general',
              name: '어디서나 수강권',
              count: generalCount,
              tickets: generalTickets,
            });
          }
          if (academyCount > 0) {
            groups.push({
              type: 'academy',
              name: `${academy.name_kr || academy.name_en || '학원'} 전용 수강권`,
              count: academyCount,
              tickets: academyTickets,
            });
          }

          setTicketGroups(groups);
          
          // 기본 선택: 전체 수강권이 있으면 전체 수강권, 없으면 학원 전용 수강권
          if (generalCount > 0) {
            setPaymentMethod('general_ticket');
            setSelectedTicketId(generalTickets[0]?.id);
          } else if (academyCount > 0) {
            setPaymentMethod('academy_ticket');
            setSelectedTicketId(academyTickets[0]?.id);
          }
        }
      } catch (error) {
        console.error('Error loading tickets:', error);
      } finally {
        setLoading(false);
      }
    };

    loadTickets();
  }, [academy]);

  const handlePaymentMethodSelect = (method: PaymentMethod) => {
    setPaymentMethod(method);
    
    if (method === 'general_ticket' && ticketGroups.find(g => g.type === 'general')) {
      const generalGroup = ticketGroups.find(g => g.type === 'general');
      setSelectedTicketId(generalGroup?.tickets[0]?.id);
    } else if (method === 'academy_ticket' && ticketGroups.find(g => g.type === 'academy')) {
      const academyGroup = ticketGroups.find(g => g.type === 'academy');
      setSelectedTicketId(academyGroup?.tickets[0]?.id);
    } else {
      setSelectedTicketId(undefined);
    }
  };

  const handlePayment = () => {
    if ((paymentMethod === 'general_ticket' || paymentMethod === 'academy_ticket') && !selectedTicketId) {
      alert('수강권을 선택해주세요.');
      return;
    }
    onPayment(paymentMethod, selectedTicketId);
  };

  const selectedGroup = paymentMethod === 'general_ticket' 
    ? ticketGroups.find(g => g.type === 'general')
    : paymentMethod === 'academy_ticket'
    ? ticketGroups.find(g => g.type === 'academy')
    : null;

  return (
    <div className="bg-white dark:bg-neutral-950 min-h-screen pt-12 px-5 animate-in slide-in-from-bottom duration-300">
      <div className="flex items-center gap-4 mb-8">
        <button onClick={onBack} className="p-2 -ml-2 text-black dark:text-white">
          <ChevronLeft />
        </button>
        <h2 className="text-xl font-bold text-black dark:text-white">결제하기</h2>
      </div>

      {/* 클래스 정보 */}
      <div className="bg-neutral-100 dark:bg-neutral-900 rounded-2xl p-5 border border-neutral-200 dark:border-neutral-800 mb-6">
        <div className="flex justify-between mb-4 border-b border-neutral-200 dark:border-neutral-800 pb-4">
          <div>
            <div className="text-xs text-neutral-600 dark:text-neutral-400 mb-1">
              {academy?.name || "학원 정보 없음"}
            </div>
            <h3 className="text-xl font-black text-black dark:text-white">
              {classInfo?.instructor} <span className="text-sm font-normal text-neutral-600 dark:text-neutral-400">Class</span>
            </h3>
          </div>
          <div className="text-right">
            <div className="text-xs text-neutral-500 dark:text-neutral-500">시간</div>
            <div className="text-black dark:text-white font-bold">{classInfo?.time || "18:00"}</div>
          </div>
        </div>
        <div className="flex justify-between items-center text-sm">
          <span className="text-neutral-600 dark:text-neutral-400">결제 금액</span>
          <span className="text-xl font-bold text-primary dark:text-[#CCFF00]">
            {classInfo?.price?.toLocaleString() || "35,000"}원
          </span>
        </div>
      </div>

      {/* 결제 수단 선택 */}
      <div className="space-y-3 mb-8">
        <h3 className="text-black dark:text-white font-bold text-sm">결제 수단</h3>
        
        {/* 카드 결제 */}
        <button
          onClick={() => handlePaymentMethodSelect('card')}
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
              <div className="text-black dark:text-white font-bold">카드</div>
            </div>
          </div>
          {paymentMethod === 'card' && (
            <div className="w-5 h-5 rounded-full bg-primary dark:bg-[#CCFF00] flex items-center justify-center">
              <CheckCircle size={14} className="text-black" />
            </div>
          )}
        </button>

        {/* 계좌이체 */}
        <button
          onClick={() => handlePaymentMethodSelect('account')}
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
            </div>
          </div>
          {paymentMethod === 'account' && (
            <div className="w-5 h-5 rounded-full bg-primary dark:bg-[#CCFF00] flex items-center justify-center">
              <CheckCircle size={14} className="text-black" />
            </div>
          )}
        </button>

        {/* 전체 수강권 사용 */}
        {!loading && ticketGroups.find(g => g.type === 'general') && (() => {
          const group = ticketGroups.find(g => g.type === 'general')!;
          return (
            <button
              onClick={() => handlePaymentMethodSelect('general_ticket')}
              className={`w-full rounded-xl p-4 flex justify-between items-center border-2 transition-colors ${
                paymentMethod === 'general_ticket'
                  ? 'bg-neutral-200 dark:bg-neutral-800 border-primary dark:border-[#CCFF00]'
                  : 'bg-neutral-100 dark:bg-neutral-900 border-transparent hover:border-neutral-300 dark:hover:border-neutral-700'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  paymentMethod === 'general_ticket' ? 'bg-primary/20 dark:bg-[#CCFF00]/20' : 'bg-neutral-200 dark:bg-neutral-800'
                }`}>
                  <Wallet className={paymentMethod === 'general_ticket' ? 'text-primary dark:text-[#CCFF00]' : 'text-neutral-500'} size={20} />
                </div>
                <div className="text-left">
                  <div className="text-black dark:text-white font-bold">{group.name}</div>
                  <div className="text-xs text-neutral-600 dark:text-neutral-400">잔여: {group.count}회</div>
                </div>
              </div>
              {paymentMethod === 'general_ticket' && (
                <div className="w-5 h-5 rounded-full bg-primary dark:bg-[#CCFF00] flex items-center justify-center">
                  <CheckCircle size={14} className="text-black" />
                </div>
              )}
            </button>
          );
        })()}

        {/* 학원 전용 수강권 사용 */}
        {!loading && ticketGroups.find(g => g.type === 'academy') && (() => {
          const group = ticketGroups.find(g => g.type === 'academy')!;
          return (
            <button
              onClick={() => handlePaymentMethodSelect('academy_ticket')}
              className={`w-full rounded-xl p-4 flex justify-between items-center border-2 transition-colors ${
                paymentMethod === 'academy_ticket'
                  ? 'bg-neutral-200 dark:bg-neutral-800 border-primary dark:border-[#CCFF00]'
                  : 'bg-neutral-100 dark:bg-neutral-900 border-transparent hover:border-neutral-300 dark:hover:border-neutral-700'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  paymentMethod === 'academy_ticket' ? 'bg-primary/20 dark:bg-[#CCFF00]/20' : 'bg-neutral-200 dark:bg-neutral-800'
                }`}>
                  <Wallet className={paymentMethod === 'academy_ticket' ? 'text-primary dark:text-[#CCFF00]' : 'text-neutral-500'} size={20} />
                </div>
                <div className="text-left">
                  <div className="text-black dark:text-white font-bold">{group.name}</div>
                  <div className="text-xs text-neutral-600 dark:text-neutral-400">잔여: {group.count}회</div>
                </div>
              </div>
              {paymentMethod === 'academy_ticket' && (
                <div className="w-5 h-5 rounded-full bg-primary dark:bg-[#CCFF00] flex items-center justify-center">
                  <CheckCircle size={14} className="text-black" />
                </div>
              )}
            </button>
          );
        })()}
      </div>

      {/* 결제하기 버튼 */}
      <button 
        onClick={handlePayment}
        className="w-full bg-primary dark:bg-[#CCFF00] text-black font-black py-4 rounded-xl text-lg shadow-[0_0_20px_rgba(204,255,0,0.3)] active:scale-95 transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
        disabled={loading || ((paymentMethod === 'general_ticket' || paymentMethod === 'academy_ticket') && !selectedTicketId)}
      >
        {paymentMethod === 'card' || paymentMethod === 'account'
          ? '결제하기'
          : '1회권 차감하여 결제하기'
        }
      </button>
    </div>
  );
};
