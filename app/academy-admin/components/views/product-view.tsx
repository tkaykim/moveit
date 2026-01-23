"use client";

import { useState, useEffect } from 'react';
import { Ticket, TrendingUp, Settings, Plus } from 'lucide-react';
import { SectionHeader } from '../common/section-header';
import { TicketModal } from './products/ticket-modal';
import { DiscountModal } from './products/discount-modal';
import { getSupabaseClient } from '@/lib/utils/supabase-client';

interface ProductViewProps {
  academyId: string;
}

export function ProductView({ academyId }: ProductViewProps) {
  const [tickets, setTickets] = useState<any[]>([]);
  const [discounts, setDiscounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const [selectedDiscount, setSelectedDiscount] = useState<any>(null);

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

  // 수강권을 타입별로 분류
  const regularTickets = tickets.filter(t => getTicketCategory(t) === 'regular');
  const popupTickets = tickets.filter(t => getTicketCategory(t) === 'popup');
  const workshopTickets = tickets.filter(t => getTicketCategory(t) === 'workshop');

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
            setShowTicketModal(true);
          }}
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 상품 목록 */}
          <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-sm border border-gray-100 dark:border-neutral-800 p-6">
            <h3 className="font-bold text-md text-gray-800 dark:text-white mb-4 flex items-center gap-2">
              <Ticket size={18} className="text-gray-500 dark:text-gray-400" /> 판매 중인 상품
            </h3>
            <div className="space-y-6">
              {/* 정규 수강권 */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                    정규 수강권
                  </h4>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 font-medium">
                    Regular 클래스 전용
                  </span>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                  기간 내 무제한 수강. 특정 클래스 지정 또는 전체 Regular 클래스 이용 가능
                </p>
                <div className="space-y-2">
                  {regularTickets.length === 0 ? (
                    <div className="text-center py-4 text-xs text-gray-400 dark:text-gray-500">
                      등록된 정규 수강권이 없습니다
                    </div>
                  ) : (
                    regularTickets.map((product) => (
                      <div
                        key={product.id}
                        className="flex justify-between items-center p-3 border dark:border-neutral-800 rounded-lg hover:border-blue-300 dark:hover:border-blue-600 transition-colors bg-white dark:bg-neutral-900"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-bold px-2 py-0.5 rounded ${getCategoryBadgeColor('regular')}`}>
                              정규
                            </span>
                            <h4 className="font-bold text-sm text-gray-800 dark:text-white">{product.name}</h4>
                          </div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            기본가: ₩{product.price?.toLocaleString() || 0}
                          </p>
                        </div>
                        <button
                          onClick={() => {
                            setSelectedTicket(product);
                            setShowTicketModal(true);
                          }}
                          className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 ml-2"
                        >
                          <Settings size={16} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* 팝업 수강권 */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                    팝업 수강권
                  </h4>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 font-medium">
                    Popup 클래스 전용
                  </span>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                  정해진 횟수만큼 Popup 클래스 수업에 참여 가능한 횟수제 수강권
                </p>
                <div className="space-y-2">
                  {popupTickets.length === 0 ? (
                    <div className="text-center py-4 text-xs text-gray-400 dark:text-gray-500">
                      등록된 팝업 수강권이 없습니다
                    </div>
                  ) : (
                    popupTickets.map((product) => (
                      <div
                        key={product.id}
                        className="flex justify-between items-center p-3 border dark:border-neutral-800 rounded-lg hover:border-purple-300 dark:hover:border-purple-600 transition-colors bg-white dark:bg-neutral-900"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-bold px-2 py-0.5 rounded ${getCategoryBadgeColor('popup')}`}>
                              팝업
                            </span>
                            <h4 className="font-bold text-sm text-gray-800 dark:text-white">{product.name}</h4>
                          </div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            기본가: ₩{product.price?.toLocaleString() || 0} • {product.total_count || 0}회
                          </p>
                        </div>
                        <button
                          onClick={() => {
                            setSelectedTicket(product);
                            setShowTicketModal(true);
                          }}
                          className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 ml-2"
                        >
                          <Settings size={16} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* 워크샵 수강권 */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                    워크샵 수강권
                  </h4>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 font-medium">
                    Workshop 클래스 전용
                  </span>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                  정해진 횟수만큼 Workshop 클래스 수업에 참여 가능한 횟수제 수강권
                </p>
                <div className="space-y-2">
                  {workshopTickets.length === 0 ? (
                    <div className="text-center py-4 text-xs text-gray-400 dark:text-gray-500">
                      등록된 워크샵 수강권이 없습니다
                    </div>
                  ) : (
                    workshopTickets.map((product) => (
                      <div
                        key={product.id}
                        className="flex justify-between items-center p-3 border dark:border-neutral-800 rounded-lg hover:border-amber-300 dark:hover:border-amber-600 transition-colors bg-white dark:bg-neutral-900"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-bold px-2 py-0.5 rounded ${getCategoryBadgeColor('workshop')}`}>
                              워크샵
                            </span>
                            <h4 className="font-bold text-sm text-gray-800 dark:text-white">{product.name}</h4>
                          </div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            기본가: ₩{product.price?.toLocaleString() || 0} • {product.total_count || 0}회
                          </p>
                        </div>
                        <button
                          onClick={() => {
                            setSelectedTicket(product);
                            setShowTicketModal(true);
                          }}
                          className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 ml-2"
                        >
                          <Settings size={16} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <button
                onClick={() => {
                  setSelectedTicket(null);
                  setShowTicketModal(true);
                }}
                className="w-full py-3 border border-gray-300 dark:border-neutral-700 border-dashed rounded-lg text-gray-500 dark:text-gray-400 text-sm hover:bg-gray-100 dark:hover:bg-neutral-800 flex items-center justify-center gap-2 transition-colors"
              >
                <Plus size={16} /> 새 수강권 만들기
              </button>
            </div>
          </div>

          {/* 할인율 관리 */}
          <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-sm border border-gray-100 dark:border-neutral-800 p-6">
            <h3 className="font-bold text-md text-gray-800 dark:text-white mb-4 flex items-center gap-2">
              <TrendingUp size={18} className="text-gray-500 dark:text-gray-400" /> 할인 정책 (프로모션)
            </h3>
            <div className="space-y-4">
              {discounts.length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  등록된 할인 정책이 없습니다.
                </div>
              ) : (
                discounts.map((discount) => (
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
          onClose={() => {
            setShowTicketModal(false);
            setSelectedTicket(null);
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
