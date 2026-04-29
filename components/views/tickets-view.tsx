"use client";

import { ChevronLeft, Ticket, Calendar, Plus, Pause } from 'lucide-react';
import { useState, useEffect } from 'react';
import { LanguageToggle } from '@/components/common/language-toggle';
import { useAuth } from '@/contexts/AuthContext';
import { TicketRechargeModal } from '@/components/modals/ticket-recharge-modal';
import { TicketExtensionRequestModal } from '@/components/modals/ticket-extension-request-modal';
import { fetchWithAuth } from '@/lib/api/auth-fetch';
import { getStudioPalette, getStudioTag } from '@/lib/utils/studio-color';

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
      setLoading(true);
      const res = await fetchWithAuth('/api/user-tickets?includeAll=true');
      const json = await res.json();

      if (!res.ok) {
        if (res.status === 401) {
          setTickets([]);
          return;
        }
        throw new Error(json.error || '수강권 조회 실패');
      }

      const data = json.data || [];
      const maxExt: AcademyMaxExtension = {};
      const today = new Date().toISOString().split('T')[0];

      const formattedTickets: UserTicket[] = data.map((item: any) => {
        const ticket = item.tickets;
        const academy = ticket?.academies;
        const acadId = ticket?.academy_id;
        if (acadId != null) maxExt[acadId] = academy?.max_extension_days ?? null;
        const isPeriod = ticket?.ticket_type === 'PERIOD';

        // 만료 상태 계산: DB status + expiry_date/remaining_count 기반
        let effectiveStatus = item.status || 'ACTIVE';
        if (effectiveStatus === 'ACTIVE') {
          if (item.expiry_date && item.expiry_date < today) {
            effectiveStatus = 'EXPIRED';
          } else if (!isPeriod && item.remaining_count !== null && item.remaining_count <= 0) {
            effectiveStatus = 'USED';
          }
        }

        return {
          id: item.id,
          ticket_name: ticket?.name || '수강권',
          remaining_count: isPeriod ? -1 : (item.remaining_count ?? 0),
          total_count: ticket?.total_count || 0,
          start_date: item.start_date,
          expiry_date: item.expiry_date,
          status: effectiveStatus,
          academy_name: academy?.name_kr || academy?.name_en || '학원',
          academy_id: acadId,
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
      <span className="text-[10px] font-bold px-2 py-1 rounded bg-primary/10/10 text-primary">
        사용가능
      </span>
    );
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-neutral-950 min-h-screen pt-8 px-5 animate-in slide-in-from-bottom duration-300">
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

  const FILTERS: Array<{ id: 'ALL' | 'ACTIVE' | 'EXPIRED' | 'USED'; label: string }> = [
    { id: 'ALL', label: '전체' },
    { id: 'ACTIVE', label: '사용가능' },
    { id: 'EXPIRED', label: '만료' },
    { id: 'USED', label: '사용완료' },
  ];

  return (
    <div className="bg-bg min-h-screen pt-7 px-5 pb-32 animate-in slide-in-from-bottom duration-300">
      {/* 헤더 — 디자인 패턴: meta + hero */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <button onClick={onBack} className="p-1 -ml-1 text-text-3 hover:text-text">
            <ChevronLeft size={18} />
          </button>
          <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-text-3">
            MY PASSES · {filteredTickets.length}
          </span>
        </div>
        <LanguageToggle />
      </div>
      <h1 className="text-[28px] font-semibold leading-[1.1] tracking-[-0.03em] text-text mb-5">
        내 수강권
      </h1>

      {/* 필터 — 디자인의 segmented */}
      <div className="inline-flex bg-surface-2 rounded-[7px] p-[2px] gap-[2px] mb-5">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`px-3 py-1.5 rounded-[5px] text-[12px] font-medium whitespace-nowrap transition-colors ${
              filter === f.id
                ? 'bg-surface text-text shadow-token-sm'
                : 'text-text-3 hover:text-text'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* 수강권 목록 */}
      {filteredTickets.length === 0 ? (
        <div className="text-center py-20">
          <Ticket className="mx-auto mb-4 text-text-4" size={40} />
          <p className="text-text-3 text-[13px] mb-2">보유한 수강권이 없습니다</p>
          <p className="text-[11px] text-text-4 mb-6">수강권을 구매하여 클래스를 예약해보세요</p>
          <button
            onClick={() => setIsRechargeModalOpen(true)}
            className="mx-auto bg-text text-bg text-[13px] font-medium px-5 py-2.5 rounded-[7px] flex items-center gap-2 hover:opacity-90 transition-opacity"
          >
            <Plus size={16} />
            수강권 구매하기
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredTickets.map((ticket) => {
            const palette = getStudioPalette(ticket.academy_id);
            const tag = getStudioTag(ticket.academy_name);
            const isPeriod = ticket.ticket_type === 'PERIOD' || ticket.remaining_count === -1;
            const lowRemaining =
              !isPeriod &&
              ticket.total_count > 0 &&
              ticket.remaining_count > 0 &&
              ticket.remaining_count / ticket.total_count <= 0.3;

            return (
              <div
                key={ticket.id}
                className="rounded-[14px] overflow-hidden relative shadow-token"
                style={{ background: palette.bg, color: palette.ink }}
              >
                {/* 상단: 학원 태그 + 권명 */}
                <div className="px-5 pt-4 pb-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-6 h-6 rounded-md flex items-center justify-center text-[12px] font-bold"
                        style={{
                          background: 'rgba(255,255,255,0.14)',
                          color: palette.ink,
                        }}
                      >
                        {tag}
                      </div>
                      <span className="text-[12px] opacity-80">{ticket.academy_name ?? '·'}</span>
                    </div>
                    {lowRemaining && (
                      <span
                        className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                        style={{ background: 'rgba(255,255,255,0.2)', color: palette.ink }}
                      >
                        잔여 임박
                      </span>
                    )}
                  </div>
                  <h3 className="text-[20px] font-semibold tracking-[-0.02em] leading-tight break-words [word-break:keep-all]">
                    {ticket.ticket_name}
                  </h3>
                </div>

                {/* 점선 perforation */}
                <div
                  className="h-px mx-5"
                  style={{
                    background:
                      'repeating-linear-gradient(to right, rgba(255,255,255,0.5) 0 4px, transparent 4px 8px)',
                  }}
                />

                {/* 하단: REMAINING / EXPIRES (mono) */}
                <div className="px-5 py-3.5 grid grid-cols-2 gap-2 text-[10px] uppercase tracking-[0.08em] opacity-90">
                  <div>
                    <div className="font-mono mb-0.5" style={{ opacity: 0.7 }}>
                      {isPeriod ? 'TYPE' : 'REMAINING'}
                    </div>
                    <div className="font-mono text-[15px] font-semibold opacity-100 normal-case tracking-normal">
                      {isPeriod ? '기간권' : `${ticket.remaining_count}/${ticket.total_count || ticket.remaining_count}`}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono mb-0.5" style={{ opacity: 0.7 }}>
                      EXPIRES
                    </div>
                    <div className="font-mono text-[13px] font-medium opacity-100 normal-case tracking-normal">
                      {ticket.expiry_date
                        ? new Date(ticket.expiry_date).toISOString().slice(0, 10)
                        : '—'}
                    </div>
                  </div>
                </div>

                {/* 연장 신청 (액티브일 때만) */}
                {ticket.status === 'ACTIVE' && ticket.expiry_date && (
                  <button
                    type="button"
                    onClick={() => setExtensionModalTicket(ticket)}
                    className="w-full py-2.5 text-[12px] font-medium flex items-center justify-center gap-1.5"
                    style={{
                      background: 'rgba(255,255,255,0.08)',
                      borderTop: '1px solid rgba(255,255,255,0.12)',
                    }}
                  >
                    <Pause size={12} />
                    연장/일시정지 신청
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 수강권 추가 구매 버튼 (수강권이 있을 때) */}
      {filteredTickets.length > 0 && (
        <div className="fixed bottom-[88px] left-1/2 -translate-x-1/2 w-full max-w-[420px] px-5 z-40">
          <button
            onClick={() => setIsRechargeModalOpen(true)}
            className="w-full bg-text text-bg font-medium text-[13px] py-3.5 rounded-[10px] flex items-center justify-center gap-2 shadow-token-lg hover:opacity-90 transition-opacity"
          >
            <Plus size={16} />
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
          expiryDate={extensionModalTicket.expiry_date ?? null}
          maxExtensionDays={extensionModalTicket.academy_id ? (academyMaxExtension[extensionModalTicket.academy_id] ?? null) : null}
          onSuccess={loadTickets}
        />
      )}
    </div>
  );
};





