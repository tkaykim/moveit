"use client";

/**
 * 수업별 예약자 명단 (T9 §1)
 *
 * 인포데스크의 질문 하나 — "이 수업에 누가 오나요?" — 를 한 화면에서 끝낸다.
 * 날짜를 고르면 그 날 회차가 시간순으로 늘어서고, 회차를 펼치면 명단이 나온다.
 */
import { useCallback, useEffect, useState } from 'react';
import { fetchWithAuth } from '@/lib/api/auth-fetch';
import { ChevronDown, ChevronRight, RefreshCw, Users } from 'lucide-react';
import { CopyLinkButton } from '@/components/share/copy-link-button';
import {
  ConsolePage,
  ConsoleCard,
  AllClear,
  Loading,
  ErrorNote,
  Chip,
  ActionButton,
  formatTime,
  inputClass,
} from './console-ui';

interface RosterStudent {
  booking_id: string;
  student_name: string;
  contact: string | null;
  ticket_name: string | null;
  ticket_type: string | null;
  remaining_count: number | null;
  deduction_state: string;
  deduction_label: string;
  attendance_state: string;
  attendance_label: string;
  from_held_order: boolean;
  hold_expires_at: string | null;
  is_admin_added: boolean;
}

interface RosterOccurrence {
  schedule_id: string;
  class_id: string;
  class_title: string;
  instructor_name: string | null;
  start_time: string;
  end_time: string | null;
  is_canceled: boolean;
  max_students: number | null;
  booked_count: number;
  attended_count: number;
  held_count: number;
  students: RosterStudent[];
}

function kstTodayString(): string {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 3600_000);
  return kst.toISOString().slice(0, 10);
}

const ATTENDANCE_TONE: Record<string, 'good' | 'neutral' | 'bad' | 'warn'> = {
  ATTENDED: 'good',
  BOOKED: 'neutral',
  CANCELLED: 'bad',
  PENDING: 'warn',
};

const DEDUCTION_TONE: Record<string, 'good' | 'neutral' | 'warn' | 'info'> = {
  DEDUCTED: 'good',
  NOT_DEDUCTED: 'warn',
  REFUNDED: 'info',
  NONE: 'neutral',
};

export function RosterView({ academyId, slug }: { academyId: string; slug?: string | null }) {
  const [date, setDate] = useState(kstTodayString());
  const [occurrences, setOccurrences] = useState<RosterOccurrence[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [origin, setOrigin] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') setOrigin(window.location.origin);
  }, []);

  // 공개 딥링크의 학원 세그먼트: slug 우선, 없으면 UUID(getAcademyBySlug 가 둘 다 받는다).
  const linkBase = slug || academyId;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchWithAuth(
        `/api/academy-admin/${academyId}/console/roster?date=${date}`
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || '명단을 불러오지 못했습니다.');
      setOccurrences(json.occurrences ?? []);
      // 회차가 하나뿐이면 자동으로 펼친다 — 클릭 한 번을 아낀다
      if ((json.occurrences ?? []).length === 1) {
        setOpen({ [json.occurrences[0].schedule_id]: true });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '명단을 불러오지 못했습니다.');
      setOccurrences([]);
    } finally {
      setLoading(false);
    }
  }, [academyId, date]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <ConsolePage
      title="수업별 예약자 명단"
      description="날짜를 고르면 그 날 수업과 오시는 분들이 보입니다."
      actions={
        <>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            aria-label="날짜 선택"
            data-testid="roster-date"
            className={`${inputClass} w-auto py-1.5`}
          />
          <ActionButton onClick={load} variant="ghost" busy={loading} testId="roster-refresh">
            <RefreshCw size={13} /> 새로고침
          </ActionButton>
        </>
      }
    >
      {error && <ErrorNote message={error} />}

      {loading ? (
        <Loading label="명단 불러오는 중" />
      ) : occurrences.length === 0 ? (
        <ConsoleCard title="이 날의 수업">
          <AllClear message="이 날은 예정된 수업이 없습니다." />
        </ConsoleCard>
      ) : (
        <div className="space-y-3" data-testid="roster-list">
          {occurrences.map((occ) => {
            const isOpen = !!open[occ.schedule_id];
            return (
              <section
                key={occ.schedule_id}
                data-testid="roster-occurrence"
                className="w-full max-w-full rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 overflow-hidden"
              >
                <div className="flex items-start">
                <button
                  type="button"
                  onClick={() => setOpen((p) => ({ ...p, [occ.schedule_id]: !p[occ.schedule_id] }))}
                  className="min-w-0 flex-1 flex items-start gap-2 px-3 sm:px-4 py-3 text-left hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors"
                >
                  {isOpen ? (
                    <ChevronDown size={16} className="mt-0.5 shrink-0 text-neutral-400" />
                  ) : (
                    <ChevronRight size={16} className="mt-0.5 shrink-0 text-neutral-400" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="text-sm font-bold text-neutral-900 dark:text-white">
                        {formatTime(occ.start_time)}
                      </span>
                      <span className="text-sm font-semibold text-neutral-800 dark:text-neutral-100 break-keep">
                        {occ.class_title}
                      </span>
                      {occ.is_canceled && <Chip tone="bad">휴강</Chip>}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-neutral-500 dark:text-neutral-400">
                      {occ.instructor_name && <span className="break-keep">{occ.instructor_name}</span>}
                      <span className="inline-flex items-center gap-1">
                        <Users size={12} /> {occ.booked_count}
                        {occ.max_students ? ` / ${occ.max_students}` : ''}명
                      </span>
                      {occ.attended_count > 0 && <Chip tone="good">출석 {occ.attended_count}</Chip>}
                      {occ.held_count > 0 && <Chip tone="warn">미입금 {occ.held_count}</Chip>}
                    </div>
                  </div>
                </button>
                {/* 이 회차의 공개 신청 링크 복사 — 인스타/카톡에 붙일 한 수업 한 링크 */}
                <div className="pr-2 sm:pr-3 py-3 shrink-0">
                  <CopyLinkButton
                    url={`${origin}/s/${linkBase}/c/${occ.schedule_id}`}
                    testId="roster-copy-link"
                    ariaLabel={`${occ.class_title} 신청 링크 복사`}
                  />
                </div>
                </div>

                {isOpen && (
                  <div className="border-t border-neutral-100 dark:border-neutral-800 p-3 sm:p-4">
                    {occ.students.length === 0 ? (
                      <AllClear message="아직 예약자가 없습니다." />
                    ) : (
                      <ul className="space-y-2">
                        {occ.students.map((s) => (
                          <li
                            key={s.booking_id}
                            data-testid="roster-student"
                            data-student-name={s.student_name}
                            className="w-full max-w-full rounded-lg border border-neutral-200 dark:border-neutral-800 px-3 py-2"
                          >
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                              <span className="text-sm font-semibold text-neutral-900 dark:text-white break-keep">
                                {s.student_name}
                              </span>
                              {s.contact && (
                                <span className="text-xs text-neutral-500 dark:text-neutral-400">
                                  {s.contact}
                                </span>
                              )}
                              {s.is_admin_added && <Chip tone="info">직접 등록</Chip>}
                            </div>
                            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                              <Chip tone="neutral">
                                수강권: {s.ticket_name ?? '없음'}
                                {s.remaining_count != null ? ` (잔여 ${s.remaining_count})` : ''}
                              </Chip>
                              <Chip tone={DEDUCTION_TONE[s.deduction_state] ?? 'neutral'}>
                                {s.deduction_label}
                              </Chip>
                              <Chip tone={ATTENDANCE_TONE[s.attendance_state] ?? 'neutral'}>
                                {s.attendance_label}
                              </Chip>
                              {s.from_held_order && (
                                <Chip tone="warn">미입금 예약 (입금 확인 필요)</Chip>
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </ConsolePage>
  );
}
