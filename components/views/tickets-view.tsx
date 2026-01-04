"use client";

import { ChevronLeft, Ticket, Calendar, Clock } from 'lucide-react';
import { useState, useEffect } from 'react';
import { getSupabaseClient } from '@/lib/utils/supabase-client';

interface TicketsViewProps {
  onBack: () => void;
}

interface UserTicket {
  id: string;
  ticket_name: string;
  remaining_count: number;
  total_count: number;
  start_date: string | null;
  expiry_date: string | null;
  status: string;
  academy_name?: string;
}

export const TicketsView = ({ onBack }: TicketsViewProps) => {
  const [tickets, setTickets] = useState<UserTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'ALL' | 'ACTIVE' | 'EXPIRED' | 'USED'>('ALL');

  useEffect(() => {
    async function loadTickets() {
      try {
        const supabase = getSupabaseClient();
        if (!supabase) {
          setLoading(false);
          return;
        }

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setLoading(false);
          return;
        }

        const { data: userTickets } = await (supabase as any)
          .from('user_tickets')
          .select(`
            *,
            tickets (
              name,
              academy_id
            ),
            academies:academy_id (
              name_kr,
              name_en
            )
          `)
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (userTickets) {
          const transformedTickets = userTickets.map((ut: any) => {
            const ticket = ut.tickets || {};
            const academy = ut.academies || {};
            const academyName = academy.name_kr || academy.name_en || '전체 학원';
            
            return {
              id: ut.id,
              ticket_name: ticket.name || '수강권',
              remaining_count: ut.remaining_count || 0,
              total_count: ut.remaining_count || 0, // total_count는 tickets 테이블에 있을 수 있음
              start_date: ut.start_date,
              expiry_date: ut.expiry_date,
              status: ut.status || 'ACTIVE',
              academy_name: academyName,
            };
          });
          setTickets(transformedTickets);
        }
      } catch (error) {
        console.error('Error loading tickets:', error);
      } finally {
        setLoading(false);
      }
    }
    loadTickets();
  }, []);

  const filteredTickets = tickets.filter(ticket => {
    if (filter === 'ALL') return true;
    return ticket.status === filter;
  });

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('ko-KR', { 
      year: 'numeric', 
      month: '2-digit', 
      day: '2-digit' 
    });
  };

  const getStatusBadge = (status: string, expiryDate: string | null) => {
    if (status === 'EXPIRED' || status === 'USED') {
      return (
        <span className="text-[10px] font-bold px-2 py-1 rounded bg-neutral-200 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-400">
          {status === 'EXPIRED' ? '만료' : '사용완료'}
        </span>
      );
    }
    
    if (expiryDate) {
      const expiry = new Date(expiryDate);
      const now = new Date();
      if (expiry < now) {
        return (
          <span className="text-[10px] font-bold px-2 py-1 rounded bg-red-500/10 text-red-500 dark:text-red-400">
            만료
          </span>
        );
      }
    }
    
    return (
      <span className="text-[10px] font-bold px-2 py-1 rounded bg-primary/10 dark:bg-[#CCFF00]/10 text-primary dark:text-[#CCFF00]">
        사용가능
      </span>
    );
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-neutral-950 min-h-screen pt-12 px-5 animate-in slide-in-from-bottom duration-300">
        <div className="flex items-center gap-4 mb-8">
          <button onClick={onBack} className="p-2 -ml-2 text-black dark:text-white">
            <ChevronLeft />
          </button>
          <h2 className="text-xl font-bold text-black dark:text-white">회원권</h2>
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
        <h2 className="text-xl font-bold text-black dark:text-white">회원권</h2>
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
          onClick={() => setFilter('ACTIVE')}
          className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${
            filter === 'ACTIVE'
              ? 'bg-primary dark:bg-[#CCFF00] text-black'
              : 'bg-neutral-100 dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400'
          }`}
        >
          사용가능
        </button>
        <button
          onClick={() => setFilter('EXPIRED')}
          className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${
            filter === 'EXPIRED'
              ? 'bg-primary dark:bg-[#CCFF00] text-black'
              : 'bg-neutral-100 dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400'
          }`}
        >
          만료
        </button>
        <button
          onClick={() => setFilter('USED')}
          className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${
            filter === 'USED'
              ? 'bg-primary dark:bg-[#CCFF00] text-black'
              : 'bg-neutral-100 dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400'
          }`}
        >
          사용완료
        </button>
      </div>

      {/* 수강권 목록 */}
      {filteredTickets.length === 0 ? (
        <div className="text-center py-20">
          <Ticket className="mx-auto mb-4 text-neutral-400 dark:text-neutral-600" size={48} />
          <p className="text-neutral-500 dark:text-neutral-400 mb-2">보유한 수강권이 없습니다</p>
          <p className="text-xs text-neutral-400 dark:text-neutral-500">클래스를 예약하여 수강권을 구매해보세요</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredTickets.map((ticket) => (
            <div
              key={ticket.id}
              className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-4"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Ticket className="text-primary dark:text-[#CCFF00]" size={20} />
                    <h3 className="text-base font-bold text-black dark:text-white">
                      {ticket.ticket_name}
                    </h3>
                  </div>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    {ticket.academy_name}
                  </p>
                </div>
                {getStatusBadge(ticket.status, ticket.expiry_date)}
              </div>

              <div className="grid grid-cols-2 gap-4 pt-3 border-t border-neutral-200 dark:border-neutral-800">
                <div>
                  <div className="text-xs text-neutral-500 dark:text-neutral-400 mb-1">잔여 횟수</div>
                  <div className="text-lg font-black text-black dark:text-white">
                    {ticket.remaining_count}회
                  </div>
                </div>
                <div>
                  <div className="text-xs text-neutral-500 dark:text-neutral-400 mb-1">만료일</div>
                  <div className="text-sm font-bold text-black dark:text-white flex items-center gap-1">
                    <Calendar size={14} />
                    {formatDate(ticket.expiry_date)}
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



