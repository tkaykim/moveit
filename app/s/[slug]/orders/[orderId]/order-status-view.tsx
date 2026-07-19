'use client';

/**
 * 주문 결과 화면 (T10) — **정직하게** 상태를 말한다.
 *
 *   CONFIRMED          → 완료
 *   PAYMENT_APPROVED   → "결제는 완료됐고 처리 중". 절대 실패라고 하지 않는다.
 *   FULFILLMENT_FAILED → 결제됨 + 처리 실패. 복구 안내를 준다(돈이 사라진 게 아니다).
 *   PENDING_PAYMENT    → 입금/결제 대기
 *
 * 새로고침 복구: 상태는 언제나 **서버에서** 다시 읽는다. 화면에 캐시된 낙관적 결과를
 * 믿지 않는다 — 결제 도중 새로고침해도 이 페이지가 진짜 상태를 보여준다.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Loader2, CheckCircle2, Clock, AlertTriangle, Landmark } from 'lucide-react';
import { fetchWithAuth } from '@/lib/api/auth-fetch';
import type { MiniSkin } from '@/lib/miniapp/skin';

type Phase = 'PENDING' | 'PROCESSING' | 'DONE' | 'FAILED' | 'CLOSED';

interface OrderStatus {
  provider_order_id: string;
  status: string;
  phase: Phase;
  message: string;
  method: string;
  total_amount: number;
  expires_at: string | null;
  fulfillment_error_code: string | null;
  items: { id: string; item_type: string; ticket_name_snapshot: string | null }[];
}

const fmt = (iso: string) =>
  new Date(iso).toLocaleString('ko-KR', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Seoul',
  });

export function OrderStatusView({
  slug,
  academyId,
  providerOrderId,
  skin,
}: {
  slug: string;
  academyId: string;
  providerOrderId: string;
  skin: MiniSkin;
}) {
  const [status, setStatus] = useState<OrderStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetchWithAuth(
        `/api/orders/status?providerOrderId=${encodeURIComponent(providerOrderId)}`,
        { cache: 'no-store' }
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || '주문 상태를 불러오지 못했습니다.');
        return null;
      }
      setError(null);
      setStatus(data as OrderStatus);
      return data as OrderStatus;
    } catch {
      setError('네트워크 오류로 주문 상태를 불러오지 못했습니다.');
      return null;
    } finally {
      setLoading(false);
    }
  }, [providerOrderId]);

  useEffect(() => {
    let alive = true;

    const tick = async () => {
      const s = await load();
      if (!alive) return;
      // 이행이 끝나지 않은 동안만 짧게 다시 물어본다.
      if (s && s.phase === 'PROCESSING') {
        timer.current = setTimeout(tick, 2500);
      }
    };
    void tick();

    return () => {
      alive = false;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [load]);

  // 완료·종료된 주문이면 저장해둔 "진행 중 주문" 표시를 지운다.
  useEffect(() => {
    if (status && (status.phase === 'DONE' || status.phase === 'CLOSED')) {
      try {
        const key = `miniapp-pending-order:${academyId}`;
        if (window.localStorage.getItem(key) === providerOrderId) {
          window.localStorage.removeItem(key);
        }
      } catch {
        /* noop */
      }
    }
  }, [status, academyId, providerOrderId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="animate-spin" size={26} style={{ color: 'var(--primary)' }} />
      </div>
    );
  }

  if (error || !status) {
    return (
      <div className="px-5 pt-10 text-center">
        <AlertTriangle size={26} className="mx-auto text-neutral-400 mb-3" />
        <p className="text-sm font-semibold">{error || '주문을 찾을 수 없습니다.'}</p>
        <p className="text-xs text-neutral-500 mt-1.5 break-all">주문번호 {providerOrderId}</p>
        <Link
          href={`/s/${slug}/my`}
          className="inline-block mt-5 px-4 py-2.5 rounded-xl text-[13px] font-bold text-white"
          style={{ backgroundColor: 'var(--primary)' }}
        >
          MY 로 이동
        </Link>
      </div>
    );
  }

  const P = status.phase;

  return (
    <div className="px-5 pt-10 pb-10" data-testid="order-status" data-phase={P} data-status={status.status}>
      <div className="text-center">
        {P === 'DONE' && <CheckCircle2 size={44} className="mx-auto" style={{ color: 'var(--primary)' }} />}
        {P === 'PROCESSING' && <Loader2 size={44} className="mx-auto animate-spin text-amber-500" />}
        {P === 'PENDING' && <Landmark size={44} className="mx-auto text-neutral-400" />}
        {P === 'FAILED' && <AlertTriangle size={44} className="mx-auto text-red-500" />}
        {P === 'CLOSED' && <Clock size={44} className="mx-auto text-neutral-400" />}

        <h1 className="text-[20px] font-extrabold mt-4" data-testid="order-headline">
          {P === 'DONE' && '결제가 완료되었습니다'}
          {P === 'PROCESSING' && '결제는 완료됐고 처리 중입니다'}
          {P === 'PENDING' && (status.method === 'BANK' ? '입금을 기다리고 있습니다' : '결제를 기다리고 있습니다')}
          {P === 'FAILED' && '결제는 완료됐지만 처리에 실패했습니다'}
          {P === 'CLOSED' && '종료된 주문입니다'}
        </h1>

        <p className="text-[13px] text-neutral-500 mt-2 leading-relaxed" data-testid="order-message">
          {P === 'PROCESSING'
            ? '결제 자체는 정상 승인되었습니다. 수강권 발급과 예약 확정을 마무리하는 중이에요.'
            : P === 'FAILED'
              ? '결제 금액은 안전하게 기록되어 있습니다. 학원에 문의하시면 바로 처리해 드립니다.'
              : status.message}
        </p>
      </div>

      <div className="mt-7 p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-900 space-y-2">
        <Row label="주문번호" value={status.provider_order_id} mono />
        <Row
          label="결제 수단"
          value={status.method === 'BANK' ? '계좌이체' : status.method === 'TOSS' ? '카드' : '현장결제'}
        />
        <Row
          label="결제 금액"
          value={`${(status.total_amount ?? 0).toLocaleString('ko-KR')}${skin.currencySuffix}`}
        />
        {P === 'PENDING' && status.method === 'BANK' && status.expires_at && (
          <Row label="입금 기한" value={fmt(status.expires_at)} />
        )}
        {P === 'FAILED' && status.fulfillment_error_code && (
          <Row label="오류 코드" value={status.fulfillment_error_code} mono />
        )}
      </div>

      {status.items.length > 0 && (
        <ul className="mt-4 space-y-1.5">
          {status.items.map((it) => (
            <li
              key={it.id}
              className="text-[12px] text-neutral-500 flex items-center gap-2 px-1"
            >
              <span className="w-1 h-1 rounded-full bg-neutral-300 flex-shrink-0" />
              <span className="truncate">
                {it.item_type === 'TICKET_PURCHASE'
                  ? it.ticket_name_snapshot || '수강권'
                  : '수업 예약'}
              </span>
            </li>
          ))}
        </ul>
      )}

      {P === 'PENDING' && status.method === 'BANK' && (
        <p className="mt-5 text-[12px] text-neutral-500 leading-relaxed px-1">{skin.bankNotice}</p>
      )}

      <div className="mt-7 space-y-2">
        <Link
          href={`/s/${slug}/my`}
          className="w-full py-3 rounded-xl text-[13px] font-bold text-white flex items-center justify-center"
          style={{ backgroundColor: 'var(--primary)' }}
        >
          MY 에서 확인하기
        </Link>
        <Link
          href={`/s/${slug}/schedule`}
          className="w-full py-3 rounded-xl text-[13px] font-bold border border-neutral-300 dark:border-neutral-700 flex items-center justify-center"
        >
          시간표로 돌아가기
        </Link>
      </div>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3 text-[13px]">
      <span className="text-neutral-500 flex-shrink-0">{label}</span>
      <span className={`font-semibold text-right break-all ${mono ? 'tabular-nums text-[12px]' : ''}`}>
        {value}
      </span>
    </div>
  );
}
