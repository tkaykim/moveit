'use client';

import { useEffect, useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import { fetchWithAuth } from '@/lib/api/auth-fetch';

export interface StudentTicket {
  user_ticket_id: string;
  ticket_name: string;
  ticket_type: string | null;
  remaining_count: number | null;
  start_date: string | null;
  expiry_date: string | null;
  status: string | null;
  not_started: boolean;
}

export interface StudentRow {
  user_id: string;
  name: string;
  contact: string | null;
  tickets: StudentTicket[];
  active_ticket_count: number;
  membership_name: string | null;
  membership_status: string | null;
  membership_end_date: string | null;
  student_membership_id: string | null;
}

/** console/students 를 한 번 불러 클라이언트에서 이름/전화로 거른다 (페이지 집계 — N+1 없음). */
export function useStudents(academyId: string) {
  const [all, setAll] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuth(`/api/academy-admin/${academyId}/console/students`, { cache: 'no-store' });
      if (res.ok) {
        const j = await res.json();
        setAll(j.students ?? []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [academyId]);

  return { all, loading, reload: load };
}

const digits = (s: string) => s.replace(/\D/g, '');

export function filterStudents(all: StudentRow[], query: string): StudentRow[] {
  const q = query.trim();
  if (!q) return [];
  const qd = digits(q);
  const lower = q.toLowerCase();
  return all
    .filter((s) => {
      const nameHit = s.name.toLowerCase().includes(lower);
      const phoneHit = qd.length >= 2 && s.contact ? digits(s.contact).includes(qd) : false;
      return nameHit || phoneHit;
    })
    .slice(0, 30);
}

/** 검색창 + 결과 리스트. onPick 으로 학생을 고른다 (현장결제·수동발급·전문반 부여 공용). */
export function StudentPicker({
  academyId,
  brand,
  onPick,
  emptyHint = '이름 또는 전화번호로 검색해요',
  testId = 'student-picker',
}: {
  academyId: string;
  brand: string;
  onPick: (student: StudentRow) => void;
  emptyHint?: string;
  testId?: string;
}) {
  const { all, loading } = useStudents(academyId);
  const [q, setQ] = useState('');
  const results = useMemo(() => filterStudents(all, q), [all, q]);

  return (
    <div data-testid={testId}>
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
        <input
          data-testid={`${testId}-input`}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="이름 · 전화번호"
          className="w-full h-12 pl-9 pr-9 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-[15px]"
        />
        {q && (
          <button
            type="button"
            aria-label="지우기"
            onClick={() => setQ('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-full bg-neutral-100 dark:bg-neutral-800"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {loading ? (
        <p className="py-8 text-center text-sm text-neutral-400">불러오는 중...</p>
      ) : !q.trim() ? (
        <p className="py-8 text-center text-sm text-neutral-400">{emptyHint}</p>
      ) : results.length === 0 ? (
        <p className="py-8 text-center text-sm text-neutral-400">검색 결과가 없어요</p>
      ) : (
        <ul className="mt-3 space-y-2" data-testid={`${testId}-results`}>
          {results.map((s) => (
            <li key={s.user_id}>
              <button
                type="button"
                data-testid="student-result"
                data-user-id={s.user_id}
                onClick={() => onPick(s)}
                className="w-full text-left p-3 rounded-xl border border-neutral-100 dark:border-neutral-800 bg-white dark:bg-neutral-900 active:scale-[0.99] transition-transform"
              >
                <div className="flex items-center gap-2">
                  <span className="text-[15px] font-bold truncate">{s.name}</span>
                  {s.membership_name && (
                    <span
                      className="px-1.5 py-0.5 rounded text-[10px] font-bold text-white flex-shrink-0"
                      style={{ backgroundColor: brand }}
                    >
                      {s.membership_name}
                    </span>
                  )}
                  <span className="ml-auto text-[11px] font-semibold text-neutral-400 flex-shrink-0">
                    수강권 {s.active_ticket_count}
                  </span>
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
