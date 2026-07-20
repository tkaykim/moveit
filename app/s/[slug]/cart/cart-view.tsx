'use client';

/**
 * 장바구니 → 결제 (T10)
 *
 * 규율:
 *   ① 결제 **전에** preflight 로 항목별 판정을 받고, 거절 항목은 **각자의 사유**와 함께 보여준다.
 *      "일단 결제하고 나중에 취소"는 하지 않는다.
 *   ② 금액은 서버가 준 값만 보여준다. 화면에서 더하지 않는다.
 *   ③ 현장결제(ONSITE)는 스태프 전용이라 학생 화면에 노출하지 않는다.
 *   ④ 주문번호는 결제 요청 전에 만들어 저장한다 — 새로고침해도 자기 주문으로 돌아올 수 있게.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2, Trash2, AlertCircle, LogIn, ShoppingCart } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { fetchWithAuth } from '@/lib/api/auth-fetch';
import type { MiniSkin } from '@/lib/miniapp/skin';
import {
  readCart,
  removeAt,
  dropIndexes,
  clearCart,
  toOrderItems,
  type CartEntry,
} from '@/lib/miniapp/cart';
import type { OrderItemVerdict, OrderMethod } from '@/lib/orders/types';

const PENDING_KEY = (academyId: string) => `miniapp-pending-order:${academyId}`;

/** 학생에게 제안하는 결제 수단. ONSITE 는 의도적으로 없다(스태프 전용). */
const METHODS: { value: Extract<OrderMethod, 'BANK' | 'TOSS'>; label: string; hint: string }[] = [
  { value: 'BANK', label: '계좌이체', hint: '24시간 좌석을 잡아둡니다' },
  { value: 'TOSS', label: '카드 결제', hint: '토스페이먼츠' },
];

export function CartView({
  slug,
  academyId,
  academyName,
  skin,
}: {
  slug: string;
  academyId: string;
  academyName: string;
  skin: MiniSkin;
}) {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [entries, setEntries] = useState<CartEntry[]>([]);
  const [verdicts, setVerdicts] = useState<OrderItemVerdict[]>([]);
  const [totals, setTotals] = useState<{ original: number; discount: number; total: number } | null>(
    null
  );
  const [method, setMethod] = useState<'BANK' | 'TOSS'>('BANK');
  const [checking, setChecking] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setEntries(readCart(academyId));
  }, [academyId]);

  /** 서버 판정을 다시 받는다. 화면의 모든 사유는 여기서만 온다. */
  const runPreflight = useCallback(
    async (list: CartEntry[]) => {
      if (list.length === 0) {
        setVerdicts([]);
        setTotals(null);
        return;
      }
      setChecking(true);
      setError(null);
      try {
        const res = await fetchWithAuth('/api/orders/preflight', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ academyId, items: toOrderItems(list) }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data?.error || '주문 확인에 실패했습니다.');
          setVerdicts([]);
          setTotals(null);
          return;
        }
        setVerdicts((data.items || []) as OrderItemVerdict[]);
        setTotals({
          original: data.original_amount ?? 0,
          discount: data.discount_amount ?? 0,
          total: data.total_amount ?? 0,
        });
      } catch {
        setError('네트워크 오류로 주문을 확인하지 못했습니다.');
      } finally {
        setChecking(false);
      }
    },
    [academyId]
  );

  useEffect(() => {
    if (!authLoading) void runPreflight(entries);
  }, [entries, authLoading, runPreflight]);

  const rejected = useMemo(() => verdicts.filter((v) => !v.ok), [verdicts]);
  const needsSignIn = useMemo(() => rejected.some((v) => v.code === 'SIGN_IN_REQUIRED'), [rejected]);
  const canCheckout = entries.length > 0 && rejected.length === 0 && !checking && totals != null;

  const handleRemove = (index: number) => setEntries(removeAt(academyId, index));

  const handleDropRejected = () =>
    setEntries(dropIndexes(academyId, rejected.map((v) => v.index)));

  const handleCheckout = async () => {
    if (!canCheckout || !totals) return;
    setSubmitting(true);
    setError(null);

    // 주문번호를 **먼저** 만들어 저장한다. 결제 중 새로고침해도 이 번호로 돌아온다.
    const providerOrderId = `MV-${Date.now().toString(36).toUpperCase()}-${Math.random()
      .toString(36)
      .slice(2, 10)
      .toUpperCase()}`;
    try {
      window.localStorage.setItem(PENDING_KEY(academyId), providerOrderId);
    } catch {
      /* 저장 실패가 결제를 막지는 않는다 */
    }

    try {
      const res = await fetchWithAuth('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          academyId,
          method,
          items: toOrderItems(entries),
          providerOrderId,
          expectedTotalAmount: totals.total,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        // 락 아래 재검증에서 뒤집힌 항목이 있으면 최신 판정을 그대로 보여준다.
        if (Array.isArray(data?.rejected) && data.rejected.length > 0) {
          setVerdicts((prev) => {
            const map = new Map(prev.map((v) => [v.index, v]));
            for (const r of data.rejected as OrderItemVerdict[]) map.set(r.index, r);
            return [...map.values()].sort((a, b) => a.index - b.index);
          });
        }
        setError(data?.error || '주문 생성에 실패했습니다.');
        setSubmitting(false);
        return;
      }

      clearCart(academyId);
      router.push(`/s/${slug}/orders/${encodeURIComponent(providerOrderId)}`);
    } catch {
      setError('네트워크 오류로 주문을 만들지 못했습니다.');
      setSubmitting(false);
    }
  };

  const verdictFor = (i: number) => verdicts.find((v) => v.index === i);

  return (
    <div className="px-5 pt-8 pb-10">
      <p className="text-[11px] font-bold tracking-widest uppercase" style={{ color: 'var(--primary)' }}>
        Cart
      </p>
      <h1 className="text-[24px] font-extrabold tracking-tight mt-0.5">장바구니</h1>
      <p className="text-[13px] text-neutral-500 mt-1.5 mb-6">{academyName}</p>

      {entries.length === 0 ? (
        <div className="py-16 text-center rounded-2xl bg-neutral-50 dark:bg-neutral-900" data-testid="cart-empty">
          <ShoppingCart size={22} className="mx-auto text-neutral-300 mb-2" />
          <p className="text-sm text-neutral-400">장바구니가 비어 있습니다</p>
          <Link
            href={`/s/${slug}/schedule`}
            className="inline-block mt-4 px-4 py-2 rounded-lg text-[12px] font-bold text-white"
            style={{ backgroundColor: 'var(--primary)' }}
          >
            시간표 보러가기
          </Link>
        </div>
      ) : (
        <>
          <ul className="space-y-2.5" data-testid="cart-list">
            {entries.map((e, i) => {
              const v = verdictFor(i);
              const bad = v ? !v.ok : false;
              return (
                <li
                  key={`${e.item.item_type}-${i}`}
                  data-testid="cart-item"
                  data-ok={v ? (v.ok ? '1' : '0') : ''}
                  data-code={v?.code ?? ''}
                  className={`p-4 rounded-2xl border ${
                    bad
                      ? 'border-red-300 bg-red-50/60 dark:border-red-500/40 dark:bg-red-500/5'
                      : 'border-neutral-200 dark:border-neutral-800'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-[14px] font-bold truncate">{e.label}</p>
                      {e.sublabel && (
                        <p className="text-xs text-neutral-500 truncate mt-0.5">{e.sublabel}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {v?.ok && v.final_amount > 0 && (
                        <span className="text-[13px] font-extrabold tabular-nums">
                          {v.final_amount.toLocaleString('ko-KR')}
                          {skin.currencySuffix}
                        </span>
                      )}
                      <button
                        type="button"
                        aria-label="삭제"
                        data-testid="cart-remove"
                        onClick={() => handleRemove(i)}
                        className="p-1.5 rounded-lg text-neutral-400 hover:text-red-500"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>

                  {/* 거절 사유는 **항목마다 따로** 보여준다 */}
                  {bad && v && (
                    <p
                      data-testid="reject-reason"
                      data-code={v.code}
                      className="mt-2.5 flex items-start gap-1.5 text-[12px] font-semibold text-red-600 dark:text-red-400 leading-relaxed"
                    >
                      <AlertCircle size={13} className="mt-[1px] flex-shrink-0" />
                      <span>{v.message}</span>
                    </p>
                  )}
                </li>
              );
            })}
          </ul>

          {checking && (
            <p className="mt-4 flex items-center gap-2 text-xs text-neutral-500">
              <Loader2 size={13} className="animate-spin" /> 주문 가능 여부를 확인하고 있습니다…
            </p>
          )}

          {/* 로그인이 필요한 경우 — 게스트는 수강권을 받을 주인이 없어 이행이 불가능하다 */}
          {needsSignIn && !user && (
            <div
              data-testid="signin-required"
              className="mt-4 p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800"
            >
              <p className="text-[13px] font-bold">수강권 구매는 로그인이 필요합니다</p>
              <p className="text-[12px] text-neutral-500 mt-1 leading-relaxed">
                수강권은 회원 계정으로 발급됩니다. 로그인 후 다시 시도해 주세요.
              </p>
              <Link
                href={`/s/${slug}/my`}
                data-testid="signin-link"
                className="mt-3 w-full py-2.5 rounded-xl text-[13px] font-bold text-white flex items-center justify-center gap-1.5"
                style={{ backgroundColor: 'var(--primary)' }}
              >
                <LogIn size={14} /> 로그인하기
              </Link>
            </div>
          )}

          {rejected.length > 0 && (
            <button
              type="button"
              data-testid="drop-rejected"
              onClick={handleDropRejected}
              className="mt-4 w-full py-3 rounded-xl text-[13px] font-bold border border-neutral-300 dark:border-neutral-700"
            >
              주문할 수 없는 {rejected.length}개 빼고 계속하기
            </button>
          )}

          {/* 금액 — 서버가 계산한 값만 표시 */}
          {totals && rejected.length === 0 && (
            <div className="mt-6 p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-900 space-y-1.5">
              <div className="flex justify-between text-[13px] text-neutral-500">
                <span>상품 금액</span>
                <span className="tabular-nums">
                  {totals.original.toLocaleString('ko-KR')}
                  {skin.currencySuffix}
                </span>
              </div>
              {totals.discount > 0 && (
                <div className="flex justify-between text-[13px]" style={{ color: 'var(--primary)' }}>
                  <span>할인</span>
                  <span className="tabular-nums">
                    −{totals.discount.toLocaleString('ko-KR')}
                    {skin.currencySuffix}
                  </span>
                </div>
              )}
              <div className="flex justify-between items-baseline pt-2 mt-1 border-t border-neutral-200 dark:border-neutral-800">
                <span className="text-[13px] font-bold">결제 금액</span>
                <span data-testid="cart-total" className="text-[19px] font-extrabold tabular-nums">
                  {totals.total.toLocaleString('ko-KR')}
                  {skin.currencySuffix}
                </span>
              </div>
            </div>
          )}

          {/* 결제 수단 */}
          {rejected.length === 0 && (
            <div className="mt-5">
              <p className="text-[13px] font-bold mb-2">결제 수단</p>
              <div className="grid grid-cols-2 gap-2">
                {METHODS.map((m) => (
                  <button
                    key={m.value}
                    type="button"
                    data-testid={`method-${m.value}`}
                    data-selected={method === m.value ? '1' : '0'}
                    onClick={() => setMethod(m.value)}
                    className="p-3 rounded-xl border text-left"
                    style={
                      method === m.value
                        ? { borderColor: 'var(--primary)', borderWidth: 2 }
                        : undefined
                    }
                  >
                    <span className="block text-[13px] font-bold">{m.label}</span>
                    <span className="block text-[11px] text-neutral-500 mt-0.5">{m.hint}</span>
                  </button>
                ))}
              </div>
              {method === 'BANK' && (
                <p className="text-[11px] text-neutral-500 mt-2 leading-relaxed">{skin.bankNotice}</p>
              )}
            </div>
          )}

          {error && (
            <p data-testid="cart-error" className="mt-4 text-[12px] font-semibold text-red-600 dark:text-red-400">
              {error}
            </p>
          )}

          <button
            type="button"
            data-testid="checkout"
            disabled={!canCheckout || submitting}
            onClick={handleCheckout}
            className="mt-5 w-full py-3.5 rounded-xl text-[14px] font-extrabold text-white disabled:opacity-40 flex items-center justify-center gap-2"
            style={{ backgroundColor: 'var(--primary)' }}
          >
            {submitting && <Loader2 size={15} className="animate-spin" />}
            {skin.checkoutCta}
          </button>
        </>
      )}
    </div>
  );
}
