'use client';

import { useCallback, useEffect, useState } from 'react';
import { Wallet, Landmark, Check, AlertTriangle, ChevronDown, Clock, RotateCcw } from 'lucide-react';
import { fetchWithAuth } from '@/lib/api/auth-fetch';
import { useLiteAdmin } from './context';
import { OnsiteSheet } from './onsite-sheet';

interface OrderItem {
  ticket_name_snapshot: string | null;
  item_type: string;
}
interface BankPending {
  id: string;
  student_name: string;
  orderer_phone: string | null;
  total_amount: number;
  expires_at: string | null;
  created_at: string;
  items: OrderItem[];
  item_count: number;
}
interface StuckOrder {
  order_group_id: string;
  status: string;
  total_amount: number;
  orderer_name: string | null;
  fulfillment_error_message: string | null;
  retry_count: number | null;
}
interface HistoryOrder {
  id: string;
  student_name: string;
  method: string;
  status: string;
  total_amount: number;
  created_at: string;
}

const won = (n: number) => `${(n ?? 0).toLocaleString('ko-KR')}원`;

function remaining(expiresAt: string | null): string {
  if (!expiresAt) return '';
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return '만료 임박';
  const h = Math.floor(ms / 3600_000);
  const m = Math.floor((ms % 3600_000) / 60_000);
  if (h >= 24) return `${Math.floor(h / 24)}일 남음`;
  if (h > 0) return `${h}시간 ${m}분 남음`;
  return `${m}분 남음`;
}

export function PaymentsView() {
  const academy = useLiteAdmin();
  const [bank, setBank] = useState<BankPending[]>([]);
  const [stuck, setStuck] = useState<StuckOrder[]>([]);
  const [history, setHistory] = useState<HistoryOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [issued, setIssued] = useState<Record<string, { tickets: number; bookings: number }>>({});
  const [onsite, setOnsite] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuth(`/api/a/${academy.id}/payments`, { cache: 'no-store' });
      if (res.ok) {
        const j = await res.json();
        setBank(j.bankPending ?? []);
        setStuck(j.stuck ?? []);
        setHistory(j.history ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [academy.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const confirm = async (orderId: string) => {
    if (busy) return;
    setBusy(orderId);
    setError(null);
    try {
      const res = await fetchWithAuth(`/api/academy-admin/${academy.id}/orders/confirm`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ orderGroupId: orderId }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json?.error || '입금 확인에 실패했어요.');
        return;
      }
      // 확정된 카드는 성공 상태(발급 결과)를 그대로 보여준다 — 목록을 다시 불러 지우지 않는다.
      setIssued((p) => ({ ...p, [orderId]: { tickets: json.issued_tickets ?? 0, bookings: json.created_bookings ?? 0 } }));
    } finally {
      setBusy(null);
    }
  };

  const retry = async (orderId: string) => {
    if (busy) return;
    setBusy(orderId);
    setError(null);
    try {
      const res = await fetchWithAuth(`/api/academy-admin/${academy.id}/orders/retry`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ orderGroupId: orderId }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) setError(json?.error || '재시도에 실패했어요.');
      await load();
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="px-4 pt-4">
      {/* 현장결제 진입 */}
      <button
        type="button"
        data-testid="onsite-open"
        onClick={() => setOnsite(true)}
        className="w-full h-12 mb-4 rounded-xl font-bold text-white text-[14px] flex items-center justify-center gap-1.5"
        style={{ backgroundColor: academy.brand }}
      >
        <Wallet size={18} /> 현장결제 / 수강권 발급
      </button>

      {error && (
        <p className="mb-3 text-[13px] font-semibold text-red-500" data-testid="payments-error">
          {error}
        </p>
      )}

      {/* 처리 필요 (막힌 주문) */}
      <section className="mb-5" data-testid="stuck-section">
        <h2 className="text-[13px] font-extrabold text-neutral-500 mb-2 flex items-center gap-1">
          <AlertTriangle size={14} className={stuck.length ? 'text-amber-500' : 'text-neutral-300'} /> 처리 필요
        </h2>
        {loading ? (
          <p className="py-6 text-center text-sm text-neutral-400">불러오는 중...</p>
        ) : stuck.length === 0 ? (
          <div className="py-5 text-center rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800">
            <p className="text-[13px] text-emerald-600 dark:text-emerald-400 font-bold">정상 — 막힌 주문이 없어요</p>
          </div>
        ) : (
          <ul className="space-y-2" data-testid="stuck-list">
            {stuck.map((o) => (
              <li
                key={o.order_group_id}
                data-testid="stuck-row"
                data-order-id={o.order_group_id}
                className="p-3 rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-900/10"
              >
                <div className="flex items-center gap-2">
                  <span className="text-[14px] font-bold truncate">{o.orderer_name || '주문'}</span>
                  <span className="text-[12px] text-neutral-500">{won(o.total_amount)}</span>
                  <button
                    type="button"
                    data-testid="stuck-retry"
                    disabled={busy === o.order_group_id}
                    onClick={() => retry(o.order_group_id)}
                    className="ml-auto h-9 px-3 rounded-lg text-[13px] font-bold text-white flex items-center gap-1 disabled:opacity-50"
                    style={{ backgroundColor: academy.brand }}
                  >
                    <RotateCcw size={13} /> 재시도
                  </button>
                </div>
                {o.fulfillment_error_message && (
                  <p className="mt-1 text-[11px] text-amber-700 dark:text-amber-400 break-all">{o.fulfillment_error_message}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 입금 대기 */}
      <section data-testid="bank-section">
        <h2 className="text-[13px] font-extrabold text-neutral-500 mb-2 flex items-center gap-1">
          <Landmark size={14} /> 입금 대기 {bank.length > 0 && <span style={{ color: academy.brand }}>{bank.length}</span>}
        </h2>
        {loading ? (
          <p className="py-6 text-center text-sm text-neutral-400">불러오는 중...</p>
        ) : bank.length === 0 ? (
          <div className="py-8 text-center rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800">
            <p className="text-sm text-neutral-400">입금 확인을 기다리는 주문이 없어요</p>
          </div>
        ) : (
          <ul className="space-y-2.5" data-testid="bank-list">
            {bank.map((o) => (
              <li
                key={o.id}
                data-testid="bank-order"
                data-order-id={o.id}
                className="p-4 rounded-2xl border border-neutral-100 dark:border-neutral-800 bg-white dark:bg-neutral-900"
              >
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-bold truncate">{o.student_name}</p>
                    <p className="text-xs text-neutral-500 truncate mt-0.5">
                      {o.items.map((i) => i.ticket_name_snapshot ?? '항목').slice(0, 2).join(', ')}
                      {o.item_count > 2 ? ` 외 ${o.item_count - 2}` : ''}
                      {` · 수업 ${o.items.filter((i) => i.item_type === 'SCHEDULE_BOOKING').length}건`}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-[15px] font-extrabold tabular-nums" style={{ color: academy.brand }}>
                      {won(o.total_amount)}
                    </p>
                    {o.expires_at && (
                      <p className="text-[11px] text-amber-600 dark:text-amber-400 flex items-center gap-0.5 justify-end mt-0.5">
                        <Clock size={10} /> {remaining(o.expires_at)}
                      </p>
                    )}
                  </div>
                </div>

                {issued[o.id] ? (
                  <div
                    data-testid="bank-issued"
                    className="mt-3 flex items-center gap-1.5 text-[13px] font-bold text-emerald-600 dark:text-emerald-400"
                  >
                    <Check size={15} /> 확정됨 — 수강권 {issued[o.id].tickets}건
                    {issued[o.id].bookings > 0 ? ` · 예약 ${issued[o.id].bookings}건` : ''}
                  </div>
                ) : (
                  <button
                    type="button"
                    data-testid="bank-confirm"
                    disabled={busy === o.id}
                    onClick={() => confirm(o.id)}
                    className="mt-3 w-full h-11 rounded-xl font-bold text-white text-[14px] disabled:opacity-50"
                    style={{ backgroundColor: academy.brand }}
                  >
                    {busy === o.id ? '확인 중...' : '입금 확인하고 전체 확정'}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 히스토리 (읽기 전용) */}
      {history.length > 0 && (
        <section className="mt-5" data-testid="history-section">
          <button
            type="button"
            data-testid="history-toggle"
            onClick={() => setShowHistory((v) => !v)}
            className="w-full flex items-center gap-1 text-[13px] font-bold text-neutral-400 py-2"
          >
            <ChevronDown size={15} className={showHistory ? 'rotate-180 transition-transform' : 'transition-transform'} />
            만료·취소 내역 {history.length}건
          </button>
          {showHistory && (
            <ul className="space-y-1.5" data-testid="history-list">
              {history.map((o) => (
                <li
                  key={o.id}
                  className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800 flex items-center gap-2 opacity-70"
                >
                  <span className="text-[13px] font-bold truncate">{o.student_name}</span>
                  <span className="text-[11px] text-neutral-400">{won(o.total_amount)}</span>
                  <span className="ml-auto px-1.5 py-0.5 rounded text-[10px] font-bold bg-neutral-200 text-neutral-500 dark:bg-neutral-700 dark:text-neutral-400">
                    {o.status === 'EXPIRED' ? '만료' : '취소'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {onsite && (
        <OnsiteSheet
          academyId={academy.id}
          brand={academy.brand}
          title="현장결제 / 수강권 발급"
          onClose={() => setOnsite(false)}
          onDone={load}
        />
      )}
    </div>
  );
}
