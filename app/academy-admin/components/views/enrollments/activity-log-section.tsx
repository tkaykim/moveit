"use client";

import { useState, useEffect, useRef } from 'react';
import type { LucideIcon } from 'lucide-react';
import { RefreshCw, Loader2, FileText, Ticket, MinusCircle, PlusCircle, Clock, ShieldCheck, UserPlus, CheckCircle, XCircle, Search } from 'lucide-react';

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
  note: string | null;
  actor_user_id: string | null;
  actor_name: string | null;
  user_name: string;
  created_at: string;
}

const ACTION_FILTER_OPTIONS = [
  { value: '', label: '전체' },
  { value: 'TICKET_ISSUED', label: '수강권 발급' },
  { value: 'ENROLL', label: '수강신청' },
  { value: 'CANCEL', label: '예약 취소' },
  { value: 'REFUND', label: '환불' },
  { value: 'COUNT_DEDUCT', label: '횟수 차감' },
  { value: 'COUNT_RESTORE', label: '횟수 복구' },
  { value: 'EXTENSION_REQUESTED', label: '연장/일시정지 신청' },
  { value: 'EXTENSION_APPROVED', label: '연장/일시정지 승인' },
  { value: 'ADMIN_EXTEND', label: '관리자 연장' },
  { value: 'ADMIN_ENROLL', label: '관리자 수기 추가' },
  { value: 'ATTENDANCE_CHECKED', label: '출석 체크' },
  { value: 'TICKET_EXHAUSTED', label: '수강권 소진' },
  { value: 'TICKET_EXPIRED', label: '수강권 만료' },
];

const ACTION_BADGE_STYLES: Record<string, { bg: string; text: string; icon: LucideIcon }> = {
  TICKET_ISSUED: { bg: 'bg-emerald-100 dark:bg-emerald-900/40', text: 'text-emerald-700 dark:text-emerald-300', icon: Ticket },
  ENROLL: { bg: 'bg-blue-100 dark:bg-blue-900/40', text: 'text-blue-700 dark:text-blue-300', icon: PlusCircle },
  CANCEL: { bg: 'bg-red-100 dark:bg-red-900/40', text: 'text-red-700 dark:text-red-300', icon: MinusCircle },
  REFUND: { bg: 'bg-orange-100 dark:bg-orange-900/40', text: 'text-orange-700 dark:text-orange-300', icon: MinusCircle },
  COUNT_DEDUCT: { bg: 'bg-amber-100 dark:bg-amber-900/40', text: 'text-amber-700 dark:text-amber-300', icon: MinusCircle },
  COUNT_RESTORE: { bg: 'bg-teal-100 dark:bg-teal-900/40', text: 'text-teal-700 dark:text-teal-300', icon: PlusCircle },
  EXTENSION_REQUESTED: { bg: 'bg-violet-100 dark:bg-violet-900/40', text: 'text-violet-700 dark:text-violet-300', icon: Clock },
  EXTENSION_APPROVED: { bg: 'bg-indigo-100 dark:bg-indigo-900/40', text: 'text-indigo-700 dark:text-indigo-300', icon: ShieldCheck },
  ADMIN_EXTEND: { bg: 'bg-cyan-100 dark:bg-cyan-900/40', text: 'text-cyan-700 dark:text-cyan-300', icon: Clock },
  ADMIN_ENROLL: { bg: 'bg-pink-100 dark:bg-pink-900/40', text: 'text-pink-700 dark:text-pink-300', icon: UserPlus },
  ATTENDANCE_CHECKED: { bg: 'bg-green-100 dark:bg-green-900/40', text: 'text-green-700 dark:text-green-300', icon: CheckCircle },
  TICKET_EXHAUSTED: { bg: 'bg-gray-100 dark:bg-gray-700/40', text: 'text-gray-700 dark:text-gray-300', icon: XCircle },
  TICKET_EXPIRED: { bg: 'bg-neutral-100 dark:bg-neutral-700/40', text: 'text-neutral-700 dark:text-neutral-300', icon: Clock },
};

function formatPayload(p: Record<string, unknown> | null): string {
  if (!p || Object.keys(p).length === 0) return '';
  const parts: string[] = [];
  if (p.ticket_name) parts.push(String(p.ticket_name));
  if (p.via === 'qr') parts.push('QR 출석');
  else if (p.via === 'manual') parts.push('수동 처리');
  else if (p.via === 'toss_payment') parts.push('토스 결제');
  else if (p.via === 'bank_transfer') parts.push('계좌이체');
  else if (p.via === 'purchase') parts.push('결제');
  else if (p.via === 'purchase_guest') parts.push('비회원 구매');
  else if (p.via === 'backfill') parts.push('과거 기록 복구');
  else if (p.via === 'excel_import') parts.push('엑셀 일괄 등록');
  if (p.guest_name) parts.push(`게스트: ${p.guest_name}`);
  if (p.remaining_count != null) parts.push(`잔여 ${p.remaining_count}회`);
  if (p.delta) parts.push(`${Number(p.delta) > 0 ? '+' : ''}${p.delta}회`);
  if (p.reason) parts.push(String(p.reason));
  if (p.days) parts.push(`${p.days}일`);
  if (p.expiry_date) parts.push(`만료: ${p.expiry_date}`);
  return parts.join(' · ');
}

export function ActivityLogSection({ academyId }: { academyId: string }) {
  const [items, setItems] = useState<ActivityLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [backfilling, setBackfilling] = useState(false);
  const [backfillDone, setBackfillDone] = useState(false);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);
  const limit = 30;

  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setPage(1);
    }, 400);
    return () => { if (debounceTimer.current) clearTimeout(debounceTimer.current); };
  }, [searchTerm]);

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (actionFilter) params.set('action', actionFilter);
      if (debouncedSearch) params.set('search', debouncedSearch);
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

  const runBackfill = async () => {
    setBackfilling(true);
    try {
      const res = await fetch(`/api/academy-admin/${academyId}/activity-log-backfill`, { method: 'POST' });
      if (!res.ok) throw new Error('백필 실패');
      setBackfillDone(true);
      await load();
    } catch (e) {
      console.error(e);
      alert('과거 로그 복구에 실패했습니다.');
    } finally {
      setBackfilling(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [academyId, page, actionFilter, debouncedSearch]);

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="bg-white dark:bg-neutral-900 rounded-xl border border-gray-100 dark:border-neutral-800 shadow-sm">
      <div className="p-4 border-b border-gray-100 dark:border-neutral-800 flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <FileText size={18} className="text-gray-500 dark:text-gray-400" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              수강권·수강신청·취소·환불·연장·횟수 변동 이력
            </span>
          </div>
          <div className="flex items-center gap-2">
            {!backfillDone && (
              <button
                type="button"
                onClick={runBackfill}
                disabled={backfilling || loading}
                className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 dark:border-neutral-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-neutral-800 disabled:opacity-50"
                title="기존 출석/결제/취소 기록에서 누락된 활동 로그를 복구합니다"
              >
                {backfilling ? '복구 중…' : '과거 로그 복구'}
              </button>
            )}
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
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1 max-w-sm">
            <input
              type="text"
              placeholder="이름, 연락처, 수강권, 메모 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2 border dark:border-neutral-700 rounded-lg text-sm w-full focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 outline-none bg-white dark:bg-neutral-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
            />
            <Search size={16} className="absolute left-3 top-2.5 text-gray-400 dark:text-gray-500" />
          </div>
          <select
            value={actionFilter}
            onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
            className="text-sm border border-gray-200 dark:border-neutral-700 rounded-lg px-3 py-2 bg-white dark:bg-neutral-800 text-gray-800 dark:text-gray-200"
          >
            {ACTION_FILTER_OPTIONS.map((opt) => (
              <option key={opt.value || 'all'} value={opt.value}>{opt.label}</option>
            ))}
          </select>
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
            {debouncedSearch ? '검색 결과가 없습니다.' : '기록된 활동이 없습니다.'}
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
              {items.map((row) => {
                const payloadStr = formatPayload(row.payload);
                const noteStr = row.note || '';
                const remarkParts = [noteStr, payloadStr].filter(Boolean);
                const remark = remarkParts.join(' · ') || '-';

                return (
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
                      {(() => {
                        const style = ACTION_BADGE_STYLES[row.action];
                        const Icon = style?.icon;
                        return (
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${style?.bg ?? 'bg-gray-100 dark:bg-neutral-800'} ${style?.text ?? 'text-gray-700 dark:text-gray-300'}`}>
                            {Icon && <Icon size={13} />}
                            {row.action_label}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="py-2.5 px-4 text-gray-700 dark:text-gray-300">{row.user_name}</td>
                    <td className="py-2.5 px-4 text-gray-600 dark:text-gray-400">{row.actor_name ?? '-'}</td>
                    <td className="py-2.5 px-4 text-gray-500 dark:text-gray-500 text-xs max-w-[320px]" title={remark}>
                      <span className="line-clamp-2">{remark}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      <div className="p-3 border-t border-gray-100 dark:border-neutral-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-gray-600 dark:text-gray-400">
        <span>총 {total}건</span>
        {totalPages > 1 && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setPage(1)}
              disabled={page <= 1 || loading}
              className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-neutral-700 rounded disabled:opacity-40 disabled:cursor-not-allowed"
            >
              «
            </button>
            <button
              type="button"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-neutral-700 rounded disabled:opacity-40 disabled:cursor-not-allowed"
            >
              ‹
            </button>
            <span className="px-3 py-1 font-medium text-gray-900 dark:text-white">
              {page} / {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((p) => p + 1)}
              className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-neutral-700 rounded disabled:opacity-40 disabled:cursor-not-allowed"
            >
              ›
            </button>
            <button
              type="button"
              onClick={() => setPage(totalPages)}
              disabled={page >= totalPages || loading}
              className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-neutral-700 rounded disabled:opacity-40 disabled:cursor-not-allowed"
            >
              »
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
