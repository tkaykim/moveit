'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { authFetch } from '@/lib/supabase/auth-fetch';
import { useAcademy } from '../../../contexts/academy-context';

const VALID_PLAN_IDS = ['starter', 'growth', 'pro'];
const VALID_CYCLES = ['monthly', 'annual'];

const REDIRECT_DELAY_MS = 1200;

const processedAuthKeys = new Set<string>();
const inFlightAuthKeys = new Set<string>();

function isAlreadyUsedAuthError(res: Response, data: { error?: string }): boolean {
  if (res.status < 400 || res.status >= 500) return false;
  const msg = (data?.error ?? '').toLowerCase();
  return msg.includes('이미 사용') || msg.includes('already') || msg.includes('already_used');
}

export default function BillingCallbackPage() {
  const searchParams = useSearchParams();
  const { academyId, academySlug } = useAcademy();
  const authKey = searchParams?.get('authKey');
  const customerKey = searchParams?.get('customerKey');
  const returnTo = searchParams?.get('returnTo');
  const planId = searchParams?.get('planId');
  const cycle = searchParams?.get('cycle');
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!academyId || !authKey || !customerKey) {
      setStatus('error');
      setMessage('필수 정보가 없습니다.');
      return;
    }

    if (processedAuthKeys.has(authKey)) return;
    if (inFlightAuthKeys.has(authKey)) return;
    inFlightAuthKeys.add(authKey);

    (async () => {
      try {
        const body: { authKey: string; customerKey: string; academyId: string; planId?: string; billingCycle?: string } = {
          authKey,
          customerKey,
          academyId,
        };
        if (planId && VALID_PLAN_IDS.includes(planId) && cycle && VALID_CYCLES.includes(cycle)) {
          body.planId = planId;
          body.billingCycle = cycle;
        }
        const res = await authFetch('/api/billing/request-billing-auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const data = await res.json();

        if (!res.ok) {
          if (isAlreadyUsedAuthError(res, data)) {
            processedAuthKeys.add(authKey);
            setStatus('success');
            setMessage('카드가 등록되었습니다.');
            await new Promise((r) => setTimeout(r, REDIRECT_DELAY_MS));
            window.location.href = `/academy-admin/${academySlug}/billing?card=ok`;
            return;
          }
          setStatus('error');
          setMessage(data?.error ?? '카드 등록에 실패했습니다.');
          return;
        }

        processedAuthKeys.add(authKey);

        setStatus('success');
        setMessage('카드가 등록되었습니다. 14일 무료 체험이 시작되었습니다.');
        const goToBilling = returnTo === 'billing';
        await new Promise((r) => setTimeout(r, REDIRECT_DELAY_MS));
        window.location.href = goToBilling
          ? `/academy-admin/${academySlug}/billing?card=ok`
          : `/academy-admin/${academySlug}?card=ok`;
      } catch {
        setStatus('error');
        setMessage('카드 등록 처리 중 오류가 발생했습니다.');
      } finally {
        inFlightAuthKeys.delete(authKey);
        processedAuthKeys.add(authKey);
      }
    })();
  }, [academyId, academySlug, authKey, customerKey, returnTo, planId, cycle]);

  const goToBilling = () => {
    window.location.href = `/academy-admin/${academySlug}/billing`;
  };

  return (
    <div className="min-h-[40vh] flex flex-col items-center justify-center p-6">
      {status === 'loading' && (
        <p className="text-gray-600 dark:text-gray-400">카드 등록을 처리하고 있습니다…</p>
      )}
      {status === 'success' && (
        <div className="text-center">
          <p className="text-green-600 dark:text-green-400 font-medium mb-4">{message}</p>
          <button
            type="button"
            onClick={goToBilling}
            className="px-4 py-2 rounded-lg bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-sm font-medium"
          >
            구독/결제 관리로 이동
          </button>
        </div>
      )}
      {status === 'error' && (
        <div className="text-center max-w-md">
          <p className="text-red-600 dark:text-red-400 font-medium mb-2">{message}</p>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4">
            카드 등록에 실패했습니다. 본인 명의 카드로 다시 시도해 주세요.
          </p>
          <button
            type="button"
            onClick={goToBilling}
            className="px-4 py-2 rounded-lg bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-sm font-medium"
          >
            구독/결제 관리로 이동
          </button>
        </div>
      )}
    </div>
  );
}
