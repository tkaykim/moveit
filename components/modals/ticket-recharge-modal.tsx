"use client";

import { useState, useEffect, useCallback } from 'react';
import { X, Search, Ticket as TicketIcon, Loader2 } from 'lucide-react';

interface Ticket {
  id: string;
  name: string;
  price: number | null;
  ticket_type: string;
  total_count: number | null;
  valid_days: number | null;
  academies: {
    id: string;
    name_kr: string | null;
    name_en: string | null;
  } | null;
}

interface Academy {
  id: string;
  name_kr: string | null;
  name_en: string | null;
}

interface TicketRechargeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPurchaseSuccess?: () => void;
}

export const TicketRechargeModal = ({ isOpen, onClose, onPurchaseSuccess }: TicketRechargeModalProps) => {
  const [activeTab, setActiveTab] = useState<'all' | 'academy'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Academy[]>([]);
  const [selectedAcademy, setSelectedAcademy] = useState<Academy | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [purchasing, setPurchasing] = useState<string | null>(null);

  // 수강권 목록 로드
  const loadTickets = useCallback(async (academyId?: string) => {
    setLoading(true);
    try {
      const url = academyId 
        ? `/api/tickets?academyId=${academyId}`
        : '/api/tickets';
      const response = await fetch(url);
      if (response.ok) {
        const { data } = await response.json();
        setTickets(data || []);
      } else {
        console.error('Failed to load tickets');
        setTickets([]);
      }
    } catch (error) {
      console.error('Error loading tickets:', error);
      setTickets([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // 전체 수강권 탭 선택 시
  useEffect(() => {
    if (isOpen && activeTab === 'all') {
      loadTickets();
      setSelectedAcademy(null);
      setSearchQuery('');
    }
  }, [isOpen, activeTab, loadTickets]);

  // 학원 선택 시 수강권 로드
  useEffect(() => {
    if (isOpen && activeTab === 'academy' && selectedAcademy) {
      loadTickets(selectedAcademy.id);
    }
  }, [isOpen, activeTab, selectedAcademy, loadTickets]);

  // 학원 검색
  const handleSearch = useCallback(async (query: string) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    try {
      const response = await fetch(`/api/academies/search?q=${encodeURIComponent(query)}`);
      if (response.ok) {
        const { data } = await response.json();
        setSearchResults(data || []);
      }
    } catch (error) {
      console.error('Error searching academies:', error);
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  // 수강권 구매
  const handlePurchase = async (ticketId: string) => {
    setPurchasing(ticketId);
    try {
      const response = await fetch('/api/tickets/purchase', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ticketId }),
      });

      if (response.ok) {
        const result = await response.json();
        if (result.demo) {
          alert('데모버전입니다. 구매가 완료되었습니다!');
        } else {
          alert('수강권 구매가 완료되었습니다!');
        }
        if (onPurchaseSuccess) {
          onPurchaseSuccess();
        }
        // 수강권 목록 다시 로드
        if (selectedAcademy) {
          loadTickets(selectedAcademy.id);
        } else {
          loadTickets();
        }
      } else {
        const error = await response.json();
        alert(error.error || '수강권 구매에 실패했습니다.');
      }
    } catch (error) {
      console.error('Error purchasing ticket:', error);
      alert('수강권 구매 중 오류가 발생했습니다.');
    } finally {
      setPurchasing(null);
    }
  };

  // 모달 닫기 시 초기화
  const handleClose = () => {
    setActiveTab('all');
    setSearchQuery('');
    setSearchResults([]);
    setSelectedAcademy(null);
    setTickets([]);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 backdrop-blur-sm animate-in fade-in" 
      onClick={handleClose}
    >
      <div 
        className="relative w-full max-w-[420px] bg-white dark:bg-neutral-900 rounded-t-3xl max-h-[90vh] flex flex-col animate-in slide-in-from-bottom duration-300 border-t border-neutral-200 dark:border-neutral-800 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between p-6 border-b border-neutral-200 dark:border-neutral-800">
          <h2 className="text-xl font-bold text-black dark:text-white">수강권 충전</h2>
          <button 
            onClick={handleClose}
            className="text-neutral-400 hover:text-black dark:hover:text-white"
          >
            <X size={24} />
          </button>
        </div>

        {/* 탭 */}
        <div className="flex border-b border-neutral-200 dark:border-neutral-800">
          <button
            onClick={() => setActiveTab('all')}
            className={`flex-1 py-4 text-sm font-bold transition-colors ${
              activeTab === 'all'
                ? 'text-black dark:text-white border-b-2 border-primary dark:border-[#CCFF00]'
                : 'text-neutral-500 dark:text-neutral-400'
            }`}
          >
            전체 수강권
          </button>
          <button
            onClick={() => setActiveTab('academy')}
            className={`flex-1 py-4 text-sm font-bold transition-colors ${
              activeTab === 'academy'
                ? 'text-black dark:text-white border-b-2 border-primary dark:border-[#CCFF00]'
                : 'text-neutral-500 dark:text-neutral-400'
            }`}
          >
            학원별 수강권
          </button>
        </div>

        {/* 컨텐츠 */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === 'academy' && (
            <div className="p-4 border-b border-neutral-200 dark:border-neutral-800">
              {/* 학원 검색 */}
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={18} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  placeholder="학원 이름으로 검색"
                  className="w-full pl-10 pr-4 py-2 bg-neutral-100 dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 text-black dark:text-white placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary dark:focus:ring-[#CCFF00]"
                />
                {searching && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <Loader2 className="animate-spin text-neutral-400" size={18} />
                  </div>
                )}
              </div>

              {/* 검색 결과 */}
              {searchQuery && searchResults.length > 0 && !selectedAcademy && (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {searchResults.map((academy) => (
                    <button
                      key={academy.id}
                      onClick={() => {
                        setSelectedAcademy(academy);
                        setSearchQuery('');
                        setSearchResults([]);
                      }}
                      className="w-full text-left p-3 bg-neutral-100 dark:bg-neutral-800 rounded-xl hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
                    >
                      <div className="font-bold text-black dark:text-white">
                        {academy.name_kr || academy.name_en || '이름 없음'}
                      </div>
                      {academy.name_kr && academy.name_en && (
                        <div className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                          {academy.name_en}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}

              {/* 선택된 학원 */}
              {selectedAcademy && (
                <div className="p-3 bg-primary/10 dark:bg-[#CCFF00]/10 rounded-xl flex items-center justify-between">
                  <div>
                    <div className="font-bold text-black dark:text-white">
                      {selectedAcademy.name_kr || selectedAcademy.name_en || '이름 없음'}
                    </div>
                    {selectedAcademy.name_kr && selectedAcademy.name_en && (
                      <div className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                        {selectedAcademy.name_en}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => {
                      setSelectedAcademy(null);
                      setTickets([]);
                    }}
                    className="text-neutral-500 hover:text-black dark:hover:text-white"
                  >
                    <X size={18} />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* 수강권 목록 */}
          <div className="p-4">
            {loading ? (
              <div className="text-center py-12">
                <Loader2 className="animate-spin text-neutral-400 mx-auto mb-2" size={24} />
                <div className="text-neutral-500 dark:text-neutral-400">로딩 중...</div>
              </div>
            ) : activeTab === 'academy' && !selectedAcademy ? (
              <div className="text-center py-12 text-neutral-500 dark:text-neutral-400">
                학원을 검색하여 선택해주세요
              </div>
            ) : tickets.length === 0 ? (
              <div className="text-center py-12 text-neutral-500 dark:text-neutral-400">
                {activeTab === 'all' ? '전체 수강권이 없습니다' : '해당 학원의 수강권이 없습니다'}
              </div>
            ) : (
              <div className="space-y-3">
                {tickets.map((ticket) => (
                  <div
                    key={ticket.id}
                    className="bg-neutral-100 dark:bg-neutral-800 rounded-2xl p-4 border border-neutral-200 dark:border-neutral-700"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <TicketIcon size={18} className="text-primary dark:text-[#CCFF00]" />
                          <h3 className="font-bold text-black dark:text-white">{ticket.name}</h3>
                        </div>
                        <div className="text-xs text-neutral-500 dark:text-neutral-400">
                          {ticket.ticket_type} • {ticket.total_count}회 • 유효기간 {ticket.valid_days}일
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-black text-primary dark:text-[#CCFF00]">
                          {ticket.price?.toLocaleString()}원
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => handlePurchase(ticket.id)}
                      disabled={purchasing === ticket.id}
                      className="w-full bg-primary dark:bg-[#CCFF00] text-black font-bold py-3 rounded-xl hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity flex items-center justify-center gap-2"
                    >
                      {purchasing === ticket.id ? (
                        <>
                          <Loader2 className="animate-spin" size={18} />
                          구매 중...
                        </>
                      ) : (
                        '구매하기'
                      )}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

