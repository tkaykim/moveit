"use client";

/**
 * 멤버십 관리 (T9 §3)
 *
 * 세 갈래를 한 화면에서:
 *   1) 멤버십 정의 — 만들기·수정, 할인·커버리지 혜택 관리
 *   2) 학생별 멤버십 — 부여 / 연장 / 일시정지 / 재개
 *   3) 만료 멤버십 검토 큐 — 읽기 전용 목록이 아니라 **처리 가능한** 목록
 *
 * ⚠ 혜택 제거는 언제나 소프트(is_active=false). 행은 남는다 — 지난 결제의 근거이기 때문이다.
 */
import { useCallback, useEffect, useState } from 'react';
import { fetchWithAuth } from '@/lib/api/auth-fetch';
import { RefreshCw, Plus, Pause, Play, CalendarPlus, Check } from 'lucide-react';
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
  formatDateTime,
} from './console-ui';

interface Membership {
  id: string;
  key: string;
  name: string;
  visibility: 'hidden' | 'locked';
  is_active: boolean;
  bundled_ticket_id: string | null;
  perks_text: string[] | null;
  description: string | null;
}

interface Discount {
  id: string;
  class_group_id: string | null;
  ticket_id: string | null;
  percent: number;
  is_active: boolean;
}

interface StudentMembership {
  id: string;
  user_id: string;
  membership_id: string;
  status: string;
  start_date: string | null;
  end_date: string | null;
  memberships?: { name?: string } | null;
}

interface ReviewRow {
  student_membership_id: string;
  user_id: string;
  student_name: string | null;
  membership_name: string;
  membership_end_date: string | null;
  booking_id: string;
  class_title: string | null;
  schedule_start_time: string;
  last_action: string | null;
  last_handled_at: string | null;
  last_handled_by: string | null;
}

interface Ref {
  id: string;
  name: string;
}

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: '이용 중',
  SUSPENDED: '일시정지',
  EXPIRED: '만료',
};

const ACTION_LABEL: Record<string, string> = {
  ACKNOWLEDGED: '확인함',
  CONTACTED: '연락함',
  RESOLVED: '처리 완료',
  DISMISSED: '넘어감',
};

export function MembershipsView({ academyId }: { academyId: string }) {
  const base = `/api/academy-admin/${academyId}`;

  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [students, setStudents] = useState<StudentMembership[]>([]);
  const [queue, setQueue] = useState<ReviewRow[]>([]);
  const [tickets, setTickets] = useState<Ref[]>([]);
  const [classGroups, setClassGroups] = useState<Ref[]>([]);
  const [roster, setRoster] = useState<{ user_id: string; name: string }[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  // 멤버십 만들기 폼
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newKey, setNewKey] = useState('');
  const [newVisibility, setNewVisibility] = useState<'hidden' | 'locked'>('locked');
  const [newBundled, setNewBundled] = useState('');
  const [newPerks, setNewPerks] = useState('');

  // 선택된 멤버십의 혜택
  const [selected, setSelected] = useState<string | null>(null);
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [discountPercent, setDiscountPercent] = useState('10');
  const [discountGroup, setDiscountGroup] = useState('');

  // 부여 폼
  const [grantUser, setGrantUser] = useState('');
  const [grantMembership, setGrantMembership] = useState('');
  const [grantEnd, setGrantEnd] = useState('');

  const say = (e: unknown, fallback: string) =>
    setError(e instanceof Error ? e.message : fallback);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [mRes, sRes, qRes, rRes, stRes] = await Promise.all([
        fetchWithAuth(`${base}/memberships?includeInactive=true`),
        fetchWithAuth(`${base}/memberships/students`),
        // 처리한 건도 함께 — 누가 언제 처리했는지가 화면에 남아야 한다
        fetchWithAuth(`${base}/memberships/review-queue?includeHandled=true`),
        fetchWithAuth(`${base}/console/refs`),
        fetchWithAuth(`${base}/console/students`),
      ]);
      const [m, s, q, r, st] = await Promise.all([
        mRes.json(),
        sRes.json(),
        qRes.json(),
        rRes.json(),
        stRes.json(),
      ]);
      if (!mRes.ok) throw new Error(m?.error || '멤버십을 불러오지 못했습니다.');
      setMemberships(m.memberships ?? []);
      setStudents(sRes.ok ? (s.students ?? []) : []);
      setQueue(qRes.ok ? (q.queue ?? []) : []);
      setTickets(rRes.ok ? (r.tickets ?? []) : []);
      setClassGroups(rRes.ok ? (r.classGroups ?? []) : []);
      setRoster(
        stRes.ok ? (st.students ?? []).map((x: any) => ({ user_id: x.user_id, name: x.name })) : []
      );
    } catch (e) {
      say(e, '불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [base]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const loadDiscounts = useCallback(
    async (membershipId: string) => {
      try {
        const res = await fetchWithAuth(`${base}/memberships/${membershipId}/discounts`);
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || '혜택을 불러오지 못했습니다.');
        setDiscounts(json.discounts ?? []);
      } catch (e) {
        say(e, '혜택을 불러오지 못했습니다.');
      }
    },
    [base]
  );

  const pick = async (id: string) => {
    const next = selected === id ? null : id;
    setSelected(next);
    setDiscounts([]);
    if (next) await loadDiscounts(next);
  };

  /** 공통 실행기 — 성공하면 전체를 다시 읽어 화면이 결과를 반영하게 한다 */
  const run = async (
    key: string,
    fn: () => Promise<Response>,
    after?: () => Promise<void> | void
  ) => {
    setBusy(key);
    setError(null);
    try {
      const res = await fn();
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || '처리에 실패했습니다.');
      await loadAll();
      if (after) await after();
    } catch (e) {
      say(e, '처리에 실패했습니다.');
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

  const nameOfMembership = (id: string) => memberships.find((m) => m.id === id)?.name ?? '—';
  const nameOfStudent = (id: string) => roster.find((r) => r.user_id === id)?.name ?? id.slice(0, 8);

  return (
    <ConsolePage
      title="멤버십 관리"
      description="멤버십을 만들고, 혜택을 정하고, 학생에게 부여합니다."
      actions={
        <ActionButton onClick={loadAll} variant="ghost" busy={loading} testId="memberships-refresh">
          <RefreshCw size={13} /> 새로고침
        </ActionButton>
      }
    >
      {error && <ErrorNote message={error} />}
      {loading && <Loading label="멤버십 불러오는 중" />}

      {/* ---------- 1. 멤버십 정의 ---------- */}
      <ConsoleCard
        title="멤버십 종류"
        count={memberships.length}
        dataTestId="membership-definitions"
        headerRight={
          <ActionButton
            onClick={() => setShowCreate((v) => !v)}
            variant="ghost"
            testId="membership-new-toggle"
          >
            <Plus size={13} /> 새 멤버십
          </ActionButton>
        }
      >
        {showCreate && (
          <form
            data-testid="membership-create-form"
            onSubmit={(e) => {
              e.preventDefault();
              void run(
                'create',
                () =>
                  post(`${base}/memberships`, {
                    key: newKey.trim(),
                    name: newName.trim(),
                    visibility: newVisibility,
                    bundled_ticket_id: newBundled || null,
                    perks_text: newPerks.trim()
                      ? newPerks.split('\n').map((s) => s.trim()).filter(Boolean)
                      : null,
                  }),
                () => {
                  setShowCreate(false);
                  setNewName('');
                  setNewKey('');
                  setNewPerks('');
                  setNewBundled('');
                }
              );
            }}
            className="mb-4 space-y-3 rounded-lg border border-neutral-200 dark:border-neutral-800 p-3"
          >
            <Field label="멤버십 이름">
              <input
                required
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                data-testid="membership-name"
                className={inputClass}
                placeholder="예: 정회원"
              />
            </Field>
            <Field label="식별 코드 (영문·숫자)">
              <input
                required
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
                data-testid="membership-key"
                className={inputClass}
                placeholder="예: regular"
              />
            </Field>
            <Field label="노출 방식">
              <select
                value={newVisibility}
                onChange={(e) => setNewVisibility(e.target.value as 'hidden' | 'locked')}
                data-testid="membership-visibility"
                className={inputClass}
              >
                <option value="locked">잠금 — 목록에 보이되 회원만 신청 가능</option>
                <option value="hidden">숨김 — 회원이 아니면 아예 안 보임</option>
              </select>
            </Field>
            <Field label="함께 지급할 수강권 (선택)">
              <select
                value={newBundled}
                onChange={(e) => setNewBundled(e.target.value)}
                data-testid="membership-bundled"
                className={inputClass}
              >
                <option value="">지급 안 함</option>
                {tickets.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="혜택 안내 (한 줄에 하나)">
              <textarea
                value={newPerks}
                onChange={(e) => setNewPerks(e.target.value)}
                data-testid="membership-perks"
                rows={2}
                className={inputClass}
                placeholder={'예: 전 수업 10% 할인\n예: 우선 예약'}
              />
            </Field>
            <ActionButton type="submit" busy={busy === 'create'} testId="membership-create-submit">
              만들기
            </ActionButton>
          </form>
        )}

        {memberships.length === 0 ? (
          <AllClear message="아직 만든 멤버십이 없습니다." />
        ) : (
          <ul className="space-y-2">
            {memberships.map((m) => (
              <li
                key={m.id}
                data-testid="membership-row"
                data-membership-name={m.name}
                className="w-full max-w-full rounded-lg border border-neutral-200 dark:border-neutral-800"
              >
                <button
                  type="button"
                  onClick={() => void pick(m.id)}
                  className="w-full text-left px-3 py-2.5 hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
                >
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-sm font-bold text-neutral-900 dark:text-white break-keep">
                      {m.name}
                    </span>
                    <Chip tone={m.is_active ? 'good' : 'neutral'}>
                      {m.is_active ? '사용 중' : '사용 안 함'}
                    </Chip>
                    <Chip tone="info">{m.visibility === 'hidden' ? '숨김' : '잠금'}</Chip>
                  </div>
                  {m.perks_text && m.perks_text.length > 0 && (
                    <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400 break-keep">
                      {m.perks_text.join(' · ')}
                    </p>
                  )}
                </button>

                {selected === m.id && (
                  <div
                    className="border-t border-neutral-100 dark:border-neutral-800 p-3 space-y-3"
                    data-testid="membership-detail"
                  >
                    <div className="flex flex-wrap gap-2">
                      <ActionButton
                        variant="ghost"
                        busy={busy === `toggle-${m.id}`}
                        onClick={() =>
                          void run(`toggle-${m.id}`, () =>
                            patch(`${base}/memberships/${m.id}`, { is_active: !m.is_active })
                          )
                        }
                        testId="membership-toggle-active"
                      >
                        {m.is_active ? '사용 안 함으로 내리기' : '다시 사용하기'}
                      </ActionButton>
                    </div>

                    {/* 할인 혜택 */}
                    <div>
                      <h3 className="text-xs font-bold text-neutral-600 dark:text-neutral-400 mb-2">
                        할인 혜택
                      </h3>
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          void run(
                            `disc-add-${m.id}`,
                            () =>
                              post(`${base}/memberships/${m.id}/discounts`, {
                                class_group_id: discountGroup || null,
                                ticket_id: null,
                                percent: Number(discountPercent),
                              }),
                            () => loadDiscounts(m.id)
                          );
                        }}
                        className="flex flex-wrap items-end gap-2 mb-2"
                      >
                        <div className="min-w-0 flex-1 basis-40">
                          <Field label="대상 수업 그룹">
                            <select
                              value={discountGroup}
                              onChange={(e) => setDiscountGroup(e.target.value)}
                              data-testid="discount-group"
                              className={inputClass}
                            >
                              <option value="">전체</option>
                              {classGroups.map((g) => (
                                <option key={g.id} value={g.id}>
                                  {g.name}
                                </option>
                              ))}
                            </select>
                          </Field>
                        </div>
                        <div className="w-24">
                          <Field label="할인율 %">
                            <input
                              type="number"
                              min={0}
                              max={100}
                              value={discountPercent}
                              onChange={(e) => setDiscountPercent(e.target.value)}
                              data-testid="discount-percent"
                              className={inputClass}
                            />
                          </Field>
                        </div>
                        <ActionButton
                          type="submit"
                          busy={busy === `disc-add-${m.id}`}
                          testId="discount-add"
                        >
                          추가
                        </ActionButton>
                      </form>

                      {discounts.length === 0 ? (
                        <AllClear message="설정된 할인이 없습니다." />
                      ) : (
                        <ul className="space-y-1.5" data-testid="discount-list">
                          {discounts.map((d) => (
                            <li
                              key={d.id}
                              data-testid="discount-row"
                              data-discount-id={d.id}
                              data-active={d.is_active ? 'true' : 'false'}
                              className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-neutral-200 dark:border-neutral-800 px-2.5 py-1.5"
                            >
                              <span className="text-xs text-neutral-700 dark:text-neutral-300 break-keep min-w-0">
                                {d.class_group_id
                                  ? (classGroups.find((g) => g.id === d.class_group_id)?.name ??
                                    '수업 그룹')
                                  : '전체 수업'}{' '}
                                · {d.percent}% 할인
                                {!d.is_active && ' (적용 안 함)'}
                              </span>
                              <ActionButton
                                variant="ghost"
                                busy={busy === `disc-${d.id}`}
                                onClick={() =>
                                  void run(
                                    `disc-${d.id}`,
                                    () =>
                                      patch(`${base}/memberships/${m.id}/discounts`, {
                                        discount_id: d.id,
                                        is_active: !d.is_active,
                                      }),
                                    () => loadDiscounts(m.id)
                                  )
                                }
                                testId={d.is_active ? 'discount-deactivate' : 'discount-reactivate'}
                              >
                                {d.is_active ? '적용 중지' : '다시 적용'}
                              </ActionButton>
                            </li>
                          ))}
                        </ul>
                      )}
                      <p className="mt-2 text-[11px] text-neutral-500 dark:text-neutral-400 break-keep">
                        적용을 중지해도 기록은 남습니다. 지난 결제의 근거이기 때문에 삭제하지
                        않습니다.
                      </p>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </ConsoleCard>

      {/* ---------- 2. 학생별 멤버십 ---------- */}
      <ConsoleCard title="학생별 멤버십" count={students.length} dataTestId="student-memberships">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void run(
              'grant',
              () =>
                post(`${base}/memberships/students`, {
                  user_id: grantUser,
                  membership_id: grantMembership,
                  end_date: grantEnd || null,
                }),
              () => {
                setGrantUser('');
                setGrantEnd('');
              }
            );
          }}
          className="mb-4 flex flex-wrap items-end gap-2"
          data-testid="grant-form"
        >
          <div className="min-w-0 flex-1 basis-40">
            <Field label="학생">
              <select
                required
                value={grantUser}
                onChange={(e) => setGrantUser(e.target.value)}
                data-testid="grant-user"
                className={inputClass}
              >
                <option value="">선택</option>
                {roster.map((r) => (
                  <option key={r.user_id} value={r.user_id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="min-w-0 flex-1 basis-40">
            <Field label="멤버십">
              <select
                required
                value={grantMembership}
                onChange={(e) => setGrantMembership(e.target.value)}
                data-testid="grant-membership"
                className={inputClass}
              >
                <option value="">선택</option>
                {memberships
                  .filter((m) => m.is_active)
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
              </select>
            </Field>
          </div>
          <div className="w-40">
            <Field label="종료일 (선택)">
              <input
                type="date"
                value={grantEnd}
                onChange={(e) => setGrantEnd(e.target.value)}
                data-testid="grant-end"
                className={inputClass}
              />
            </Field>
          </div>
          <ActionButton type="submit" busy={busy === 'grant'} testId="grant-submit">
            부여하기
          </ActionButton>
        </form>

        {students.length === 0 ? (
          <AllClear message="아직 멤버십을 가진 학생이 없습니다." />
        ) : (
          <ul className="space-y-2" data-testid="student-membership-list">
            {students.map((sm) => (
              <li
                key={sm.id}
                data-testid="student-membership-row"
                data-student-membership-id={sm.id}
                data-status={sm.status}
                className="w-full max-w-full rounded-lg border border-neutral-200 dark:border-neutral-800 px-3 py-2.5"
              >
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-sm font-bold text-neutral-900 dark:text-white break-keep">
                    {nameOfStudent(sm.user_id)}
                  </span>
                  <Chip tone="info">{sm.memberships?.name ?? nameOfMembership(sm.membership_id)}</Chip>
                  <Chip
                    tone={
                      sm.status === 'ACTIVE' ? 'good' : sm.status === 'SUSPENDED' ? 'warn' : 'neutral'
                    }
                  >
                    {STATUS_LABEL[sm.status] ?? sm.status}
                  </Chip>
                  {sm.end_date && <Chip tone="neutral">~{sm.end_date}</Chip>}
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {sm.status === 'ACTIVE' ? (
                    <ActionButton
                      variant="ghost"
                      busy={busy === `sus-${sm.id}`}
                      onClick={() =>
                        void run(`sus-${sm.id}`, () =>
                          patch(`${base}/memberships/students/${sm.id}`, { action: 'suspend' })
                        )
                      }
                      testId="membership-suspend"
                    >
                      <Pause size={12} /> 일시정지
                    </ActionButton>
                  ) : sm.status === 'SUSPENDED' ? (
                    <ActionButton
                      variant="ghost"
                      busy={busy === `res-${sm.id}`}
                      onClick={() =>
                        void run(`res-${sm.id}`, () =>
                          patch(`${base}/memberships/students/${sm.id}`, { action: 'resume' })
                        )
                      }
                      testId="membership-resume"
                    >
                      <Play size={12} /> 재개
                    </ActionButton>
                  ) : null}
                  <ActionButton
                    variant="ghost"
                    busy={busy === `ext-${sm.id}`}
                    onClick={() => {
                      const from = sm.end_date ? new Date(`${sm.end_date}T00:00:00+09:00`) : new Date();
                      const next = new Date(from.getTime() + 30 * 86400_000);
                      const end = next.toISOString().slice(0, 10);
                      void run(`ext-${sm.id}`, () =>
                        patch(`${base}/memberships/students/${sm.id}`, {
                          action: 'extend',
                          end_date: end,
                          reactivate: sm.status === 'EXPIRED',
                        })
                      );
                    }}
                    testId="membership-extend"
                  >
                    <CalendarPlus size={12} /> 30일 연장
                  </ActionButton>
                </div>
              </li>
            ))}
          </ul>
        )}
      </ConsoleCard>

      {/* ---------- 3. 만료 멤버십 검토 큐 ---------- */}
      <ConsoleCard
        title="확인이 필요한 멤버십"
        count={queue.length}
        tone="warn"
        dataTestId="review-queue"
      >
        <p className="mb-3 text-xs text-neutral-500 dark:text-neutral-400 break-keep">
          멤버십이 끝났는데 회원 전용 수업 예약이 아직 남아 있는 분들입니다. 처리하면 누가 언제
          처리했는지 기록됩니다.
        </p>
        {queue.length === 0 ? (
          <AllClear message="확인이 필요한 멤버십이 없습니다." />
        ) : (
          <ul className="space-y-2" data-testid="review-queue-list">
            {queue.map((row) => (
              <li
                key={`${row.student_membership_id}-${row.booking_id}`}
                data-testid="review-queue-row"
                className="w-full max-w-full rounded-lg border border-amber-200 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-900/10 px-3 py-2.5"
              >
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-sm font-bold text-neutral-900 dark:text-white break-keep">
                    {row.student_name ?? nameOfStudent(row.user_id)}
                  </span>
                  <Chip tone="warn">
                    {row.membership_name} 만료
                    {row.membership_end_date ? ` (${row.membership_end_date})` : ''}
                  </Chip>
                </div>
                <p className="mt-1 text-xs text-neutral-600 dark:text-neutral-400 break-keep">
                  남은 예약: {row.class_title ?? '수업'} · {formatDateTime(row.schedule_start_time)}
                </p>
                {row.last_action ? (
                  <p
                    className="mt-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400 break-keep"
                    data-testid="review-handled"
                  >
                    처리됨: {ACTION_LABEL[row.last_action] ?? row.last_action} ·{' '}
                    {formatDateTime(row.last_handled_at)}
                    {row.last_handled_by ? ` · 담당 ${row.last_handled_by.slice(0, 8)}` : ''}
                  </p>
                ) : (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {(['CONTACTED', 'RESOLVED', 'DISMISSED'] as const).map((action) => (
                      <ActionButton
                        key={action}
                        variant="ghost"
                        busy={busy === `rev-${row.student_membership_id}-${action}`}
                        onClick={() =>
                          void run(`rev-${row.student_membership_id}-${action}`, () =>
                            post(`${base}/memberships/review-queue`, {
                              student_membership_id: row.student_membership_id,
                              booking_id: row.booking_id,
                              action,
                            })
                          )
                        }
                        testId={`review-action-${action}`}
                      >
                        <Check size={12} /> {ACTION_LABEL[action]}
                      </ActionButton>
                    ))}
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
