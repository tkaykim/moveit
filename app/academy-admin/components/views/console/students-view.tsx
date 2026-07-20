"use client";

/**
 * 수강생 목록 (T9 §2)
 *
 * ⚠ 이 화면은 **한 번의 요청**으로 전체를 채운다.
 *   학생 1명당 요청 1개(N+1)는 결함이다 — 수강생 200명 학원에서 화면이 죽는다.
 *   집계는 서버(lib/db/operator-console.ts)가 고정 쿼리 수로 처리한다.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchWithAuth } from '@/lib/api/auth-fetch';
import { RefreshCw, Search } from 'lucide-react';
import {
  ConsolePage,
  ConsoleCard,
  AllClear,
  Loading,
  ErrorNote,
  Chip,
  ActionButton,
  inputClass,
} from './console-ui';

interface TicketSummary {
  user_ticket_id: string;
  ticket_name: string;
  remaining_count: number | null;
  expiry_date: string | null;
  status: string | null;
  not_started: boolean;
}

export interface StudentRow {
  user_id: string;
  name: string;
  contact: string | null;
  tickets: TicketSummary[];
  active_ticket_count: number;
  membership_name: string | null;
  membership_status: string | null;
  membership_end_date: string | null;
  student_membership_id: string | null;
}

const MEMBERSHIP_LABEL: Record<string, string> = {
  ACTIVE: '이용 중',
  SUSPENDED: '일시정지',
  EXPIRED: '만료',
};

export function ConsoleStudentsView({ academyId }: { academyId: string }) {
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // 딱 한 번. 학생 수와 무관하게 요청은 이것뿐이다.
      const res = await fetchWithAuth(`/api/academy-admin/${academyId}/console/students`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || '수강생을 불러오지 못했습니다.');
      setStudents(json.students ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : '수강생을 불러오지 못했습니다.');
      setStudents([]);
    } finally {
      setLoading(false);
    }
  }, [academyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return students;
    return students.filter(
      (s) => s.name.toLowerCase().includes(q) || (s.contact ?? '').toLowerCase().includes(q)
    );
  }, [students, query]);

  return (
    <ConsolePage
      title="수강생 목록"
      description="보유 수강권(잔여·기간·시작 전)과 현재 멤버십을 함께 봅니다."
      actions={
        <ActionButton onClick={load} variant="ghost" busy={loading} testId="students-refresh">
          <RefreshCw size={13} /> 새로고침
        </ActionButton>
      }
    >
      {error && <ErrorNote message={error} />}

      <div className="relative w-full max-w-full sm:max-w-xs">
        <Search
          size={15}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none"
        />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="이름·연락처로 찾기"
          aria-label="수강생 검색"
          data-testid="students-search"
          className={`${inputClass} pl-9`}
        />
      </div>

      <ConsoleCard title="수강생" count={filtered.length} dataTestId="students-card">
        {loading ? (
          <Loading label="수강생 불러오는 중" />
        ) : filtered.length === 0 ? (
          <AllClear
            message={
              students.length === 0
                ? '아직 등록된 수강생이 없습니다.'
                : '검색 조건에 맞는 수강생이 없습니다.'
            }
          />
        ) : (
          <ul className="space-y-2" data-testid="students-list">
            {filtered.map((s) => (
              <li
                key={s.user_id}
                data-testid="student-row"
                data-student-id={s.user_id}
                className="w-full max-w-full rounded-lg border border-neutral-200 dark:border-neutral-800 px-3 py-2.5"
              >
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="text-sm font-bold text-neutral-900 dark:text-white break-keep">
                    {s.name}
                  </span>
                  {s.contact && (
                    <span className="text-xs text-neutral-500 dark:text-neutral-400">
                      {s.contact}
                    </span>
                  )}
                </div>

                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <span
                    className="contents"
                    data-testid="student-membership"
                    data-membership={s.membership_name ?? ''}
                    data-membership-status={s.membership_status ?? ''}
                  >
                    {s.membership_name ? (
                      <Chip tone={s.membership_status === 'ACTIVE' ? 'good' : 'warn'}>
                        멤버십: {s.membership_name} ·{' '}
                        {MEMBERSHIP_LABEL[s.membership_status ?? ''] ?? s.membership_status}
                        {s.membership_end_date ? ` (~${s.membership_end_date})` : ''}
                      </Chip>
                    ) : (
                      <Chip tone="neutral">멤버십 없음</Chip>
                    )}
                  </span>
                </div>

                <div className="mt-1.5 flex flex-wrap items-center gap-1.5" data-testid="student-tickets">
                  {s.tickets.length === 0 ? (
                    <Chip tone="neutral">보유 수강권 없음</Chip>
                  ) : (
                    s.tickets.map((t) => (
                      <Chip
                        key={t.user_ticket_id}
                        tone={t.not_started ? 'info' : t.status === 'ACTIVE' ? 'good' : 'neutral'}
                      >
                        {t.ticket_name}
                        {t.remaining_count != null ? ` · 잔여 ${t.remaining_count}회` : ''}
                        {t.not_started
                          ? ' · 시작 전'
                          : t.expiry_date
                            ? ` · ~${t.expiry_date}`
                            : ''}
                      </Chip>
                    ))
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </ConsoleCard>
    </ConsolePage>
  );
}
