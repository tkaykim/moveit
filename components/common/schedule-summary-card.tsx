"use client";

import { Calendar, Users, UserCheck, Clock, XCircle } from 'lucide-react';

interface ScheduleSummaryCardProps {
  schedule: {
    id: string;
    start_time: string;
    end_time: string;
    max_students: number | null;
    classes: {
      title: string;
      academies: {
        name_kr?: string | null;
        name_en?: string | null;
      } | null;
    } | null;
    instructors: {
      name_kr?: string | null;
      name_en?: string | null;
    } | null;
    halls: {
      name: string;
    } | null;
  };
  totalEnrollments: number;
  confirmedCount: number;
  pendingCount: number;
  cancelledCount: number;
  className?: string;
}

export function ScheduleSummaryCard({
  schedule,
  totalEnrollments,
  confirmedCount,
  pendingCount,
  cancelledCount,
  className = '',
}: ScheduleSummaryCardProps) {
  const maxStudents = schedule.max_students || 0;
  const remainingSpots = Math.max(0, maxStudents - confirmedCount);
  const fillPercentage = maxStudents > 0 ? (confirmedCount / maxStudents) * 100 : 0;

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const instructorName = schedule.instructors
    ? schedule.instructors.name_kr || schedule.instructors.name_en || '강사 정보 없음'
    : '강사 정보 없음';

  const academyName = schedule.classes?.academies
    ? schedule.classes.academies.name_kr || schedule.classes.academies.name_en || '학원 정보 없음'
    : '학원 정보 없음';

  return (
    <div className={`bg-white dark:bg-neutral-900 rounded-xl p-6 border border-neutral-200 dark:border-neutral-800 ${className}`}>
      <div className="mb-4">
        <h3 className="text-lg font-bold text-black dark:text-white mb-2">
          {schedule.classes?.title || '클래스 정보 없음'}
        </h3>
        <div className="space-y-1 text-sm text-neutral-600 dark:text-neutral-400">
          <div className="flex items-center gap-2">
            <Users size={14} />
            <span>강사: {instructorName}</span>
          </div>
          <div className="flex items-center gap-2">
            <Calendar size={14} />
            <span>{formatDateTime(schedule.start_time)}</span>
          </div>
          {schedule.halls && (
            <div className="flex items-center gap-2">
              <span>장소: {schedule.halls.name}</span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <span>학원: {academyName}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="bg-neutral-50 dark:bg-neutral-800 rounded-lg p-3">
          <div className="text-xs text-neutral-500 dark:text-neutral-400 mb-1">총 신청 인원</div>
          <div className="text-xl font-bold text-black dark:text-white">{totalEnrollments}명</div>
        </div>
        <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3">
          <div className="text-xs text-green-600 dark:text-green-400 mb-1 flex items-center gap-1">
            <UserCheck size={12} />
            확정 인원 (구입승인 + 출석완료)
          </div>
          <div className="text-xl font-bold text-green-700 dark:text-green-400">{confirmedCount}명</div>
        </div>
        <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-3">
          <div className="text-xs text-yellow-600 dark:text-yellow-400 mb-1 flex items-center gap-1">
            <Clock size={12} />
            대기 인원
          </div>
          <div className="text-xl font-bold text-yellow-700 dark:text-yellow-400">{pendingCount}명</div>
        </div>
        <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3">
          <div className="text-xs text-red-600 dark:text-red-400 mb-1 flex items-center gap-1">
            <XCircle size={12} />
            취소 인원
          </div>
          <div className="text-xl font-bold text-red-700 dark:text-red-400">{cancelledCount}명</div>
        </div>
      </div>

      {maxStudents > 0 && (
        <div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-black dark:text-white">
              인원 현황: {confirmedCount} / {maxStudents}
            </span>
            <span className="text-sm text-neutral-600 dark:text-neutral-400">
              잔여: {remainingSpots}명
            </span>
          </div>
          <div className="w-full h-3 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all ${
                fillPercentage >= 100
                  ? 'bg-red-500'
                  : fillPercentage >= 80
                  ? 'bg-yellow-500'
                  : 'bg-green-500'
              }`}
              style={{ width: `${Math.min(fillPercentage, 100)}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
