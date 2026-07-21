'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, Clock, User, MapPin, AlertTriangle } from 'lucide-react';
import { fetchWithAuth } from '@/lib/api/auth-fetch';
import { useLiteAdmin } from './context';
import { ClassFormSheet, type Refs, type EditTarget } from './class-form-sheet';

interface Occurrence {
  schedule_id: string;
  class_id: string;
  class_title: string;
  instructor_name: string | null;
  start_time: string;
  end_time: string | null;
  is_canceled: boolean;
  max_students: number | null;
  booked_count: number;
  hall_id: string | null;
  hall_name: string | null;
  class_group_id: string | null;
  class_group_name: string | null;
  is_special: boolean;
  audience_membership_id: string | null;
  needs_readiness: boolean;
}

const WD = ['월', '화', '수', '목', '금', '토', '일'];

function kstTodayStr(): string {
  return new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
}
function addDaysStr(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const r = new Date(Date.UTC(y, m - 1, d) + days * 86400000);
  return `${r.getUTCFullYear()}-${String(r.getUTCMonth() + 1).padStart(2, '0')}-${String(r.getUTCDate()).padStart(2, '0')}`;
}
/** 그 날이 속한 주의 월요일(KST) */
function mondayOf(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0=일
  const back = dow === 0 ? 6 : dow - 1;
  return addDaysStr(date, -back);
}
function isoToKstDate(iso: string): string {
  return new Date(new Date(iso).getTime() + 9 * 3600_000).toISOString().slice(0, 10);
}
function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Seoul' });
}

export function ClassesView() {
  const academy = useLiteAdmin();
  const [weekStart, setWeekStart] = useState(mondayOf(kstTodayStr()));
  const [selectedDay, setSelectedDay] = useState(kstTodayStr());
  const [occ, setOcc] = useState<Occurrence[]>([]);
  const [refs, setRefs] = useState<Refs>({ classGroups: [], halls: [], memberships: [] });
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);
  const [tagging, setTagging] = useState<string | null>(null);

  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDaysStr(weekStart, i)), [weekStart]);
  const weekEnd = weekDays[6];

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [occRes, refsRes] = await Promise.all([
        fetchWithAuth(`/api/a/${academy.id}/occurrences?from=${weekStart}&to=${weekEnd}`, { cache: 'no-store' }),
        fetchWithAuth(`/api/a/${academy.id}/refs`, { cache: 'no-store' }),
      ]);
      if (occRes.ok) {
        const j = await occRes.json();
        setOcc(j.occurrences ?? []);
      }
      if (refsRes.ok) {
        const j = await refsRes.json();
        setRefs({ classGroups: j.classGroups ?? [], halls: j.halls ?? [], memberships: j.memberships ?? [] });
      }
    } finally {
      setLoading(false);
    }
  }, [academy.id, weekStart, weekEnd]);

  useEffect(() => {
    load();
  }, [load]);

  // 선택 날짜가 이번 주 밖이면 주 첫날로 스냅
  useEffect(() => {
    if (selectedDay < weekStart || selectedDay > weekEnd) setSelectedDay(weekStart);
  }, [weekStart, weekEnd, selectedDay]);

  const byDay = useMemo(() => {
    const map = new Map<string, Occurrence[]>();
    for (const o of occ) {
      const d = isoToKstDate(o.start_time);
      (map.get(d) ?? map.set(d, []).get(d)!).push(o);
    }
    for (const list of map.values()) list.sort((a, b) => a.start_time.localeCompare(b.start_time));
    return map;
  }, [occ]);

  const dayList = byDay.get(selectedDay) ?? [];

  const tagReadiness = async (classId: string, classGroupId: string) => {
    if (!classGroupId) return;
    setTagging(classId);
    try {
      const res = await fetchWithAuth(`/api/academy-admin/${academy.id}/class-readiness`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ classId, classGroupId }),
      });
      if (res.ok) await load();
    } finally {
      setTagging(null);
    }
  };

  return (
    <div className="px-4 pt-4">
      {/* 주 이동 */}
      <div className="flex items-center gap-2 mb-3">
        <button
          type="button"
          aria-label="이전 주"
          data-testid="week-prev"
          onClick={() => setWeekStart((w) => addDaysStr(w, -7))}
          className="w-11 h-11 flex items-center justify-center rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900"
        >
          <ChevronLeft size={20} />
        </button>
        <button
          type="button"
          data-testid="week-today"
          onClick={() => {
            setWeekStart(mondayOf(kstTodayStr()));
            setSelectedDay(kstTodayStr());
          }}
          className="flex-1 h-11 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-[13px] font-bold"
        >
          이번 주
        </button>
        <button
          type="button"
          aria-label="다음 주"
          data-testid="week-next"
          onClick={() => setWeekStart((w) => addDaysStr(w, 7))}
          className="w-11 h-11 flex items-center justify-center rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      {/* 요일 그리드 */}
      <div className="grid grid-cols-7 gap-1 mb-4" data-testid="week-grid">
        {weekDays.map((d, i) => {
          const list = byDay.get(d) ?? [];
          const active = d === selectedDay;
          const isToday = d === kstTodayStr();
          return (
            <button
              key={d}
              type="button"
              data-testid="week-day"
              data-date={d}
              onClick={() => setSelectedDay(d)}
              className={`flex flex-col items-center py-2 rounded-xl border min-h-[64px] justify-center ${
                active ? 'text-white' : 'bg-white dark:bg-neutral-900 border-neutral-100 dark:border-neutral-800'
              }`}
              style={active ? { backgroundColor: academy.brand, borderColor: academy.brand } : undefined}
            >
              <span className="text-[10px] font-bold opacity-80">{WD[i]}</span>
              <span className={`text-[15px] font-extrabold ${isToday && !active ? '' : ''}`} style={isToday && !active ? { color: academy.brand } : undefined}>
                {Number(d.split('-')[2])}
              </span>
              {list.length > 0 && (
                <span className={`mt-0.5 text-[9px] font-bold ${active ? 'opacity-90' : 'text-neutral-400'}`}>
                  {list.length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* 수업 추가 */}
      <button
        type="button"
        data-testid="add-class"
        onClick={() => setCreating(true)}
        className="w-full h-12 mb-4 rounded-xl font-bold text-white text-[14px] flex items-center justify-center gap-1.5"
        style={{ backgroundColor: academy.brand }}
      >
        <Plus size={18} /> 수업 추가
      </button>

      {/* 선택 날짜 수업 목록 */}
      {loading ? (
        <div className="py-16 text-center text-sm text-neutral-400">불러오는 중...</div>
      ) : dayList.length === 0 ? (
        <div className="py-16 text-center rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800">
          <p className="text-sm text-neutral-400">이 날 수업이 없어요</p>
        </div>
      ) : (
        <ul className="space-y-2.5" data-testid="day-class-list">
          {dayList.map((o) => (
            <li
              key={o.schedule_id}
              data-testid="class-occurrence"
              data-schedule-id={o.schedule_id}
              data-canceled={o.is_canceled ? '1' : '0'}
              className={`p-4 rounded-2xl border bg-white dark:bg-neutral-900 border-neutral-100 dark:border-neutral-800 ${
                o.is_canceled ? 'opacity-60' : ''
              }`}
            >
              <button
                type="button"
                data-testid="class-edit-open"
                onClick={() =>
                  setEditTarget({
                    schedule_id: o.schedule_id,
                    class_id: o.class_id,
                    class_title: o.class_title,
                    class_group_id: o.class_group_id,
                    instructor_name: o.instructor_name,
                    hall_id: o.hall_id,
                    max_students: o.max_students,
                    start_time: o.start_time,
                    end_time: o.end_time,
                    is_canceled: o.is_canceled,
                  })
                }
                className="w-full text-left"
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
                      {o.class_group_name && (
                        <span className="px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-[10px] font-bold">
                          {o.class_group_name}
                        </span>
                      )}
                      {o.instructor_name && (
                        <span className="inline-flex items-center gap-0.5">
                          <User size={11} /> {o.instructor_name}
                        </span>
                      )}
                      {o.hall_name && (
                        <span className="inline-flex items-center gap-0.5">
                          <MapPin size={11} /> {o.hall_name}
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <span className="text-[13px] font-extrabold tabular-nums" style={{ color: academy.brand }}>
                      신청 {o.booked_count}
                      {typeof o.max_students === 'number' ? `/${o.max_students}` : ''}
                    </span>
                    {o.is_canceled && (
                      <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-neutral-200 text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300">
                        휴강
                      </span>
                    )}
                  </div>
                </div>
              </button>

              {/* 예약 준비 필요 (수업군 미지정) — 인라인 지정 */}
              {o.needs_readiness && (
                <div
                  data-testid="readiness-inline"
                  className="mt-3 pt-3 border-t border-amber-100 dark:border-amber-900/40"
                >
                  <p className="text-[11px] font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1 mb-2">
                    <AlertTriangle size={12} /> 예약 준비 필요 — 수업군을 지정하면 바로 예약이 열려요
                  </p>
                  <div className="flex gap-2">
                    <select
                      data-testid="readiness-group-select"
                      defaultValue=""
                      disabled={tagging === o.class_id}
                      onChange={(e) => tagReadiness(o.class_id, e.target.value)}
                      className="flex-1 h-10 px-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-[13px]"
                    >
                      <option value="">수업군 선택</option>
                      {refs.classGroups.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.name}
                          {g.is_special ? ' (특별)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {creating && (
        <ClassFormSheet
          academyId={academy.id}
          brand={academy.brand}
          refs={refs}
          mode="create"
          defaultDate={selectedDay}
          onClose={() => setCreating(false)}
          onSaved={load}
        />
      )}
      {editTarget && (
        <ClassFormSheet
          academyId={academy.id}
          brand={academy.brand}
          refs={refs}
          mode="edit"
          defaultDate={selectedDay}
          edit={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={load}
        />
      )}
    </div>
  );
}
