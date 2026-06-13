"use client";

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { SectionHeader } from '../common/section-header';
import { getSupabaseClient } from '@/lib/utils/supabase-client';
import { formatCurrency } from './utils/format-currency';
import { getPaymentMethodDisplayLabel } from '@/lib/toss/payment-method';
import { fetchWithAuth } from '@/lib/api/auth-fetch';

interface RevenueViewProps {
  academyId: string;
}

export function RevenueView({ academyId }: RevenueViewProps) {
  const router = useRouter();
  const [stats, setStats] = useState({
    totalRevenue: 0,
    unpaidAmount: 0,
    netProfit: 0,
  });
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refundTarget, setRefundTarget] = useState<any | null>(null);
  const [refundReason, setRefundReason] = useState('');
  const [refundProcessing, setRefundProcessing] = useState(false);
  const [refundResult, setRefundResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    loadData();
  }, [academyId]);

  const loadData = async () => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      setLoading(false);
      return;
    }

    try {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      // 이번 달 매출 통계
      const { data: revenueData } = await supabase
        .from('revenue_transactions')
        .select('final_price, discount_amount, original_price')
        .eq('academy_id', academyId)
        .eq('payment_status', 'COMPLETED')
        .gte('transaction_date', startOfMonth);

      const totalRevenue = revenueData?.reduce((sum: number, t: any) => sum + (t.final_price || 0), 0) || 0;

      // 미정산 금액 (강사 정산)
      const { data: salariesData } = await supabase
        .from('instructor_salaries')
        .select('salary_amount')
        .eq('academy_id', academyId)
        .eq('status', 'PENDING');

      const unpaidAmount = salariesData?.reduce((sum: number, s: any) => sum + (s.salary_amount || 0), 0) || 0;

      const netProfit = totalRevenue - unpaidAmount;

      setStats({
        totalRevenue,
        unpaidAmount,
        netProfit,
      });

      // 최근 결제 내역 (명시적 컬럼 선택 - 구매 시점 스냅샷 포함)
      const { data: transactionsData, error } = await supabase
        .from('revenue_transactions')
        .select(`
          id,
          academy_id,
          user_id,
          ticket_id,
          user_ticket_id,
          discount_id,
          original_price,
          discount_amount,
          final_price,
          payment_method,
          payment_status,
          transaction_date,
          registration_type,
          quantity,
          valid_days,
          ticket_name,
          ticket_type_snapshot,
          toss_payment_key,
          notes,
          created_at,
          users (
            id,
            name,
            nickname
          ),
          tickets (
            id,
            name,
            ticket_type,
            ticket_category,
            valid_days,
            total_count
          )
        `)
        .eq('academy_id', academyId)
        .in('payment_status', ['COMPLETED', 'REFUNDED', 'PARTIALLY_REFUNDED'])
        .order('transaction_date', { ascending: false })
        .limit(50);

      if (error) throw error;
      setTransactions(transactionsData || []);
    } catch (error) {
      console.error('Error loading revenue data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefund = useCallback(async () => {
    if (!refundTarget) return;
    setRefundProcessing(true);
    setRefundResult(null);
    try {
      const res = await fetchWithAuth(`/api/academy-admin/${academyId}/ticket-refund`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          revenueTransactionId: refundTarget.id,
          cancelReason: refundReason || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setRefundResult({ success: false, message: data.error || '환불에 실패했습니다.' });
        return;
      }
      setRefundResult({ success: true, message: data.message || '환불 처리 완료' });
      loadData();
    } catch {
      setRefundResult({ success: false, message: '네트워크 오류가 발생했습니다.' });
    } finally {
      setRefundProcessing(false);
    }
  }, [refundTarget, refundReason, academyId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500 dark:text-gray-400">로딩 중...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-onboarding="page-revenue-0">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-gray-800 dark:text-white">매출 및 정산 관리</h2>
        <button
          onClick={() => router.push(`/academy-admin/${academyId}/revenue?tab=sales`)}
          className="bg-blue-600 dark:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors"
        >
          수강권 판매하기
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-2">
        <div className="bg-white dark:bg-neutral-900 p-6 rounded-xl shadow-sm border-l-4 border-blue-600 dark:border-blue-500">
          <p className="text-gray-500 dark:text-gray-400 text-sm">이번 달 총 매출</p>
          <p className="text-2xl font-bold mt-2 text-gray-900 dark:text-white">
            {formatCurrency(stats.totalRevenue)}
          </p>
        </div>
        <div className="bg-white dark:bg-neutral-900 p-6 rounded-xl shadow-sm border-l-4 border-green-500 dark:border-green-400">
          <p className="text-gray-500 dark:text-gray-400 text-sm">미정산 금액 (강사료)</p>
          <p className="text-2xl font-bold mt-2 text-gray-900 dark:text-white">
            {formatCurrency(stats.unpaidAmount)}
          </p>
        </div>
        <div className="bg-white dark:bg-neutral-900 p-6 rounded-xl shadow-sm border-l-4 border-purple-500 dark:border-purple-400">
          <p className="text-gray-500 dark:text-gray-400 text-sm">순수익 (예상)</p>
          <p className="text-2xl font-bold mt-2 text-gray-900 dark:text-white">
            {formatCurrency(stats.netProfit)}
          </p>
        </div>
      </div>

      <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-sm border border-gray-100 dark:border-neutral-800 p-6">
        <h3 className="font-bold text-lg text-gray-800 dark:text-white mb-4">최근 결제 내역</h3>
        {transactions.length === 0 ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            결제 내역이 없습니다.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 dark:bg-neutral-800 text-gray-500 dark:text-gray-400">
                <tr>
                  <th className="px-3 py-3">날짜</th>
                  <th className="px-3 py-3">구분</th>
                  <th className="px-3 py-3">회원명</th>
                  <th className="px-3 py-3">구매항목</th>
                  <th className="px-3 py-3 text-center">수량</th>
                  <th className="px-3 py-3 text-center">유효기간</th>
                  <th className="px-3 py-3">결제 금액</th>
                  <th className="px-3 py-3">결제 수단</th>
                  <th className="px-3 py-3 text-center">상태</th>
                  <th className="px-3 py-3 text-right">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-neutral-800">
                {transactions.map((rev) => {
                  const hasLiveTicket = !!rev.tickets;
                  // 상품명: 스냅샷(ticket_name) → 현재 티켓(tickets.name) 순서로 표시
                  const displayName = rev.ticket_name || rev.tickets?.name || '알 수 없음';
                  // 상품 유형: 스냅샷 → 현재 티켓 순서로 판별
                  const typeStr = (rev.ticket_type_snapshot || rev.tickets?.ticket_type || '').toUpperCase();
                  const isCountType = typeStr === 'COUNT';
                  const ticketType = isCountType ? 'count' : 'period';
                  const displayQuantity = rev.quantity || (isCountType ? (rev.tickets?.total_count || 1) : 1);
                  // valid_days: revenue_transactions → tickets fallback
                  const rawValidDays = rev.valid_days != null ? rev.valid_days : (rev.tickets?.valid_days ?? null);
                  return (
                    <tr key={rev.id} className="hover:bg-gray-50 dark:hover:bg-neutral-800">
                      <td className="px-3 py-3 text-gray-500 dark:text-gray-400 text-xs whitespace-nowrap">
                        {new Date(rev.transaction_date).toLocaleDateString('ko-KR')}
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${
                            rev.registration_type === 'RE_REGISTRATION'
                              ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                              : 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                          }`}
                        >
                          {rev.registration_type === 'RE_REGISTRATION' ? '재등록' : '신규'}
                        </span>
                      </td>
                      <td className="px-3 py-3 font-medium text-gray-900 dark:text-white">
                        {rev.users?.name || rev.users?.nickname || '-'}
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium mr-1 ${
                            ticketType === 'count'
                              ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-400'
                              : 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-400'
                          }`}
                        >
                          {ticketType === 'count' ? '횟수' : '기간'}
                        </span>
                        <span className="text-gray-700 dark:text-gray-300">{displayName}</span>
                        {!hasLiveTicket && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ml-1 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400">
                            삭제됨
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-center text-gray-700 dark:text-gray-300">
                        {ticketType === 'count'
                          ? `${displayQuantity}회`
                          : `${displayQuantity}개월`}
                      </td>
                      <td className="px-3 py-3 text-center text-gray-700 dark:text-gray-300">
                        {rawValidDays != null && rawValidDays > 0 ? `${rawValidDays}일` : '무기한'}
                      </td>
                      <td className="px-3 py-3 font-bold text-gray-900 dark:text-white">
                        {formatCurrency(rev.final_price)}
                      </td>
                      <td className="px-3 py-3 text-gray-600 dark:text-gray-400">
                        {rev.payment_method ? getPaymentMethodDisplayLabel(rev.payment_method) : '-'}
                      </td>
                      <td className="px-3 py-3 text-center">
                        {rev.payment_status === 'REFUNDED' ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400">
                            환불됨
                          </span>
                        ) : rev.payment_status === 'PARTIALLY_REFUNDED' ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400">
                            부분환불
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400">
                            완료
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-right">
                        {rev.payment_status === 'COMPLETED' ? (
                          <button
                            onClick={() => { setRefundTarget(rev); setRefundReason(''); setRefundResult(null); }}
                            className="text-xs border border-red-200 dark:border-red-800 px-2 py-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 transition-colors"
                          >
                            환불
                          </button>
                        ) : (
                          <span className="text-xs text-gray-400">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {/* 환불 확인 모달 */}
      {refundTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => !refundProcessing && setRefundTarget(null)} />
          <div className="relative bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">환불 처리</h3>

            {refundResult ? (
              <div className="space-y-4">
                <div className={`p-4 rounded-xl text-sm font-medium ${
                  refundResult.success
                    ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400'
                    : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'
                }`}>
                  {refundResult.message}
                </div>
                <button
                  onClick={() => { setRefundTarget(null); setRefundResult(null); }}
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
                    <span className="font-medium text-gray-900 dark:text-white">
                      {refundTarget.ticket_name || refundTarget.tickets?.name || '-'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">회원</span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {refundTarget.users?.name || refundTarget.users?.nickname || '-'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">결제 금액</span>
                    <span className="font-bold text-gray-900 dark:text-white">
                      {formatCurrency(refundTarget.final_price)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">결제 수단</span>
                    <span className="text-gray-700 dark:text-gray-300">
                      {getPaymentMethodDisplayLabel(refundTarget.payment_method)}
                    </span>
                  </div>
                  {refundTarget.toss_payment_key && (
                    <div className="pt-1 text-xs text-blue-600 dark:text-blue-400">
                      토스 결제 취소 API가 자동 호출됩니다
                    </div>
                  )}
                  {!refundTarget.toss_payment_key && (
                    <div className="pt-1 text-xs text-amber-600 dark:text-amber-400">
                      PG 환불 없음 — 계좌이체/현금 건은 별도 환불 필요
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    환불 사유 (선택)
                  </label>
                  <input
                    type="text"
                    value={refundReason}
                    onChange={(e) => setRefundReason(e.target.value)}
                    placeholder="예: 고객 요청, 중복 결제"
                    className="w-full border dark:border-neutral-700 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-neutral-800 text-gray-900 dark:text-white placeholder-gray-400"
                  />
                </div>

                <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-xl p-3 text-xs text-red-600 dark:text-red-400">
                  환불 시 해당 수강권이 비활성화되고, 연결된 예약이 모두 취소됩니다.
                  이 작업은 되돌릴 수 없습니다.
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setRefundTarget(null)}
                    disabled={refundProcessing}
                    className="flex-1 py-2.5 rounded-xl bg-gray-100 dark:bg-neutral-800 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-200 dark:hover:bg-neutral-700 transition-colors disabled:opacity-40"
                  >
                    취소
                  </button>
                  <button
                    onClick={handleRefund}
                    disabled={refundProcessing}
                    className="flex-1 py-2.5 rounded-xl bg-red-600 text-white font-bold hover:bg-red-700 transition-colors disabled:opacity-40"
                  >
                    {refundProcessing ? '처리 중…' : '환불 확인'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

