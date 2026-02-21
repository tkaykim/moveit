'use client';

import { useEffect, useState, useId } from 'react';
import { X, Loader2, AlertCircle } from 'lucide-react';
import { useTossPaymentWidget } from '@/hooks/use-toss-payment-widget';

const TOSS_CLIENT_KEY =
  typeof window !== 'undefined' ? process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY : undefined;

export interface TicketTossPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: string;
  amount: number;
  orderName: string;
  customerKey: string;
  sessionId: string;
  returnTo?: string;
}

export function TicketTossPaymentModal({
  isOpen,
  onClose,
  orderId,
  amount,
  orderName,
  customerKey,
  sessionId,
  returnTo = 'session',
}: TicketTossPaymentModalProps) {
  const idSuffix = useId().replace(/:/g, '');
  const paymentMethodsSelector = `#toss-payment-methods-${idSuffix}`;
  const agreementSelector = `#toss-agreement-${idSuffix}`;

  const {
    isReady,
    error: widgetError,
    renderWidgets,
    requestPayment,
    destroy,
  } = useTossPaymentWidget({
    clientKey: TOSS_CLIENT_KEY ?? '',
    customerKey,
    amount,
    orderId,
    orderName,
    sessionId,
    returnTo,
    paymentMethodsSelector,
    agreementSelector,
  });

  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    if (!TOSS_CLIENT_KEY) {
      setError('결제 설정이 완료되지 않았습니다.');
      return;
    }
    renderWidgets();
    return () => {
      destroy();
    };
  }, [isOpen, orderId, amount, orderName, customerKey, sessionId, returnTo]); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePayment = async () => {
    setError(null);
    setPaying(true);
    try {
      await requestPayment();
      // Redirect 방식이므로 여기 반환되면 실패한 경우. 성공 시 successUrl로 이동함.
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '결제 요청에 실패했습니다.');
    } finally {
      setPaying(false);
    }
  };

  if (!isOpen) return null;

  const displayError = error || widgetError;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div
        className="absolute inset-0 bg-black/50"
        aria-hidden
        onClick={onClose}
      />
      <div className="relative w-full max-h-[90vh] sm:max-h-[85vh] sm:max-w-lg rounded-t-2xl sm:rounded-2xl bg-white dark:bg-neutral-900 shadow-xl border border-neutral-200 dark:border-neutral-700 flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-neutral-200 dark:border-neutral-700 flex-shrink-0">
          <h2 className="text-lg font-bold text-neutral-900 dark:text-white">결제하기</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 dark:text-neutral-400"
            aria-label="닫기"
          >
            <X size={20} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-4 space-y-4">
          {!TOSS_CLIENT_KEY && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200 text-sm">
              <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />
              <span>결제 설정이 완료되지 않았습니다.</span>
            </div>
          )}

          {TOSS_CLIENT_KEY && !isReady && !displayError && (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={32} className="animate-spin text-neutral-400" />
            </div>
          )}

          {TOSS_CLIENT_KEY && isReady && (
            <>
              <div>
                <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">결제 수단</p>
                <div id={`toss-payment-methods-${idSuffix}`} className="toss-payment-methods-container min-h-[120px]" />
              </div>
              <div>
                <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">이용약관</p>
                <div id={`toss-agreement-${idSuffix}`} className="toss-agreement-container min-h-[80px]" />
              </div>
            </>
          )}

          {displayError && (
            <p className="text-sm text-red-600 dark:text-red-400 flex items-center gap-1">
              <AlertCircle size={14} /> {displayError}
            </p>
          )}

          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            결제 금액: <strong className="text-neutral-900 dark:text-white">{amount.toLocaleString()}원</strong>
          </p>
        </div>

        <div className="p-4 border-t border-neutral-200 dark:border-neutral-700 flex-shrink-0">
          <button
            type="button"
            onClick={handlePayment}
            disabled={!isReady || paying || !TOSS_CLIENT_KEY}
            className="w-full py-3 rounded-xl font-bold bg-neutral-900 dark:bg-[#CCFF00] text-white dark:text-black hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {paying ? (
              <>
                <Loader2 size={20} className="animate-spin" />
                결제 진행 중…
              </>
            ) : (
              `${amount.toLocaleString()}원 결제하기`
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
