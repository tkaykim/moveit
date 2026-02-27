"use client";

import { useState, useEffect, useCallback } from 'react';
import { fetchWithAuth } from '@/lib/api/auth-fetch';
import { Landmark, RefreshCw, Loader2, CheckCircle, Clock, Ticket, CalendarCheck, Search, ChevronLeft, ChevronRight } from 'lucide-react';

interface BankTransferOrder {
  id: string;
  user_id: string | null;
  ticket_id: string;
  schedule_id: string | null;
  amount: number;
  order_name: string | null;
  orderer_name?: string | null;
  status: string;
  created_at: string;
  confirmed_at: string | null;
  tickets: { id: string; name: string } | null;
  schedules: {
    id: string;
    start_time: string;
    end_time: string;
    classes: { id: string | null; title: string } | null;
  } | null;
  user_name?: string | null;
  user_phone?: string | null;
  user_email?: string | null;
}

/** 긴 내용은 칩으로 표시, 호버 시 전체 텍스트 툴팁 */
function CellChip({
  text,
  maxWidth = 'max-w-[120px]',
  className = '',
}: {
  text: string | null | undefined;
  maxWidth?: string;
  className?: string;
}) {
  const s = text?.trim() || '—';
  return (
    <span
      title={s !== '—' && s.length > 20 ? s : undefined}
      className={`inline-block px-2 py-0.5 rounded-md bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 text-xs truncate ${maxWidth} ${className}`}
    >
      {s}
    </span>
  );
}

interface DepositConfirmViewProps {
  academyId: string;
}

const PAGE_SIZE = 20;

export function DepositConfirmView({ academyId }: DepositConfirmViewProps) {
  const [orders, setOrders] = useState<BankTransferOrder[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const loadPage = useCallback(
    async (pageNum: number, q: string) => {
      if (!academyId) {
        setOrders([]);
        setTotal(0);
        setLoading(false);
        return;
      }
      setLoading(true);
      setListError(null);
      try {
        const params = new URLSearchParams({ page: String(pageNum), limit: String(PAGE_SIZE) });
        if (q) params.set('q', q);
        const res = await fetchWithAuth(
          `/api/academy-admin/${academyId}/bank-transfer-orders?${params.toString()}`
        );
        const json = await res.json();
        if (res.ok) {
          const data = Array.isArray(json.data) ? json.data : [];
          const totalVal = typeof json.total === 'number' ? json.total : 0;
          setOrders(data as BankTransferOrder[]);
          setTotal(totalVal);
        } else {
          setOrders([]);
          setTotal(0);
          setListError(json?.error || `목록을 불러올 수 없습니다. (${res.status})`);
        }
      } catch (e: unknown) {
        setOrders([]);
        setTotal(0);
        setListError(e instanceof Error ? e.message : '목록을 불러오는 중 오류가 발생했습니다.');
      } finally {
        setLoading(false);
      }
    },
    [academyId]
  );

  useEffect(() => {
    loadPage(page, searchQuery);
  }, [page, searchQuery, loadPage]);

  useEffect(() => {
    if (!academyId) return;
    setPage(1);
    setSearchQuery('');
    setSearchInput('');
    loadPage(1, '');
  }, [academyId, loadPage]);

  const handleSearch = useCallback(() => {
    setSearchQuery(searchInput.trim());
    setPage(1);
  }, [searchInput]);

  const handleConfirm = async (orderId: string) => {
    setConfirmingId(orderId);
    try {
      const res = await fetchWithAuth(
        `/api/academy-admin/${academyId}/bank-transfer-confirm`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId }),
        }
      );
      const data = await res.json();
      if (res.ok) {
        setOrders((prev) =>
          prev.map((o) =>
            o.id === orderId
              ? { ...o, status: 'CONFIRMED' as const, confirmed_at: new Date().toISOString() }
              : o
          )
        );
      } else {
        alert(data.error || '입금 확인 처리에 실패했습니다.');
      }
    } catch {
      alert('요청 중 오류가 발생했습니다.');
    } finally {
      setConfirmingId(null);
    }
  };

  const refreshCurrent = useCallback(() => {
    loadPage(page, searchQuery);
  }, [page, searchQuery, loadPage]);

  useEffect(() => {
    const handler = () => {
      if (document.visibilityState === 'visible' && academyId) refreshCurrent();
    };
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, [academyId, refreshCurrent]);

  const formatDate = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleString('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  };

  const formatTimeRange = (startIso: string, endIso: string) => {
    try {
      const start = new Date(startIso);
      const end = new Date(endIso);
      const dateStr = start.toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit', weekday: 'short' });
      const startStr = start.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
      const endStr = end.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
      return `${dateStr} ${startStr} ~ ${endStr}`;
    } catch {
      return `${startIso} ~ ${endIso}`;
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasPrev = page > 1;
  const hasNext = page < totalPages;

  return (
    <div className="p-4 lg:p-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-2 mb-3">
        <Landmark className="text-primary dark:text-[#CCFF00]" size={22} />
        <h1 className="text-lg font-bold text-black dark:text-white">수동 입금확인</h1>
      </div>

      <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-4">
        계좌이체로 신청한 주문을 확인한 뒤 입금 확인을 누르면 수강권이 발급되고, 수업 예약이 있으면 예약이 확정됩니다.
      </p>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex-1 min-w-[200px] flex gap-2">
          <span className="relative flex-1">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="이름, 연락처, 이메일, 주문명 검색"
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-black dark:text-white text-sm"
            />
          </span>
          <button
            type="button"
            onClick={handleSearch}
            className="px-4 py-2 rounded-lg bg-neutral-800 dark:bg-neutral-200 text-white dark:text-black text-sm font-medium hover:opacity-90"
          >
            검색
          </button>
        </div>
        <button
          onClick={refreshCurrent}
          disabled={loading}
          className="p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-400 disabled:opacity-50"
          title="새로고침"
        >
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {listError && (
        <div className="mb-4 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm">
          {listError}
        </div>
      )}

      {loading && orders.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="animate-spin text-primary dark:text-[#CCFF00]" size={32} />
        </div>
      ) : orders.length === 0 ? (
        <div className="text-center py-12 text-neutral-500 dark:text-neutral-400">
          {searchQuery ? '검색 결과가 없습니다.' : '주문이 없습니다.'}
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-neutral-200 dark:border-neutral-700">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="border-b border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/80">
                  <th className="text-left py-3 px-3 font-semibold text-neutral-700 dark:text-neutral-300 whitespace-nowrap">이름</th>
                  <th className="text-left py-3 px-3 font-semibold text-neutral-700 dark:text-neutral-300 whitespace-nowrap">연락처</th>
                  <th className="text-left py-3 px-3 font-semibold text-neutral-700 dark:text-neutral-300 whitespace-nowrap">회원여부</th>
                  <th className="text-left py-3 px-3 font-semibold text-neutral-700 dark:text-neutral-300 whitespace-nowrap">유형</th>
                  <th className="text-left py-3 px-3 font-semibold text-neutral-700 dark:text-neutral-300 whitespace-nowrap">상품</th>
                  <th className="text-left py-3 px-3 font-semibold text-neutral-700 dark:text-neutral-300 whitespace-nowrap">신청수업</th>
                  <th className="text-right py-3 px-3 font-semibold text-neutral-700 dark:text-neutral-300 whitespace-nowrap">결제금액</th>
                  <th className="text-left py-3 px-3 font-semibold text-neutral-700 dark:text-neutral-300 whitespace-nowrap">예금주명</th>
                  <th className="text-left py-3 px-3 font-semibold text-neutral-700 dark:text-neutral-300 whitespace-nowrap">상태</th>
                  <th className="text-center py-3 px-3 font-semibold text-neutral-700 dark:text-neutral-300 whitespace-nowrap w-[90px]">비고</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => {
                  const hasBooking = !!order.schedule_id && !!order.schedules;
                  const isPending = order.status === 'PENDING';
                  const contact = [order.user_phone, order.user_email].filter(Boolean).join(' / ') || '—';
                  const classText = hasBooking && order.schedules
                    ? `${order.schedules.classes?.title || '(클래스)'} ${formatTimeRange(order.schedules.start_time, order.schedules.end_time)}`
                    : '—';
                  return (
                    <tr
                      key={order.id}
                      className="border-b border-neutral-100 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
                    >
                      <td className="py-2.5 px-3 align-middle">
                        <CellChip text={order.user_name || '(이름 없음)'} maxWidth="max-w-[100px]" />
                      </td>
                      <td className="py-2.5 px-3 align-middle">
                        <CellChip text={contact} maxWidth="max-w-[140px]" />
                      </td>
                      <td className="py-2.5 px-3 align-middle">
                        <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                          order.user_id ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300' : 'bg-neutral-200 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-400'
                        }`}>
                          {order.user_id ? '회원' : '비회원'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 align-middle">
                        {hasBooking ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200">
                            <CalendarCheck size={12} />
                            수강권+예약
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400">
                            <Ticket size={12} />
                            수강권만
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 align-middle">
                        <CellChip text={order.tickets?.name || order.order_name || '수강권'} maxWidth="max-w-[140px]" />
                      </td>
                      <td className="py-2.5 px-3 align-middle">
                        <CellChip text={classText} maxWidth="max-w-[180px]" />
                      </td>
                      <td className="py-2.5 px-3 text-right text-neutral-800 dark:text-neutral-200 font-medium whitespace-nowrap">
                        {order.amount.toLocaleString()}원
                      </td>
                      <td className="py-2.5 px-3 align-middle">
                        <CellChip text={order.orderer_name ?? undefined} maxWidth="max-w-[100px]" />
                      </td>
                      <td className="py-2.5 px-3 align-middle">
                        {isPending ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200">
                            <Clock size={12} />
                            입금대기
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-200">
                            <CheckCircle size={12} />
                            확인완료
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 align-middle text-center">
                        {isPending && (
                          <button
                            onClick={() => handleConfirm(order.id)}
                            disabled={confirmingId !== null}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-xs font-medium"
                          >
                            {confirmingId === order.id ? (
                              <Loader2 size={12} className="animate-spin" />
                            ) : (
                              <CheckCircle size={12} />
                            )}
                            입금확인
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={!hasPrev || loading}
                className="p-2 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-50 disabled:pointer-events-none"
              >
                <ChevronLeft size={18} />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPage(p)}
                  disabled={loading}
                  className={`min-w-[2rem] py-1.5 px-2 rounded-lg text-sm font-medium ${
                    page === p
                      ? 'bg-primary dark:bg-[#CCFF00] text-black'
                      : 'border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                  } disabled:opacity-50`}
                >
                  {p}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={!hasNext || loading}
                className="p-2 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-50 disabled:pointer-events-none"
              >
                <ChevronRight size={18} />
              </button>
              <span className="text-xs text-neutral-500 ml-2">
                {total}건 · {page}/{totalPages}페이지
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
