'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

interface SessionItem {
  id: string;
  start_time: string;
  end_time: string;
  max_students: number | null;
  current_students: number | null;
}

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short', timeZone: 'Asia/Seoul' });
const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Seoul' });

export function WorkshopSessionList({ sessions }: { sessions: SessionItem[] }) {
  const router = useRouter();
  const [waitlistFor, setWaitlistFor] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [doneFor, setDoneFor] = useState<Set<string>>(new Set());
  const [error, setError] = useState('');

  const joinWaitlist = async (scheduleId: string) => {
    if (!name.trim() || !phone.trim()) {
      setError('이름과 연락처를 입력해 주세요.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/workshops/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduleId, name: name.trim(), phone: phone.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '대기 신청에 실패했습니다.');
      setDoneFor((prev) => new Set(prev).add(scheduleId));
      setWaitlistFor(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : '대기 신청에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-2.5">
      {sessions.map((s) => {
        const full = typeof s.max_students === 'number' && (s.current_students ?? 0) >= s.max_students;
        const remaining =
          typeof s.max_students === 'number' ? Math.max(0, s.max_students - (s.current_students ?? 0)) : null;
        return (
          <div key={s.id} className="p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold">{fmtDate(s.start_time)}</p>
                <p className="text-xs text-neutral-500 tabular-nums">
                  {fmtTime(s.start_time)} ~ {fmtTime(s.end_time)}
                  {remaining !== null && !full && ` · 잔여 ${remaining}석`}
                </p>
              </div>
              {full ? (
                doneFor.has(s.id) ? (
                  <span className="text-xs font-semibold text-emerald-600">대기 신청 완료</span>
                ) : (
                  <button
                    onClick={() => {
                      setWaitlistFor(waitlistFor === s.id ? null : s.id);
                      setError('');
                    }}
                    className="px-3.5 py-2 rounded-lg text-xs font-bold border border-neutral-300 dark:border-neutral-700"
                  >
                    대기 신청
                  </button>
                )
              ) : (
                <button
                  onClick={() => router.push(`/book/session/${s.id}`)}
                  className="px-4 py-2 rounded-lg text-xs font-bold text-white"
                  style={{ backgroundColor: 'var(--primary)' }}
                >
                  신청하기
                </button>
              )}
            </div>

            {waitlistFor === s.id && (
              <div className="mt-3 pt-3 border-t border-neutral-100 dark:border-neutral-800 space-y-2">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="이름"
                  className="w-full rounded-lg border border-neutral-200 dark:border-neutral-700 bg-transparent px-3 py-2 text-sm"
                />
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="연락처 (자리가 나면 연락드립니다)"
                  inputMode="tel"
                  className="w-full rounded-lg border border-neutral-200 dark:border-neutral-700 bg-transparent px-3 py-2 text-sm"
                />
                {error && <p className="text-xs text-red-500">{error}</p>}
                <button
                  onClick={() => joinWaitlist(s.id)}
                  disabled={submitting}
                  className="w-full py-2.5 rounded-lg text-xs font-bold text-white disabled:opacity-60 flex items-center justify-center gap-1.5"
                  style={{ backgroundColor: 'var(--primary)' }}
                >
                  {submitting && <Loader2 size={13} className="animate-spin" />}
                  대기열에 등록하기
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
