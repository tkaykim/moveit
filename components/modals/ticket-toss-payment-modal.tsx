'use client';

import { useEffect, useRef, useState } from 'react';
import { X, Loader2 } from 'lucide-react';

const TOSS_SCRIPT = 'https://js.tosspayments.com/v2/standard';

interface TicketTossPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  onError: (message: string) => void;
  /** 토스 클라이언트 키 (NEXT_PUBLIC_TOSS_CLIENT_KEY). 없으면 모달은 사용하지 않음 */
  clientKey: string | undefined;
  orderId: string;
  amount: number;
  orderName: string;
  customerKey: string;
  /** successUrl (같은 origin 권장). 앱 WebView 내 리다이렉트용 */
  successUrl: string;
  /** failUrl (같은 origin 권장) */
  failUrl: string;
}

/**
 * 수강권 결제용 토스 결제위젯 모달.
 * 같은 화면(앱 내 WebView)에서 결제 방법 선택 후 결제 요청하여,
 * success/fail 리다이렉트가 앱 WebView로 오도록 함.
 */
export function TicketTossPaymentModal({
  isOpen,
  onClose,
  onError,
  clientKey,
  orderId,
  amount,
  orderName,
  customerKey,
  successUrl,
  failUrl,
}: TicketTossPaymentModalProps) {
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const widgetsRef = useRef<any>(null);

  useEffect(() => {
    if (!isOpen || !clientKey || amount <= 0) return;

    let cancelled = false;

    const init = async () => {
      setLoading(true);
      try {
        if (!(window as any).TossPayments) {
          await new Promise<void>((resolve, reject) => {
            const script = document.createElement('script');
            script.src = TOSS_SCRIPT;
            script.async = true;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error('토스페이먼츠 스크립트 로드 실패'));
            document.body.appendChild(script);
          });
        }

        if (cancelled) return;

        // 공식 문서: "주문서의 DOM이 생성된 이후에 호출" — React 커밋 직후를 보장하기 위해 한 프레임 대기
        await new Promise<void>((resolve) => {
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
        });

        if (cancelled) return;
        if (!document.querySelector('#toss-widget-payment') || !document.querySelector('#toss-widget-agreement')) {
          throw new Error('결제 영역을 찾을 수 없습니다.');
        }

        const TossPayments = (window as any).TossPayments;
        const tossPayments = TossPayments(clientKey);
        const widgets = tossPayments.widgets({ customerKey });
        widgetsRef.current = widgets;

        await widgets.setAmount({ currency: 'KRW', value: amount });

        await Promise.all([
          widgets.renderPaymentMethods({ selector: '#toss-widget-payment', variantKey: 'DEFAULT' }),
          widgets.renderAgreement({ selector: '#toss-widget-agreement', variantKey: 'AGREEMENT' }),
        ]);
      } catch (e: any) {
        if (!cancelled) onError(e?.message || '결제 위젯을 불러올 수 없습니다.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    init();
    return () => {
      cancelled = true;
    };
  }, [isOpen, clientKey, amount, customerKey]);

  const handleRequestPayment = async () => {
    if (!widgetsRef.current) return;
    setPaying(true);
    try {
      await widgetsRef.current.requestPayment({
        orderId,
        orderName,
        successUrl,
        failUrl,
        customerEmail: '',
        customerName: '',
        customerMobilePhone: '',
      });
      // 성공/실패는 리다이렉트로 처리됨
    } catch (e: any) {
      onError(e?.message || '결제 요청에 실패했습니다.');
    } finally {
      setPaying(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div className="relative bg-white dark:bg-neutral-900 rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-h-[90vh] flex flex-col max-w-lg animate-in slide-in-from-bottom sm:zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-4 border-b border-neutral-200 dark:border-neutral-800">
          <h3 className="text-lg font-bold text-black dark:text-white">결제</h3>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 rounded-lg"
            aria-label="닫기"
          >
            <X size={20} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-4 min-h-0 relative">
          {/* selector 대상 요소는 DOM에 항상 있어야 함(공식: "DOM 생성된 이후에 호출") */}
          <div id="toss-widget-payment" className="min-h-[120px]" />
          <div id="toss-widget-agreement" className="mt-4 min-h-[80px]" />
          {loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white dark:bg-neutral-900 rounded-b-2xl sm:rounded-b-2xl">
              <Loader2 size={32} className="text-primary dark:text-[#CCFF00] animate-spin" />
              <p className="text-sm text-neutral-500">결제 UI를 불러오는 중…</p>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-neutral-200 dark:border-neutral-800">
          <button
            type="button"
            disabled={loading || paying}
            onClick={handleRequestPayment}
            className="w-full bg-primary dark:bg-[#CCFF00] text-black font-bold py-3 rounded-xl disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {paying ? (
              <>
                <Loader2 size={20} className="animate-spin" />
                <span>결제 진행 중…</span>
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
