"use client";

import { useState, useEffect, useMemo } from 'react';
import { Ticket, TrendingUp, Settings, Plus, Tag, Zap, ChevronDown, ChevronUp, Search, Trash2 } from 'lucide-react';
import { SectionHeader } from '../common/section-header';
import { TicketModal } from './products/ticket-modal';
import { DiscountModal } from './products/discount-modal';
import { getSupabaseClient } from '@/lib/utils/supabase-client';
import { formatCurrency } from './utils/format-currency';

interface ProductViewProps {
  academyId: string;
}

type TicketCategoryFilter = 'all' | 'regular' | 'popup' | 'workshop';

export function ProductView({ academyId }: ProductViewProps) {
  const [tickets, setTickets] = useState<any[]>([]);
  const [discounts, setDiscounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const [selectedDiscount, setSelectedDiscount] = useState<any>(null);
  const [categoryFilter, setCategoryFilter] = useState<TicketCategoryFilter>('all');
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    regular: true,
    popup: true,
    workshop: true,
  });
  const [initialTicketCategory, setInitialTicketCategory] = useState<'regular' | 'popup' | 'workshop' | undefined>(undefined);
  const [searchQuery, setSearchQuery] = useState('');
  const [deletingTicketId, setDeletingTicketId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [academyId]);

  const loadData = async () => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      setLoading(false);
      return;
    }

    try {
      // 수강권 목록
      const { data: ticketsData, error: ticketsError } = await supabase
        .from('tickets')
        .select('*')
        .eq('academy_id', academyId)
        .order('created_at', { ascending: false });

      if (ticketsError) throw ticketsError;
      setTickets(ticketsData || []);

      // 할인 정책 목록
      const { data: discountsData, error: discountsError } = await supabase
        .from('discounts')
        .select('*')
        .eq('academy_id', academyId)
        .order('created_at', { ascending: false });

      if (discountsError) throw discountsError;
      setDiscounts(discountsData || []);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTicket = async (product: any) => {
    if (!product?.id) return;
    const message = `"${product.name}" 수강권을 삭제하시겠습니까?\n\n클래스 연결 정보(ticket_classes)는 함께 삭제됩니다. 보유 회원이 있거나 매출 이력이 있는 수강권은 삭제할 수 없습니다.`;
    if (!confirm(message)) return;

    const supabase = getSupabaseClient();
    if (!supabase) return;

    setDeletingTicketId(product.id);
    try {
      // 1) ticket_classes에서 해당 수강권 연결 삭제
      await supabase.from('ticket_classes').delete().eq('ticket_id', product.id);

      // 2) tickets 삭제 (user_tickets·revenue_transactions 참조 시 FK 오류)
      const { error } = await supabase.from('tickets').delete().eq('id', product.id).eq('academy_id', academyId);

      if (error) {
        if (error.code === '23503') {
          alert('보유 회원이 있거나 매출 이력이 있어 삭제할 수 없습니다. 판매 중지만 가능합니다.');
        } else {
          alert(`삭제 실패: ${error.message}`);
        }
        return;
      }
      if (selectedTicket?.id === product.id) {
        setSelectedTicket(null);
        setShowTicketModal(false);
      }
      loadData();
    } catch (err: any) {
      console.error('Delete ticket error:', err);
      alert(err?.message || '삭제 중 오류가 발생했습니다.');
    } finally {
      setDeletingTicketId(null);
    }
  };

  // 수강권 유형 정보
  const TICKET_CATEGORY_CONFIG = {
    regular: {
      name: '정규',
      fullName: '정규 수강권',
      classType: 'Regular',
      badgeColor: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
      borderColor: 'hover:border-blue-300 dark:hover:border-blue-600',
    },
    popup: {
      name: '팝업',
      fullName: '팝업 수강권',
      classType: 'Popup',
      badgeColor: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400',
      borderColor: 'hover:border-purple-300 dark:hover:border-purple-600',
    },
    workshop: {
      name: '워크샵',
      fullName: '워크샵 수강권',
      classType: 'Workshop',
      badgeColor: 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400',
      borderColor: 'hover:border-amber-300 dark:hover:border-amber-600',
    },
  };

  const getTicketCategory = (ticket: any): 'regular' | 'popup' | 'workshop' => {
    // access_group으로 먼저 판단
    if (ticket.access_group === 'popup') return 'popup';
    if (ticket.access_group === 'workshop') return 'workshop';
    // is_coupon이 true인 경우 팝업으로 분류 (레거시 지원)
    if (ticket.is_coupon === true && ticket.access_group !== 'regular') return 'popup';
    // 기본값은 정규 수강권
    return 'regular';
  };

  const getCategoryBadgeColor = (category: 'regular' | 'popup' | 'workshop'): string => {
    return TICKET_CATEGORY_CONFIG[category].badgeColor;
  };

  // 검색 필터링된 수강권 목록
  const filteredTickets = useMemo(() => {
    if (!searchQuery.trim()) return tickets;
    const query = searchQuery.toLowerCase();
    return tickets.filter(ticket => 
      (ticket.name?.toLowerCase().includes(query)) ||
      (ticket.price?.toString().includes(query)) ||
      (ticket.ticket_type?.toLowerCase().includes(query)) ||
      (ticket.valid_days?.toString().includes(query)) ||
      (ticket.total_count?.toString().includes(query))
    );
  }, [tickets, searchQuery]);

  // 검색 필터링된 할인 정책 목록
  const filteredDiscounts = useMemo(() => {
    if (!searchQuery.trim()) return discounts;
    const query = searchQuery.toLowerCase();
    return discounts.filter(discount => 
      (discount.name?.toLowerCase().includes(query)) ||
      (discount.discount_value?.toString().includes(query)) ||
      (discount.discount_type?.toLowerCase().includes(query))
    );
  }, [discounts, searchQuery]);

  // 수강권을 타입별로 분류 (검색 필터링 적용)
  const regularTickets = filteredTickets.filter(t => getTicketCategory(t) === 'regular');
  const popupTickets = filteredTickets.filter(t => getTicketCategory(t) === 'popup');
  const workshopTickets = filteredTickets.filter(t => getTicketCategory(t) === 'workshop');

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  // 필터링된 카테고리 목록
  const getFilteredCategories = () => {
    if (categoryFilter === 'all') {
      return ['regular', 'popup', 'workshop'] as const;
    }
    return [categoryFilter] as const;
  };

  const getTicketsByCategory = (category: 'regular' | 'popup' | 'workshop') => {
    switch (category) {
      case 'regular': return regularTickets;
      case 'popup': return popupTickets;
      case 'workshop': return workshopTickets;
    }
  };

  const getCategoryIcon = (category: 'regular' | 'popup' | 'workshop') => {
    switch (category) {
      case 'regular': return <Ticket size={18} className="text-blue-500" />;
      case 'popup': return <Zap size={18} className="text-purple-500" />;
      case 'workshop': return <Tag size={18} className="text-amber-500" />;
    }
  };

  const getCategoryDescription = (category: 'regular' | 'popup' | 'workshop') => {
    switch (category) {
      case 'regular': return '기간제 수강권. 구매 시 시작일 선택, 기간 내 무제한 수강';
      case 'popup': return '횟수제 쿠폰. 유효기간 내 미소진 시 잔여 수량 소멸';
      case 'workshop': return '특정 워크샵 전용. 해당 워크샵에서만 사용 가능';
    }
  };

  const getCategoryCardStyle = (category: 'regular' | 'popup' | 'workshop') => {
    switch (category) {
      case 'regular': return {
        headerBg: 'bg-blue-50 dark:bg-blue-900/20',
        border: 'border-blue-200 dark:border-blue-800',
        iconBg: 'bg-blue-100 dark:bg-blue-900/40',
      };
      case 'popup': return {
        headerBg: 'bg-purple-50 dark:bg-purple-900/20',
        border: 'border-purple-200 dark:border-purple-800',
        iconBg: 'bg-purple-100 dark:bg-purple-900/40',
      };
      case 'workshop': return {
        headerBg: 'bg-amber-50 dark:bg-amber-900/20',
        border: 'border-amber-200 dark:border-amber-800',
        iconBg: 'bg-amber-100 dark:bg-amber-900/40',
      };
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500 dark:text-gray-400">로딩 중...</div>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        <SectionHeader
          title="수강권 및 상품 관리"
          buttonText="새 상품 추가"
          onButtonClick={() => {
            setSelectedTicket(null);
            setInitialTicketCategory(undefined);
            setShowTicketModal(true);
          }}
        />

        {/* 검색 및 카테고리 필터 */}
        <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-sm border border-gray-100 dark:border-neutral-800 p-4 space-y-4">
          {/* 검색 입력 */}
          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="수강권명, 가격, 유형으로 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary dark:focus:ring-[#CCFF00] text-gray-900 dark:text-white"
            />
          </div>

          {/* 카테고리 필터 탭 */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setCategoryFilter('all')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                categoryFilter === 'all'
                  ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900'
                  : 'bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-neutral-700'
              }`}
            >
              전체 ({filteredTickets.length})
            </button>
            <button
              onClick={() => setCategoryFilter('regular')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                categoryFilter === 'regular'
                  ? 'bg-blue-600 text-white'
                  : 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40'
              }`}
            >
              <Ticket size={16} />
              정규 수강권 ({regularTickets.length})
            </button>
            <button
              onClick={() => setCategoryFilter('popup')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                categoryFilter === 'popup'
                  ? 'bg-purple-600 text-white'
                  : 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-900/40'
              }`}
            >
              <Zap size={16} />
              팝업 쿠폰 ({popupTickets.length})
            </button>
            <button
              onClick={() => setCategoryFilter('workshop')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                categoryFilter === 'workshop'
                  ? 'bg-amber-600 text-white'
                  : 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/40'
              }`}
            >
              <Tag size={16} />
              워크샵 수강권 ({workshopTickets.length})
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 상품 목록 */}
          <div className="space-y-4">
            {getFilteredCategories().map((category) => {
              const categoryTickets = getTicketsByCategory(category);
              const style = getCategoryCardStyle(category);
              const config = TICKET_CATEGORY_CONFIG[category];
              const isExpanded = expandedSections[category];

              return (
                <div
                  key={category}
                  className={`bg-white dark:bg-neutral-900 rounded-xl shadow-sm border overflow-hidden ${style.border}`}
                >
                  {/* 아코디언 헤더 */}
                  <button
                    onClick={() => toggleSection(category)}
                    className={`w-full p-4 flex items-center justify-between ${style.headerBg} transition-colors hover:opacity-90`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${style.iconBg}`}>
                        {getCategoryIcon(category)}
                      </div>
                      <div className="text-left">
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-gray-800 dark:text-white">
                            {config.fullName}
                          </h3>
                          <span className={`text-xs font-bold px-2 py-0.5 rounded ${config.badgeColor}`}>
                            {categoryTickets.length}개
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          {getCategoryDescription(category)}
                        </p>
                      </div>
                    </div>
                    {isExpanded ? (
                      <ChevronUp size={20} className="text-gray-400" />
                    ) : (
                      <ChevronDown size={20} className="text-gray-400" />
                    )}
                  </button>

                  {/* 아코디언 컨텐츠 */}
                  {isExpanded && (
                    <div className="p-4 space-y-2 border-t dark:border-neutral-800">
                      {categoryTickets.length === 0 ? (
                        <div className="text-center py-6 text-gray-400 dark:text-gray-500">
                          <p className="text-sm">
                            {searchQuery 
                              ? `"${searchQuery}"에 대한 검색 결과가 없습니다.`
                              : `등록된 ${config.fullName}이(가) 없습니다`}
                          </p>
                          {!searchQuery && (
                            <button
                              onClick={() => {
                                setSelectedTicket(null);
                                setInitialTicketCategory(category);
                                setShowTicketModal(true);
                              }}
                              className="mt-2 text-xs text-blue-600 dark:text-blue-400 hover:underline"
                            >
                              + 새로 만들기
                            </button>
                          )}
                        </div>
                      ) : (
                        categoryTickets.map((product) => {
                          const opts = (category === 'popup' && product.count_options && Array.isArray(product.count_options) && product.count_options.length > 0)
                            ? product.count_options as { count?: number; price?: number; valid_days?: number | null }[]
                            : null;
                          return (
                          <div
                            key={product.id}
                            className={`flex justify-between items-start gap-2 p-3 border dark:border-neutral-800 rounded-lg transition-colors bg-white dark:bg-neutral-900 ${config.borderColor} ${deletingTicketId === product.id ? 'opacity-60 pointer-events-none' : ''}`}
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <h4 className="font-bold text-sm text-gray-800 dark:text-white truncate">{product.name}</h4>
                                {!product.is_on_sale && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-neutral-800 text-gray-500 dark:text-gray-400 flex-shrink-0">
                                    판매중지
                                  </span>
                                )}
                                {product.is_public === false && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-200 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-400 flex-shrink-0">
                                    비공개
                                  </span>
                                )}
                              </div>
                              {category === 'regular' && (
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                  {formatCurrency(product.price ?? 0)}
                                  {product.valid_days && <span> • {product.valid_days}일</span>}
                                </p>
                              )}
                              {(category === 'popup' || category === 'workshop') && !opts && (
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                  {formatCurrency(product.price ?? 0)}
                                  <span> • {product.total_count ?? 0}회</span>
                                  {product.valid_days && <span> • 유효 {product.valid_days}일</span>}
                                </p>
                              )}
                              {opts && (
                                <div className="mt-2">
                                  <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">옵션</span>
                                  <div className="flex flex-wrap gap-1.5 mt-1">
                                    {opts.map((o: { count?: number; price?: number; valid_days?: number | null }, i: number) => {
                                      const c = Number(o?.count ?? 0);
                                      const p = Number(o?.price ?? 0);
                                      const d = o?.valid_days;
                                      if (c <= 0) return null;
                                      return (
                                        <span
                                          key={i}
                                          className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-md bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200 font-medium"
                                        >
                                          <span>{c}회권</span>
                                          <span className="text-purple-600 dark:text-purple-300">{formatCurrency(p)}</span>
                                          {d != null && <span className="text-[10px] text-purple-500 dark:text-purple-400">유효 {d}일</span>}
                                        </span>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <button
                                onClick={(e) => { e.stopPropagation(); setSelectedTicket(product); setShowTicketModal(true); }}
                                className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-800"
                                title="수정"
                              >
                                <Settings size={16} />
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleDeleteTicket(product); }}
                                disabled={deletingTicketId === product.id}
                                className="text-red-400 dark:text-red-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 p-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                                title="삭제"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </div>
                          );
                        })
                      )}

                      {categoryTickets.length > 0 && !searchQuery && (
                        <button
                          onClick={() => {
                            setSelectedTicket(null);
                            setInitialTicketCategory(category);
                            setShowTicketModal(true);
                          }}
                          className="w-full py-2 border border-gray-200 dark:border-neutral-700 border-dashed rounded-lg text-gray-400 dark:text-gray-500 text-xs hover:bg-gray-50 dark:hover:bg-neutral-800 flex items-center justify-center gap-1 transition-colors"
                        >
                          <Plus size={14} /> 추가
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* 할인율 관리 */}
          <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-sm border border-gray-100 dark:border-neutral-800 p-6">
            <h3 className="font-bold text-md text-gray-800 dark:text-white mb-4 flex items-center gap-2">
              <TrendingUp size={18} className="text-gray-500 dark:text-gray-400" /> 할인 정책 (프로모션)
            </h3>
            <div className="space-y-4">
              {filteredDiscounts.length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  {searchQuery ? '검색 결과가 없습니다.' : '등록된 할인 정책이 없습니다.'}
                </div>
              ) : (
                filteredDiscounts.map((discount) => (
                  <div
                    key={discount.id}
                    className="flex justify-between items-center p-4 border border-dashed dark:border-neutral-700 rounded-lg bg-gray-50 dark:bg-neutral-800"
                  >
                    <div>
                      <h4 className="font-bold text-gray-800 dark:text-white">{discount.name}</h4>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        감면액:{' '}
                        {discount.discount_type === 'PERCENT'
                          ? `${discount.discount_value}%`
                          : `₩${discount.discount_value.toLocaleString()}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-3 h-3 rounded-full ${
                          discount.is_active
                            ? 'bg-green-500 dark:bg-green-400'
                            : 'bg-gray-300 dark:bg-gray-600'
                        }`}
                      ></span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {discount.is_active ? '적용중' : '비활성'}
                      </span>
                      <button
                        onClick={() => {
                          setSelectedDiscount(discount);
                          setShowDiscountModal(true);
                        }}
                        className="ml-2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
                      >
                        <Settings size={16} />
                      </button>
                    </div>
                  </div>
                ))
              )}
              <button
                onClick={() => {
                  setSelectedDiscount(null);
                  setShowDiscountModal(true);
                }}
                className="w-full py-3 border border-gray-300 dark:border-neutral-700 border-dashed rounded-lg text-gray-500 dark:text-gray-400 text-sm hover:bg-gray-100 dark:hover:bg-neutral-800 flex items-center justify-center gap-2 transition-colors"
              >
                <Plus size={16} /> 새 할인 정책 만들기
              </button>
            </div>
          </div>
        </div>
      </div>

      {showTicketModal && (
        <TicketModal
          academyId={academyId}
          ticket={selectedTicket}
          initialCategory={initialTicketCategory}
          onClose={() => {
            setShowTicketModal(false);
            setSelectedTicket(null);
            setInitialTicketCategory(undefined);
            loadData();
          }}
        />
      )}

      {showDiscountModal && (
        <DiscountModal
          academyId={academyId}
          discount={selectedDiscount}
          onClose={() => {
            setShowDiscountModal(false);
            setSelectedDiscount(null);
            loadData();
          }}
        />
      )}
    </>
  );
}
