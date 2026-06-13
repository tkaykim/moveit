"use client";

import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, AlertTriangle } from 'lucide-react';
import { fetchWithAuth } from '@/lib/api/auth-fetch';
import { getSupabaseClient } from '@/lib/utils/supabase-client';
import { getPaymentMethodDisplayLabel } from '@/lib/toss/payment-method';

interface RefundModalProps {
  academyId: string;
  /** 우선순위: revenueTransactionId > userTicketId > bookingId */
  revenueTransactionId?: string;
  userTicketId?: string | null;
  bookingId?: string | null;
  /** 표시용 보조 정보(없으면 결제건을 조회해 채움) */
  fallbackTicketName?: string;
  fallbackUserName?: string;
  onClose: () => void;
  onDone?: () => void;
}

interface RevInfo {
  id: string;
  ticket_name: string | null;
  final_price: number;
  payment_method: string | null;
  payment_status: string;
  toss_payment_key: string | null;
}

/**
 * 수강권 결제 환불 공용 모달.
 * - 매출/정산: revenueTransactionId 전달
 * - 출석/신청관리: userTicketId 또는 bookingId 전달 → 결제건을 역추적
 * 토스 결제는 PG 취소까지, 계좌이체/현금/수기는 시스템 롤백만(실제 환불은 현장 오프라인).
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
  const [loadingInfo, setLoadingInfo] = useState(true);
  const [info, setInfo] = useState<RevInfo | null>(null);
  const [noPayment, setNoPayment] = useState(false);
  const [reason, setReason] = useState('');
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  // 결제건 조회(표시용). revenue_transactions 는 RLS off 라 클라이언트 조회 가능.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingInfo(true);
      const supabase = getSupabaseClient() as any;
      if (!supabase) { setLoadingInfo(false); return; }
      const cols = 'id, ticket_name, final_price, payment_method, payment_status, toss_payment_key, user_ticket_id, created_at';
      try {
        let row: any = null;
        if (revenueTransactionId) {
          const { data } = await supabase
            .from('revenue_transactions')
            .select(cols)
            .eq('id', revenueTransactionId)
            .eq('academy_id', academyId)
            .maybeSingle();
          row = data;
        } else {
          let utId = userTicketId ?? null;
          if (!utId && bookingId) {
            const { data: bk } = await supabase
              .from('bookings')
              .select('user_ticket_id')
              .eq('id', bookingId)
              .maybeSingle();
            utId = bk?.user_ticket_id ?? null;
          }
          if (utId) {
            const { data } = await supabase
              .from('revenue_transactions')
              .select(cols)
              .eq('user_ticket_id', utId)
              .eq('academy_id', academyId)
              .in('payment_status', ['COMPLETED', 'PARTIALLY_REFUNDED'])
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();
            row = data;
          }
        }
        if (cancelled) return;
        if (row) {
          setInfo(row as RevInfo);
        } else {
          setNoPayment(true);
        }
      } catch {
        if (!cancelled) setNoPayment(true);
      } finally {
        if (!cancelled) setLoadingInfo(false);
      }
    })();
    return () => { cancelled = true; };
  }, [academyId, revenueTransactionId, userTicketId, bookingId]);

  const alreadyRefunded = info?.payment_status === 'REFUNDED';

  const handleRefund = useCallback(async () => {
    setProcessing(true);
    setResult(null);
    try {
      const res = await fetchWithAuth(`/api/academy-admin/${academyId}/ticket-refund`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          revenueTransactionId: revenueTransactionId || info?.id,
          userTicketId: userTicketId || undefined,
          bookingId: bookingId || undefined,
          cancelReason: reason || undefined,
        }),
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
  }, [academyId, revenueTransactionId, userTicketId, bookingId, info?.id, reason, onDone]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={() => !processing && onClose()} />
      <div className="relative bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl w-full max-w-md p-6">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">환불 처리</h3>

        {loadingInfo ? (
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
            <button
              onClick={onClose}
              className="w-full py-2.5 rounded-xl bg-gray-100 dark:bg-neutral-800 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-200 dark:hover:bg-neutral-700 transition-colors"
            >
              닫기
            </button>
          </div>
        ) : noPayment ? (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-900/10 text-amber-700 dark:text-amber-400 text-sm flex gap-2">
              <AlertTriangle size={18} className="shrink-0 mt-0.5" />
              <span>이 예약에는 환불할 결제 내역이 없습니다. (수기 발급·무료 발급 등 결제 기록이 없는 건)</span>
            </div>
            <button
              onClick={onClose}
              className="w-full py-2.5 rounded-xl bg-gray-100 dark:bg-neutral-800 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-200 dark:hover:bg-neutral-700 transition-colors"
            >
              닫기
            </button>
          </div>
        ) : alreadyRefunded ? (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-gray-50 dark:bg-neutral-800 text-gray-600 dark:text-gray-300 text-sm">
              이미 환불된 결제입니다.
            </div>
            <button
              onClick={onClose}
              className="w-full py-2.5 rounded-xl bg-gray-100 dark:bg-neutral-800 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-200 dark:hover:bg-neutral-700 transition-colors"
            >
              닫기
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-gray-50 dark:bg-neutral-800 rounded-xl p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">상품명</span>
                <span className="font-medium text-gray-900 dark:text-white text-right">
                  {info?.ticket_name || fallbackTicketName || '-'}
                </span>
              </div>
              {fallbackUserName && (
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">회원</span>
                  <span className="font-medium text-gray-900 dark:text-white">{fallbackUserName}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">결제 금액</span>
                <span className="font-bold text-gray-900 dark:text-white">
                  {(info?.final_price ?? 0).toLocaleString()}원
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">결제 수단</span>
                <span className="text-gray-700 dark:text-gray-300">
                  {getPaymentMethodDisplayLabel(info?.payment_method) || '-'}
                </span>
              </div>
              {info?.toss_payment_key ? (
                <div className="pt-1 text-xs text-blue-600 dark:text-blue-400">
                  토스 결제 취소 API가 자동 호출되어 카드/간편결제 금액이 환불됩니다.
                </div>
              ) : (
                <div className="pt-1 text-xs text-amber-600 dark:text-amber-400">
                  계좌이체·현금·수기 건입니다. 시스템상 환불(수강권·예약 취소)만 처리되며,
                  실제 금액 환불은 현장에서 직접 진행해 주세요.
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                환불 사유 (선택)
              </label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="예: 고객 요청, 중복 결제"
                className="w-full border dark:border-neutral-700 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-neutral-800 text-gray-900 dark:text-white placeholder-gray-400"
              />
            </div>

            <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-xl p-3 text-xs text-red-600 dark:text-red-400">
              환불 시 해당 수강권이 비활성화되고, 그 수강권으로 잡힌 예약이 모두 취소됩니다.
              이 작업은 되돌릴 수 없습니다.
            </div>

            <div className="flex gap-3">
              <button
                onClick={onClose}
                disabled={processing}
                className="flex-1 py-2.5 rounded-xl bg-gray-100 dark:bg-neutral-800 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-200 dark:hover:bg-neutral-700 transition-colors disabled:opacity-40"
              >
                취소
              </button>
              <button
                onClick={handleRefund}
                disabled={processing}
                className="flex-1 py-2.5 rounded-xl bg-red-600 text-white font-bold hover:bg-red-700 transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
              >
                {processing ? (<><Loader2 size={16} className="animate-spin" />처리 중…</>) : '환불 확인'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
