"use client";

import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, AlertTriangle, Info } from 'lucide-react';
import { fetchWithAuth } from '@/lib/api/auth-fetch';
import { getPaymentMethodDisplayLabel } from '@/lib/toss/payment-method';

interface RefundModalProps {
  academyId: string;
  /** 우선순위: revenueTransactionId > userTicketId > bookingId */
  revenueTransactionId?: string;
  userTicketId?: string | null;
  bookingId?: string | null;
  fallbackTicketName?: string;
  fallbackUserName?: string;
  onClose: () => void;
  onDone?: () => void;
}

interface Preview {
  paidAmount: number;
  suggestedRefund: number;
  basis: string;
  breakdown: { label: string; value: string }[];
  kind: 'PERIOD' | 'COUNT' | 'WORKSHOP';
  expired: boolean;
  isToss: boolean;
  paymentMethod: string | null;
  ticketName: string | null;
}

const KIND_LABEL: Record<string, string> = {
  PERIOD: '기간제',
  COUNT: '횟수제',
  WORKSHOP: '워크샵/팝업',
};

/**
 * 수강권 결제 환불 공용 모달.
 * 서버 dryRun 으로 권장 환불액·산정근거를 받아 표시하고, 관리자가 최종 금액을 직접 조정해 실행.
 * 토스는 PG 취소(부분취소 포함), 계좌이체/현금/수기는 시스템 롤백만(실제 환불은 현장).
 */
export function RefundModal({
  academyId,
  revenueTransactionId,
  userTicketId,
  bookingId,
  fallbackTicketName,
  fallbackUserName,
  onClose,
  onDone,
}: RefundModalProps) {
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [amount, setAmount] = useState<number>(0);
  const [reason, setReason] = useState('');
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const body = useCallback(
    (extra: Record<string, unknown>) => ({
      revenueTransactionId: revenueTransactionId || undefined,
      userTicketId: userTicketId || undefined,
      bookingId: bookingId || undefined,
      ...extra,
    }),
    [revenueTransactionId, userTicketId, bookingId]
  );

  // 권장 환불액 산정(dryRun)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const res = await fetchWithAuth(`/api/academy-admin/${academyId}/ticket-refund`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body({ dryRun: true })),
        });
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setLoadError(data.error || '결제 정보를 불러올 수 없습니다.');
        } else {
          setPreview(data as Preview);
          setAmount(data.suggestedRefund ?? 0);
        }
      } catch {
        if (!cancelled) setLoadError('네트워크 오류가 발생했습니다.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [academyId, body]);

  const handleRefund = useCallback(async () => {
    setProcessing(true);
    setResult(null);
    try {
      const res = await fetchWithAuth(`/api/academy-admin/${academyId}/ticket-refund`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body({ refundAmount: amount, cancelReason: reason || undefined })),
      });
      const data = await res.json();
      if (!res.ok) {
        setResult({ success: false, message: data.error || '환불에 실패했습니다.' });
        return;
      }
      setResult({ success: true, message: data.message || '환불 처리가 완료되었습니다.' });
      onDone?.();
    } catch {
      setResult({ success: false, message: '네트워크 오류가 발생했습니다.' });
    } finally {
      setProcessing(false);
    }
  }, [academyId, body, amount, reason, onDone]);

  const paid = preview?.paidAmount ?? 0;
  const overSuggested = preview && amount > preview.suggestedRefund;
  const clampedInvalid = amount < 0 || amount > paid;

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={() => !processing && onClose()} />
      <div className="relative bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">환불 처리</h3>

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="animate-spin text-primary" size={28} />
          </div>
        ) : result ? (
          <div className="space-y-4">
            <div className={`p-4 rounded-xl text-sm font-medium ${
              result.success
                ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400'
                : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'
            }`}>
              {result.message}
            </div>
            <button onClick={onClose} className="w-full py-2.5 rounded-xl bg-gray-100 dark:bg-neutral-800 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-200 dark:hover:bg-neutral-700 transition-colors">
              닫기
            </button>
          </div>
        ) : loadError ? (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-900/10 text-amber-700 dark:text-amber-400 text-sm flex gap-2">
              <AlertTriangle size={18} className="shrink-0 mt-0.5" />
              <span>{loadError}</span>
            </div>
            <button onClick={onClose} className="w-full py-2.5 rounded-xl bg-gray-100 dark:bg-neutral-800 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-200 dark:hover:bg-neutral-700 transition-colors">
              닫기
            </button>
          </div>
        ) : preview ? (
          <div className="space-y-4">
            {/* 결제/수강권 요약 */}
            <div className="bg-gray-50 dark:bg-neutral-800 rounded-xl p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">상품명</span>
                <span className="font-medium text-gray-900 dark:text-white text-right">
                  {preview.ticketName || fallbackTicketName || '-'}
                  <span className="ml-1.5 text-[11px] px-1.5 py-0.5 rounded bg-gray-200 dark:bg-neutral-700 text-gray-600 dark:text-gray-300 align-middle">
                    {KIND_LABEL[preview.kind] || preview.kind}
                  </span>
                </span>
              </div>
              {fallbackUserName && (
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">회원</span>
                  <span className="font-medium text-gray-900 dark:text-white">{fallbackUserName}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">결제 수단</span>
                <span className="text-gray-700 dark:text-gray-300">{getPaymentMethodDisplayLabel(preview.paymentMethod) || '-'}</span>
              </div>
            </div>

            {/* 산정 내역 */}
            <div className="border border-gray-200 dark:border-neutral-700 rounded-xl p-4 space-y-1.5 text-sm">
              {preview.breakdown.map((b, i) => (
                <div key={i} className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">{b.label}</span>
                  <span className={`text-gray-800 dark:text-gray-200 ${b.label.includes('권장') ? 'font-bold' : ''}`}>{b.value}</span>
                </div>
              ))}
            </div>

            {/* 산정 근거 */}
            <div className="rounded-xl bg-blue-50 dark:bg-blue-900/10 text-blue-700 dark:text-blue-300 text-xs p-3 flex gap-2">
              <Info size={15} className="shrink-0 mt-0.5" />
              <span>{preview.basis}</span>
            </div>

            {/* 환불 금액 입력 (권장값 prefill, 관리자 조정 가능) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                환불 금액 <span className="text-gray-400 font-normal">(권장 {preview.suggestedRefund.toLocaleString()}원 · 최대 {paid.toLocaleString()}원)</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={amount}
                  min={0}
                  max={paid}
                  onChange={(e) => setAmount(Math.floor(Number(e.target.value) || 0))}
                  className="w-full border dark:border-neutral-700 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-neutral-800 text-gray-900 dark:text-white pr-8"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">원</span>
              </div>
              <div className="flex gap-2 mt-1.5">
                <button onClick={() => setAmount(preview.suggestedRefund)} className="text-xs px-2 py-1 rounded bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-neutral-700">
                  권장액
                </button>
                <button onClick={() => setAmount(paid)} className="text-xs px-2 py-1 rounded bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-neutral-700">
                  전액
                </button>
                <button onClick={() => setAmount(0)} className="text-xs px-2 py-1 rounded bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-neutral-700">
                  0원
                </button>
              </div>
              {overSuggested && (
                <p className="mt-1.5 text-xs text-amber-600 dark:text-amber-400">권장액보다 큰 금액입니다. 학원 재량으로 진행됩니다.</p>
              )}
            </div>

            {/* 사유 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">환불 사유 (선택)</label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="예: 고객 요청, 중복 결제"
                className="w-full border dark:border-neutral-700 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-neutral-800 text-gray-900 dark:text-white placeholder-gray-400"
              />
            </div>

            {/* 처리 안내 */}
            <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-xl p-3 text-xs text-red-600 dark:text-red-400 space-y-1">
              <p>환불 시 수강권이 해지되고, 아직 진행되지 않은 예약(대기·확정)이 취소됩니다. 이미 출석완료한 수업은 유지됩니다.</p>
              {preview.isToss ? (
                <p>{amount >= paid ? '토스 전체취소' : amount > 0 ? `토스 부분취소 ${amount.toLocaleString()}원` : 'PG 취소 없음(수강권만 해지)'}로 처리됩니다.</p>
              ) : (
                <p>계좌이체/현금/수기 건입니다. 시스템 처리만 되며 실제 금액 환불은 현장에서 직접 진행해 주세요.</p>
              )}
            </div>

            <div className="flex gap-3">
              <button onClick={onClose} disabled={processing} className="flex-1 py-2.5 rounded-xl bg-gray-100 dark:bg-neutral-800 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-200 dark:hover:bg-neutral-700 transition-colors disabled:opacity-40">
                취소
              </button>
              <button onClick={handleRefund} disabled={processing || clampedInvalid} className="flex-1 py-2.5 rounded-xl bg-red-600 text-white font-bold hover:bg-red-700 transition-colors disabled:opacity-40 flex items-center justify-center gap-2">
                {processing ? (<><Loader2 size={16} className="animate-spin" />처리 중…</>) : `${amount.toLocaleString()}원 환불`}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>,
    document.body
  );
}
