'use client';

import { PAYMENT_STATUS_LABELS, BILLING_CYCLE_LABELS, type PaymentStatus } from '@/types/billing';

interface PaymentRow {
  id: string;
  amount: number;
  billing_cycle: string;
  status: string;
  paid_at: string | null;
  created_at: string;
  toss_order_id: string | null;
}

interface PaymentHistoryTableProps {
  payments: PaymentRow[];
  loading: boolean;
}

function formatDate(s: string | null): string {
  if (!s) return '-';
  return new Date(s).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function PaymentHistoryTable({ payments, loading }: PaymentHistoryTableProps) {
  if (loading) {
    return (
      <section className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">결제 이력</h3>
        <div className="animate-pulse space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-10 bg-gray-200 dark:bg-gray-600 rounded" />
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
      <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">결제 이력</h3>
      {payments.length === 0 ? (
        <p className="text-gray-500 dark:text-gray-400 text-sm">결제 이력이 없습니다.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400">
                <th className="py-2 pr-4 font-medium">결제일</th>
                <th className="py-2 pr-4 font-medium">금액</th>
                <th className="py-2 pr-4 font-medium">주기</th>
                <th className="py-2 pr-4 font-medium">상태</th>
                <th className="py-2 font-medium">주문 ID</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => {
                const statusLabel = PAYMENT_STATUS_LABELS[p.status as PaymentStatus] ?? p.status;
                return (
                  <tr key={p.id} className="border-b border-gray-100 dark:border-gray-700">
                    <td className="py-2 pr-4 text-gray-900 dark:text-white">
                      {formatDate(p.paid_at ?? p.created_at)}
                    </td>
                    <td className="py-2 pr-4 text-gray-900 dark:text-white">
                      {p.amount.toLocaleString()}원
                    </td>
                    <td className="py-2 pr-4 text-gray-600 dark:text-gray-300">
                      {BILLING_CYCLE_LABELS[p.billing_cycle as keyof typeof BILLING_CYCLE_LABELS] ?? p.billing_cycle}
                    </td>
                    <td className="py-2 pr-4">
                      <span
                        className={
                          p.status === 'completed'
                            ? 'text-green-600 dark:text-green-400'
                            : p.status === 'failed'
                              ? 'text-red-600 dark:text-red-400'
                              : 'text-gray-600 dark:text-gray-400'
                        }
                      >
                        {statusLabel}
                      </span>
                    </td>
                    <td className="py-2 text-gray-500 dark:text-gray-400 font-mono text-xs">
                      {p.toss_order_id ?? '-'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
