"use client";

import { useState, useEffect } from 'react';
import { X, Ticket, Calendar, Hash, Check, Tag, Gift } from 'lucide-react';
import { getSupabaseClient } from '@/lib/utils/supabase-client';

interface TicketInfo {
  id: string;
  name: string;
  description?: string;
  price: number;
  ticket_type: 'PERIOD' | 'COUNT';
  total_count?: number;
  valid_days?: number;
  is_general: boolean;
  is_coupon: boolean; // true: 쿠폰(1회 수강권), false: 정규 수강권
}

interface DiscountInfo {
  id: string;
  name: string;
  discount_type: 'PERCENT' | 'FIXED';
  discount_value: number;
  valid_from: string | null;
  valid_until: string | null;
  description: string | null;
}

interface TicketPurchaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  academyId: string;
  academyName?: string;
  onPurchaseComplete?: () => void;
}

export const TicketPurchaseModal = ({
  isOpen,
  onClose,
  academyId,
  academyName,
  onPurchaseComplete,
}: TicketPurchaseModalProps) => {
  const [tickets, setTickets] = useState<TicketInfo[]>([]);
  const [discounts, setDiscounts] = useState<DiscountInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<TicketInfo | null>(null);
  const [selectedDiscount, setSelectedDiscount] = useState<DiscountInfo | null>(null);
  const [activeTab, setActiveTab] = useState<'ticket' | 'coupon'>('ticket');
  const [startDate, setStartDate] = useState<string>(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [purchasing, setPurchasing] = useState(false);
  const [purchaseSuccess, setPurchaseSuccess] = useState(false);

  useEffect(() => {
    if (isOpen && academyId) {
      loadTickets();
      loadDiscounts();
    }
  }, [isOpen, academyId]);

  const loadDiscounts = async () => {
    try {
      const supabase = getSupabaseClient();
      if (!supabase) return;

      const now = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('discounts')
        .select('*')
        .eq('academy_id', academyId)
        .eq('is_active', true)
        .or(`valid_from.is.null,valid_from.lte.${now}`)
        .or(`valid_until.is.null,valid_until.gte.${now}`);

      if (error) throw error;
      setDiscounts(data || []);
    } catch (error) {
      console.error('Error loading discounts:', error);
    }
  };

  const loadTickets = async () => {
    try {
      setLoading(true);
      const supabase = getSupabaseClient();
      if (!supabase) return;

      const { data, error } = await supabase
        .from('tickets')
        .select('*')
        .eq('academy_id', academyId)
        .eq('is_on_sale', true)
        .order('price', { ascending: true });

      if (error) throw error;
      setTickets(data || []);
    } catch (error) {
      console.error('Error loading tickets:', error);
    } finally {
      setLoading(false);
    }
  };

  // 할인 금액 계산
  const calculateDiscount = (ticket: TicketInfo, discount: DiscountInfo | null): number => {
    if (!discount) return 0;
    if (discount.discount_type === 'PERCENT') {
      return Math.floor(ticket.price * discount.discount_value / 100);
    }
    return Math.min(discount.discount_value, ticket.price);
  };

  const discountAmount = selectedTicket && selectedDiscount 
    ? calculateDiscount(selectedTicket, selectedDiscount) 
    : 0;
  const finalPrice = selectedTicket ? selectedTicket.price - discountAmount : 0;

  // 수강권(is_coupon=false)과 쿠폰(is_coupon=true) 분리
  const regularTickets = tickets.filter(t => !t.is_coupon);
  const couponTickets = tickets.filter(t => t.is_coupon);
  const displayTickets = activeTab === 'ticket' ? regularTickets : couponTickets;

  const handlePurchase = async () => {
    if (!selectedTicket) return;

    try {
      setPurchasing(true);
      
      const response = await fetch('/api/tickets/purchase', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ticketId: selectedTicket.id,
          startDate: startDate,
          discountId: selectedDiscount?.id,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || '구매에 실패했습니다.');
      }

      setPurchaseSuccess(true);
      
      setTimeout(() => {
        onPurchaseComplete?.();
        handleClose();
      }, 2000);
    } catch (error: any) {
      console.error('Error purchasing ticket:', error);
      alert(error.message || '구매에 실패했습니다.');
    } finally {
      setPurchasing(false);
    }
  };

  const handleClose = () => {
    setSelectedTicket(null);
    setSelectedDiscount(null);
    setPurchaseSuccess(false);
    setActiveTab('ticket');
    onClose();
  };

  const getDiscountText = (discount: DiscountInfo) => {
    if (discount.discount_type === 'PERCENT') {
      return `${discount.discount_value}% 할인`;
    }
    return `${formatPrice(discount.discount_value)}원 할인`;
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('ko-KR').format(price);
  };

  const getValidityText = (ticket: TicketInfo) => {
    if (ticket.ticket_type === 'PERIOD') {
      if (ticket.valid_days) {
        if (ticket.valid_days >= 30) {
          const months = Math.floor(ticket.valid_days / 30);
          return `${months}개월`;
        }
        return `${ticket.valid_days}일`;
      }
      return '무제한';
    } else {
      // COUNT type
      let text = `${ticket.total_count}회`;
      if (ticket.valid_days) {
        if (ticket.valid_days >= 30) {
          const months = Math.floor(ticket.valid_days / 30);
          text += ` (${months}개월 유효)`;
        } else {
          text += ` (${ticket.valid_days}일 유효)`;
        }
      }
      return text;
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in"
      onClick={handleClose}
    >
      <div 
        className="w-full sm:max-w-lg max-h-[90vh] bg-white dark:bg-neutral-900 rounded-t-3xl sm:rounded-3xl overflow-hidden animate-in slide-in-from-bottom"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between p-4 border-b border-neutral-200 dark:border-neutral-800">
          <div>
            <h2 className="text-lg font-bold text-black dark:text-white">수강권/쿠폰 구매</h2>
            {academyName && (
              <p className="text-sm text-neutral-500">{academyName}</p>
            )}
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-full transition-colors"
          >
            <X size={20} className="text-neutral-600 dark:text-neutral-400" />
          </button>
        </div>

        {/* 수강권/쿠폰 탭 */}
        {!purchaseSuccess && !loading && tickets.length > 0 && (
          <div className="flex border-b border-neutral-200 dark:border-neutral-800">
            <button
              onClick={() => { setActiveTab('ticket'); setSelectedTicket(null); }}
              className={`flex-1 py-3 text-sm font-bold transition-colors ${
                activeTab === 'ticket'
                  ? 'text-black dark:text-white border-b-2 border-neutral-800 dark:border-[#CCFF00]'
                  : 'text-neutral-500 hover:text-black dark:hover:text-white'
              }`}
            >
              <Ticket size={14} className="inline mr-1" />
              수강권 ({regularTickets.length})
            </button>
            <button
              onClick={() => { setActiveTab('coupon'); setSelectedTicket(null); }}
              className={`flex-1 py-3 text-sm font-bold transition-colors ${
                activeTab === 'coupon'
                  ? 'text-black dark:text-white border-b-2 border-neutral-800 dark:border-[#CCFF00]'
                  : 'text-neutral-500 hover:text-black dark:hover:text-white'
              }`}
            >
              <Gift size={14} className="inline mr-1" />
              쿠폰 ({couponTickets.length})
            </button>
          </div>
        )}

        {/* 컨텐츠 */}
        <div className="p-4 overflow-y-auto max-h-[60vh]">
          {purchaseSuccess ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check size={32} className="text-green-600 dark:text-green-400" />
              </div>
              <h3 className="text-xl font-bold text-black dark:text-white mb-2">
                구매 완료!
              </h3>
              <p className="text-neutral-500">
                {activeTab === 'ticket' ? '수강권이' : '쿠폰이'} 성공적으로 구매되었습니다.
              </p>
            </div>
          ) : loading ? (
            <div className="text-center py-12 text-neutral-500">
              로딩 중...
            </div>
          ) : displayTickets.length === 0 ? (
            <div className="text-center py-12 text-neutral-500">
              {activeTab === 'ticket' ? '판매 중인 수강권이 없습니다.' : '판매 중인 쿠폰이 없습니다.'}
            </div>
          ) : (
            <div className="space-y-4">
              {/* 상품 설명 */}
              <div className="text-xs text-neutral-500 bg-neutral-50 dark:bg-neutral-800/50 p-3 rounded-lg">
                {activeTab === 'ticket' 
                  ? '💡 수강권은 기간 내 정규수업을 수강할 수 있는 권한입니다.'
                  : '💡 쿠폰은 쿠폰제 수업 또는 쿠폰 허용된 수업에 사용할 수 있습니다.'
                }
              </div>

              {/* 상품 목록 */}
              <div className="space-y-2">
                {displayTickets.map((ticket) => (
                  <button
                    key={ticket.id}
                    onClick={() => setSelectedTicket(ticket)}
                    className={`w-full p-4 rounded-xl border transition-all text-left ${
                      selectedTicket?.id === ticket.id
                        ? 'border-neutral-800 dark:border-[#CCFF00] bg-neutral-50 dark:bg-neutral-800'
                        : 'border-neutral-200 dark:border-neutral-700 hover:border-neutral-400 dark:hover:border-neutral-600'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          {ticket.is_coupon ? (
                            <Gift size={16} className="text-orange-500" />
                          ) : (
                            <Ticket size={16} className="text-neutral-600 dark:text-neutral-400" />
                          )}
                          <span className="font-bold text-black dark:text-white">
                            {ticket.name}
                          </span>
                          {ticket.is_general && (
                            <span className="text-xs px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full">
                              전체 이용
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-sm text-neutral-500">
                          {ticket.ticket_type === 'PERIOD' ? (
                            <span className="flex items-center gap-1">
                              <Calendar size={14} />
                              {getValidityText(ticket)}
                            </span>
                          ) : (
                            <span className="flex items-center gap-1">
                              <Hash size={14} />
                              {getValidityText(ticket)}
                            </span>
                          )}
                        </div>
                        {ticket.description && (
                          <p className="mt-2 text-xs text-neutral-400">
                            {ticket.description}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <span className="text-lg font-bold text-black dark:text-white">
                          {formatPrice(ticket.price)}
                        </span>
                        <span className="text-sm text-neutral-500">원</span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              {/* 시작일 선택 (기간제 수강권인 경우) */}
              {selectedTicket && selectedTicket.ticket_type === 'PERIOD' && (
                <div className="p-4 bg-neutral-100 dark:bg-neutral-800 rounded-xl">
                  <label className="block text-sm font-bold text-black dark:text-white mb-2">
                    수강 시작일 선택
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full px-3 py-2 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg text-black dark:text-white"
                  />
                  <p className="mt-2 text-xs text-neutral-500">
                    선택한 날짜부터 {getValidityText(selectedTicket)} 동안 이용 가능합니다.
                  </p>
                </div>
              )}

              {/* 할인정책 선택 */}
              {selectedTicket && discounts.length > 0 && (
                <div className="p-4 bg-neutral-100 dark:bg-neutral-800 rounded-xl">
                  <label className="block text-sm font-bold text-black dark:text-white mb-2">
                    <Tag size={14} className="inline mr-1" />
                    할인 적용
                  </label>
                  <div className="space-y-2">
                    <button
                      onClick={() => setSelectedDiscount(null)}
                      className={`w-full p-3 rounded-lg border text-left text-sm ${
                        !selectedDiscount
                          ? 'border-neutral-800 dark:border-[#CCFF00] bg-white dark:bg-neutral-900'
                          : 'border-neutral-200 dark:border-neutral-700'
                      }`}
                    >
                      할인 적용 안 함
                    </button>
                    {discounts.map((discount) => (
                      <button
                        key={discount.id}
                        onClick={() => setSelectedDiscount(discount)}
                        className={`w-full p-3 rounded-lg border text-left ${
                          selectedDiscount?.id === discount.id
                            ? 'border-neutral-800 dark:border-[#CCFF00] bg-white dark:bg-neutral-900'
                            : 'border-neutral-200 dark:border-neutral-700'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-black dark:text-white text-sm">
                            {discount.name}
                          </span>
                          <span className="text-sm text-red-500 font-bold">
                            {getDiscountText(discount)}
                          </span>
                        </div>
                        {discount.description && (
                          <p className="text-xs text-neutral-500 mt-1">{discount.description}</p>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 하단 버튼 */}
        {!purchaseSuccess && selectedTicket && (
          <div className="p-4 border-t border-neutral-200 dark:border-neutral-800">
            {/* 가격 정보 */}
            <div className="space-y-1 mb-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-neutral-500">상품 금액</span>
                <span className="text-neutral-600 dark:text-neutral-400">
                  {formatPrice(selectedTicket.price)}원
                </span>
              </div>
              {discountAmount > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-red-500">할인</span>
                  <span className="text-red-500">
                    -{formatPrice(discountAmount)}원
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between pt-2 border-t border-neutral-200 dark:border-neutral-700">
                <span className="font-bold text-black dark:text-white">결제 금액</span>
                <span className="text-xl font-bold text-black dark:text-white">
                  {formatPrice(finalPrice)}원
                </span>
              </div>
            </div>
            <button
              onClick={handlePurchase}
              disabled={purchasing}
              className="w-full py-3 bg-neutral-900 dark:bg-[#CCFF00] text-white dark:text-black font-bold rounded-xl hover:bg-neutral-800 dark:hover:bg-[#b8e600] transition-colors disabled:opacity-50"
            >
              {purchasing ? '처리 중...' : `${activeTab === 'ticket' ? '수강권' : '쿠폰'} 구매하기 (테스트)`}
            </button>
            <p className="mt-2 text-xs text-center text-neutral-400">
              * 테스트 결제입니다. 실제 결제가 이루어지지 않습니다.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
