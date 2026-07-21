'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, QrCode, Users2, Clock, MapPin, User } from 'lucide-react';
import { fetchWithAuth } from '@/lib/api/auth-fetch';
import { useLiteAdmin } from './context';
import { RosterSheet, type RosterOccurrence } from './roster-sheet';

/** KST 오늘 (YYYY-MM-DD) */
function kstTodayStr(): string {
  const now = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return now.toISOString().slice(0, 10);
}
function addDaysStr(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const t = Date.UTC(y, m - 1, d) + days * 86400000;
  const r = new Date(t);
  return `${r.getUTCFullYear()}-${String(r.getUTCMonth() + 1).padStart(2, '0')}-${String(r.getUTCDate()).padStart(2, '0')}`;
}
function fmtDateLabel(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const wd = ['일', '월', '화', '수', '목', '금', '토'][dt.getUTCDay()];
  return `${m}월 ${d}일 (${wd})`;
}
function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Seoul',
  });
}

export function TodayView() {
  const academy = useLiteAdmin();
  const [date, setDate] = useState(kstTodayStr());
  const [occurrences, setOccurrences] = useState<RosterOccurrence[]>([]);
  const [halls, setHalls] = useState<Record<string, string | null>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [rosterRes, occRes] = await Promise.all([
        fetchWithAuth(`/api/academy-admin/${academy.id}/console/roster?date=${date}`, { cache: 'no-store' }),
        fetchWithAuth(`/api/a/${academy.id}/occurrences?from=${date}&to=${date}`, { cache: 'no-store' }),
      ]);
      if (!rosterRes.ok) {
        setError('명단을 불러오지 못했어요.');
        setOccurrences([]);
        return;
      }
      const rj = await rosterRes.json();
      const occ: RosterOccurrence[] = rj.occurrences ?? [];
      occ.sort((a, b) => a.start_time.localeCompare(b.start_time));
      setOccurrences(occ);
      // 홀 이름 병합 (roster 는 홀을 안 주므로 occurrences 에서 가져온다)
      if (occRes.ok) {
        const oj = await occRes.json();
        const map: Record<string, string | null> = {};
        for (const o of oj.occurrences ?? []) map[o.schedule_id] = o.hall_name ?? null;
        setHalls(map);
      }
    } catch {
      setError('명단을 불러오지 못했어요.');
      setOccurrences([]);
    } finally {
      setLoading(false);
    }
  }, [academy.id, date]);

  useEffect(() => {
    load();
  }, [load]);

  const isToday = date === kstTodayStr();
  const openOccurrence = useMemo(
    () => occurrences.find((o) => o.schedule_id === openId) ?? null,
    [occurrences, openId]
  );

  return (
    <div className="px-4 pt-4">
      {/* 날짜 스위처 */}
      <div className="flex items-center gap-2 mb-4">
        <button
          type="button"
          aria-label="이전 날"
          data-testid="date-prev"
          onClick={() => setDate((d) => addDaysStr(d, -1))}
          className="w-11 h-11 flex items-center justify-center rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900"
        >
          <ChevronLeft size={20} />
        </button>
        <div className="flex-1 text-center">
          <p className="text-[16px] font-extrabold" data-testid="today-date">
            {fmtDateLabel(date)}
          </p>
          {!isToday && (
            <button
              type="button"
              data-testid="today-reset"
              onClick={() => setDate(kstTodayStr())}
              className="text-[11px] font-bold mt-0.5"
              style={{ color: academy.brand }}
            >
              오늘로
            </button>
          )}
        </div>
        <button
          type="button"
          aria-label="다음 날"
          data-testid="date-next"
          onClick={() => setDate((d) => addDaysStr(d, 1))}
          className="w-11 h-11 flex items-center justify-center rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      {/* QR 스캔 진입 (기존 스캐너 재사용) */}
      <Link
        href={`/academy-admin/${academy.slug}/qr-reader`}
        data-testid="qr-scan-entry"
        className="flex items-center justify-center gap-2 mb-4 h-12 rounded-xl font-bold text-white text-[14px]"
        style={{ backgroundColor: academy.brand }}
      >
        <QrCode size={18} /> QR 스캔으로 출석 받기
      </Link>

      {loading ? (
        <div className="py-16 text-center text-sm text-neutral-400">불러오는 중...</div>
      ) : error ? (
        <div className="py-16 text-center text-sm text-red-500">{error}</div>
      ) : occurrences.length === 0 ? (
        <div className="py-16 text-center rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800">
          <p className="text-sm text-neutral-400">이 날 예정된 수업이 없어요</p>
        </div>
      ) : (
        <ul className="space-y-2.5" data-testid="today-list">
          {occurrences.map((o) => {
            const full = typeof o.max_students === 'number' && o.booked_count >= o.max_students;
            return (
              <li key={o.schedule_id}>
                <button
                  type="button"
                  data-testid="today-occurrence"
                  data-schedule-id={o.schedule_id}
                  onClick={() => setOpenId(o.schedule_id)}
                  className={`w-full text-left p-4 rounded-2xl border bg-white dark:bg-neutral-900 border-neutral-100 dark:border-neutral-800 active:scale-[0.99] transition-transform ${
                    o.is_canceled ? 'opacity-60' : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className="px-2.5 py-1.5 rounded-lg text-[13px] font-extrabold tabular-nums text-white flex-shrink-0 flex items-center gap-1"
                      style={{ backgroundColor: academy.brand }}
                    >
                      <Clock size={12} /> {fmtTime(o.start_time)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className={`text-[15px] font-bold truncate ${o.is_canceled ? 'line-through' : ''}`}>
                        {o.class_title}
                      </p>
                      <p className="text-xs text-neutral-500 truncate mt-1 flex items-center gap-2 flex-wrap">
                        {o.instructor_name && (
                          <span className="inline-flex items-center gap-0.5">
                            <User size={11} /> {o.instructor_name}
                          </span>
                        )}
                        {halls[o.schedule_id] && (
                          <span className="inline-flex items-center gap-0.5">
                            <MapPin size={11} /> {halls[o.schedule_id]}
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <span
                        className={`text-[13px] font-extrabold tabular-nums ${full ? 'text-red-500' : ''}`}
                        style={!full ? { color: academy.brand } : undefined}
                      >
                        신청 {o.booked_count}
                        {typeof o.max_students === 'number' ? `/${o.max_students}` : ''}
                      </span>
                      <div className="flex gap-1">
                        {o.held_count > 0 && (
                          <span
                            data-testid="badge-deposit-pending"
                            className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                          >
                            입금대기 {o.held_count}
                          </span>
                        )}
                        {o.is_canceled && (
                          <span
                            data-testid="badge-canceled"
                            className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-neutral-200 text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300"
                          >
                            휴강
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {openOccurrence && (
        <RosterSheet
          slug={academy.slug}
          occurrence={openOccurrence}
          onClose={() => setOpenId(null)}
          onChanged={load}
        />
      )}

      <div className="h-4" />
      <p className="text-center text-[11px] text-neutral-300 dark:text-neutral-600 flex items-center justify-center gap-1">
        <Users2 size={12} /> 수업을 누르면 신청자 명단이 열려요
      </p>
    </div>
  );
}
