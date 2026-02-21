'use client';

import { useState, useEffect } from 'react';
import { X, AlertCircle } from 'lucide-react';
import { buildTossCustomerKey } from '@/lib/billing/toss-customer-key';
import { isCapacitorNative, APP_SCHEME, getPaymentSuccessUrl, getPaymentFailUrl } from '@/lib/capacitor/env';
import type { BillingPlanId, BillingCycle } from '@/types/billing';

const TOSS_CLIENT_KEY =
  typeof window !== 'undefined' ? process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY : undefined;

const PLAN_OPTIONS: { id: BillingPlanId; label: string }[] = [
  { id: 'starter', label: 'Starter' },
  { id: 'growth', label: 'Growth' },
  { id: 'pro', label: 'Pro' },
];

const CYCLE_OPTIONS: { id: BillingCycle; label: string }[] = [
  { id: 'monthly', label: '월간' },
  { id: 'annual', label: '연간' },
];

const VALID_PLAN_IDS: BillingPlanId[] = ['starter', 'growth', 'pro'];
const VALID_CYCLES: BillingCycle[] = ['monthly', 'annual'];

interface SubscribeModalProps {
  academyId: string;
  isOpen: boolean;
  onClose: () => void;
  initialPlanId?: BillingPlanId | null;
  initialCycle?: BillingCycle | null;
}

export function SubscribeModal({ academyId, isOpen, onClose, initialPlanId, initialCycle }: SubscribeModalProps) {
  const [planId, setPlanId] = useState<BillingPlanId>(
    initialPlanId && VALID_PLAN_IDS.includes(initialPlanId) ? initialPlanId : 'starter'
  );
  const [cycle, setCycle] = useState<BillingCycle>(
    initialCycle && VALID_CYCLES.includes(initialCycle) ? initialCycle : 'monthly'
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    if (initialPlanId && VALID_PLAN_IDS.includes(initialPlanId)) setPlanId(initialPlanId);
    if (initialCycle && VALID_CYCLES.includes(initialCycle)) setCycle(initialCycle);
  }, [isOpen, initialPlanId, initialCycle]);

  if (!isOpen) return null;

  const handleStartBilling = async () => {
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
      const successUrl = getPaymentSuccessUrl(`academy-admin/${academyId}/billing/callback`, { returnTo: 'dashboard', planId, cycle });
      const failUrl = getPaymentFailUrl(`academy-admin/${academyId}`, { billing: 'fail' });

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
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '카드 등록 창을 열 수 없습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" aria-hidden onClick={onClose} />
      <div className="relative w-full max-w-md rounded-xl bg-white dark:bg-neutral-900 shadow-xl border border-neutral-200 dark:border-neutral-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-neutral-900 dark:text-white">구독하기</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 dark:text-neutral-400"
            aria-label="닫기"
          >
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
              플랜
            </label>
            <div className="flex gap-2 flex-wrap">
              {PLAN_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setPlanId(opt.id)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium ${
                    planId === opt.id
                      ? 'bg-neutral-900 dark:bg-[#CCFF00] text-white dark:text-black'
                      : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
              결제 주기
            </label>
            <div className="flex gap-2">
              {CYCLE_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setCycle(opt.id)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium ${
                    cycle === opt.id
                      ? 'bg-neutral-900 dark:bg-[#CCFF00] text-white dark:text-black'
                      : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {!TOSS_CLIENT_KEY && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200 text-sm">
              <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />
              <span>결제 설정이 완료되지 않았습니다. 토스페이먼츠 키 발급 후 구독이 가능합니다.</span>
            </div>
          )}

          {TOSS_CLIENT_KEY?.startsWith('test_') && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              테스트 환경: 실제 카드 정보를 입력해도 출금되지 않습니다.
            </p>
          )}

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400 flex items-center gap-1">
              <AlertCircle size={14} /> {error}
            </p>
          )}

          <button
            type="button"
            onClick={handleStartBilling}
            disabled={loading || !TOSS_CLIENT_KEY}
            className="w-full py-3 rounded-xl font-bold bg-neutral-900 dark:bg-[#CCFF00] text-white dark:text-black hover:opacity-90 disabled:opacity-50"
          >
            {loading ? '연결 중…' : '카드 등록 및 구독하기'}
          </button>
        </div>
      </div>
    </div>
  );
}
