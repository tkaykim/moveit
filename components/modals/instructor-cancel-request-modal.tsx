"use client";

import { useState } from 'react';
import { X } from 'lucide-react';
import { fetchWithAuth } from '@/lib/api/auth-fetch';

interface ScheduleSummary {
  id: string;
  start_time: string;
  end_time: string;
  classes?: { title: string | null };
  academies?: { name_kr: string | null };
}

interface InstructorCancelRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  schedule: ScheduleSummary;
  onSuccess: () => void;
}

function formatDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString('ko-KR', {
    month: 'numeric',
    day: 'numeric',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export function InstructorCancelRequestModal({
  isOpen,
  onClose,
  schedule,
  onSuccess,
}: InstructorCancelRequestModalProps) {
  const [reason, setReason] = useState('');
  const [submitLoading, setSubmitLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!reason.trim()) {
      setError('사유를 입력해주세요.');
      return;
    }

    setSubmitLoading(true);
    try {
      const res = await fetchWithAuth('/api/instructor/schedule-change-request', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schedule_id: schedule.id,
          request_type: 'CANCEL',
          reason: reason.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || '신청에 실패했습니다.');
      onSuccess();
      onClose();
    } catch (e: any) {
      setError(e.message || '신청에 실패했습니다.');
    } finally {
      setSubmitLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4">
      <div
        className="bg-white dark:bg-neutral-900 w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-700 px-4 py-3 flex items-center justify-between">
          <h2 className="text-lg font-bold text-black dark:text-white">취소 신청</h2>
          <button type="button" onClick={onClose} className="p-2 -m-2 text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-400" aria-label="닫기">
            <X size={22} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div className="rounded-lg bg-neutral-100 dark:bg-neutral-800 p-3 text-sm">
            <div className="font-medium text-black dark:text-white">{schedule.classes?.title || '수업'}</div>
            <div className="text-neutral-600 dark:text-neutral-400 mt-1">
              {formatDateTime(schedule.start_time)} ~ {new Date(schedule.end_time).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })}
            </div>
            {schedule.academies?.name_kr && (
              <div className="text-neutral-500 dark:text-neutral-500 mt-0.5">{schedule.academies.name_kr}</div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-black dark:text-white mb-2">사유 (필수)</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="취소 신청 사유를 입력해주세요."
              rows={3}
              className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-black dark:text-white resize-none"
              required
            />
          </div>

          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-lg border border-neutral-300 dark:border-neutral-600 text-black dark:text-white"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={submitLoading}
              className="flex-1 py-2.5 rounded-lg bg-primary text-black font-medium disabled:opacity-50"
            >
              {submitLoading ? '신청 중...' : '신청하기'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
