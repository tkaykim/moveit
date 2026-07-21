'use client';

import { useCallback, useEffect, useState } from 'react';
import { Star, EyeOff, ChevronDown, UserPlus, CalendarPlus, PauseCircle, PlayCircle, CalendarClock, AlertTriangle, X } from 'lucide-react';
import { fetchWithAuth } from '@/lib/api/auth-fetch';
import { useLiteAdmin } from './context';
import { StudentPicker, type StudentRow } from './student-search';

interface Membership {
  id: string;
  name: string;
  visibility: 'hidden' | 'locked';
  is_active: boolean;
  bundled_ticket_id: string | null;
  member_count: number;
}
interface Member {
  id: string;
  user_id: string;
  membership_id: string;
  status: string;
  start_date: string | null;
  end_date: string | null;
  student_name: string;
  contact: string | null;
}
interface ReviewRow {
  student_membership_id: string;
  student_name: string | null;
  membership_name: string;
  class_title: string | null;
  schedule_start_time: string;
  booking_id: string;
}

const STATUS_TONE: Record<string, string> = {
  ACTIVE: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  SUSPENDED: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  EXPIRED: 'bg-neutral-200 text-neutral-500 dark:bg-neutral-700 dark:text-neutral-400',
};
const STATUS_LABEL: Record<string, string> = { ACTIVE: '유효', SUSPENDED: '정지', EXPIRED: '만료' };

function kstTodayStr(): string {
  return new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
}
const fmtDateTime = (iso: string) => new Date(iso).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Seoul' });

export function MembershipsView() {
  const academy = useLiteAdmin();
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [queue, setQueue] = useState<ReviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [grantFor, setGrantFor] = useState<Membership | null>(null);
  const [evalFor, setEvalFor] = useState<Membership | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuth(`/api/a/${academy.id}/pro`, { cache: 'no-store' });
      if (res.ok) {
        const j = await res.json();
        setMemberships(j.memberships ?? []);
        setMembers(j.members ?? []);
        setQueue(j.reviewQueue ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [academy.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const patchMember = async (key: string, id: string, body: Record<string, unknown>) => {
    if (busy) return;
    setBusy(key);
    setError(null);
    try {
      const res = await fetchWithAuth(`/api/academy-admin/${academy.id}/memberships/students/${id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) setError(json?.error || '처리에 실패했어요.');
      await load();
    } finally {
      setBusy(null);
    }
  };

  const handleReview = async (row: ReviewRow, action: 'RESOLVED' | 'DISMISSED') => {
    const key = `review-${row.student_membership_id}-${row.booking_id}`;
    if (busy) return;
    setBusy(key);
    setError(null);
    try {
      const res = await fetchWithAuth(`/api/academy-admin/${academy.id}/memberships/review-queue`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ student_membership_id: row.student_membership_id, booking_id: row.booking_id, action }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) setError(json?.error || '처리에 실패했어요.');
      await load();
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="px-4 pt-4">
      {error && <p className="mb-3 text-[13px] font-semibold text-red-500" data-testid="pro-error">{error}</p>}

      {/* 만료 처리 큐 */}
      {queue.length > 0 && (
        <section className="mb-5" data-testid="review-section">
          <h2 className="text-[13px] font-extrabold text-amber-600 dark:text-amber-400 mb-2 flex items-center gap-1">
            <AlertTriangle size={14} /> 만료 처리 큐 {queue.length}
          </h2>
          <ul className="space-y-2" data-testid="review-list">
            {queue.map((r) => (
              <li
                key={`${r.student_membership_id}-${r.booking_id}`}
                data-testid="review-row"
                data-sm-id={r.student_membership_id}
                className="p-3 rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-900/10"
              >
                <p className="text-[14px] font-bold">{r.student_name || '학생'}</p>
                <p className="text-[11px] text-neutral-500 mt-0.5">
                  {r.membership_name} 만료 · {r.class_title ?? '수업'} {fmtDateTime(r.schedule_start_time)}
                </p>
                <div className="flex gap-2 mt-2">
                  <button
                    type="button"
                    data-testid="review-keep"
                    disabled={!!busy}
                    onClick={() => handleReview(r, 'RESOLVED')}
                    className="flex-1 h-10 rounded-lg text-[13px] font-bold text-white disabled:opacity-50"
                    style={{ backgroundColor: academy.brand }}
                  >
                    유지
                  </button>
                  <button
                    type="button"
                    data-testid="review-cancel"
                    disabled={!!busy}
                    onClick={() => handleReview(r, 'DISMISSED')}
                    className="flex-1 h-10 rounded-lg text-[13px] font-bold border border-neutral-300 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 disabled:opacity-50"
                  >
                    취소 처리
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 멤버십 목록 */}
      <h2 className="text-[13px] font-extrabold text-neutral-500 mb-2 flex items-center gap-1">
        <Star size={14} /> 전문반
      </h2>
      {loading ? (
        <p className="py-16 text-center text-sm text-neutral-400">불러오는 중...</p>
      ) : memberships.length === 0 ? (
        <div className="py-16 text-center rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800">
          <p className="text-sm text-neutral-400">등록된 전문반이 없어요</p>
        </div>
      ) : (
        <ul className="space-y-2.5" data-testid="membership-list">
          {memberships.map((m) => {
            const roster = members.filter((x) => x.membership_id === m.id);
            const open = expanded === m.id;
            return (
              <li
                key={m.id}
                data-testid="membership-card"
                data-membership-id={m.id}
                className="rounded-2xl border border-neutral-100 dark:border-neutral-800 bg-white dark:bg-neutral-900 overflow-hidden"
              >
                <button
                  type="button"
                  data-testid="membership-toggle"
                  onClick={() => setExpanded(open ? null : m.id)}
                  className="w-full text-left p-4 flex items-center gap-2"
                >
                  <span className="text-[15px] font-extrabold truncate">{m.name}</span>
                  {m.visibility === 'hidden' && (
                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-[10px] font-bold text-neutral-500">
                      <EyeOff size={9} /> 숨김
                    </span>
                  )}
                  {!m.is_active && (
                    <span className="px-1.5 py-0.5 rounded bg-neutral-200 dark:bg-neutral-700 text-[10px] font-bold text-neutral-500">비활성</span>
                  )}
                  <span className="ml-auto text-[13px] font-extrabold tabular-nums flex-shrink-0" style={{ color: academy.brand }} data-testid="membership-count">
                    {m.member_count}명
                  </span>
                  <ChevronDown size={16} className={`text-neutral-400 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
                </button>

                {open && (
                  <div className="px-4 pb-4">
                    <div className="flex gap-2 mb-3">
                      <button
                        type="button"
                        data-testid="membership-grant-open"
                        onClick={() => setGrantFor(m)}
                        className="flex-1 h-10 rounded-lg text-[13px] font-bold text-white flex items-center justify-center gap-1"
                        style={{ backgroundColor: academy.brand }}
                      >
                        <UserPlus size={14} /> 부여
                      </button>
                      <button
                        type="button"
                        data-testid="membership-eval-open"
                        onClick={() => setEvalFor(m)}
                        className="flex-1 h-10 rounded-lg text-[13px] font-bold border border-neutral-200 dark:border-neutral-700 flex items-center justify-center gap-1"
                        style={{ color: academy.brand }}
                      >
                        <CalendarPlus size={14} /> 월평가
                      </button>
                    </div>

                    {roster.length === 0 ? (
                      <p className="py-4 text-center text-[13px] text-neutral-400">아직 소속 학생이 없어요</p>
                    ) : (
                      <ul className="space-y-2" data-testid="membership-roster">
                        {roster.map((mem) => {
                          const su = (mem.status ?? '').toUpperCase();
                          return (
                            <li
                              key={mem.id}
                              data-testid="membership-member"
                              data-sm-id={mem.id}
                              data-status={su}
                              className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800"
                            >
                              <div className="flex items-center gap-2">
                                <span className="text-[14px] font-bold truncate">{mem.student_name}</span>
                                <span className={`ml-auto px-1.5 py-0.5 rounded text-[10px] font-bold flex-shrink-0 ${STATUS_TONE[su] ?? ''}`}>
                                  {STATUS_LABEL[su] ?? su}
                                </span>
                              </div>
                              <p className="text-[11px] text-neutral-500 mt-0.5">
                                {mem.start_date ?? '?'} ~ {mem.end_date ?? '무기한'}
                              </p>
                              <div className="flex gap-2 mt-2">
                                <ExtendButton
                                  disabled={!!busy}
                                  onExtend={(d) => patchMember(`extend-${mem.id}`, mem.id, { action: 'extend', end_date: d, reactivate: false })}
                                />
                                {su === 'SUSPENDED' ? (
                                  <button
                                    type="button"
                                    data-testid="member-resume"
                                    disabled={!!busy}
                                    onClick={() => patchMember(`resume-${mem.id}`, mem.id, { action: 'resume' })}
                                    className="flex-1 h-9 rounded-lg text-[12px] font-bold flex items-center justify-center gap-1 text-white disabled:opacity-50"
                                    style={{ backgroundColor: academy.brand }}
                                  >
                                    <PlayCircle size={13} /> 재개
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    data-testid="member-suspend"
                                    disabled={!!busy || su === 'EXPIRED'}
                                    onClick={() => patchMember(`suspend-${mem.id}`, mem.id, { action: 'suspend' })}
                                    className="flex-1 h-9 rounded-lg text-[12px] font-bold flex items-center justify-center gap-1 border border-neutral-300 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 disabled:opacity-40"
                                  >
                                    <PauseCircle size={13} /> 정지
                                  </button>
                                )}
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {grantFor && (
        <GrantSheet
          academyId={academy.id}
          brand={academy.brand}
          membership={grantFor}
          onClose={() => setGrantFor(null)}
          onDone={async () => {
            setGrantFor(null);
            await load();
          }}
        />
      )}
      {evalFor && (
        <MonthEvalSheet
          academyId={academy.id}
          brand={academy.brand}
          membership={evalFor}
          onClose={() => setEvalFor(null)}
          onDone={() => setEvalFor(null)}
        />
      )}
    </div>
  );
}

/** 연장 — end_date 를 입력받아 PATCH extend */
function ExtendButton({ disabled, onExtend }: { disabled: boolean; onExtend: (endDate: string) => void }) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState('');
  if (!open) {
    return (
      <button
        type="button"
        data-testid="member-extend-open"
        disabled={disabled}
        onClick={() => setOpen(true)}
        className="flex-1 h-9 rounded-lg text-[12px] font-bold flex items-center justify-center gap-1 border border-neutral-300 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 disabled:opacity-40"
      >
        <CalendarClock size={13} /> 연장
      </button>
    );
  }
  return (
    <div className="flex-1 flex gap-1">
      <input
        type="date"
        data-testid="member-extend-date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        className="flex-1 h-9 px-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-[12px]"
      />
      <button
        type="button"
        data-testid="member-extend-apply"
        disabled={disabled || !date}
        onClick={() => { onExtend(date); setOpen(false); }}
        className="px-2 h-9 rounded-lg text-[12px] font-bold text-white disabled:opacity-40"
        style={{ backgroundColor: 'var(--primary)' }}
      >
        적용
      </button>
    </div>
  );
}

/** 멤버십 부여 — 학생 검색 + 시작/종료일. 번들 수강권은 RPC 가 자동 발급한다. */
function GrantSheet({
  academyId,
  brand,
  membership,
  onClose,
  onDone,
}: {
  academyId: string;
  brand: string;
  membership: Membership;
  onClose: () => void;
  onDone: () => void;
}) {
  const [student, setStudent] = useState<StudentRow | null>(null);
  const [startDate, setStartDate] = useState(kstTodayStr());
  const [endDate, setEndDate] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    if (busy) return;
    if (!student) return setErr('학생을 선택해 주세요.');
    setBusy(true);
    setErr(null);
    try {
      const res = await fetchWithAuth(`/api/academy-admin/${academyId}/memberships/students`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          user_id: student.user_id,
          membership_id: membership.id,
          start_date: startDate || null,
          end_date: endDate || null,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(json?.error || '부여에 실패했어요.');
        return;
      }
      onDone();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" data-testid="grant-sheet">
      <button type="button" aria-label="닫기" className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute inset-x-0 bottom-0 mx-auto max-w-lg bg-white dark:bg-neutral-950 rounded-t-3xl max-h-[92dvh] flex flex-col">
        <div className="px-5 pt-4 pb-3 border-b border-neutral-100 dark:border-neutral-800 flex items-center">
          <p className="text-[17px] font-extrabold truncate">{membership.name} 부여</p>
          <button type="button" aria-label="닫기" onClick={onClose} className="ml-auto w-9 h-9 flex items-center justify-center rounded-full bg-neutral-100 dark:bg-neutral-800">
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {student ? (
            <div className="flex items-center gap-2 p-3 rounded-xl border border-neutral-100 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900">
              <span className="text-[15px] font-bold truncate">{student.name}</span>
              <button type="button" onClick={() => setStudent(null)} className="ml-auto text-[12px] font-bold" style={{ color: brand }}>
                변경
              </button>
            </div>
          ) : (
            <StudentPicker academyId={academyId} brand={brand} onPick={setStudent} testId="grant-student" />
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[12px] font-bold text-neutral-500 mb-1.5">시작일</label>
              <input type="date" data-testid="grant-start" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full h-12 px-3 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-[15px]" />
            </div>
            <div>
              <label className="block text-[12px] font-bold text-neutral-500 mb-1.5">종료일 (선택)</label>
              <input type="date" data-testid="grant-end" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full h-12 px-3 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-[15px]" />
            </div>
          </div>
          {err && <p className="text-[13px] font-semibold text-red-500" data-testid="grant-error">{err}</p>}
        </div>
        <div className="px-5 py-3 border-t border-neutral-100 dark:border-neutral-800" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 12px)' }}>
          <button type="button" data-testid="grant-submit" disabled={busy} onClick={submit} className="w-full h-12 rounded-xl font-extrabold text-white text-[15px] disabled:opacity-50" style={{ backgroundColor: brand }}>
            {busy ? '처리 중...' : '멤버십 부여'}
          </button>
        </div>
      </div>
    </div>
  );
}

/** 월평가 빠른 개설 — 멤버십 전용 회차 1개. Phase 1 수업 추가 API 재사용(audienceMembershipId 프리셋). */
function MonthEvalSheet({
  academyId,
  brand,
  membership,
  onClose,
  onDone,
}: {
  academyId: string;
  brand: string;
  membership: Membership;
  onClose: () => void;
  onDone: () => void;
}) {
  const [groups, setGroups] = useState<{ id: string; name: string; is_special: boolean }[]>([]);
  const [title, setTitle] = useState(`${membership.name} 월평가`);
  const [classGroupId, setClassGroupId] = useState('');
  const [date, setDate] = useState(kstTodayStr());
  const [startTime, setStartTime] = useState('19:00');
  const [endTime, setEndTime] = useState('20:30');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    (async () => {
      const res = await fetchWithAuth(`/api/a/${academyId}/refs`, { cache: 'no-store' });
      if (res.ok) setGroups((await res.json()).classGroups ?? []);
    })();
  }, [academyId]);

  const submit = async () => {
    if (busy) return;
    if (!classGroupId) return setErr('수업군을 선택해 주세요.');
    setBusy(true);
    setErr(null);
    try {
      const res = await fetchWithAuth(`/api/a/${academyId}/classes`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          title: title.trim() || `${membership.name} 월평가`,
          classGroupId,
          date,
          startTime,
          endTime,
          audienceMembershipId: membership.id,
          repeatWeeks: 1,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(json?.error || '개설에 실패했어요.');
        return;
      }
      setDone(true);
      onDone();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" data-testid="eval-sheet">
      <button type="button" aria-label="닫기" className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute inset-x-0 bottom-0 mx-auto max-w-lg bg-white dark:bg-neutral-950 rounded-t-3xl max-h-[92dvh] flex flex-col">
        <div className="px-5 pt-4 pb-3 border-b border-neutral-100 dark:border-neutral-800 flex items-center">
          <p className="text-[17px] font-extrabold">월평가 개설 (전문반 전용)</p>
          <button type="button" aria-label="닫기" onClick={onClose} className="ml-auto w-9 h-9 flex items-center justify-center rounded-full bg-neutral-100 dark:bg-neutral-800">
            <X size={18} />
          </button>
        </div>
        {done ? (
          <div className="px-6 py-12 text-center" data-testid="eval-done">
            <p className="text-[16px] font-extrabold">개설 완료</p>
            <p className="text-sm text-neutral-500 mt-1">{membership.name} 소속만 예약할 수 있어요.</p>
            <button type="button" onClick={onClose} className="mt-6 w-full h-12 rounded-xl font-extrabold text-white text-[15px]" style={{ backgroundColor: brand }}>
              닫기
            </button>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              <div>
                <label className="block text-[12px] font-bold text-neutral-500 mb-1.5">제목</label>
                <input data-testid="eval-title" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full h-12 px-3 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-[15px]" />
              </div>
              <div>
                <label className="block text-[12px] font-bold text-neutral-500 mb-1.5">수업군 (예약 열림에 필수)</label>
                <select data-testid="eval-group" value={classGroupId} onChange={(e) => setClassGroupId(e.target.value)} className="w-full h-12 px-3 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-[15px]">
                  <option value="">선택해 주세요</option>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>{g.name}{g.is_special ? ' (특별)' : ''}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[12px] font-bold text-neutral-500 mb-1.5">날짜</label>
                <input type="date" data-testid="eval-date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full h-12 px-3 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-[15px]" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] font-bold text-neutral-500 mb-1.5">시작</label>
                  <input type="time" data-testid="eval-start" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="w-full h-12 px-3 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-[15px]" />
                </div>
                <div>
                  <label className="block text-[12px] font-bold text-neutral-500 mb-1.5">종료</label>
                  <input type="time" data-testid="eval-end" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="w-full h-12 px-3 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-[15px]" />
                </div>
              </div>
              {err && <p className="text-[13px] font-semibold text-red-500" data-testid="eval-error">{err}</p>}
            </div>
            <div className="px-5 py-3 border-t border-neutral-100 dark:border-neutral-800" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 12px)' }}>
              <button type="button" data-testid="eval-submit" disabled={busy} onClick={submit} className="w-full h-12 rounded-xl font-extrabold text-white text-[15px] disabled:opacity-50" style={{ backgroundColor: brand }}>
                {busy ? '개설 중...' : '월평가 개설'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
