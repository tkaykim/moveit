'use client';

import { useEffect, useRef, useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { normalizePhone } from '@/lib/utils/phone';
import { isNativePlatform } from '@/lib/capacitor/platform';
import { ModalPortal } from '@/components/common/modal-portal';

const TOSS_SCRIPT = 'https://js.tosspayments.com/v2/standard';

/** 토스 customerMobilePhone: `-` 없이 숫자만 8~15자 */
function toTossPhone(value: string | undefined): string {
  if (!value) return '';
  const digits = normalizePhone(value);
  return digits.length >= 8 && digits.length <= 15 ? digits : '';
}

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
  /** 휴대폰 번호. 숫자만 8~15자로 전달됨 (하이픈 없음). 없으면 빈 문자열 전달 */
  customerMobilePhone?: string;
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
  customerMobilePhone: customerMobilePhoneProp,
}: TicketTossPaymentModalProps) {
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [cancelMsg, setCancelMsg] = useState('');
  // 결제수단 미선택·약관 미동의 등 "사용자가 고칠 수 있는" 오류는 모달을 닫지 않고
  // 여기 인라인으로 안내한다(부모 onError 는 위젯 로드/렌더 실패 같은 치명적 경우 전용).
  const [inlineError, setInlineError] = useState('');
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
    setInlineError('');
    setCancelMsg('');
    try {
      const customerMobilePhone = toTossPhone(customerMobilePhoneProp);
      const isApp = isNativePlatform();
      // 2026-05-10: 빈 문자열 customerEmail/customerName 을 보내면 일부 케이스에서
      // SDK 가 invalid 로 판정해 silent reject 함. 값이 없으면 키 자체를 넣지 않음.
      const paymentRequest: Record<string, unknown> = {
        orderId,
        orderName,
        successUrl,
        failUrl,
      };
      if (customerMobilePhone) paymentRequest.customerMobilePhone = customerMobilePhone;
      if (isApp) {
        paymentRequest.windowTarget = 'self';
        paymentRequest.card = { appScheme: 'moveitapp://' };
      }
      await widgetsRef.current.requestPayment(paymentRequest);
      // 성공/실패는 리다이렉트로 처리됨
    } catch (e: any) {
      // 2026-05-10: 결제하기 클릭 후 redirect 가 아예 일어나지 않는 사고 추적용.
      // 토스 SDK 가 throw 하지만 e.message 가 비어있으면 부모 onError 가 빈 문자열로
      // setError 해서 사용자가 사고를 인지하지 못함. 로깅 + fallback 메시지 강화.
      console.error('[toss] requestPayment error', { code: e?.code, message: e?.message, raw: e });
      const code: string = e?.code ?? '';
      const isCancelled = code === 'PAY_PROCESS_CANCELED' || code === 'PAY_PROCESS_ABORTED';
      if (isCancelled) {
        setCancelMsg('결제가 취소되었습니다. 다시 시도하려면 결제하기를 눌러주세요.');
        setTimeout(() => setCancelMsg(''), 4000);
      } else {
        const rawMsg = (typeof e?.message === 'string' && e.message.trim()) ? e.message : '';
        const isPhoneFormatError =
          rawMsg && (rawMsg.includes('전화번호') && (rawMsg.includes('특수문자') || rawMsg.includes('형식')));
        const isSelectMethod = rawMsg && (rawMsg.includes('선택') || /method|payment/i.test(code));
        const friendly = isPhoneFormatError
          ? '전화번호는 하이픈(-) 없이 숫자만 입력해주세요.'
          : isSelectMethod
            ? '결제 수단을 선택한 뒤 결제하기를 눌러주세요.'
            : (rawMsg || (code
                ? `결제 요청 중 오류가 발생했습니다 (${code}). 잠시 후 다시 시도해주세요.`
                : '결제 요청에 실패했습니다. 결제 수단을 다시 선택하고 시도해주세요.'));
        // 모달을 닫지 않고 인라인으로 안내 — 사용자가 결제 수단을 고른 뒤 바로 재시도 가능.
        setInlineError(friendly);
      }
    } finally {
      setPaying(false);
    }
  };

  if (!isOpen) return null;

  return (
    <ModalPortal>
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} aria-hidden />
      {/* 토스 결제위젯은 흰색 고정 iframe이므로 모달 전체를 항상 라이트로 둔다(다크모드에서도). */}
      <div className="relative bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-h-[90vh] flex flex-col max-w-lg animate-in slide-in-from-bottom sm:zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-5 pt-4 pb-3">
          <h3 className="text-base font-bold text-neutral-900">결제</h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 -mr-1.5 text-neutral-400 hover:text-neutral-600 rounded-lg"
            aria-label="닫기"
          >
            <X size={20} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-5 min-h-0 relative">
          {/* selector 대상 요소는 DOM에 항상 있어야 함(공식: "DOM 생성된 이후에 호출") */}
          <div id="toss-widget-payment" className="min-h-[120px]" />
          <div id="toss-widget-agreement" className="min-h-[80px]" />
          {loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white">
              <Loader2 size={28} className="text-neutral-400 animate-spin" />
              <p className="text-sm text-neutral-500">결제 수단을 불러오는 중…</p>
            </div>
          )}
        </div>

        <div className="px-5 pt-3 pb-5">
          {inlineError && (
            <p className="mb-2 text-center text-sm font-medium text-red-500">{inlineError}</p>
          )}
          {cancelMsg && !inlineError && (
            <p className="mb-2 text-center text-sm text-neutral-500">{cancelMsg}</p>
          )}
          <button
            type="button"
            disabled={loading || paying}
            onClick={handleRequestPayment}
            className="w-full bg-neutral-900 text-white font-bold py-3.5 rounded-xl disabled:opacity-40 flex items-center justify-center gap-2 hover:bg-neutral-800 transition-colors"
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
    </ModalPortal>
  );
}
