'use client';

import { useState } from 'react';
import { CreditCard, AlertCircle } from 'lucide-react';
import { buildTossCustomerKey } from '@/lib/billing/toss-customer-key';
import { isCapacitorNative, APP_SCHEME } from '@/lib/capacitor/env';

interface PaymentMethodCardProps {
  academyId: string;
  cardCompany: string | null;
  cardNumberMasked: string | null;
  hasBillingKey: boolean;
  onSuccess: () => void;
}

const TOSS_CLIENT_KEY = typeof window !== 'undefined' ? process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY : process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY;

export function PaymentMethodCard({
  academyId,
  cardCompany,
  cardNumberMasked,
  hasBillingKey,
  onSuccess,
}: PaymentMethodCardProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canRegister = !!TOSS_CLIENT_KEY;
  const displayCard = hasBillingKey && (cardCompany || cardNumberMasked);

  const handleRegisterCard = async () => {
    if (!TOSS_CLIENT_KEY) {
      setError('결제 설정이 완료되지 않았습니다. 관리자에게 문의하세요.');
      return;
    }
    setError(null);
    setLoading(true);

    try {
      const script = document.createElement('script');
      script.src = 'https://js.tosspayments.com/v2/standard';
      script.async = true;
      document.body.appendChild(script);

      await new Promise<void>((resolve, reject) => {
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('토스페이먼츠 스크립트 로드 실패'));
      });

      const TossPayments = (window as any).TossPayments;
      if (!TossPayments) {
        throw new Error('토스페이먼츠 SDK를 불러올 수 없습니다.');
      }

      const customerKey = buildTossCustomerKey(academyId);
      const baseUrl = window.location.origin;
      const successUrl = `${baseUrl}/academy-admin/${academyId}/billing/callback`;
      const failUrl = `${baseUrl}/academy-admin/${academyId}/billing?billing=fail`;

      const tossPayments = TossPayments(TOSS_CLIENT_KEY);
      const payment = tossPayments.payment({ customerKey });

      await payment.requestBillingAuth({
        method: 'CARD',
        successUrl,
        failUrl,
        customerEmail: '',
        customerName: '',
        ...(isCapacitorNative() && { appScheme: APP_SCHEME }),
      });
    } catch (err: any) {
      setError(err?.message ?? '카드 등록 창을 열 수 없습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
      <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
        <CreditCard size={20} />
        결제 수단
      </h3>

      {!canRegister && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200 text-sm">
          <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />
          <span>결제 설정이 완료되지 않았습니다. 토스페이먼츠 키 발급 후 카드 등록이 가능합니다.</span>
        </div>
      )}

      {canRegister && (
        <>
          {displayCard ? (
            <div className="flex items-center justify-between flex-wrap gap-3">
              <p className="text-gray-700 dark:text-gray-300 text-sm">
                {cardCompany && <span className="font-medium">{cardCompany}</span>}
                {cardNumberMasked && (
                  <span className={cardCompany ? ' ml-2' : ''}>{cardNumberMasked}</span>
                )}
              </p>
              <button
                type="button"
                onClick={handleRegisterCard}
                disabled={loading}
                className="text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white underline disabled:opacity-50"
              >
                {loading ? '연결 중…' : '카드 변경'}
              </button>
            </div>
          ) : (
            <div>
              <p className="text-gray-600 dark:text-gray-400 text-sm mb-3">
                자동 결제를 위해 카드를 등록해 주세요.
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                카드 번호는 저장되지 않으며, 카드사·마스킹 번호(****1234)와 결제 토큰만 안전하게 저장됩니다.
              </p>
              {TOSS_CLIENT_KEY?.startsWith('test_') && (
                <p className="text-xs text-amber-600 dark:text-amber-400 mb-3">
                  테스트 환경: 실제 카드 정보를 입력해도 출금되지 않습니다. 자유롭게 등록해 보세요.
                </p>
              )}
              <button
                type="button"
                onClick={handleRegisterCard}
                disabled={loading}
                className="px-4 py-2 rounded-lg bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-sm font-medium hover:bg-gray-800 dark:hover:bg-gray-200 disabled:opacity-50"
              >
                {loading ? '연결 중…' : '카드 등록'}
              </button>
            </div>
          )}

          {error && (
            <p className="mt-2 text-sm text-red-600 dark:text-red-400 flex items-center gap-1">
              <AlertCircle size={14} /> {error}
            </p>
          )}
        </>
      )}
    </section>
  );
}
