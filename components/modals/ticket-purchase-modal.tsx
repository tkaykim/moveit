"use client";

import { useState, useEffect } from 'react';
import { fetchWithAuth } from '@/lib/api/auth-fetch';
import { X, Ticket, Calendar, Hash, Check, Tag, Gift, Copy, Loader2, LogIn, UserPlus, UserX } from 'lucide-react';
import { getSupabaseClient } from '@/lib/utils/supabase-client';
import { useLocale } from '@/contexts/LocaleContext';
import { ENABLE_TOSS_PAYMENT } from '@/lib/constants/payment';
import { useAuth } from '@/contexts/AuthContext';
import { MyTab } from '@/components/auth/MyTab';
import { TicketTossPaymentModal } from '@/components/modals/ticket-toss-payment-modal';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';

interface TicketInfo {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  ticket_type: 'PERIOD' | 'COUNT';
  total_count?: number;
  valid_days?: number;
  is_general: boolean;
  is_coupon: boolean;
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
  onRequireAuth?: () => void;
}

export const TicketPurchaseModal = ({
  isOpen,
  onClose,
  academyId,
  academyName,
  onPurchaseComplete,
}: TicketPurchaseModalProps) => {
  const { t, language } = useLocale();
  const { user } = useAuth();

  const [tickets, setTickets] = useState<TicketInfo[]>([]);
  const [discounts, setDiscounts] = useState<DiscountInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<TicketInfo | null>(null);
  const [selectedDiscount, setSelectedDiscount] = useState<DiscountInfo | null>(null);
  const [activeTab, setActiveTab] = useState<'ticket' | 'coupon'>('ticket');
  const [startDate, setStartDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [purchasing, setPurchasing] = useState(false);
  const [purchaseSuccess, setPurchaseSuccess] = useState(false);
  const [bankTransferResult, setBankTransferResult] = useState<{
    orderId: string;
    amount: number;
    orderName: string;
    bankName: string;
    bankAccountNumber: string;
    bankDepositorName: string;
    ordererName?: string;
  } | null>(null);
  const [showDepositorStep, setShowDepositorStep] = useState(false);
  const [depositorName, setDepositorName] = useState('');
  const [depositorStepLoading, setDepositorStepLoading] = useState(false);

  const [showAuthChoice, setShowAuthChoice] = useState(false);
  const [showGuestForm, setShowGuestForm] = useState(false);
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [guestInfo, setGuestInfo] = useState<{ name: string; phone: string; email: string } | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalInitialTab, setAuthModalInitialTab] = useState<'login' | 'signup'>('login');

  const [purchasePaymentType, setPurchasePaymentType] = useState<'card' | 'account'>('card');
  const [widgetModalOpen, setWidgetModalOpen] = useState(false);
  const [widgetOrder, setWidgetOrder] = useState<{
    orderId: string;
    amount: number;
    orderName: string;
    successUrl: string;
    failUrl: string;
    customerKey: string;
    customerMobilePhone?: string;
  } | null>(null);

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
        .or('is_public.eq.true,is_public.is.null')
        .order('price', { ascending: true });
      if (error) throw error;
      setTickets(data || []);
    } catch (error) {
      console.error('Error loading tickets:', error);
    } finally {
      setLoading(false);
    }
  };

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

  const regularTickets = tickets.filter(t => !t.is_coupon);
  const couponTickets = tickets.filter(t => t.is_coupon);
  const displayTickets = activeTab === 'ticket' ? regularTickets : couponTickets;

  const handlePurchase = async () => {
    if (!selectedTicket) return;
    if (!user && !guestInfo) {
      setShowAuthChoice(true);
      return;
    }
    if (ENABLE_TOSS_PAYMENT) {
      if (purchasePaymentType === 'card') {
        await handleTossCardPayment();
      } else {
        await startDepositorStep();
      }
    } else {
      await startDepositorStep();
    }
  };

  const handleTossCardPayment = async () => {
    if (!selectedTicket) return;
    setPurchasing(true);
    try {
      const body: Record<string, unknown> = {
        ticketId: selectedTicket.id,
        discountId: selectedDiscount?.id || undefined,
      };
      if (guestInfo) {
        body.guestName = guestInfo.name;
        body.guestPhone = guestInfo.phone || undefined;
        body.guestEmail = guestInfo.email || undefined;
      }
      const orderRes = user
        ? await fetchWithAuth('/api/tickets/payment-order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          })
        : await fetch('/api/tickets/payment-order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          });
      if (!orderRes.ok) {
        const data = await orderRes.json();
        throw new Error(data.error || (language === 'ko' ? '주문 생성에 실패했습니다.' : 'Failed to create order.'));
      }
      const { orderId, amount, orderName } = await orderRes.json();
      const origin = window.location.origin;
      const successUrl = `${origin}/payment/ticket/success`;
      const failUrl = `${origin}/payment/ticket/fail`;
      const customerKey = user?.id ?? `guest_${orderId}`;
      let customerMobilePhone: string | undefined;
      if (user?.id) {
        try {
          const profileRes = await fetchWithAuth('/api/auth/profile');
          if (profileRes.ok) {
            const data = await profileRes.json();
            const raw = data?.profile?.phone;
            if (typeof raw === 'string' && raw.trim()) {
              const digits = raw.replace(/\D/g, '');
              if (digits.length >= 8 && digits.length <= 15) customerMobilePhone = digits;
            }
          }
        } catch { /* ignore */ }
      } else if (guestInfo?.phone) {
        const digits = guestInfo.phone.replace(/\D/g, '');
        if (digits.length >= 8 && digits.length <= 15) customerMobilePhone = digits;
      }
      setWidgetOrder({ orderId, amount, orderName, successUrl, failUrl, customerKey, customerMobilePhone });
      setWidgetModalOpen(true);
    } catch (error: any) {
      console.error('Error creating payment order:', error);
      alert(error.message || (language === 'ko' ? '결제 처리에 실패했습니다.' : 'Payment processing failed.'));
    } finally {
      setPurchasing(false);
    }
  };

  const startDepositorStep = async () => {
    setShowDepositorStep(true);
    if (user) {
      setDepositorStepLoading(true);
      try {
        const profileRes = await fetchWithAuth('/api/auth/profile');
        if (profileRes.ok) {
          const data = await profileRes.json();
          const name = data?.profile?.name ?? data?.profile?.name_en ?? '';
          setDepositorName(String(name).trim() || '');
        } else {
          setDepositorName('');
        }
      } catch {
        setDepositorName('');
      } finally {
        setDepositorStepLoading(false);
      }
    } else if (guestInfo) {
      setDepositorName(guestInfo.name);
      setDepositorStepLoading(false);
    }
  };

  const handleDepositorSubmit = async () => {
    if (!selectedTicket || !depositorName.trim()) return;
    setPurchasing(true);
    try {
      const body: Record<string, unknown> = {
        ticketId: selectedTicket.id,
        discountId: selectedDiscount?.id ?? undefined,
        depositorName: depositorName.trim(),
      };
      if (guestInfo) {
        body.ordererName = guestInfo.name;
        body.ordererPhone = guestInfo.phone || undefined;
        body.ordererEmail = guestInfo.email || undefined;
      } else {
        body.ordererName = depositorName.trim();
      }
      const response = user
        ? await fetchWithAuth('/api/tickets/bank-transfer-order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          })
        : await fetch('/api/tickets/bank-transfer-order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || (language === 'ko' ? '신청에 실패했습니다.' : 'Request failed.'));
      }
      setBankTransferResult({
        orderId: data.orderId,
        amount: data.amount,
        orderName: data.orderName,
        bankName: data.bankName,
        bankAccountNumber: data.bankAccountNumber,
        bankDepositorName: data.bankDepositorName,
        ordererName: data.ordererName,
      });
      setShowDepositorStep(false);
      setDepositorName('');
    } catch (error: any) {
      alert(error.message || (language === 'ko' ? '신청에 실패했습니다.' : 'Request failed.'));
    } finally {
      setPurchasing(false);
    }
  };

  const handleGuestFormSubmit = () => {
    if (!guestName.trim()) {
      alert(language === 'ko' ? '이름을 입력해 주세요.' : 'Please enter your name.');
      return;
    }
    if (!guestPhone.trim() && !guestEmail.trim()) {
      alert(language === 'ko' ? '연락처 또는 이메일 중 하나를 입력해 주세요.' : 'Please enter phone or email.');
      return;
    }
    setGuestInfo({ name: guestName.trim(), phone: guestPhone.trim(), email: guestEmail.trim() });
    setShowGuestForm(false);
    setShowAuthChoice(false);
  };

  const handleClose = () => {
    setSelectedTicket(null);
    setSelectedDiscount(null);
    setPurchaseSuccess(false);
    setBankTransferResult(null);
    setShowDepositorStep(false);
    setDepositorName('');
    setActiveTab('ticket');
    setShowAuthChoice(false);
    setShowGuestForm(false);
    setGuestName('');
    setGuestPhone('');
    setGuestEmail('');
    setGuestInfo(null);
    setPurchasePaymentType('card');
    setWidgetModalOpen(false);
    setWidgetOrder(null);
    onClose();
  };

  const getDiscountText = (discount: DiscountInfo) => {
    if (discount.discount_type === 'PERCENT') {
      return `${discount.discount_value}% ${language === 'ko' ? '할인' : 'off'}`;
    }
    return `${formatPrice(discount.discount_value)}${language === 'ko' ? '원 할인' : ' KRW off'}`;
  };

  const formatPrice = (price: number) => new Intl.NumberFormat('ko-KR').format(price);

  const getValidityText = (ticket: TicketInfo) => {
    if (ticket.ticket_type === 'PERIOD') {
      if (ticket.valid_days) {
        if (ticket.valid_days >= 30) {
          const months = Math.floor(ticket.valid_days / 30);
          return t('ticketModal.months', { n: String(months) });
        }
        return t('ticketModal.days', { n: String(ticket.valid_days) });
      }
      return t('ticketModal.unlimited');
    } else {
      let text = language === 'ko' ? `${ticket.total_count}회` : `${ticket.total_count} ${t('ticket.count')}`;
      if (ticket.valid_days) {
        if (ticket.valid_days >= 30) {
          const months = Math.floor(ticket.valid_days / 30);
          text += ' ' + t('ticketModal.validMonths', { n: String(months) });
        } else {
          text += ' ' + t('ticketModal.validDays', { n: String(ticket.valid_days) });
        }
      }
      return text;
    }
  };

  const showTabs = !purchaseSuccess && !loading && tickets.length > 0 && !showAuthChoice && !showGuestForm && !showDepositorStep && !bankTransferResult;
  const showFooter = !purchaseSuccess && !bankTransferResult && !showDepositorStep && !showAuthChoice && !showGuestForm && selectedTicket;

  return (
    <>
      <Sheet open={isOpen} onOpenChange={(open) => { if (!open) handleClose(); }}>
        <SheetContent
          side="bottom"
          showCloseButton={false}
          className="left-0 right-0 w-full max-w-[420px] mx-auto rounded-t-2xl border-neutral-200 dark:border-neutral-800 p-0 flex flex-col"
          style={{ maxHeight: 'min(85dvh, 85vh)', minHeight: '30dvh' }}
        >
          {/* 드래그 핸들 + 헤더 */}
          <SheetHeader className="shrink-0 p-4 pb-2 border-b border-neutral-200 dark:border-neutral-800 text-left">
            <div className="w-12 h-1 bg-neutral-300 dark:bg-neutral-700 rounded-full mx-auto mb-3" />
            <div className="flex items-center justify-between">
              <div>
                <SheetTitle className="text-lg font-bold text-black dark:text-white">
                  {t('ticketModal.title')}
                </SheetTitle>
                {academyName && (
                  <SheetDescription className="text-sm text-neutral-500">
                    {academyName}
                  </SheetDescription>
                )}
              </div>
              <button
                type="button"
                onClick={handleClose}
                className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-full transition-colors"
              >
                <X size={20} className="text-neutral-500" />
              </button>
            </div>
          </SheetHeader>

          {/* 수강권/쿠폰 탭 */}
          {showTabs && (
            <div className="flex border-b border-neutral-200 dark:border-neutral-800 shrink-0">
              <button
                onClick={() => { setActiveTab('ticket'); setSelectedTicket(null); }}
                className={`flex-1 py-3 text-sm font-bold transition-colors ${
                  activeTab === 'ticket'
                    ? 'text-black dark:text-white border-b-2 border-primary'
                    : 'text-neutral-500 hover:text-black dark:hover:text-white'
                }`}
              >
                <Ticket size={14} className="inline mr-1" />
                {t('ticketModal.ticketTab')} ({regularTickets.length})
              </button>
              <button
                onClick={() => { setActiveTab('coupon'); setSelectedTicket(null); }}
                className={`flex-1 py-3 text-sm font-bold transition-colors ${
                  activeTab === 'coupon'
                    ? 'text-black dark:text-white border-b-2 border-primary'
                    : 'text-neutral-500 hover:text-black dark:hover:text-white'
                }`}
              >
                <Gift size={14} className="inline mr-1" />
                {t('ticketModal.couponTab')} ({couponTickets.length})
              </button>
            </div>
          )}

          {/* 컨텐츠 */}
          <div className="flex-1 overflow-y-auto p-4 min-h-0">
            {showAuthChoice ? (
              <AuthChoiceStep
                language={language}
                onLogin={() => { setShowAuthChoice(false); setAuthModalInitialTab('login'); setIsAuthModalOpen(true); }}
                onSignup={() => { setShowAuthChoice(false); setAuthModalInitialTab('signup'); setIsAuthModalOpen(true); }}
                onGuest={() => { setShowAuthChoice(false); setShowGuestForm(true); setGuestName(''); setGuestPhone(''); setGuestEmail(''); }}
                onBack={() => setShowAuthChoice(false)}
              />
            ) : showGuestForm ? (
              <GuestFormStep
                language={language}
                guestName={guestName}
                guestPhone={guestPhone}
                guestEmail={guestEmail}
                onNameChange={setGuestName}
                onPhoneChange={setGuestPhone}
                onEmailChange={setGuestEmail}
                onSubmit={handleGuestFormSubmit}
                onBack={() => { setShowGuestForm(false); setShowAuthChoice(true); }}
              />
            ) : showDepositorStep ? (
              <DepositorStep
                language={language}
                depositorName={depositorName}
                depositorStepLoading={depositorStepLoading}
                purchasing={purchasing}
                onNameChange={setDepositorName}
                onSubmit={handleDepositorSubmit}
                onCancel={() => { setShowDepositorStep(false); setDepositorName(''); }}
              />
            ) : bankTransferResult ? (
              <BankTransferResult
                language={language}
                result={bankTransferResult}
                onClose={handleClose}
              />
            ) : purchaseSuccess ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Check size={32} className="text-green-600 dark:text-green-400" />
                </div>
                <h3 className="text-xl font-bold text-black dark:text-white mb-2">
                  {t('ticketModal.purchaseComplete')}
                </h3>
                <p className="text-neutral-500">
                  {activeTab === 'ticket' ? t('ticketModal.ticketPurchased') : t('ticketModal.couponPurchased')}
                </p>
              </div>
            ) : loading ? (
              <div className="text-center py-12 text-neutral-500">{t('common.loading')}</div>
            ) : displayTickets.length === 0 ? (
              <div className="text-center py-12 text-neutral-500">
                {activeTab === 'ticket' ? t('ticketModal.noTickets') : t('ticketModal.noCoupons')}
              </div>
            ) : (
              <TicketListContent
                displayTickets={displayTickets}
                selectedTicket={selectedTicket}
                selectedDiscount={selectedDiscount}
                discounts={discounts}
                startDate={startDate}
                activeTab={activeTab}
                user={user}
                guestInfo={guestInfo}
                language={language}
                t={t}
                onSelectTicket={setSelectedTicket}
                onSelectDiscount={setSelectedDiscount}
                onStartDateChange={setStartDate}
                onClearGuestInfo={() => { setGuestInfo(null); setGuestName(''); setGuestPhone(''); setGuestEmail(''); }}
                getValidityText={getValidityText}
                getDiscountText={getDiscountText}
                formatPrice={formatPrice}
              />
            )}
          </div>

          {/* 하단 결제 영역 */}
          {showFooter && (
            <div className="shrink-0 p-4 border-t border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
              <div className="space-y-1 mb-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-neutral-500">{t('ticketModal.productAmount')}</span>
                  <span className="text-neutral-600 dark:text-neutral-400">
                    {formatPrice(selectedTicket!.price)}{t('ticketModal.won')}
                  </span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-red-500">{t('ticketModal.discount')}</span>
                    <span className="text-red-500">-{formatPrice(discountAmount)}{t('ticketModal.won')}</span>
                  </div>
                )}
                <div className="flex items-center justify-between pt-2 border-t border-neutral-200 dark:border-neutral-700">
                  <span className="font-bold text-black dark:text-white">{t('ticketModal.paymentAmount')}</span>
                  <span className="text-xl font-bold text-black dark:text-white">
                    {formatPrice(finalPrice)}{t('ticketModal.won')}
                  </span>
                </div>
              </div>

              {ENABLE_TOSS_PAYMENT && (user || guestInfo) && (
                <div className="mb-3">
                  <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-2">
                    {language === 'ko' ? '결제 방식' : 'Payment method'}
                  </p>
                  <div className="flex gap-2 p-1.5 rounded-xl bg-neutral-100 dark:bg-neutral-800/80">
                    <button
                      onClick={() => setPurchasePaymentType('card')}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                        purchasePaymentType === 'card'
                          ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-sm border border-neutral-200 dark:border-neutral-600'
                          : 'text-neutral-600 dark:text-neutral-400'
                      }`}
                    >
                      {language === 'ko' ? '카드결제' : 'Card'}
                    </button>
                    <button
                      onClick={() => setPurchasePaymentType('account')}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                        purchasePaymentType === 'account'
                          ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-sm border border-neutral-200 dark:border-neutral-600'
                          : 'text-neutral-600 dark:text-neutral-400'
                      }`}
                    >
                      {language === 'ko' ? '계좌이체' : 'Bank transfer'}
                    </button>
                  </div>
                </div>
              )}

              <button
                onClick={handlePurchase}
                disabled={purchasing}
                className="w-full py-3.5 bg-primary text-black font-bold rounded-xl hover:opacity-95 active:scale-[0.99] transition-all disabled:opacity-50"
              >
                {purchasing
                  ? t('ticketModal.processing')
                  : !user && !guestInfo
                    ? (language === 'ko' ? '구매하기' : 'Purchase')
                    : t('ticketModal.purchaseButton', { type: activeTab === 'ticket' ? t('ticketModal.purchaseButtonTicket') : t('ticketModal.purchaseButtonCoupon') })
                }
              </button>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* 로그인/회원가입 모달 */}
      <MyTab
        isOpen={isAuthModalOpen}
        onClose={async () => {
          setIsAuthModalOpen(false);
          const supabase = getSupabaseClient();
          if (supabase) {
            const { data: { user: authUser } } = await (supabase as any).auth.getUser();
            if (authUser) {
              setShowAuthChoice(false);
            }
          }
        }}
        initialTab={authModalInitialTab}
      />

      {/* 토스 결제 위젯 모달 */}
      {ENABLE_TOSS_PAYMENT && widgetOrder && (
        <TicketTossPaymentModal
          isOpen={widgetModalOpen}
          onClose={() => { setWidgetModalOpen(false); setWidgetOrder(null); }}
          onSuccess={() => {
            setWidgetModalOpen(false);
            setWidgetOrder(null);
            setPurchaseSuccess(true);
            setTimeout(() => { onPurchaseComplete?.(); handleClose(); }, 2000);
          }}
          onError={(msg) => { setWidgetModalOpen(false); setWidgetOrder(null); alert(msg); }}
          clientKey={process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY}
          orderId={widgetOrder.orderId}
          amount={widgetOrder.amount}
          orderName={widgetOrder.orderName}
          customerKey={widgetOrder.customerKey}
          successUrl={widgetOrder.successUrl}
          failUrl={widgetOrder.failUrl}
          customerMobilePhone={widgetOrder.customerMobilePhone}
        />
      )}
    </>
  );
};

// ─── 분리된 서브 컴포넌트들 ───

function AuthChoiceStep({ language, onLogin, onSignup, onGuest, onBack }: {
  language: string;
  onLogin: () => void;
  onSignup: () => void;
  onGuest: () => void;
  onBack: () => void;
}) {
  return (
    <div className="space-y-4 py-4">
      <div className="text-center mb-2">
        <h3 className="text-base font-bold text-black dark:text-white mb-1">
          {language === 'ko' ? '수강권 구매' : 'Purchase Ticket'}
        </h3>
        <p className="text-sm text-neutral-500">
          {language === 'ko' ? '로그인하시겠습니까? 비회원으로도 구매할 수 있습니다.' : 'Log in or continue as guest.'}
        </p>
      </div>
      <button type="button" onClick={onLogin}
        className="w-full py-3.5 rounded-xl bg-primary text-black font-semibold text-sm flex items-center justify-center gap-2 hover:opacity-95 active:scale-[0.99] transition-all">
        <LogIn size={18} />
        {language === 'ko' ? '로그인' : 'Log in'}
      </button>
      <button type="button" onClick={onSignup}
        className="w-full py-3.5 rounded-xl border-2 border-neutral-300 dark:border-neutral-600 text-neutral-800 dark:text-neutral-200 font-semibold text-sm flex items-center justify-center gap-2 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-all">
        <UserPlus size={18} />
        {language === 'ko' ? '회원가입' : 'Sign up'}
      </button>
      <button type="button" onClick={onGuest}
        className="w-full py-2.5 text-sm text-neutral-600 dark:text-neutral-400 underline underline-offset-2 flex items-center justify-center gap-2">
        <UserX size={16} />
        {language === 'ko' ? '비회원으로 계속하기' : 'Continue as guest'}
      </button>
      <button type="button" onClick={onBack} className="w-full py-2 text-xs text-neutral-400">
        {language === 'ko' ? '뒤로' : 'Back'}
      </button>
    </div>
  );
}

function GuestFormStep({ language, guestName, guestPhone, guestEmail, onNameChange, onPhoneChange, onEmailChange, onSubmit, onBack }: {
  language: string;
  guestName: string;
  guestPhone: string;
  guestEmail: string;
  onNameChange: (v: string) => void;
  onPhoneChange: (v: string) => void;
  onEmailChange: (v: string) => void;
  onSubmit: () => void;
  onBack: () => void;
}) {
  return (
    <div className="space-y-4 py-2">
      <h3 className="text-base font-bold text-black dark:text-white">
        {language === 'ko' ? '비회원 정보 입력' : 'Guest Information'}
      </h3>
      <p className="text-xs text-neutral-500">
        {language === 'ko' ? '연락처 또는 이메일 중 하나는 필수입니다.' : 'Phone or email is required.'}
      </p>
      <div>
        <label className="block text-xs text-neutral-600 dark:text-neutral-400 mb-1">
          {language === 'ko' ? '이름' : 'Name'} <span className="text-red-500">*</span>
        </label>
        <input type="text" value={guestName} onChange={(e) => onNameChange(e.target.value)}
          placeholder={language === 'ko' ? '이름을 입력하세요' : 'Enter name'}
          className="w-full px-3 py-2.5 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-black dark:text-white text-sm" />
      </div>
      <div>
        <label className="block text-xs text-neutral-600 dark:text-neutral-400 mb-1">{language === 'ko' ? '연락처' : 'Phone'}</label>
        <input type="tel" value={guestPhone} onChange={(e) => onPhoneChange(e.target.value)}
          placeholder="010-0000-0000"
          className="w-full px-3 py-2.5 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-black dark:text-white text-sm" />
      </div>
      <div>
        <label className="block text-xs text-neutral-600 dark:text-neutral-400 mb-1">{language === 'ko' ? '이메일' : 'Email'}</label>
        <input type="email" value={guestEmail} onChange={(e) => onEmailChange(e.target.value)}
          placeholder="email@example.com"
          className="w-full px-3 py-2.5 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-black dark:text-white text-sm" />
      </div>
      <div className="flex gap-2 pt-2">
        <button type="button" onClick={onBack}
          className="flex-1 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-600 text-sm font-medium">
          {language === 'ko' ? '뒤로' : 'Back'}
        </button>
        <button type="button" onClick={onSubmit}
          className="flex-1 py-2.5 rounded-xl bg-primary text-black font-bold text-sm">
          {language === 'ko' ? '다음' : 'Next'}
        </button>
      </div>
    </div>
  );
}

function DepositorStep({ language, depositorName, depositorStepLoading, purchasing, onNameChange, onSubmit, onCancel }: {
  language: string;
  depositorName: string;
  depositorStepLoading: boolean;
  purchasing: boolean;
  onNameChange: (v: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="space-y-4 py-2">
      <h3 className="text-base font-bold text-black dark:text-white">
        {language === 'ko' ? '입금 안내' : 'Transfer Details'}
      </h3>
      <p className="text-sm text-neutral-600 dark:text-neutral-400">
        {language === 'ko'
          ? '아래 입금자명을 입력한 뒤 신청해 주세요. 학원에서 확인 후 수강권이 발급됩니다.'
          : 'Enter depositor name and submit. Your ticket will be issued after verification.'}
      </p>
      <div>
        <label className="block text-sm font-bold text-black dark:text-white mb-1">
          {language === 'ko' ? '입금자명' : 'Depositor name'}
        </label>
        {depositorStepLoading ? (
          <div className="py-2 flex items-center gap-2">
            <Loader2 className="animate-spin text-primary" size={20} />
            <span className="text-sm text-neutral-500">...</span>
          </div>
        ) : (
          <input type="text" value={depositorName} onChange={(e) => onNameChange(e.target.value)}
            placeholder={language === 'ko' ? '입금 시 사용할 이름' : 'Name for transfer'}
            className="w-full px-3 py-2.5 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-black dark:text-white text-sm" />
        )}
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={onCancel}
          className="flex-1 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-600 text-sm font-medium">
          {language === 'ko' ? '취소' : 'Cancel'}
        </button>
        <button type="button" disabled={purchasing || !depositorName.trim() || depositorStepLoading} onClick={onSubmit}
          className="flex-1 py-2.5 rounded-xl bg-primary text-black font-bold text-sm disabled:opacity-50 flex items-center justify-center gap-2">
          {purchasing ? <Loader2 size={18} className="animate-spin" /> : (language === 'ko' ? '신청하기' : 'Submit')}
        </button>
      </div>
    </div>
  );
}

function BankTransferResult({ language, result, onClose }: {
  language: string;
  result: { amount: number; bankName: string; bankAccountNumber: string; bankDepositorName: string; ordererName?: string };
  onClose: () => void;
}) {
  return (
    <div>
      <p className="text-sm text-neutral-500 mb-3">
        {language === 'ko' ? '아래 계좌로 입금해 주시면 학원에서 확인 후 수강권이 발급됩니다.' : 'Transfer the amount below. Your ticket will be issued after the academy verifies.'}
      </p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 p-3 text-sm mb-4">
        <span className="text-neutral-500">{language === 'ko' ? '금액' : 'Amount'}</span>
        <span className="font-semibold">{result.amount.toLocaleString()}{language === 'ko' ? '원' : ' KRW'}</span>
        <span className="text-neutral-500">{language === 'ko' ? '은행' : 'Bank'}</span>
        <span>{result.bankName}</span>
        <span className="text-neutral-500">{language === 'ko' ? '계좌번호' : 'Account'}</span>
        <div className="flex items-center gap-1.5">
          <span className="font-mono truncate">{result.bankAccountNumber}</span>
          <button type="button" onClick={() => navigator.clipboard.writeText(result.bankAccountNumber)}
            className="shrink-0 p-1 rounded-lg bg-primary text-black hover:opacity-90"
            title={language === 'ko' ? '복사' : 'Copy'}>
            <Copy size={14} />
          </button>
        </div>
        <span className="text-neutral-500">{language === 'ko' ? '예금주' : 'Holder'}</span>
        <span>{result.bankDepositorName}</span>
        {result.ordererName && (
          <>
            <span className="text-neutral-500">{language === 'ko' ? '입금자명' : 'Depositor'}</span>
            <span className="font-medium">{result.ordererName}</span>
          </>
        )}
      </div>
      <button type="button" onClick={onClose}
        className="w-full py-3.5 rounded-xl bg-primary text-black font-bold hover:opacity-95 active:scale-[0.99] transition-all">
        {language === 'ko' ? '확인' : 'OK'}
      </button>
    </div>
  );
}

function TicketListContent({ displayTickets, selectedTicket, selectedDiscount, discounts, startDate, activeTab, user, guestInfo, language, t, onSelectTicket, onSelectDiscount, onStartDateChange, onClearGuestInfo, getValidityText, getDiscountText, formatPrice }: {
  displayTickets: TicketInfo[];
  selectedTicket: TicketInfo | null;
  selectedDiscount: DiscountInfo | null;
  discounts: DiscountInfo[];
  startDate: string;
  activeTab: string;
  user: any;
  guestInfo: { name: string; phone: string; email: string } | null;
  language: string;
  t: (key: string, params?: Record<string, string>) => string;
  onSelectTicket: (t: TicketInfo) => void;
  onSelectDiscount: (d: DiscountInfo | null) => void;
  onStartDateChange: (d: string) => void;
  onClearGuestInfo: () => void;
  getValidityText: (t: TicketInfo) => string;
  getDiscountText: (d: DiscountInfo) => string;
  formatPrice: (p: number) => string;
}) {
  return (
    <div className="space-y-3">
      {!user && guestInfo && (
        <div className="flex items-center justify-between p-3 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
          <div className="text-sm text-blue-700 dark:text-blue-300">
            <span className="font-medium">{guestInfo.name}</span>
            <span className="text-blue-500 dark:text-blue-400 ml-2 text-xs">{guestInfo.phone || guestInfo.email}</span>
          </div>
          <button type="button" onClick={onClearGuestInfo} className="text-xs text-blue-600 dark:text-blue-400 underline">
            {language === 'ko' ? '변경' : 'Change'}
          </button>
        </div>
      )}

      <div className="text-xs text-neutral-500 bg-neutral-50 dark:bg-neutral-800/50 p-3 rounded-lg">
        {activeTab === 'ticket' ? t('ticketModal.ticketDesc') : t('ticketModal.couponDesc')}
      </div>

      <div className="space-y-2">
        {displayTickets.map((ticket) => (
          <button
            key={ticket.id}
            onClick={() => onSelectTicket(ticket)}
            className={`w-full p-4 rounded-2xl border-2 transition-all text-left ${
              selectedTicket?.id === ticket.id
                ? 'border-primary bg-primary/5'
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
                  <span className="font-bold text-black dark:text-white">{ticket.name}</span>
                  {ticket.is_general && (
                    <span className="text-xs px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full">
                      {t('ticketModal.allAcademy')}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-sm text-neutral-500">
                  {ticket.ticket_type === 'PERIOD' ? (
                    <span className="flex items-center gap-1"><Calendar size={14} />{getValidityText(ticket)}</span>
                  ) : (
                    <span className="flex items-center gap-1"><Hash size={14} />{getValidityText(ticket)}</span>
                  )}
                </div>
                {ticket.description && <p className="mt-2 text-xs text-neutral-400">{ticket.description}</p>}
              </div>
              <div className="text-right">
                <span className="text-lg font-bold text-black dark:text-white">{formatPrice(ticket.price)}</span>
                <span className="text-sm text-neutral-500">{t('ticketModal.won')}</span>
              </div>
            </div>
          </button>
        ))}
      </div>

      {selectedTicket && selectedTicket.ticket_type === 'PERIOD' && (
        <div className="p-4 bg-neutral-100 dark:bg-neutral-800 rounded-xl">
          <label className="block text-sm font-bold text-black dark:text-white mb-2">{t('ticketModal.startDateSelect')}</label>
          <input type="date" value={startDate} onChange={(e) => onStartDateChange(e.target.value)}
            min={new Date().toISOString().split('T')[0]}
            className="w-full px-3 py-2 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg text-black dark:text-white" />
          <p className="mt-2 text-xs text-neutral-500">{t('ticketModal.validFromTo', { period: getValidityText(selectedTicket) })}</p>
        </div>
      )}

      {selectedTicket && discounts.length > 0 && (
        <div className="p-4 bg-neutral-100 dark:bg-neutral-800 rounded-xl">
          <label className="block text-sm font-bold text-black dark:text-white mb-2">
            <Tag size={14} className="inline mr-1" />{t('ticketModal.discountApply')}
          </label>
          <div className="space-y-2">
            <button onClick={() => onSelectDiscount(null)}
              className={`w-full p-3 rounded-lg border text-left text-sm ${!selectedDiscount ? 'border-primary bg-white dark:bg-neutral-900' : 'border-neutral-200 dark:border-neutral-700'}`}>
              {t('ticketModal.noDiscount')}
            </button>
            {discounts.map((discount) => (
              <button key={discount.id} onClick={() => onSelectDiscount(discount)}
                className={`w-full p-3 rounded-lg border text-left ${selectedDiscount?.id === discount.id ? 'border-primary bg-white dark:bg-neutral-900' : 'border-neutral-200 dark:border-neutral-700'}`}>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-black dark:text-white text-sm">{discount.name}</span>
                  <span className="text-sm text-red-500 font-bold">{getDiscountText(discount)}</span>
                </div>
                {discount.description && <p className="text-xs text-neutral-500 mt-1">{discount.description}</p>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
