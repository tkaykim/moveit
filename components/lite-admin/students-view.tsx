'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Search, X, Minus, Plus, Ticket, History, ChevronLeft } from 'lucide-react';
import { fetchWithAuth } from '@/lib/api/auth-fetch';
import { useLiteAdmin } from './context';
import { ticketTypeLabel, isCountType } from './ticket-label';
import { useStudents, filterStudents, type StudentRow, type StudentTicket } from './student-search';
import { OnsiteSheet } from './onsite-sheet';

interface ActivityRow {
  id: string;
  action: string;
  action_label: string;
  note: string | null;
  delta: number | null;
  reason: string | null;
  created_at: string;
  actor_name: string;
}

function ticketStatusLabel(t: StudentTicket): { label: string; tone: string } {
  const today = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
  if ((t.status ?? '').toUpperCase() === 'REFUNDED') return { label: '환불됨', tone: 'bg-neutral-100 text-neutral-400 dark:bg-neutral-800' };
  if (t.not_started) return { label: '미개시', tone: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300' };
  if (t.expiry_date && t.expiry_date < today) return { label: '만료', tone: 'bg-neutral-200 text-neutral-500 dark:bg-neutral-700 dark:text-neutral-400' };
  if ((t.status ?? '').toUpperCase() === 'USED') return { label: '소진', tone: 'bg-neutral-200 text-neutral-500 dark:bg-neutral-700 dark:text-neutral-400' };
  return { label: '유효', tone: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' };
}

const fmtDate = (iso: string) => new Date(iso).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Seoul' });

export function StudentsView() {
  const academy = useLiteAdmin();
  const { all, loading, reload } = useStudents(academy.id);
  const [q, setQ] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activity, setActivity] = useState<ActivityRow[]>([]);
  const [issueOpen, setIssueOpen] = useState(false);
  const [adjust, setAdjust] = useState<{ ticket: StudentTicket; delta: 1 | -1 } | null>(null);

  const results = useMemo(() => filterStudents(all, q), [all, q]);
  const selected = useMemo(() => all.find((s) => s.user_id === selectedId) ?? null, [all, selectedId]);

  const loadActivity = useCallback(async (userId: string) => {
    const res = await fetchWithAuth(`/api/a/${academy.id}/students/activity?user_id=${userId}`, { cache: 'no-store' });
    if (res.ok) setActivity((await res.json()).activity ?? []);
    else setActivity([]);
  }, [academy.id]);

  useEffect(() => {
    if (selectedId) void loadActivity(selectedId);
  }, [selectedId, loadActivity]);

  const refreshSelected = async () => {
    await reload();
    if (selectedId) await loadActivity(selectedId);
  };

  // 상세 화면
  if (selected) {
    return (
      <div className="px-4 pt-4">
        <button
          type="button"
          data-testid="student-back"
          onClick={() => setSelectedId(null)}
          className="inline-flex items-center gap-1 text-[13px] font-bold text-neutral-500 mb-3"
        >
          <ChevronLeft size={16} /> 목록으로
        </button>

        <div className="p-4 rounded-2xl border border-neutral-100 dark:border-neutral-800 bg-white dark:bg-neutral-900 mb-4">
          <div className="flex items-center gap-2">
            <p className="text-[18px] font-extrabold truncate">{selected.name}</p>
            {selected.membership_name && (
              <span className="px-2 py-0.5 rounded text-[11px] font-bold text-white" style={{ backgroundColor: academy.brand }}>
                {selected.membership_name}
              </span>
            )}
          </div>
          {selected.contact && <p className="text-[12px] text-neutral-500 mt-0.5">{selected.contact}</p>}
        </div>

        {/* 보유 수강권 */}
        <h2 className="text-[13px] font-extrabold text-neutral-500 mb-2">보유 수강권</h2>
        {selected.tickets.length === 0 ? (
          <div className="py-6 text-center rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800 mb-4">
            <p className="text-sm text-neutral-400">보유한 수강권이 없어요</p>
          </div>
        ) : (
          <ul className="space-y-2 mb-4" data-testid="student-tickets">
            {selected.tickets.map((t) => {
              const st = ticketStatusLabel(t);
              const count = isCountType(t.ticket_type);
              const canDeduct = count && (t.remaining_count ?? 0) > 0;
              return (
                <li
                  key={t.user_ticket_id}
                  data-testid="student-ticket"
                  data-user-ticket-id={t.user_ticket_id}
                  data-ticket-type={t.ticket_type ?? ''}
                  className="p-3 rounded-xl border border-neutral-100 dark:border-neutral-800 bg-white dark:bg-neutral-900"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-[14px] font-bold truncate">{t.ticket_name}</span>
                    <span className="px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-[10px] font-bold flex-shrink-0" data-testid="ticket-type-label">
                      {ticketTypeLabel(t.ticket_type)}
                    </span>
                    <span className={`ml-auto px-1.5 py-0.5 rounded text-[10px] font-bold flex-shrink-0 ${st.tone}`}>{st.label}</span>
                  </div>
                  <p className="text-[11px] text-neutral-500 mt-1">
                    {count ? (
                      <span data-testid="ticket-remaining">잔여 {t.remaining_count ?? 0}회</span>
                    ) : (
                      <span>기간권</span>
                    )}
                    {t.expiry_date ? ` · ~${t.expiry_date}` : ''}
                    {t.not_started && t.start_date ? ` · ${t.start_date} 시작` : ''}
                  </p>

                  {count && (
                    <div className="flex gap-2 mt-2.5">
                      <button
                        type="button"
                        data-testid="ticket-deduct"
                        disabled={!canDeduct}
                        onClick={() => setAdjust({ ticket: t, delta: -1 })}
                        className="flex-1 h-10 rounded-lg text-[13px] font-bold flex items-center justify-center gap-1 border border-neutral-300 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 disabled:opacity-40"
                      >
                        <Minus size={14} /> 횟수 차감
                      </button>
                      <button
                        type="button"
                        data-testid="ticket-restore"
                        onClick={() => setAdjust({ ticket: t, delta: 1 })}
                        className="flex-1 h-10 rounded-lg text-[13px] font-bold flex items-center justify-center gap-1 text-white"
                        style={{ backgroundColor: academy.brand }}
                      >
                        <Plus size={14} /> 복구
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {/* 수동 발급 */}
        <button
          type="button"
          data-testid="student-issue-open"
          onClick={() => setIssueOpen(true)}
          className="w-full h-11 mb-5 rounded-xl font-bold text-[14px] flex items-center justify-center gap-1.5 border border-neutral-200 dark:border-neutral-700"
          style={{ color: academy.brand }}
        >
          <Ticket size={16} /> 수강권 수동 발급
        </button>

        {/* 최근 활동 */}
        <h2 className="text-[13px] font-extrabold text-neutral-500 mb-2 flex items-center gap-1">
          <History size={14} /> 최근 활동
        </h2>
        {activity.length === 0 ? (
          <p className="py-4 text-center text-[13px] text-neutral-400">기록이 없어요</p>
        ) : (
          <ul className="space-y-1.5" data-testid="student-activity">
            {activity.map((a) => (
              <li key={a.id} className="p-2.5 rounded-lg bg-neutral-50 dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-bold">{a.action_label}</span>
                  {typeof a.delta === 'number' && a.delta !== 0 && (
                    <span className={`text-[12px] font-bold ${a.delta > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                      {a.delta > 0 ? `+${a.delta}` : a.delta}
                    </span>
                  )}
                  <span className="ml-auto text-[11px] text-neutral-400">{fmtDate(a.created_at)}</span>
                </div>
                <p className="text-[11px] text-neutral-500 mt-0.5">
                  {a.reason || a.note ? `${a.reason || a.note} · ` : ''}
                  {a.actor_name}
                </p>
              </li>
            ))}
          </ul>
        )}

        {adjust && (
          <AdjustDialog
            academyId={academy.id}
            brand={academy.brand}
            ticket={adjust.ticket}
            delta={adjust.delta}
            onClose={() => setAdjust(null)}
            onDone={async () => {
              setAdjust(null);
              await refreshSelected();
            }}
          />
        )}
        {issueOpen && (
          <OnsiteSheet
            academyId={academy.id}
            brand={academy.brand}
            presetStudent={selected}
            title={`${selected.name} 수강권 발급`}
            onClose={() => setIssueOpen(false)}
            onDone={refreshSelected}
          />
        )}
      </div>
    );
  }

  // 검색 목록
  return (
    <div className="px-4 pt-4">
      <div className="relative mb-3">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
        <input
          data-testid="students-search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="이름 · 전화번호로 검색"
          className="w-full h-12 pl-9 pr-9 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-[15px]"
        />
        {q && (
          <button type="button" aria-label="지우기" onClick={() => setQ('')} className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-full bg-neutral-100 dark:bg-neutral-800">
            <X size={14} />
          </button>
        )}
      </div>

      {loading ? (
        <p className="py-16 text-center text-sm text-neutral-400">불러오는 중...</p>
      ) : !q.trim() ? (
        <p className="py-16 text-center text-sm text-neutral-400">이름 또는 전화번호로 학생을 찾아요</p>
      ) : results.length === 0 ? (
        <p className="py-16 text-center text-sm text-neutral-400">검색 결과가 없어요</p>
      ) : (
        <ul className="space-y-2" data-testid="students-results">
          {results.map((s) => (
            <li key={s.user_id}>
              <button
                type="button"
                data-testid="student-open"
                data-user-id={s.user_id}
                onClick={() => setSelectedId(s.user_id)}
                className="w-full text-left p-3.5 rounded-2xl border border-neutral-100 dark:border-neutral-800 bg-white dark:bg-neutral-900 active:scale-[0.99] transition-transform"
              >
                <div className="flex items-center gap-2">
                  <span className="text-[15px] font-bold truncate">{s.name}</span>
                  {s.membership_name && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold text-white flex-shrink-0" style={{ backgroundColor: academy.brand }}>
                      {s.membership_name}
                    </span>
                  )}
                  <span className="ml-auto text-[11px] font-semibold text-neutral-400 flex-shrink-0">수강권 {s.active_ticket_count}</span>
                </div>
                {s.contact && <p className="text-[11px] text-neutral-500 mt-0.5 truncate">{s.contact}</p>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** 횟수 차감/복구 — 사유 필수. 기존 검증된 adjust-ticket-count 경로(감사 로그 포함)를 그대로 쓴다. */
function AdjustDialog({
  academyId,
  brand,
  ticket,
  delta,
  onClose,
  onDone,
}: {
  academyId: string;
  brand: string;
  ticket: StudentTicket;
  delta: 1 | -1;
  onClose: () => void;
  onDone: () => void;
}) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const isDeduct = delta < 0;

  const submit = async () => {
    if (busy) return;
    if (!reason.trim()) return setErr('사유를 입력해 주세요.');
    setBusy(true);
    setErr(null);
    try {
      const res = await fetchWithAuth(`/api/academy-admin/${academyId}/adjust-ticket-count`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ user_ticket_id: ticket.user_ticket_id, delta, reason: reason.trim() }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(json?.error || '처리에 실패했어요.');
        return;
      }
      onDone();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" data-testid="adjust-dialog">
      <button type="button" aria-label="닫기" className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute inset-x-0 bottom-0 mx-auto max-w-lg bg-white dark:bg-neutral-950 rounded-t-3xl" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)' }}>
        <div className="px-5 pt-5 pb-4">
          <p className="text-[17px] font-extrabold">{isDeduct ? '횟수 차감' : '횟수 복구'} (1회)</p>
          <p className="text-[13px] text-neutral-500 mt-1">
            {ticket.ticket_name} · 현재 잔여 {ticket.remaining_count ?? 0}회 → {(ticket.remaining_count ?? 0) + delta}회
          </p>
          <label className="block text-[12px] font-bold text-neutral-500 mt-4 mb-1.5">사유 (필수)</label>
          <input
            data-testid="adjust-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={isDeduct ? '예: 현장 수동 출석' : '예: 오차감 복구'}
            className="w-full h-12 px-3 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-[15px]"
          />
          {err && <p className="text-[13px] font-semibold text-red-500 mt-2" data-testid="adjust-error">{err}</p>}
          <div className="flex gap-2 mt-5">
            <button type="button" onClick={onClose} className="flex-1 h-12 rounded-xl font-bold text-[15px] border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300">
              취소
            </button>
            <button
              type="button"
              data-testid="adjust-submit"
              disabled={busy}
              onClick={submit}
              className="flex-1 h-12 rounded-xl font-extrabold text-white text-[15px] disabled:opacity-50"
              style={{ backgroundColor: brand }}
            >
              {busy ? '처리 중...' : isDeduct ? '차감' : '복구'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
