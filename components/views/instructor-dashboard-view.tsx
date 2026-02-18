"use client";

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Calendar, MapPin, Users, List, CalendarDays } from 'lucide-react';
import { fetchWithAuth } from '@/lib/api/auth-fetch';
import { InstructorScheduleDetailModal } from '@/components/modals/instructor-schedule-detail-modal';
import { InstructorScheduleCalendar } from '@/components/views/instructor-schedule-calendar';

type TabType = 'upcoming' | 'past';
type ViewMode = 'list' | 'calendar';

interface ScheduleItem {
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

interface ApiResponse {
  academies: { id: string; name_kr: string | null }[];
  schedules: ScheduleItem[];
  total: number;
  has_more: boolean;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function formatDateHeader(iso: string) {
  const d = new Date(iso);
  const month = d.getMonth() + 1;
  const date = d.getDate();
  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
  const day = dayNames[d.getDay()];
  return `${month}/${date}(${day})`;
}

export function InstructorDashboardView() {
  const router = useRouter();
  const [tab, setTab] = useState<TabType>('upcoming');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [academyId, setAcademyId] = useState<string>('');
  const [academies, setAcademies] = useState<{ id: string; name_kr: string | null }[]>([]);
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedScheduleId, setSelectedScheduleId] = useState<string | null>(null);

  const loadSchedules = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ tab, limit: '50' });
      if (academyId) params.set('academy_id', academyId);
      const res = await fetchWithAuth(`/api/instructor/my-schedule?${params}`);
      if (!res.ok) {
        setSchedules([]);
        setAcademies([]);
        return;
      }
      const data: ApiResponse = await res.json();
      setSchedules(data.schedules || []);
      setAcademies(data.academies || []);
      setTotal(data.total ?? 0);
    } catch {
      setSchedules([]);
    } finally {
      setLoading(false);
    }
  }, [tab, academyId]);

  useEffect(() => {
    loadSchedules();
  }, [loadSchedules]);

  // 스와이프 새로고침 시 현재 페이지 유지하며 목록만 갱신
  useEffect(() => {
    const handler = () => loadSchedules();
    window.addEventListener('pull-to-refresh', handler);
    return () => window.removeEventListener('pull-to-refresh', handler);
  }, [loadSchedules]);

  const groupedByDate = schedules.reduce<Record<string, ScheduleItem[]>>((acc, s) => {
    const key = s.start_time.slice(0, 10);
    if (!acc[key]) acc[key] = [];
    acc[key].push(s);
    return acc;
  }, {});
  const dateKeys = Object.keys(groupedByDate).sort();

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-black pb-20">
      <header className="sticky top-0 z-10 bg-white dark:bg-neutral-950 border-b border-neutral-200 dark:border-neutral-800 px-4 pt-8 pb-3 flex items-center gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="p-1.5 -ml-1 text-neutral-600 dark:text-neutral-400"
          aria-label="뒤로"
        >
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-lg font-bold text-black dark:text-white flex-1">
          내 수업 관리 (강사용)
        </h1>
      </header>

      <div className="px-4 py-3 space-y-4">
        {/* 예정된 수업 / 지난 수업 */}
        <div className="flex rounded-xl bg-neutral-100 dark:bg-neutral-800 p-1">
          <button
            type="button"
            onClick={() => setTab('upcoming')}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
              tab === 'upcoming'
                ? 'bg-white dark:bg-neutral-700 text-black dark:text-white shadow'
                : 'text-neutral-600 dark:text-neutral-400'
            }`}
          >
            예정된 수업
          </button>
          <button
            type="button"
            onClick={() => setTab('past')}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
              tab === 'past'
                ? 'bg-white dark:bg-neutral-700 text-black dark:text-white shadow'
                : 'text-neutral-600 dark:text-neutral-400'
            }`}
          >
            지난 수업
          </button>
        </div>

        {/* 목록보기 / 달력보기 */}
        <div className="flex rounded-xl bg-neutral-100 dark:bg-neutral-800 p-1">
          <button
            type="button"
            onClick={() => setViewMode('list')}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-1.5 ${
              viewMode === 'list'
                ? 'bg-white dark:bg-neutral-700 text-black dark:text-white shadow'
                : 'text-neutral-600 dark:text-neutral-400'
            }`}
          >
            <List size={16} />
            목록보기
          </button>
          <button
            type="button"
            onClick={() => setViewMode('calendar')}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-1.5 ${
              viewMode === 'calendar'
                ? 'bg-white dark:bg-neutral-700 text-black dark:text-white shadow'
                : 'text-neutral-600 dark:text-neutral-400'
            }`}
          >
            <CalendarDays size={16} />
            달력보기
          </button>
        </div>

        {academies.length > 1 && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setAcademyId('')}
              className={`px-3 py-1.5 rounded-full text-xs font-medium ${
                !academyId
                  ? 'bg-primary dark:bg-[#CCFF00] text-black'
                  : 'bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300'
              }`}
            >
              전체
            </button>
            {academies.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => setAcademyId(a.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium ${
                  academyId === a.id
                    ? 'bg-primary dark:bg-[#CCFF00] text-black'
                    : 'bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300'
                }`}
              >
                {a.name_kr || a.id}
              </button>
            ))}
          </div>
        )}

        <div className="min-h-[320px]">
        {viewMode === 'calendar' ? (
          <InstructorScheduleCalendar
            academyId={academyId}
            onRefresh={loadSchedules}
          />
        ) : (
          <>
        {loading ? (
          <div className="py-12 text-center text-neutral-500 dark:text-neutral-400 text-sm">
            로딩 중...
          </div>
        ) : schedules.length === 0 ? (
          <div className="py-12 text-center text-neutral-500 dark:text-neutral-400 text-sm">
            {tab === 'upcoming' ? '예정된 수업이 없습니다.' : '지난 수업이 없습니다.'}
          </div>
        ) : (
          <div className="space-y-6">
            {dateKeys.map((dateKey) => (
              <div key={dateKey}>
                <div className="text-xs font-bold text-neutral-500 dark:text-neutral-400 mb-2 flex items-center gap-1">
                  <Calendar size={14} />
                  {formatDateHeader(dateKey + 'T12:00:00')}
                </div>
                <div className="space-y-2">
                  {(groupedByDate[dateKey] || []).map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setSelectedScheduleId(s.id)}
                      className="w-full text-left p-4 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
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
                            {s.hall?.name && (
                              <span>{s.hall.name}</span>
                            )}
                          </div>
                          <div className="mt-1.5 flex items-center gap-1 text-xs text-neutral-500 dark:text-neutral-400">
                            <Users size={12} />
                            <span>
                              확정 {s.enrollment.confirmed}명
                              {s.enrollment.pending > 0 && ` / 대기 ${s.enrollment.pending}명`}
                              {' '}/ 정원 {s.max_students}명
                            </span>
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
          </>
        )}
        </div>
      </div>

      {selectedScheduleId && (
        <InstructorScheduleDetailModal
          scheduleId={selectedScheduleId}
          onClose={() => setSelectedScheduleId(null)}
          onRefresh={loadSchedules}
        />
      )}
    </div>
  );
}
