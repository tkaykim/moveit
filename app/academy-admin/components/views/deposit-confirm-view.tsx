"use client";

import { useState, useEffect, useCallback } from 'react';
import { fetchWithAuth } from '@/lib/api/auth-fetch';
import { Landmark, RefreshCw, Loader2, CheckCircle, Clock, Ticket, CalendarCheck } from 'lucide-react';

interface BankTransferOrder {
  id: string;
  user_id: string;
  ticket_id: string;
  schedule_id: string | null;
  amount: number;
  order_name: string | null;
  status: string;
  created_at: string;
  confirmed_at: string | null;
  tickets: { id: string; name: string } | null;
  schedules: {
    id: string;
    start_time: string;
    end_time: string;
    classes: { id: string; title: string } | null;
  } | null;
  user_name?: string | null;
  user_phone?: string | null;
  user_email?: string | null;
}

interface DepositConfirmViewProps {
  academyId: string;
}

type TabStatus = 'PENDING' | 'CONFIRMED';

export function DepositConfirmView({ academyId }: DepositConfirmViewProps) {
  const [tab, setTab] = useState<TabStatus>('PENDING');
  const [orders, setOrders] = useState<BankTransferOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);

  const loadOrders = useCallback(async () => {
    if (!academyId) {
      setOrders([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setListError(null);
    try {
      const res = await fetchWithAuth(
        `/api/academy-admin/${academyId}/bank-transfer-orders?status=${tab}`
      );
      const data = await res.json();
      if (res.ok) {
        setOrders(Array.isArray(data.data) ? data.data : []);
      } else {
        setOrders([]);
        setListError(data?.error || `목록을 불러올 수 없습니다. (${res.status})`);
      }
    } catch (e: any) {
      setOrders([]);
      setListError(e?.message || '목록을 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }, [academyId, tab]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  // 다른 탭에서 주문 후 이 페이지 탭으로 돌아왔을 때 목록 새로고침
  useEffect(() => {
    const handler = () => {
      if (document.visibilityState === 'visible' && academyId) loadOrders();
    };
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, [academyId, loadOrders]);

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
        await loadOrders();
      } else {
        alert(data.error || '입금 확인 처리에 실패했습니다.');
      }
    } catch (e) {
      alert('요청 중 오류가 발생했습니다.');
    } finally {
      setConfirmingId(null);
    }
  };

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

  return (
    <div className="p-4 lg:p-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-2 mb-3">
        <Landmark className="text-primary dark:text-[#CCFF00]" size={22} />
        <h1 className="text-lg font-bold text-black dark:text-white">수동 입금확인</h1>
      </div>

      <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-3">
        계좌이체로 신청한 주문을 확인한 뒤 입금 확인을 누르면 수강권이 발급되고, 수업 예약이 있으면 예약이 확정됩니다.
      </p>

      <div className="flex gap-2 border-b border-neutral-200 dark:border-neutral-700 mb-3">
        <button
          onClick={() => setTab('PENDING')}
          className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
            tab === 'PENDING'
              ? 'bg-primary dark:bg-[#CCFF00] text-black'
              : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
          }`}
        >
          입금 대기
        </button>
        <button
          onClick={() => setTab('CONFIRMED')}
          className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
            tab === 'CONFIRMED'
              ? 'bg-primary dark:bg-[#CCFF00] text-black'
              : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
          }`}
        >
          확인 완료
        </button>
      </div>

      <div className="flex justify-end mb-2">
        <button
          onClick={loadOrders}
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

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="animate-spin text-primary dark:text-[#CCFF00]" size={32} />
        </div>
      ) : orders.length === 0 ? (
        <div className="text-center py-12 text-neutral-500 dark:text-neutral-400">
          {tab === 'PENDING' ? '입금 대기 중인 주문이 없습니다.' : '확인 완료된 주문이 없습니다.'}
        </div>
      ) : (
        <ul className="space-y-2">
          {orders.map((order) => {
            const hasBooking = !!order.schedule_id && !!order.schedules;
            return (
              <li
                key={order.id}
                className="p-3 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900"
              >
                <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 flex-1 min-w-0">
                    {hasBooking ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200 shrink-0">
                        <CalendarCheck size={12} />
                        수강권+예약
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 shrink-0">
                        <Ticket size={12} />
                        수강권만
                      </span>
                    )}
                    <span className="font-medium text-black dark:text-white">
                      {order.user_name || '(이름 없음)'}
                    </span>
                    {order.user_phone && (
                      <span className="text-sm text-neutral-500">{order.user_phone}</span>
                    )}
                    {order.user_email && (
                      <span className="text-sm text-neutral-500 truncate max-w-[180px]">{order.user_email}</span>
                    )}
                    <span className="text-sm text-neutral-600 dark:text-neutral-400">
                      {order.tickets?.name || order.order_name || '수강권'} · {order.amount.toLocaleString()}원
                    </span>
                    {hasBooking && order.schedules && (
                      <span className="text-xs text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded">
                        {order.schedules.classes?.title || '(클래스)'} {formatTimeRange(order.schedules.start_time, order.schedules.end_time)}
                      </span>
                    )}
                    <span className="text-xs text-neutral-400">
                      {formatDate(order.created_at)}
                      {order.confirmed_at && ` · ${formatDate(order.confirmed_at)}`}
                    </span>
                  </div>
                  {tab === 'PENDING' && (
                    <button
                      onClick={() => handleConfirm(order.id)}
                      disabled={confirmingId !== null}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-medium shrink-0"
                    >
                      {confirmingId === order.id ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <CheckCircle size={14} />
                      )}
                      입금확인
                    </button>
                  )}
                  {tab === 'CONFIRMED' && (
                    <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400 shrink-0">
                      <CheckCircle size={14} /> 확인완료
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
