"use client";

import { useState, useEffect } from 'react';
import { Ticket, Calendar, Hash, ChevronRight, Gift } from 'lucide-react';

interface UserTicketDetail {
  id: string;
  remaining_count: number;
  expiry_date: string;
  start_date: string;
  status: string;
  tickets: {
    id: string;
    name: string;
    ticket_type: 'PERIOD' | 'COUNT';
    total_count?: number;
    valid_days?: number;
    academy_id: string;
    is_general: boolean;
    is_coupon: boolean; // true: 쿠폰(1회 수강권), false: 정규 수강권
    academies?: {
      id: string;
      name_kr: string;
      name_en: string;
    };
  };
}

interface MyTicketsSectionProps {
  onAcademyClick?: (academyId: string) => void;
}

export const MyTicketsSection = ({ onAcademyClick }: MyTicketsSectionProps) => {
  const [tickets, setTickets] = useState<UserTicketDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'ticket' | 'coupon'>('ticket');

  useEffect(() => {
    loadTickets();
  }, []);

  const loadTickets = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/user-tickets');
      if (response.ok) {
        const result = await response.json();
        setTickets(result.data || []);
      }
    } catch (error) {
      console.error('Error loading tickets:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const getStatusBadge = (ticket: UserTicketDetail) => {
    const now = new Date();
    const expiry = new Date(ticket.expiry_date);
    
    if (ticket.status !== 'ACTIVE') {
      return (
        <span className="text-xs px-2 py-0.5 bg-neutral-200 dark:bg-neutral-700 text-neutral-500 rounded-full">
          {ticket.status === 'EXPIRED' ? '만료됨' : ticket.status === 'USED' ? '소진됨' : ticket.status}
        </span>
      );
    }

    const daysLeft = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysLeft <= 7) {
      return (
        <span className="text-xs px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-full">
          {daysLeft}일 남음
        </span>
      );
    } else if (daysLeft <= 30) {
      return (
        <span className="text-xs px-2 py-0.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400 rounded-full">
          {daysLeft}일 남음
        </span>
      );
    }
    
    return (
      <span className="text-xs px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-full">
        사용 가능
      </span>
    );
  };

  // 수강권과 쿠폰 분리
  const regularTickets = tickets.filter(t => !t.tickets?.is_coupon);
  const couponTickets = tickets.filter(t => t.tickets?.is_coupon);
  const displayTickets = activeTab === 'ticket' ? regularTickets : couponTickets;

  // 학원별로 그룹핑
  const groupedTickets = displayTickets.reduce((acc, ticket) => {
    const academyId = ticket.tickets?.academy_id || 'general';
    const academyName = ticket.tickets?.academies?.name_kr || ticket.tickets?.academies?.name_en || (ticket.tickets?.is_general ? '전체 이용' : '기타');
    
    if (!acc[academyId]) {
      acc[academyId] = {
        academyName,
        tickets: [],
      };
    }
    acc[academyId].tickets.push(ticket);
    return acc;
  }, {} as Record<string, { academyName: string; tickets: UserTicketDetail[] }>);

  if (loading) {
    return (
      <div className="mb-6">
        <h3 className="text-lg font-bold text-black dark:text-white mb-4">보유 수강권/쿠폰</h3>
        <div className="text-center py-8 text-neutral-500">로딩 중...</div>
      </div>
    );
  }

  return (
    <div className="mb-6">
      <h3 className="text-lg font-bold text-black dark:text-white mb-4">보유 수강권/쿠폰</h3>
      
      {/* 탭 */}
      <div className="flex mb-4 bg-neutral-100 dark:bg-neutral-800 rounded-xl p-1">
        <button
          onClick={() => setActiveTab('ticket')}
          className={`flex-1 py-2 px-4 rounded-lg text-sm font-bold transition-colors ${
            activeTab === 'ticket'
              ? 'bg-white dark:bg-neutral-900 text-black dark:text-white shadow-sm'
              : 'text-neutral-500 hover:text-black dark:hover:text-white'
          }`}
        >
          <Ticket size={14} className="inline mr-1" />
          수강권 ({regularTickets.length})
        </button>
        <button
          onClick={() => setActiveTab('coupon')}
          className={`flex-1 py-2 px-4 rounded-lg text-sm font-bold transition-colors ${
            activeTab === 'coupon'
              ? 'bg-white dark:bg-neutral-900 text-black dark:text-white shadow-sm'
              : 'text-neutral-500 hover:text-black dark:hover:text-white'
          }`}
        >
          <Gift size={14} className="inline mr-1" />
          쿠폰 ({couponTickets.length})
        </button>
      </div>

      {/* 안내 문구 */}
      <div className="text-xs text-neutral-500 bg-neutral-50 dark:bg-neutral-800/50 p-3 rounded-lg mb-4">
        {activeTab === 'ticket' 
          ? '💡 수강권은 기간 내 정규수업을 수강할 수 있는 권한입니다.'
          : '💡 쿠폰은 쿠폰제 수업 또는 쿠폰 허용된 수업에 사용할 수 있습니다.'
        }
      </div>

      {displayTickets.length === 0 ? (
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 text-center">
          {activeTab === 'ticket' ? (
            <Ticket size={48} className="text-neutral-300 dark:text-neutral-700 mx-auto mb-3" />
          ) : (
            <Gift size={48} className="text-neutral-300 dark:text-neutral-700 mx-auto mb-3" />
          )}
          <p className="text-neutral-500">
            {activeTab === 'ticket' ? '보유한 수강권이 없습니다.' : '보유한 쿠폰이 없습니다.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
        {Object.entries(groupedTickets).map(([academyId, group]) => (
          <div key={academyId} className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl overflow-hidden">
            {/* 학원 헤더 */}
            <button
              onClick={() => academyId !== 'general' && onAcademyClick?.(academyId)}
              className={`w-full p-4 flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800 ${
                academyId !== 'general' ? 'hover:bg-neutral-50 dark:hover:bg-neutral-800' : ''
              }`}
              disabled={academyId === 'general'}
            >
              <span className="font-bold text-black dark:text-white">{group.academyName}</span>
              {academyId !== 'general' && (
                <ChevronRight size={16} className="text-neutral-400" />
              )}
            </button>

            {/* 상품 목록 */}
            <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {group.tickets.map((ticket) => (
                <div key={ticket.id} className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {ticket.tickets?.is_coupon ? (
                        <Gift size={16} className="text-orange-500" />
                      ) : (
                        <Ticket size={16} className="text-neutral-600 dark:text-neutral-400" />
                      )}
                      <span className="font-bold text-black dark:text-white">
                        {ticket.tickets?.name || (activeTab === 'ticket' ? '수강권' : '쿠폰')}
                      </span>
                    </div>
                    {getStatusBadge(ticket)}
                  </div>
                  <div className="flex items-center gap-4 text-sm text-neutral-500">
                    {ticket.tickets?.ticket_type === 'COUNT' ? (
                      <span className="flex items-center gap-1">
                        <Hash size={14} />
                        잔여 {ticket.remaining_count}회 / {ticket.tickets?.total_count || 0}회
                      </span>
                    ) : (
                      <span className="flex items-center gap-1">
                        <Calendar size={14} />
                        {formatDate(ticket.start_date)} ~ {formatDate(ticket.expiry_date)}
                      </span>
                    )}
                  </div>
                  {ticket.tickets?.ticket_type === 'COUNT' && ticket.expiry_date && (
                    <div className="mt-1 text-xs text-neutral-400">
                      유효기간: {formatDate(ticket.expiry_date)}까지
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
        </div>
      )}
    </div>
  );
};
