"use client";

import { useState, useEffect } from 'react';
import { History, AlertCircle } from 'lucide-react';
import { formatCurrency } from '../utils/format-currency';
import { getSupabaseClient } from '@/lib/utils/supabase-client';

interface PaymentLogsProps {
  logs: any[];
  academyId: string;
}

export function PaymentLogs({ logs: initialLogs, academyId }: PaymentLogsProps) {
  const [logs, setLogs] = useState(initialLogs);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadLogs();
  }, [academyId]);

  const loadLogs = async () => {
    const supabase = getSupabaseClient();
    if (!supabase) return;

    setLoading(true);
    try {
      // 명시적 컬럼 선택 (구매 시점 스냅샷 포함)
      const { data, error } = await supabase
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
          notes,
          created_at,
          users (
            id,
            name,
            nickname,
            phone
          ),
          tickets (
            id,
            name,
            ticket_type,
            ticket_category,
            valid_days,
            total_count
          ),
          discounts (
            id,
            name
          )
        `)
        .eq('academy_id', academyId)
        .eq('payment_status', 'COMPLETED')
        .order('transaction_date', { ascending: false })
        .limit(50);

      if (error) throw error;

      const formattedLogs = (data || []).map((log: any) => {
        const hasLiveTicket = !!log.tickets;
        // 상품명: 스냅샷(ticket_name) → 현재 티켓(tickets.name) 순서
        const displayName = log.ticket_name || log.tickets?.name || '알 수 없음';
        // 상품 유형: 스냅샷 → 현재 티켓 순서
        const typeStr = (log.ticket_type_snapshot || log.tickets?.ticket_type || '').toUpperCase();
        const isCountType = typeStr === 'COUNT';
        // valid_days: revenue_transactions → tickets fallback
        const rawValidDays = log.valid_days != null ? log.valid_days : (log.tickets?.valid_days ?? null);
        return {
          id: log.id,
          date: log.transaction_date,
          studentName: log.users?.name || log.users?.nickname || '-',
          studentId: log.user_id,
          productName: displayName,
          productType: isCountType ? 'count' : 'period',
          hasLiveTicket,
          originalPrice: log.original_price,
          discountAmount: log.discount_amount,
          finalPrice: log.final_price,
          discountDetail: log.discounts?.name || '할인 없음',
          registrationType: log.registration_type || 'NEW',
          quantity: log.quantity || (isCountType ? (log.tickets?.total_count || 1) : 1),
          validDays: rawValidDays,
        };
      });

      setLogs(formattedLogs);
    } catch (error) {
      console.error('Error loading logs:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-sm border border-slate-200 dark:border-neutral-800 overflow-hidden">
      <div className="p-6 border-b border-slate-200 dark:border-neutral-800 flex justify-between items-center">
        <h2 className="text-lg font-bold flex items-center gap-2 text-gray-800 dark:text-white">
          <History size={20} className="text-slate-500 dark:text-slate-400" />
          결제 내역 로그
        </h2>
        <div className="text-sm text-slate-500 dark:text-slate-400">총 {logs.length}건</div>
      </div>

      {loading ? (
        <div className="p-12 text-center text-slate-400 dark:text-slate-500">로딩 중...</div>
      ) : logs.length === 0 ? (
        <div className="p-12 text-center text-slate-400 dark:text-slate-500">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-slate-50 dark:bg-neutral-800 rounded-full flex items-center justify-center">
              <AlertCircle size={32} />
            </div>
          </div>
          <p>아직 결제 내역이 없습니다.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600 dark:text-slate-400">
            <thead className="bg-slate-50 dark:bg-neutral-800 text-slate-700 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-neutral-700">
              <tr>
                <th className="px-4 py-4">일시</th>
                <th className="px-4 py-4">구분</th>
                <th className="px-4 py-4">학생명</th>
                <th className="px-4 py-4">구매항목</th>
                <th className="px-4 py-4 text-center">수량</th>
                <th className="px-4 py-4 text-center">유효기간</th>
                <th className="px-4 py-4">할인 정보</th>
                <th className="px-4 py-4 text-right">최종 금액</th>
                <th className="px-4 py-4 text-center">상태</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-neutral-800">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-neutral-800/50">
                  <td className="px-4 py-4 whitespace-nowrap text-gray-900 dark:text-white text-xs">
                    {new Date(log.date).toLocaleString('ko-KR')}
                  </td>
                  <td className="px-4 py-4">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${
                        log.registrationType === 'RE_REGISTRATION'
                          ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                          : 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                      }`}
                    >
                      {log.registrationType === 'RE_REGISTRATION' ? '재등록' : '신규'}
                    </span>
                  </td>
                  <td className="px-4 py-4 font-medium text-slate-900 dark:text-white">
                    {log.studentName}
                  </td>
                  <td className="px-4 py-4">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium mr-1 ${
                        log.productType === 'count'
                          ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-400'
                          : 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-400'
                      }`}
                    >
                      {log.productType === 'count' ? '횟수' : '기간'}
                    </span>
                    {log.productName}
                    {!log.hasLiveTicket && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ml-1 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400">
                        삭제됨
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-4 text-center text-slate-700 dark:text-slate-300">
                    {log.productType === 'count' ? `${log.quantity}회` : `${log.quantity}개월`}
                  </td>
                  <td className="px-4 py-4 text-center text-slate-700 dark:text-slate-300">
                    {log.validDays != null && log.validDays > 0 ? `${log.validDays}일` : '무기한'}
                  </td>
                  <td className="px-4 py-4 text-slate-500 dark:text-slate-400">
                    {log.discountDetail}
                    {log.discountAmount > 0 && (
                      <span className="text-xs text-red-500 dark:text-red-400 ml-1">
                        (-{formatCurrency(log.discountAmount)})
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-4 text-right font-bold text-slate-800 dark:text-white">
                    {formatCurrency(log.finalPrice)}
                  </td>
                  <td className="px-4 py-4 text-center">
                    <span className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-1 rounded-full text-xs font-bold">
                      완료
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
