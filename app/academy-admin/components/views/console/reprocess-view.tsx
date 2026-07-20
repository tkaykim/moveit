"use client";

/**
 * 재처리 대시보드 (T9 §5) — "조용히 썩는 것이 없어야 한다" 화면.
 *
 * 다섯 갈래 모두, 다시 시도하거나 처리할 수단이 화면 안에 있다.
 * 그리고 비어 있는 목록은 **정상**으로 읽혀야 한다 — 고장난 화면처럼 보이면
 * 원장은 이 화면을 신뢰하지 않게 되고, 그러면 이 화면은 존재 의미를 잃는다.
 */
import { useCallback, useEffect, useState } from 'react';
import { fetchWithAuth } from '@/lib/api/auth-fetch';
import { RefreshCw, RotateCcw, Tag } from 'lucide-react';
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

interface StuckOrder {
  order_group_id?: string;
  id?: string;
  status: string;
  total_amount?: number;
  method?: string;
  fulfillment_error_message?: string | null;
  retry_count?: number | null;
  created_at?: string;
}

interface FailedEvent {
  id: string;
  event_type: string;
  schedule_id: string | null;
  attempts: number;
  last_error: string | null;
  created_at: string;
}

interface PlacementIssue {
  id: string;
  occurrence_date: string;
  reason: string;
  shortfall: number | null;
  detail: string | null;
  source: string | null;
}

interface ReviewRow {
  student_membership_id: string;
  student_name: string | null;
  membership_name: string;
  membership_end_date: string | null;
  booking_id: string;
  class_title: string | null;
  schedule_start_time: string;
}

interface NotReadyClass {
  id: string;
  title: string;
  gates?: string[];
  reasons?: string[];
}

interface ClassGroup {
  id: string;
  name: string;
}

const STUCK_STATUS_LABEL: Record<string, string> = {
  PAYMENT_APPROVED: '결제는 됐는데 처리가 안 끝났습니다',
  FULFILLMENT_FAILED: '처리하다 실패했습니다',
};

const EVENT_LABEL: Record<string, string> = {
  SCHEDULE_CREATED: '새 회차 생성',
  SCHEDULE_CANCELED: '회차 취소',
};

const PLACEMENT_REASON: Record<string, string> = {
  SCHEDULE_FULL: '정원이 가득 찼습니다',
  NO_OCCURRENCE: '옮길 회차가 없습니다',
  ERROR: '처리 중 오류가 났습니다',
};

const GATE_LABEL: Record<string, string> = {
  MISSING_CLASS_GROUP: '수업 그룹이 지정되지 않았습니다',
  CLASS_GROUP_FOREIGN: '다른 학원의 수업 그룹입니다',
  INVALID_BOOKING_POLICY: '예약 규칙이 올바르지 않습니다',
  AUDIENCE_MEMBERSHIP_FOREIGN: '다른 학원의 멤버십이 지정됐습니다',
};

export function ReprocessView({ academyId }: { academyId: string }) {
  const base = `/api/academy-admin/${academyId}`;

  const [stuckOrders, setStuckOrders] = useState<StuckOrder[]>([]);
  const [failedEvents, setFailedEvents] = useState<FailedEvent[]>([]);
  const [placementIssues, setPlacementIssues] = useState<PlacementIssue[]>([]);
  const [expiredBookings, setExpiredBookings] = useState<ReviewRow[]>([]);
  const [notReady, setNotReady] = useState<NotReadyClass[]>([]);
  const [classGroups, setClassGroups] = useState<ClassGroup[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const [tagGroup, setTagGroup] = useState<Record<string, string>>({});
  const [bulkGroup, setBulkGroup] = useState('');
  const [bulkSelected, setBulkSelected] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [res, refsRes] = await Promise.all([
        fetchWithAuth(`${base}/console/reprocess`),
        fetchWithAuth(`${base}/console/refs`),
      ]);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || '목록을 불러오지 못했습니다.');
      setStuckOrders(json.stuckOrders ?? []);
      setFailedEvents(json.failedEvents ?? []);
      setPlacementIssues(json.placementIssues ?? []);
      setExpiredBookings(json.expiredMembershipBookings ?? []);
      setNotReady(json.notReadyClasses ?? []);
      if (refsRes.ok) {
        const refs = await refsRes.json();
        setClassGroups(refs.classGroups ?? []);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [base]);

  useEffect(() => {
    void load();
  }, [load]);

  const run = async (key: string, fn: () => Promise<Response>, okMessage: string) => {
    setBusy(key);
    setError(null);
    setNotice(null);
    try {
      const res = await fn();
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || '처리에 실패했습니다.');
      setNotice(okMessage);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : '처리에 실패했습니다.');
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
  const patch = (url: string, body: unknown) =>
    fetchWithAuth(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

  const selectedIds = Object.keys(bulkSelected).filter((k) => bulkSelected[k]);

  return (
    <ConsolePage
      title="재처리"
      description="처리가 끝나지 않은 일들입니다. 비어 있으면 정상입니다."
      actions={
        <ActionButton onClick={load} variant="ghost" busy={loading} testId="reprocess-refresh">
          <RefreshCw size={13} /> 새로고침
        </ActionButton>
      }
    >
      {error && <ErrorNote message={error} />}
      {notice && (
        <div
          data-testid="reprocess-notice"
          className="rounded-lg bg-emerald-50 dark:bg-emerald-900/20 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300 break-keep"
        >
          {notice}
        </div>
      )}
      {loading && <Loading label="목록 불러오는 중" />}

      {/* ① 막힌 주문 */}
      <ConsoleCard
        title="처리가 끝나지 않은 결제"
        count={stuckOrders.length}
        tone="warn"
        dataTestId="list-stuck-orders"
      >
        {stuckOrders.length === 0 ? (
          <AllClear message="모든 결제가 정상 처리됐습니다." />
        ) : (
          <ul className="space-y-2" data-testid="stuck-order-list">
            {stuckOrders.map((o) => {
              const id = o.order_group_id ?? o.id ?? '';
              return (
                <li
                  key={id}
                  data-testid="stuck-order-row"
                  data-order-id={id}
                  className="w-full max-w-full rounded-lg border border-neutral-200 dark:border-neutral-800 px-3 py-2.5"
                >
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Chip tone="bad">{STUCK_STATUS_LABEL[o.status] ?? o.status}</Chip>
                    {o.total_amount != null && (
                      <span className="text-xs text-neutral-600 dark:text-neutral-400">
                        {formatKrw(o.total_amount)}
                      </span>
                    )}
                    {o.retry_count != null && o.retry_count > 0 && (
                      <Chip tone="neutral">재시도 {o.retry_count}회</Chip>
                    )}
                  </div>
                  {o.fulfillment_error_message && (
                    <p className="mt-1 text-xs text-neutral-500 break-keep">
                      {o.fulfillment_error_message}
                    </p>
                  )}
                  <div className="mt-2">
                    <ActionButton
                      busy={busy === `retry-${id}`}
                      onClick={() =>
                        void run(
                          `retry-${id}`,
                          () => post(`${base}/orders/retry`, { orderGroupId: id }),
                          '다시 처리했습니다.'
                        )
                      }
                      testId="stuck-order-retry"
                    >
                      <RotateCcw size={12} /> 다시 처리
                    </ActionButton>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </ConsoleCard>

      {/* ② 실패한 예약 이벤트 */}
      <ConsoleCard
        title="실패한 자동 예약 작업"
        count={failedEvents.length}
        tone="warn"
        dataTestId="list-failed-events"
      >
        <p className="mb-2 text-xs text-neutral-500 dark:text-neutral-400 break-keep">
          5분마다 자동으로 다시 시도합니다. 계속 실패하면 아래 원인을 확인해 주세요.
        </p>
        {failedEvents.length === 0 ? (
          <AllClear message="실패한 자동 예약 작업이 없습니다." />
        ) : (
          <ul className="space-y-2" data-testid="failed-event-list">
            {failedEvents.map((ev) => (
              <li
                key={ev.id}
                data-testid="failed-event-row"
                className="w-full max-w-full rounded-lg border border-neutral-200 dark:border-neutral-800 px-3 py-2.5"
              >
                <div className="flex flex-wrap items-center gap-1.5">
                  <Chip tone="info">{EVENT_LABEL[ev.event_type] ?? ev.event_type}</Chip>
                  <Chip tone="warn">시도 {ev.attempts}회</Chip>
                  <span className="text-[11px] text-neutral-400">
                    {formatDateTime(ev.created_at)}
                  </span>
                </div>
                {ev.last_error && (
                  <p className="mt-1 text-xs text-red-600 dark:text-red-400 break-all">
                    {ev.last_error}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </ConsoleCard>

      {/* ③ 고정 주1회 배치 이슈 */}
      <ConsoleCard
        title="자동 예약이 안 된 고정 수업"
        count={placementIssues.length}
        tone="warn"
        dataTestId="list-placement-issues"
      >
        {placementIssues.length === 0 ? (
          <AllClear message="자동 예약이 모두 잘 잡혔습니다." />
        ) : (
          <ul className="space-y-2" data-testid="placement-issue-list">
            {placementIssues.map((p) => (
              <li
                key={p.id}
                data-testid="placement-issue-row"
                className="w-full max-w-full rounded-lg border border-neutral-200 dark:border-neutral-800 px-3 py-2.5"
              >
                <div className="flex flex-wrap items-center gap-1.5">
                  <Chip tone="warn">{PLACEMENT_REASON[p.reason] ?? p.reason}</Chip>
                  <span className="text-xs text-neutral-600 dark:text-neutral-400">
                    {p.occurrence_date}
                  </span>
                  {p.shortfall != null && p.shortfall > 0 && (
                    <Chip tone="neutral">{p.shortfall}자리 부족</Chip>
                  )}
                </div>
                {p.detail && (
                  <p className="mt-1 text-xs text-neutral-500 break-keep">{p.detail}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </ConsoleCard>

      {/* ④ 만료 멤버십인데 미래 예약 */}
      <ConsoleCard
        title="멤버십이 끝났는데 예약이 남은 분"
        count={expiredBookings.length}
        tone="warn"
        dataTestId="list-expired-membership-bookings"
      >
        {expiredBookings.length === 0 ? (
          <AllClear message="해당하는 분이 없습니다." />
        ) : (
          <ul className="space-y-2" data-testid="expired-membership-list">
            {expiredBookings.map((row) => (
              <li
                key={`${row.student_membership_id}-${row.booking_id}`}
                data-testid="expired-membership-row"
                className="w-full max-w-full rounded-lg border border-neutral-200 dark:border-neutral-800 px-3 py-2.5"
              >
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-sm font-bold text-neutral-900 dark:text-white break-keep">
                    {row.student_name ?? '이름 없음'}
                  </span>
                  <Chip tone="warn">
                    {row.membership_name} 만료
                    {row.membership_end_date ? ` (${row.membership_end_date})` : ''}
                  </Chip>
                </div>
                <p className="mt-1 text-xs text-neutral-600 dark:text-neutral-400 break-keep">
                  {row.class_title ?? '수업'} · {formatDateTime(row.schedule_start_time)}
                </p>
                <p className="mt-1 text-[11px] text-neutral-400 break-keep">
                  처리는 «멤버십 관리» 화면의 «확인이 필요한 멤버십»에서 기록합니다.
                </p>
              </li>
            ))}
          </ul>
        )}
      </ConsoleCard>

      {/* ⑤ 예약을 열 수 없는 수업 */}
      <ConsoleCard
        title="아직 예약을 열 수 없는 수업"
        count={notReady.length}
        tone="warn"
        dataTestId="list-not-ready-classes"
        headerRight={
          selectedIds.length > 0 ? (
            <span className="text-[11px] text-neutral-500">{selectedIds.length}개 선택</span>
          ) : undefined
        }
      >
        {notReady.length === 0 ? (
          <AllClear message="모든 수업이 예약을 받을 수 있습니다." />
        ) : (
          <>
            {/* 일괄 태깅 */}
            <form
              data-testid="bulk-tag-form"
              className="mb-3 flex flex-wrap items-end gap-2 rounded-lg border border-neutral-200 dark:border-neutral-800 p-2.5"
              onSubmit={(e) => {
                e.preventDefault();
                void run(
                  'bulk',
                  () =>
                    post(`${base}/class-readiness/bulk`, {
                      classIds: selectedIds,
                      classGroupId: bulkGroup || null,
                    }),
                  '선택한 수업을 한꺼번에 정리했습니다.'
                );
              }}
            >
              <div className="min-w-0 flex-1 basis-40">
                <Field label="선택한 수업을 이 그룹으로">
                  <select
                    required
                    value={bulkGroup}
                    onChange={(e) => setBulkGroup(e.target.value)}
                    data-testid="bulk-group"
                    className={inputClass}
                  >
                    <option value="">그룹 선택</option>
                    {classGroups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <ActionButton
                type="submit"
                busy={busy === 'bulk'}
                disabled={selectedIds.length === 0}
                testId="bulk-tag-submit"
              >
                <Tag size={12} /> 선택한 {selectedIds.length}개 한꺼번에
              </ActionButton>
            </form>

            <ul className="space-y-2" data-testid="not-ready-list">
              {notReady.map((c) => (
                <li
                  key={c.id}
                  data-testid="not-ready-row"
                  data-class-id={c.id}
                  className="w-full max-w-full rounded-lg border border-neutral-200 dark:border-neutral-800 px-3 py-2.5"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="checkbox"
                      checked={!!bulkSelected[c.id]}
                      onChange={(e) =>
                        setBulkSelected((prev) => ({ ...prev, [c.id]: e.target.checked }))
                      }
                      aria-label={`${c.title} 선택`}
                      data-testid="not-ready-select"
                      className="h-4 w-4 shrink-0"
                    />
                    <span className="text-sm font-bold text-neutral-900 dark:text-white break-keep min-w-0">
                      {c.title}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {(c.gates ?? c.reasons ?? []).map((g) => (
                      <Chip key={g} tone="warn">
                        {GATE_LABEL[g] ?? g}
                      </Chip>
                    ))}
                  </div>
                  <form
                    className="mt-2 flex flex-wrap items-end gap-2"
                    data-testid="tag-form"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void run(
                        `tag-${c.id}`,
                        () =>
                          patch(`${base}/class-readiness`, {
                            classId: c.id,
                            classGroupId: tagGroup[c.id] || null,
                          }),
                        '수업을 정리했습니다.'
                      );
                    }}
                  >
                    <div className="min-w-0 flex-1 basis-40">
                      <Field label="수업 그룹 지정">
                        <select
                          required
                          value={tagGroup[c.id] ?? ''}
                          onChange={(e) =>
                            setTagGroup((prev) => ({ ...prev, [c.id]: e.target.value }))
                          }
                          data-testid="tag-group"
                          className={inputClass}
                        >
                          <option value="">그룹 선택</option>
                          {classGroups.map((g) => (
                            <option key={g.id} value={g.id}>
                              {g.name}
                            </option>
                          ))}
                        </select>
                      </Field>
                    </div>
                    <ActionButton type="submit" busy={busy === `tag-${c.id}`} testId="tag-submit">
                      저장
                    </ActionButton>
                  </form>
                </li>
              ))}
            </ul>
          </>
        )}
      </ConsoleCard>
    </ConsolePage>
  );
}
