'use client';

import { useState } from 'react';
import { authFetch } from '@/lib/supabase/auth-fetch';

interface CancelSubscriptionSectionProps {
  academyId: string;
  status: string;
  cancelAtPeriodEnd: boolean;
  onSuccess: () => void;
}

export function CancelSubscriptionSection({
  academyId,
  status,
  cancelAtPeriodEnd,
  onSuccess,
}: CancelSubscriptionSectionProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const canCancel =
    (status === 'active' || status === 'trial') && !cancelAtPeriodEnd;

  const handleCancel = async () => {
    if (!canCancel || loading) return;
    setError(null);
    setLoading(true);
    try {
      const res = await authFetch('/api/billing/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ academyId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? '취소 처리에 실패했습니다.');
        return;
      }
      setConfirming(false);
      onSuccess();
    } catch {
      setError('취소 처리 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  if (cancelAtPeriodEnd) {
    return (
      <section className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-2">구독 취소</h3>
        <p className="text-amber-600 dark:text-amber-400 text-sm">
          현재 결제 기간 종료 시 구독이 취소됩니다. 기간 종료 전까지는 서비스를 이용할 수 있습니다.
        </p>
      </section>
    );
  }

  if (status !== 'active' && status !== 'trial') {
    return null;
  }

  return (
    <section className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
      <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-2">구독 취소</h3>
      <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
        구독을 취소하면 현재 결제 기간이 끝난 뒤 서비스가 종료됩니다. 취소 후에도 기간 만료 전까지는 이용 가능합니다.
      </p>
      {!confirming ? (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="text-sm text-red-600 dark:text-red-400 hover:underline"
        >
          기간 종료 시 취소하기
        </button>
      ) : (
        <div className="space-y-2">
          <p className="text-sm text-gray-600 dark:text-gray-400">정말 현재 기간 종료 시 취소하시겠습니까?</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleCancel}
              disabled={loading}
              className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50"
            >
              {loading ? '처리 중…' : '예, 취소합니다'}
            </button>
            <button
              type="button"
              onClick={() => { setConfirming(false); setError(null); }}
              disabled={loading}
              className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm"
            >
              아니오
            </button>
          </div>
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        </div>
      )}
    </section>
  );
}
