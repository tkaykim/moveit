"use client";

import { useState, useEffect } from 'react';
import { RefreshCw, Loader2, FileText } from 'lucide-react';

interface ActivityLogItem {
  id: string;
  academy_id: string;
  user_id: string | null;
  user_ticket_id: string | null;
  booking_id: string | null;
  extension_request_id: string | null;
  action: string;
  action_label: string;
  payload: Record<string, unknown> | null;
  actor_user_id: string | null;
  actor_name: string | null;
  user_name: string;
  created_at: string;
}

const ACTION_FILTER_OPTIONS = [
  { value: '', label: '전체' },
  { value: 'ENROLL', label: '수강신청' },
  { value: 'CANCEL', label: '예약 취소' },
  { value: 'REFUND', label: '환불' },
  { value: 'EXTENSION_APPROVED', label: '연장/일시정지 승인' },
  { value: 'COUNT_RESTORE', label: '횟수 복구' },
];

export function ActivityLogSection({ academyId }: { academyId: string }) {
  const [items, setItems] = useState<ActivityLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState('');
  const limit = 30;

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (actionFilter) params.set('action', actionFilter);
      const res = await fetch(`/api/academy-admin/${academyId}/activity-log?${params}`);
      if (!res.ok) throw new Error('조회 실패');
      const json = await res.json();
      setItems(json.data || []);
      setTotal(json.total ?? 0);
    } catch (e) {
      console.error(e);
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load uses page, actionFilter, academyId
  }, [academyId, page, actionFilter]);

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="bg-white dark:bg-neutral-900 rounded-xl border border-gray-100 dark:border-neutral-800 shadow-sm">
      <div className="p-4 border-b border-gray-100 dark:border-neutral-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <FileText size={18} className="text-gray-500 dark:text-gray-400" />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">수강신청·취소·환불·연장·횟수 변동 이력</span>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={actionFilter}
            onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
            className="text-sm border border-gray-200 dark:border-neutral-700 rounded-lg px-3 py-1.5 bg-white dark:bg-neutral-800 text-gray-800 dark:text-gray-200"
          >
            {ACTION_FILTER_OPTIONS.map((opt) => (
              <option key={opt.value || 'all'} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => load()}
            disabled={loading}
            className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-neutral-800 rounded-lg disabled:opacity-50"
            title="새로고침"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>
      <div className="overflow-x-auto">
        {loading && items.length === 0 ? (
          <div className="flex items-center justify-center py-12 text-gray-500 dark:text-gray-400">
            <Loader2 size={24} className="animate-spin mr-2" />
            로딩 중…
          </div>
        ) : items.length === 0 ? (
          <div className="py-12 text-center text-gray-500 dark:text-gray-400 text-sm">
            기록된 활동이 없습니다.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-neutral-800 bg-gray-50 dark:bg-neutral-800/50">
                <th className="text-left py-3 px-4 font-medium text-gray-600 dark:text-gray-400">일시</th>
                <th className="text-left py-3 px-4 font-medium text-gray-600 dark:text-gray-400">유형</th>
                <th className="text-left py-3 px-4 font-medium text-gray-600 dark:text-gray-400">회원</th>
                <th className="text-left py-3 px-4 font-medium text-gray-600 dark:text-gray-400">처리자</th>
                <th className="text-left py-3 px-4 font-medium text-gray-600 dark:text-gray-400">비고</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={row.id} className="border-b border-gray-50 dark:border-neutral-800/50 hover:bg-gray-50/50 dark:hover:bg-neutral-800/30">
                  <td className="py-2.5 px-4 text-gray-700 dark:text-gray-300 whitespace-nowrap">
                    {new Date(row.created_at).toLocaleString('ko-KR', {
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>
                  <td className="py-2.5 px-4">
                    <span className="font-medium text-gray-800 dark:text-gray-200">{row.action_label}</span>
                  </td>
                  <td className="py-2.5 px-4 text-gray-700 dark:text-gray-300">{row.user_name}</td>
                  <td className="py-2.5 px-4 text-gray-600 dark:text-gray-400">{row.actor_name ?? '-'}</td>
                  <td className="py-2.5 px-4 text-gray-500 dark:text-gray-500 text-xs max-w-[200px] truncate" title={JSON.stringify(row.payload || {})}>
                    {row.payload && Object.keys(row.payload).length > 0
                      ? JSON.stringify(row.payload).slice(0, 60) + (JSON.stringify(row.payload).length > 60 ? '…' : '')
                      : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {totalPages > 1 && (
        <div className="p-3 border-t border-gray-100 dark:border-neutral-800 flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
          <span>총 {total}건</span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-2 py-1 rounded border border-gray-200 dark:border-neutral-700 disabled:opacity-50"
            >
              이전
            </button>
            <span className="py-1">{page} / {totalPages}</span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="px-2 py-1 rounded border border-gray-200 dark:border-neutral-700 disabled:opacity-50"
            >
              다음
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
