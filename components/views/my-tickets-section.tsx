"use client";

import { useState, useEffect, useMemo } from 'react';
import { Ticket, Calendar, Hash, ChevronRight } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { fetchWithAuth } from '@/lib/api/auth-fetch';
import { useTicketLabelsMap } from '@/lib/hooks/useTicketLabels';

interface UserTicketDetail {
  id: string;
  remaining_count: number;
  expiry_date: string;
  start_date: string;
  status: string;
  tickets: {
    id: string;
    name: string;
    ticket_type: 'period' | 'count' | 'PERIOD' | 'COUNT';
    total_count?: number;
    valid_days?: number;
    academy_id: string;
    is_general: boolean;
    is_coupon: boolean;
    access_group?: string;
    ticket_category?: string;
    academies?: {
      id: string;
      name_kr: string;
      name_en: string;
    };
  };
}

type TicketCategory = 'all' | 'regular' | 'popup' | 'workshop';

interface MyTicketsSectionProps {
  onAcademyClick?: (academyId: string) => void;
}

const CATEGORY_CONFIG: Record<'all' | 'regular' | 'popup' | 'workshop', { label: string; color: string; textColor: string }> = {
  all: { label: '전체', color: 'bg-neutral-600', textColor: 'text-neutral-600 dark:text-neutral-400' },
  regular: { label: '정규권', color: 'bg-blue-600', textColor: 'text-blue-600 dark:text-blue-400' },
  popup: { label: '팝업', color: 'bg-purple-600', textColor: 'text-purple-600 dark:text-purple-400' },
  workshop: { label: '워크샵', color: 'bg-amber-600', textColor: 'text-amber-600 dark:text-amber-400' },
};

export const MyTicketsSection = ({ onAcademyClick }: MyTicketsSectionProps) => {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<UserTicketDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TicketCategory>('all');
  const academyIds = useMemo(() => [...new Set(tickets.map((t) => t.tickets?.academy_id).filter(Boolean))] as string[], [tickets]);
  const { labelsMap } = useTicketLabelsMap(academyIds);

  useEffect(() => {
    loadTickets();
  }, [user]);

  const loadTickets = async () => {
    if (!user) {
      setTickets([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const response = await fetchWithAuth('/api/user-tickets');
      if (response.ok) {
        const result = await response.json();
        setTickets(result.data || []);
      } else {
        setTickets([]);
      }
    } catch (error) {
      console.error('Error loading tickets:', error);
      setTickets([]);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const getTicketCategory = (ticket: UserTicketDetail): 'regular' | 'popup' | 'workshop' => {
    const ticketCategory = ticket.tickets?.ticket_category;
    const accessGroup = ticket.tickets?.access_group;
    const isCoupon = ticket.tickets?.is_coupon;
    
    // ticket_category 우선 확인
    if (ticketCategory === 'popup') return 'popup';
    if (ticketCategory === 'workshop') return 'workshop';
    if (ticketCategory === 'regular') return 'regular';
    
    // access_group 폴백
    if (accessGroup === 'popup') return 'popup';
    if (accessGroup === 'workshop') return 'workshop';
    if (isCoupon && accessGroup !== 'regular') return 'popup';
    return 'regular';
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

  const getCategoryBadge = (category: 'regular' | 'popup' | 'workshop', displayLabel?: string) => {
    const label = displayLabel ?? CATEGORY_CONFIG[category].label;
    return (
      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
        category === 'regular' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' :
        category === 'popup' ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400' :
        'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'
      }`}>
        {label}
      </span>
    );
  };

  // 카테고리별 필터링
  const categorizedTickets = tickets.map(t => ({ ...t, category: getTicketCategory(t) }));
  const filteredTickets = activeTab === 'all' 
    ? categorizedTickets 
    : categorizedTickets.filter(t => t.category === activeTab);

  // 카테고리별 개수
  const counts = {
    all: tickets.length,
    regular: categorizedTickets.filter(t => t.category === 'regular').length,
    popup: categorizedTickets.filter(t => t.category === 'popup').length,
    workshop: categorizedTickets.filter(t => t.category === 'workshop').length,
  };

  // 학원별로 그룹핑
  const groupedTickets = filteredTickets.reduce((acc, ticket) => {
    const academyId = ticket.tickets?.academy_id || 'general';
    const academyName = ticket.tickets?.academies?.name_kr || ticket.tickets?.academies?.name_en || (ticket.tickets?.is_general ? '전체 학원' : '기타');
    
    if (!acc[academyId]) {
      acc[academyId] = { academyName, tickets: [] };
    }
    acc[academyId].tickets.push(ticket);
    return acc;
  }, {} as Record<string, { academyName: string; tickets: (UserTicketDetail & { category: 'regular' | 'popup' | 'workshop' })[] }>);

  if (loading) {
    return (
      <div className="mb-6">
        <h3 className="text-lg font-bold text-black dark:text-white mb-4">보유 수강권</h3>
        <div className="text-center py-8 text-neutral-500">로딩 중...</div>
      </div>
    );
  }

  return (
    <div className="mb-6">
      <h3 className="text-lg font-bold text-black dark:text-white mb-4">보유 수강권</h3>
      
      {/* 카테고리 탭 */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
        {(['all', 'regular', 'popup', 'workshop'] as TicketCategory[]).map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveTab(cat)}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
              activeTab === cat
                ? cat === 'all' ? 'bg-black dark:bg-white text-white dark:text-black' :
                  cat === 'regular' ? 'bg-blue-600 text-white' :
                  cat === 'popup' ? 'bg-purple-600 text-white' :
                  'bg-amber-600 text-white'
                : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
            }`}
          >
            {CATEGORY_CONFIG[cat].label} ({counts[cat]})
          </button>
        ))}
      </div>

      {/* 안내 문구 */}
      <div className="text-xs text-neutral-500 bg-neutral-50 dark:bg-neutral-800/50 p-3 rounded-lg mb-4">
        {activeTab === 'regular' && '💡 정규권은 Regular 클래스를 기간 내 수강할 수 있습니다.'}
        {activeTab === 'popup' && '💡 쿠폰제(횟수제) 수강권은 Popup 클래스를 횟수만큼 수강할 수 있습니다.'}
        {activeTab === 'workshop' && '💡 워크샵(특강) 수강권은 Workshop 클래스를 횟수만큼 수강할 수 있습니다.'}
        {activeTab === 'all' && '💡 수강권 유형에 따라 이용 가능한 클래스가 다릅니다.'}
      </div>

      {filteredTickets.length === 0 ? (
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 text-center">
          <Ticket size={48} className="text-neutral-300 dark:text-neutral-700 mx-auto mb-3" />
          <p className="text-neutral-500">
            {activeTab === 'all' ? '보유한 수강권이 없습니다.' : `보유한 ${CATEGORY_CONFIG[activeTab].label}이 없습니다.`}
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
                {academyId !== 'general' && <ChevronRight size={16} className="text-neutral-400" />}
              </button>

              {/* 수강권 목록 */}
              <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
                {group.tickets.map((ticket) => {
                  const academyId = ticket.tickets?.academy_id;
                  const customLabel = academyId ? labelsMap[academyId]?.[ticket.category] : undefined;
                  return (
                  <div key={ticket.id} className="p-4">
                    <div className="flex items-start justify-between mb-2 min-w-0">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        {getCategoryBadge(ticket.category, customLabel)}
                        <span className="font-bold text-black dark:text-white break-words [word-break:keep-all] min-w-0">
                          {ticket.tickets?.name || '수강권'}
                        </span>
                      </div>
                      {getStatusBadge(ticket)}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-neutral-500">
                      {ticket.tickets?.ticket_type?.toLowerCase() === 'count' ? (
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
                    {ticket.tickets?.ticket_type?.toLowerCase() === 'count' && ticket.expiry_date && (
                      <div className="mt-1 text-xs text-neutral-400">
                        유효기간: {formatDate(ticket.expiry_date)}까지
                      </div>
                    )}
                  </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
