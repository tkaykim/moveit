"use client";

/**
 * 결제 처리 (T9 §4)
 *
 *  - 입금 확인 / 현장 결제 기록 : **주문 묶음 단위**. 한 번의 확인이 그 주문 전체를 끝낸다.
 *  - 보강 : 월 한도는 서버(T6 DB 함수)가 강제한다. 화면에서 다시 판정하지 않는다.
 *  - 환불 : 계산된 제안을 보여주고, 직원이 사유와 함께 조정·확인한다.
 *
 * ⚠ 환불 "확인"은 결정을 기록할 뿐 돈을 움직이지 않는다. 화면이 그 사실을 분명히 말해야 한다.
 */
import { useCallback, useEffect, useState } from 'react';
import { fetchWithAuth } from '@/lib/api/auth-fetch';
import { RefreshCw, Landmark, Wallet, Info } from 'lucide-react';
import {
  ConsolePage,
  ConsoleCard,
  AllClear,
  Loading,
  ErrorNote,
  Chip,
  ActionButton,
  Field,
  inputClass,
  formatKrw,
  formatDateTime,
} from './console-ui';

interface OrderItem {
  id: string;
  ticket_name_snapshot: string | null;
  final_amount: number | null;
}

interface PendingOrder {
  id: string;
  method: string;
  status: string;
  total_amount: number;
  student_name: string;
  orderer_phone: string | null;
  created_at: string;
  items: OrderItem[];
  item_count: number;
}

interface Refundable {
  id: string;
  student_name: string;
  ticket_name: string | null;
  final_price: number;
  refunded_amount: number | null;
  transaction_date: string;
}

interface Proposal {
  id: string;
  user_id: string | null;
  paid_amount: number;
  computed_amount: number;
  adjusted_amount: number | null;
  basis: string | null;
  status: string;
  reason: string | null;
  confirmed_by: string | null;
  confirmed_at: string | null;
  created_at: string;
}

interface MakeupBooking {
  id: string;
  class_title: string;
  student_name: string;
  status: string;
  start_time: string | null;
}

interface MakeupSchedule {
  id: string;
  class_title: string;
  start_time: string;
}

const METHOD_LABEL: Record<string, string> = {
  BANK: '계좌이체',
  ONSITE: '현장결제',
  TOSS: '카드결제',
};

const STATUS_LABEL: Record<string, string> = {
  DRAFT: '작성 중',
  PENDING_PAYMENT: '입금 대기',
  PAYMENT_APPROVED: '결제 완료 · 처리 중',
  FULFILLMENT_FAILED: '처리 실패',
};

const PROPOSAL_STATUS: Record<string, string> = {
  PROPOSED: '확인 대기',
  CONFIRMED: '확인됨',
  REJECTED: '반려됨',
};

/** 이 문구는 화면 어디에서도 사라지면 안 된다 */
const NO_MONEY_MOVED = '확인해도 돈은 빠져나가지 않습니다. 결정과 근거만 기록됩니다.';

export function PaymentsView({ academyId }: { academyId: string }) {
  const base = `/api/academy-admin/${academyId}`;

  const [orders, setOrders] = useState<PendingOrder[]>([]);
  const [refundable, setRefundable] = useState<Refundable[]>([]);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  // 환불 확인 폼 (제안 id → 입력값)
  const [adjust, setAdjust] = useState<Record<string, string>>({});
  const [reason, setReason] = useState<Record<string, string>>({});

  // 보강
  const [candidates, setCandidates] = useState<{
    bookings: MakeupBooking[];
    schedules: MakeupSchedule[];
  }>({ bookings: [], schedules: [] });
  const [makeupBooking, setMakeupBooking] = useState('');
  const [makeupTarget, setMakeupTarget] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [res, candRes] = await Promise.all([
        fetchWithAuth(`${base}/console/payments`),
        fetchWithAuth(`${base}/console/makeup-candidates`),
      ]);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || '결제 정보를 불러오지 못했습니다.');
      setOrders(json.pendingOrders ?? []);
      setRefundable(json.refundable ?? []);
      setProposals(json.proposals ?? []);
      if (candRes.ok) {
        const cand = await candRes.json();
        setCandidates({ bookings: cand.bookings ?? [], schedules: cand.schedules ?? [] });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '결제 정보를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [base]);

  useEffect(() => {
    void load();
  }, [load]);

  const run = async (key: string, fn: () => Promise<Response>, okMessage?: string) => {
    setBusy(key);
    setError(null);
    setNotice(null);
    try {
      const res = await fn();
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || '처리에 실패했습니다.');
      if (okMessage) setNotice(okMessage);
      await load();
      return json;
    } catch (e) {
      setError(e instanceof Error ? e.message : '처리에 실패했습니다.');
      return null;
    } finally {
      setBusy(null);
    }
  };

  const post = (url: string, body: unknown) =>
    fetchWithAuth(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

  return (
    <ConsolePage
      title="결제 처리"
      description="입금 확인, 현장 결제 기록, 보강, 환불을 처리합니다."
      actions={
        <ActionButton onClick={load} variant="ghost" busy={loading} testId="payments-refresh">
          <RefreshCw size={13} /> 새로고침
        </ActionButton>
      }
    >
      {error && <ErrorNote message={error} />}
      {notice && (
        <div
          data-testid="payments-notice"
          className="rounded-lg bg-emerald-50 dark:bg-emerald-900/20 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300 break-keep"
        >
          {notice}
        </div>
      )}
      {loading && <Loading label="결제 정보 불러오는 중" />}

      {/* ---------- 입금 확인 / 현장 결제 ---------- */}
      <ConsoleCard title="확인이 필요한 결제" count={orders.length} tone="warn" dataTestId="pending-orders">
        <p className="mb-3 text-xs text-neutral-500 dark:text-neutral-400 break-keep">
          한 번 확인하면 그 주문에 담긴 수강권·예약이 <strong>모두 함께</strong> 확정됩니다.
        </p>
        {orders.length === 0 ? (
          <AllClear message="확인을 기다리는 결제가 없습니다." />
        ) : (
          <ul className="space-y-2" data-testid="pending-order-list">
            {orders.map((o) => (
              <li
                key={o.id}
                data-testid="pending-order-row"
                data-order-id={o.id}
                className="w-full max-w-full rounded-lg border border-neutral-200 dark:border-neutral-800 px-3 py-2.5"
              >
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-sm font-bold text-neutral-900 dark:text-white break-keep">
                    {o.student_name}
                  </span>
                  <Chip tone="info">
                    {o.method === 'BANK' ? (
                      <span className="inline-flex items-center gap-1">
                        <Landmark size={10} /> {METHOD_LABEL[o.method]}
                      </span>
                    ) : o.method === 'ONSITE' ? (
                      <span className="inline-flex items-center gap-1">
                        <Wallet size={10} /> {METHOD_LABEL[o.method]}
                      </span>
                    ) : (
                      METHOD_LABEL[o.method] ?? o.method
                    )}
                  </Chip>
                  <Chip tone={o.status === 'FULFILLMENT_FAILED' ? 'bad' : 'warn'}>
                    {STATUS_LABEL[o.status] ?? o.status}
                  </Chip>
                </div>
                <p className="mt-1 text-xs text-neutral-600 dark:text-neutral-400 break-keep">
                  {formatKrw(o.total_amount)} · 항목 {o.item_count}개
                  {o.items.length > 0 &&
                    ` (${o.items
                      .map((i) => i.ticket_name_snapshot ?? '항목')
                      .slice(0, 3)
                      .join(', ')}${o.items.length > 3 ? ' 외' : ''})`}
                </p>
                <p className="mt-0.5 text-[11px] text-neutral-400">
                  접수 {formatDateTime(o.created_at)}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {o.method === 'TOSS' ? (
                    <span className="text-xs text-neutral-500">
                      카드결제는 결제사 승인 경로로만 확정됩니다.
                    </span>
                  ) : (
                    <ActionButton
                      busy={busy === `confirm-${o.id}`}
                      onClick={() =>
                        void run(
                          `confirm-${o.id}`,
                          () => post(`${base}/orders/confirm`, { orderGroupId: o.id }),
                          '주문 전체를 확정했습니다.'
                        )
                      }
                      testId="order-confirm"
                    >
                      {o.method === 'BANK' ? '입금 확인하고 전체 확정' : '현장 결제 기록하고 확정'}
                    </ActionButton>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </ConsoleCard>

      {/* ---------- 보강 ---------- */}
      <ConsoleCard title="보강 처리" dataTestId="makeup-section">
        <p className="mb-3 text-xs text-neutral-500 dark:text-neutral-400 break-keep">
          결석·휴강한 회차를 같은 수업의 다른 날짜로 옮깁니다. 월 한도를 넘으면 저장되지 않고
          안내가 뜹니다.
        </p>
        <form
          data-testid="makeup-form"
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void run(
              'makeup',
              () =>
                post(`${base}/makeup`, {
                  bookingId: makeupBooking,
                  targetScheduleId: makeupTarget,
                }),
              '보강 처리했습니다.'
            );
          }}
        >
          <div className="min-w-0 flex-1 basis-48">
            <Field label="옮길 예약">
              <select
                required
                value={makeupBooking}
                onChange={(e) => setMakeupBooking(e.target.value)}
                data-testid="makeup-booking"
                className={inputClass}
              >
                <option value="">선택</option>
                {candidates.bookings.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.student_name} · {b.class_title} · {formatDateTime(b.start_time)}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="min-w-0 flex-1 basis-48">
            <Field label="옮겨 갈 회차">
              <select
                required
                value={makeupTarget}
                onChange={(e) => setMakeupTarget(e.target.value)}
                data-testid="makeup-target"
                className={inputClass}
              >
                <option value="">선택</option>
                {candidates.schedules.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.class_title} · {formatDateTime(s.start_time)}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <ActionButton type="submit" busy={busy === 'makeup'} testId="makeup-submit">
            보강 처리
          </ActionButton>
        </form>
      </ConsoleCard>

      {/* ---------- 환불 ---------- */}
      <ConsoleCard title="환불" count={proposals.length} dataTestId="refund-section">
        <div
          data-testid="refund-no-money-notice"
          className="mb-3 flex items-start gap-2 rounded-lg bg-blue-50 dark:bg-blue-900/20 px-3 py-2 text-xs text-blue-800 dark:text-blue-300 break-keep"
        >
          <Info size={14} className="shrink-0 mt-0.5" />
          <span>{NO_MONEY_MOVED} 실제 송금은 별도 승인 절차로 진행됩니다.</span>
        </div>

        {/* 제안 만들기 */}
        <div className="mb-4">
          <h3 className="text-xs font-bold text-neutral-600 dark:text-neutral-400 mb-2">
            환불 금액 계산하기
          </h3>
          {refundable.length === 0 ? (
            <AllClear message="환불할 결제 내역이 없습니다." />
          ) : (
            <ul className="space-y-1.5" data-testid="refundable-list">
              {refundable.slice(0, 10).map((r) => (
                <li
                  key={r.id}
                  data-testid="refundable-row"
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-neutral-200 dark:border-neutral-800 px-2.5 py-1.5"
                >
                  <span className="text-xs text-neutral-700 dark:text-neutral-300 break-keep min-w-0">
                    {r.student_name} · {r.ticket_name ?? '수강권'} · {formatKrw(r.final_price)}
                  </span>
                  <ActionButton
                    variant="ghost"
                    busy={busy === `prop-${r.id}`}
                    onClick={() =>
                      void run(
                        `prop-${r.id}`,
                        () => post(`${base}/refund-proposals`, { revenueTransactionId: r.id }),
                        '환불 금액을 계산했습니다. 아래에서 확인해 주세요.'
                      )
                    }
                    testId="refund-propose"
                  >
                    환불 금액 계산
                  </ActionButton>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* 제안 확인 */}
        <h3 className="text-xs font-bold text-neutral-600 dark:text-neutral-400 mb-2">
          계산된 환불 제안
        </h3>
        {proposals.length === 0 ? (
          <AllClear message="확인을 기다리는 환불이 없습니다." />
        ) : (
          <ul className="space-y-2" data-testid="proposal-list">
            {proposals.map((p) => (
              <li
                key={p.id}
                data-testid="proposal-row"
                data-proposal-id={p.id}
                data-status={p.status}
                className="w-full max-w-full rounded-lg border border-neutral-200 dark:border-neutral-800 px-3 py-2.5"
              >
                <div className="flex flex-wrap items-center gap-1.5">
                  <Chip tone={p.status === 'PROPOSED' ? 'warn' : p.status === 'CONFIRMED' ? 'good' : 'neutral'}>
                    {PROPOSAL_STATUS[p.status] ?? p.status}
                  </Chip>
                  <span className="text-sm font-bold text-neutral-900 dark:text-white">
                    계산된 환불액 {formatKrw(p.computed_amount)}
                  </span>
                  <span className="text-xs text-neutral-500">
                    (결제액 {formatKrw(p.paid_amount)})
                  </span>
                </div>
                {p.basis && (
                  <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400 break-keep">
                    근거: {p.basis}
                  </p>
                )}

                {p.status === 'PROPOSED' ? (
                  <form
                    className="mt-2 space-y-2"
                    data-testid="proposal-confirm-form"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const body: Record<string, unknown> = { reason: reason[p.id] ?? '' };
                      if ((adjust[p.id] ?? '').trim() !== '') {
                        body.adjustedAmount = Number(adjust[p.id]);
                      }
                      void run(
                        `conf-${p.id}`,
                        () => post(`${base}/refund-proposals/${p.id}/confirm`, body),
                        '환불 결정을 기록했습니다. 실제 송금은 아직 일어나지 않았습니다.'
                      );
                    }}
                  >
                    <div className="flex flex-wrap items-end gap-2">
                      <div className="w-36">
                        <Field label="조정 금액 (선택)">
                          <input
                            type="number"
                            min={0}
                            max={p.paid_amount}
                            value={adjust[p.id] ?? ''}
                            onChange={(e) =>
                              setAdjust((prev) => ({ ...prev, [p.id]: e.target.value }))
                            }
                            placeholder={String(p.computed_amount)}
                            data-testid="proposal-adjust"
                            className={inputClass}
                          />
                        </Field>
                      </div>
                      <div className="min-w-0 flex-1 basis-48">
                        <Field label="사유 (필수 · 기록에 남습니다)">
                          <input
                            required
                            value={reason[p.id] ?? ''}
                            onChange={(e) =>
                              setReason((prev) => ({ ...prev, [p.id]: e.target.value }))
                            }
                            data-testid="proposal-reason"
                            className={inputClass}
                            placeholder="예: 원장 재량 조정"
                          />
                        </Field>
                      </div>
                      <ActionButton
                        type="submit"
                        busy={busy === `conf-${p.id}`}
                        testId="proposal-confirm"
                      >
                        확인 기록
                      </ActionButton>
                    </div>
                    <p className="text-[11px] text-neutral-500 dark:text-neutral-400 break-keep">
                      {NO_MONEY_MOVED}
                    </p>
                  </form>
                ) : (
                  <div
                    className="mt-2 rounded-md bg-neutral-50 dark:bg-neutral-800/50 px-2.5 py-2 text-xs text-neutral-600 dark:text-neutral-400 break-keep"
                    data-testid="proposal-audit"
                  >
                    최종 금액 {formatKrw(p.adjusted_amount)} · 사유 “{p.reason ?? '—'}” ·{' '}
                    {formatDateTime(p.confirmed_at)}
                    {p.confirmed_by ? ` · 담당 ${p.confirmed_by.slice(0, 8)}` : ''}
                    {p.adjusted_amount != null && p.adjusted_amount !== p.computed_amount && (
                      <>
                        {' '}
                        · 계산값에서 {formatKrw(Math.abs(p.adjusted_amount - p.computed_amount))}{' '}
                        {p.adjusted_amount > p.computed_amount ? '증액' : '감액'}
                      </>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </ConsoleCard>
    </ConsolePage>
  );
}
