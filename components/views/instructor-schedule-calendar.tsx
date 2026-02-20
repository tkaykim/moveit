"use client";

import { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, MapPin, Users, X } from 'lucide-react';
import { fetchWithAuth } from '@/lib/api/auth-fetch';
import { InstructorScheduleDetailModal } from '@/components/modals/instructor-schedule-detail-modal';

export interface InstructorScheduleItem {
  id: string;
  start_time: string;
  end_time: string;
  is_canceled: boolean;
  class: { id: string; title: string | null; genre: string | null; difficulty_level: string | null } | null;
  academy: { id: string; name_kr: string | null } | null;
  hall: { id: string; name: string } | null;
  max_students: number;
  enrollment: { confirmed: number; pending: number };
}

interface InstructorScheduleCalendarProps {
  academyId: string;
  onRefresh?: () => void;
}

const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function getDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getSchedulesForDate(schedules: InstructorScheduleItem[], date: Date): InstructorScheduleItem[] {
  const key = getDateKey(date);
  return schedules.filter((s) => s.start_time.slice(0, 10) === key);
}

export function InstructorScheduleCalendar({ academyId, onRefresh }: InstructorScheduleCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState<Date>(() => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), 1);
  });
  const [schedules, setSchedules] = useState<InstructorScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedScheduleId, setSelectedScheduleId] = useState<string | null>(null);

  const loadMonth = useCallback(async () => {
    setLoading(true);
    try {
      const y = currentMonth.getFullYear();
      const m = currentMonth.getMonth();
      const start = `${y}-${String(m + 1).padStart(2, '0')}-01`;
      const lastDay = new Date(y, m + 1, 0).getDate();
      const end = `${y}-${String(m + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      const params = new URLSearchParams({ start_date: start, end_date: end, limit: '100' });
      if (academyId) params.set('academy_id', academyId);
      const res = await fetchWithAuth(`/api/instructor/my-schedule?${params}`);
      if (!res.ok) {
        setSchedules([]);
        return;
      }
      const data = await res.json();
      setSchedules(data.schedules || []);
    } catch {
      setSchedules([]);
    } finally {
      setLoading(false);
    }
  }, [currentMonth, academyId]);

  useEffect(() => {
    loadMonth();
  }, [loadMonth]);

  // 스와이프 새로고침 시 캘린더 데이터만 갱신 (현재 화면 유지)
  useEffect(() => {
    const handler = () => loadMonth();
    window.addEventListener('pull-to-refresh', handler);
    return () => window.removeEventListener('pull-to-refresh', handler);
  }, [loadMonth]);

  const goPrev = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  const goNext = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  const goToday = () => setCurrentMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1));

  const getCalendarGrid = (): Date[] => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const first = new Date(year, month, 1);
    const start = new Date(first);
    start.setDate(start.getDate() - start.getDay());
    const grid: Date[] = [];
    const cur = new Date(start);
    for (let i = 0; i < 42; i++) {
      grid.push(new Date(cur));
      cur.setDate(cur.getDate() + 1);
    }
    return grid;
  };

  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
    setSelectedScheduleId(null);
  };

  const closeDrawer = () => {
    setSelectedDate(null);
    setSelectedScheduleId(null);
  };

  const grid = getCalendarGrid();
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const today = new Date();
  const todayKey = getDateKey(today);

  if (loading) {
    return (
      <div className="py-12 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary dark:border-[#CCFF00] border-t-transparent" />
      </div>
    );
  }

  const daySchedules = selectedDate ? getSchedulesForDate(schedules, selectedDate) : [];

  return (
    <div className="space-y-4 min-h-[280px]">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={goPrev}
          className="p-2 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-400"
          aria-label="이전 달"
        >
          <ChevronLeft size={20} />
        </button>
        <div className="flex items-center gap-2">
          <span className="text-base font-bold text-black dark:text-white">
            {year}년 {month + 1}월
          </span>
          <button
            type="button"
            onClick={goToday}
            className="text-xs px-3 py-1.5 bg-primary/10 dark:bg-[#CCFF00]/10 text-primary dark:text-[#CCFF00] rounded-full font-medium"
          >
            이번 달
          </button>
        </div>
        <button
          type="button"
          onClick={goNext}
          className="p-2 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-400"
          aria-label="다음 달"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden">
        <div className="grid grid-cols-7 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950">
          {DAY_NAMES.map((day, idx) => (
            <div
              key={day}
              className={`p-2 text-center text-xs font-bold ${
                idx === 0 ? 'text-rose-500' : idx === 6 ? 'text-blue-500' : 'text-neutral-600 dark:text-neutral-400'
              }`}
            >
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {grid.map((date, index) => {
            const key = getDateKey(date);
            const isCurrentMonth = date.getMonth() === month;
            const isToday = key === todayKey;
            const dayScheds = getSchedulesForDate(schedules, date);
            const hasSchedules = dayScheds.length > 0;
            const dayOfWeek = date.getDay();

            return (
              <button
                key={index}
                type="button"
                onClick={() => handleDateClick(date)}
                className={`min-h-[44px] p-1 text-sm border-b border-r border-neutral-100 dark:border-neutral-800 last:border-r-0 transition-colors ${
                  !isCurrentMonth ? 'text-neutral-300 dark:text-neutral-600 bg-neutral-50/50 dark:bg-neutral-950/50' : 'text-black dark:text-white'
                } ${isToday ? 'ring-1 ring-primary dark:ring-[#CCFF00] ring-inset font-bold' : ''} ${
                  hasSchedules ? 'bg-primary/5 dark:bg-[#CCFF00]/5 hover:bg-primary/10 dark:hover:bg-[#CCFF00]/10' : 'hover:bg-neutral-50 dark:hover:bg-neutral-800/50'
                }`}
              >
                <span className={dayOfWeek === 0 ? 'text-rose-500' : dayOfWeek === 6 ? 'text-blue-500' : ''}>
                  {date.getDate()}
                </span>
                {hasSchedules && (
                  <span className="block w-1 h-1 rounded-full bg-primary dark:bg-[#CCFF00] mx-auto mt-0.5" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 하단 드로어: 선택한 날짜의 수업 목록 - 화면(뷰포트) 기준으로 항상 보이도록 */}
      {selectedDate && (
        <>
          <div
            className="fixed inset-0 bg-black/40 z-40 animate-in fade-in duration-200"
            style={{ height: '100dvh' }}
            onClick={closeDrawer}
            aria-hidden
          />
          <div
            className="fixed left-1/2 -translate-x-1/2 bottom-0 w-full max-w-[420px] bg-white dark:bg-neutral-900 rounded-t-2xl border-t border-neutral-200 dark:border-neutral-800 shadow-2xl z-50 flex flex-col animate-in slide-in-from-bottom duration-300"
            style={{ maxHeight: 'min(90dvh, 90vh)', minHeight: '40dvh' }}
            role="dialog"
            aria-label="해당 날짜 수업 목록"
          >
            <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-neutral-200 dark:border-neutral-800">
              <h3 className="text-base font-bold text-black dark:text-white">
                {selectedDate.getMonth() + 1}월 {selectedDate.getDate()}일 ({DAY_NAMES[selectedDate.getDay()]})
              </h3>
              <button
                type="button"
                onClick={closeDrawer}
                className="p-2 -m-2 text-neutral-500 hover:text-black dark:hover:text-white"
                aria-label="닫기"
              >
                <X size={22} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 pb-24 space-y-2 min-h-0">
              {daySchedules.length === 0 ? (
                <p className="py-8 text-center text-neutral-500 dark:text-neutral-400 text-sm">
                  해당 날짜에 수업이 없습니다.
                </p>
              ) : (
                daySchedules.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSelectedScheduleId(s.id)}
                    className="w-full text-left p-4 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-950 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
                  >
                    <div className="font-semibold text-black dark:text-white truncate">
                      {s.class?.title || '수업명 없음'}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-neutral-500 dark:text-neutral-400">
                      <span className="font-medium text-neutral-700 dark:text-neutral-300">
                        {formatTime(s.start_time)} ~ {formatTime(s.end_time)}
                      </span>
                      {s.academy?.name_kr && (
                        <span className="flex items-center gap-0.5">
                          <MapPin size={12} />
                          {s.academy.name_kr}
                        </span>
                      )}
                      {s.hall?.name && <span>{s.hall.name}</span>}
                    </div>
                    <div className="mt-1.5 flex items-center gap-1 text-xs text-neutral-500 dark:text-neutral-400">
                      <Users size={12} />
                      <span>
                        확정 {s.enrollment.confirmed}명
                        {s.enrollment.pending > 0 && ` / 대기 ${s.enrollment.pending}명`} / 정원 {s.max_students}명
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}

      {selectedScheduleId && (
        <InstructorScheduleDetailModal
          scheduleId={selectedScheduleId}
          onClose={() => {
            setSelectedScheduleId(null);
          }}
          onRefresh={() => {
            loadMonth();
            onRefresh?.();
          }}
        />
      )}
    </div>
  );
}
