"use client";

import { ChevronLeft, Ticket, Calendar, Clock, Plus, Pause } from 'lucide-react';
import { useState, useEffect } from 'react';
import { getSupabaseClient } from '@/lib/utils/supabase-client';
import { useAuth } from '@/contexts/AuthContext';
import { TicketRechargeModal } from '@/components/modals/ticket-recharge-modal';
import { TicketExtensionRequestModal } from '@/components/modals/ticket-extension-request-modal';

interface TicketsViewProps {
  onBack: () => void;
  onTicketsRefresh?: () => void;
  academyId?: string;
  classId?: string;
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
  academy_id?: string;
  ticket_type?: string;
}

interface AcademyMaxExtension {
  [academyId: string]: number | null;
}

export const TicketsView = ({ onBack, onTicketsRefresh, academyId, classId }: TicketsViewProps) => {
  const [tickets, setTickets] = useState<UserTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'ALL' | 'ACTIVE' | 'EXPIRED' | 'USED'>('ALL');
  const [isRechargeModalOpen, setIsRechargeModalOpen] = useState(false);
  const [extensionModalTicket, setExtensionModalTicket] = useState<UserTicket | null>(null);
  const [academyMaxExtension, setAcademyMaxExtension] = useState<AcademyMaxExtension>({});
  const { user } = useAuth();

  const loadTickets = async () => {
    if (!user) {
      setTickets([]);
      setLoading(false);
      return;
    }

    try {
      const supabase = getSupabaseClient();
      if (!supabase) {
        setLoading(false);
        return;
      }

      const { data, error } = await (supabase as any)
        .from('user_tickets')
        .select(`
          *,
          tickets (
            name,
            is_general,
            academy_id,
            ticket_type,
            academies (
              name_kr,
              name_en,
              max_extension_days
            )
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const maxExt: AcademyMaxExtension = {};
      const formattedTickets: UserTicket[] = (data || []).map((item: any) => {
        const ticket = item.tickets;
        const academy = ticket?.academies;
        const academyId = ticket?.academy_id;
        if (academyId != null) maxExt[academyId] = academy?.max_extension_days ?? null;
        return {
          id: item.id,
          ticket_name: ticket?.name || '수강권',
          remaining_count: item.remaining_count ?? 0,
          total_count: ticket?.total_count || 0,
          start_date: item.start_date,
          expiry_date: item.expiry_date,
          status: item.status || 'ACTIVE',
          academy_name: academy?.name_kr || academy?.name_en || '학원',
          academy_id: academyId,
          ticket_type: ticket?.ticket_type,
        };
      });

      setTickets(formattedTickets);
      setAcademyMaxExtension(maxExt);
    } catch (error) {
      console.error('Error loading tickets:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTickets();
  }, [user]);

  const filteredTickets = tickets.filter(ticket => {
    if (filter === 'ALL') return true;
    return ticket.status === filter;
  });

  // 학원별로 그룹화
  const ticketsByAcademy = filteredTickets.reduce((acc, ticket) => {
    const academyName = ticket.academy_name || '학원';
    if (!acc[academyName]) {
      acc[academyName] = [];
    }
    acc[academyName].push(ticket);
    return acc;
  }, {} as Record<string, UserTicket[]>);

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
          <h2 className="text-xl font-bold text-black dark:text-white">수강권</h2>
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
        <h2 className="text-xl font-bold text-black dark:text-white">수강권</h2>
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
          <p className="text-xs text-neutral-400 dark:text-neutral-500 mb-6">수강권을 구매하여 클래스를 예약해보세요</p>
          <button
            onClick={() => setIsRechargeModalOpen(true)}
            className="mx-auto bg-primary dark:bg-[#CCFF00] text-black font-bold px-6 py-3 rounded-xl flex items-center gap-2 hover:opacity-90 transition-opacity"
          >
            <Plus size={20} />
            수강권 구매하기
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* 학원별 수강권 */}
          {Object.keys(ticketsByAcademy).length > 0 && (
            <div>
              {Object.entries(ticketsByAcademy).map(([academyName, academyTickets]) => (
                <div key={academyName} className="mb-4">
                  <h4 className="text-xs font-semibold text-neutral-500 dark:text-neutral-500 mb-2 pl-1">
                    {academyName}
                  </h4>
                  <div className="space-y-3">
                    {academyTickets.map((ticket) => (
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
                        {ticket.status === 'ACTIVE' && ticket.expiry_date && (
                          <div className="mt-3 pt-3 border-t border-neutral-200 dark:border-neutral-800">
                            <button
                              type="button"
                              onClick={() => setExtensionModalTicket(ticket)}
                              className="w-full py-2 rounded-xl border border-neutral-300 dark:border-neutral-600 text-sm font-medium text-neutral-700 dark:text-neutral-300 flex items-center justify-center gap-2 hover:bg-neutral-50 dark:hover:bg-neutral-800"
                            >
                              <Pause size={16} />
                              연장/일시정지 신청
                            </button>
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
      )}

      {/* 수강권 추가 구매 버튼 (수강권이 있을 때) */}
      {filteredTickets.length > 0 && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 w-full max-w-[420px] px-5 z-40">
          <button
            onClick={() => setIsRechargeModalOpen(true)}
            className="w-full bg-primary dark:bg-[#CCFF00] text-black font-bold py-4 rounded-xl flex items-center justify-center gap-2 shadow-lg hover:opacity-90 transition-opacity"
          >
            <Plus size={20} />
            수강권 추가 구매
          </button>
        </div>
      )}

      <TicketRechargeModal 
        isOpen={isRechargeModalOpen} 
        onClose={() => setIsRechargeModalOpen(false)}
        academyId={academyId}
        classId={classId}
        onPurchaseSuccess={() => {
          loadTickets();
          if (onTicketsRefresh) {
            onTicketsRefresh();
          }
        }}
      />
      {extensionModalTicket && (
        <TicketExtensionRequestModal
          isOpen={!!extensionModalTicket}
          onClose={() => setExtensionModalTicket(null)}
          userTicketId={extensionModalTicket.id}
          ticketName={extensionModalTicket.ticket_name}
          maxExtensionDays={extensionModalTicket.academy_id ? (academyMaxExtension[extensionModalTicket.academy_id] ?? null) : null}
          onSuccess={loadTickets}
        />
      )}
    </div>
  );
};





