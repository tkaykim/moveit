"use client";

import { useState, useEffect } from 'react';
import { X, Calendar, Clock, MapPin, Users } from 'lucide-react';
import { fetchWithAuth } from '@/lib/api/auth-fetch';

interface InstructorScheduleDetailModalProps {
  scheduleId: string;
  onClose: () => void;
  onRefresh?: () => void;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  const month = d.getMonth() + 1;
  const date = d.getDate();
  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
  const day = dayNames[d.getDay()];
  return `${month}월 ${date}일 (${day})`;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export function InstructorScheduleDetailModal({
  scheduleId,
  onClose,
}: InstructorScheduleDetailModalProps) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{
    schedule: {
      id: string;
      start_time: string;
      end_time: string;
      classes?: { title: string | null; genre: string | null; difficulty_level: string | null };
      academies?: { name_kr: string | null };
      halls?: { name: string };
    };
    enrollment: {
      confirmed: number;
      pending: number;
      cancelled: number;
      completed: number;
      total: number;
      max_students: number;
      remaining_spots: number;
    };
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchWithAuth(`/api/instructor/schedule/${scheduleId}`);
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          setError(j?.error || '불러오기 실패');
          return;
        }
        const j = await res.json();
        if (!cancelled) setData(j);
      } catch {
        if (!cancelled) setError('네트워크 오류');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [scheduleId]);

  const schedule = data?.schedule;
  const enrollment = data?.enrollment;
  const maxStudents = enrollment?.max_students ?? 0;
  const confirmed = enrollment?.confirmed ?? 0;
  const percent = maxStudents > 0 ? Math.round((confirmed / maxStudents) * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4">
      <div
        className="bg-white dark:bg-neutral-900 w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-700 px-4 py-3 flex items-center justify-between">
          <h2 className="text-lg font-bold text-black dark:text-white truncate">
            {schedule?.classes?.title || '수업 상세'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 -m-2 text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-white"
            aria-label="닫기"
          >
            <X size={22} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {loading && (
            <div className="py-8 text-center text-neutral-500 dark:text-neutral-400 text-sm">
              로딩 중...
            </div>
          )}
          {error && (
            <div className="py-8 text-center text-red-600 dark:text-red-400 text-sm">
              {error}
            </div>
          )}
          {!loading && !error && schedule && enrollment && (
            <>
              <div className="flex items-center gap-2 text-neutral-600 dark:text-neutral-400 text-sm">
                <Calendar size={16} />
                <span>{formatDate(schedule.start_time)}</span>
              </div>
              <div className="flex items-center gap-2 text-neutral-600 dark:text-neutral-400 text-sm">
                <Clock size={16} />
                <span>
                  {formatTime(schedule.start_time)} ~ {formatTime(schedule.end_time)}
                </span>
              </div>
              {schedule.academies?.name_kr && (
                <div className="flex items-center gap-2 text-neutral-600 dark:text-neutral-400 text-sm">
                  <MapPin size={16} />
                  <span>{schedule.academies.name_kr}</span>
                  {schedule.halls?.name && <span>· {schedule.halls.name}</span>}
                </div>
              )}
              {schedule.classes?.genre && (
                <p className="text-sm text-neutral-500 dark:text-neutral-400">
                  {schedule.classes.genre}
                  {schedule.classes.difficulty_level && ` · ${schedule.classes.difficulty_level}`}
                </p>
              )}

              <div className="pt-2">
                <h3 className="text-sm font-semibold text-black dark:text-white mb-3">수강인원</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                  <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3">
                    <div className="text-green-700 dark:text-green-400 font-bold">{enrollment.confirmed}명</div>
                    <div className="text-xs text-green-600 dark:text-green-500">확정</div>
                  </div>
                  <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3">
                    <div className="text-amber-700 dark:text-amber-400 font-bold">{enrollment.pending}명</div>
                    <div className="text-xs text-amber-600 dark:text-amber-500">대기</div>
                  </div>
                  <div className="bg-neutral-100 dark:bg-neutral-800 rounded-lg p-3">
                    <div className="text-neutral-700 dark:text-neutral-300 font-bold">{enrollment.cancelled}명</div>
                    <div className="text-xs text-neutral-500">취소</div>
                  </div>
                  <div className="bg-neutral-100 dark:bg-neutral-800 rounded-lg p-3">
                    <div className="text-neutral-700 dark:text-neutral-300 font-bold">{enrollment.max_students}명</div>
                    <div className="text-xs text-neutral-500">정원</div>
                  </div>
                </div>
                {maxStudents > 0 && (
                  <div className="mt-3">
                    <div className="flex justify-between text-xs text-neutral-500 dark:text-neutral-400 mb-1">
                      <span>확정 / 정원</span>
                      <span>{percent}%</span>
                    </div>
                    <div className="h-2 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary dark:bg-[#CCFF00] rounded-full transition-all"
                        style={{ width: `${Math.min(percent, 100)}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
