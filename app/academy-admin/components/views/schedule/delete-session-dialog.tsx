"use client";

import { useEffect, useState } from 'react';
import { X, Trash2, AlertTriangle } from 'lucide-react';
import {
  deleteRecurringSessions,
  getRecurringSessionCounts,
  type DeleteScope,
} from '@/lib/utils/delete-recurring-sessions';

interface DeleteSessionDialogProps {
  session: {
    id: string;
    start_time: string;
    recurring_schedule_id?: string | null;
  };
  onClose: () => void;
  onDeleted: () => void;
}

export function DeleteSessionDialog({ session, onClose, onDeleted }: DeleteSessionDialogProps) {
  const recurringId = session.recurring_schedule_id || null;
  const [scope, setScope] = useState<DeleteScope>('single');
  const [counts, setCounts] = useState<{ total: number; future: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [countsLoading, setCountsLoading] = useState(!!recurringId);

  useEffect(() => {
    if (!recurringId) return;
    let cancelled = false;
    (async () => {
      try {
        const c = await getRecurringSessionCounts({
          recurringScheduleId: recurringId,
          startTime: session.start_time,
        });
        if (!cancelled) setCounts(c);
      } catch (e) {
        if (!cancelled) setCounts({ total: 0, future: 0 });
      } finally {
        if (!cancelled) setCountsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [recurringId, session.start_time]);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      const result = await deleteRecurringSessions({
        sessionId: session.id,
        recurringScheduleId: recurringId,
        startTime: session.start_time,
        scope,
      });

      const parts = [`세션 ${result.deletedSessions}개가 삭제되었습니다.`];
      if (result.deletedBookings > 0) {
        parts.push(`연관된 예약 ${result.deletedBookings}건도 함께 정리되었습니다.`);
      }
      alert(parts.join('\n'));
      onDeleted();
    } catch (error: any) {
      console.error('Error deleting sessions:', error);
      alert(`삭제 실패: ${error.message ?? error}`);
    } finally {
      setLoading(false);
    }
  };

  const futureCount = counts?.future ?? 0;
  const totalCount = counts?.total ?? 0;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
        <div className="p-5 border-b dark:border-neutral-800 flex justify-between items-center">
          <h3 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
            <Trash2 size={18} className="text-red-600" />
            수업 삭제
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" disabled={loading}>
            <X size={20} />
          </button>
        </div>

        <div className="p-5 space-y-3">
          {!recurringId ? (
            <p className="text-sm text-gray-600 dark:text-gray-400">
              이 세션을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
            </p>
          ) : (
            <>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                이 수업은 반복 일정으로 등록되어 있습니다. 삭제 범위를 선택해주세요.
              </p>

              <label
                className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                  scope === 'single' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-200 dark:border-neutral-700 hover:bg-gray-50 dark:hover:bg-neutral-800'
                }`}
              >
                <input
                  type="radio"
                  name="delete-scope"
                  value="single"
                  checked={scope === 'single'}
                  onChange={() => setScope('single')}
                  className="mt-1"
                />
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-900 dark:text-white">이 수업만 삭제</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">선택한 날짜의 세션 1건만 삭제합니다.</div>
                </div>
              </label>

              <label
                className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                  scope === 'future' ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/20' : 'border-gray-200 dark:border-neutral-700 hover:bg-gray-50 dark:hover:bg-neutral-800'
                }`}
              >
                <input
                  type="radio"
                  name="delete-scope"
                  value="future"
                  checked={scope === 'future'}
                  onChange={() => setScope('future')}
                  className="mt-1"
                />
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-900 dark:text-white">이 날짜 이후 전체 삭제</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    이 세션을 포함해 같은 반복 일정의 이후 세션들을 삭제합니다.
                    {countsLoading ? ' (집계 중…)' : ` (${futureCount}건)`}
                  </div>
                </div>
              </label>

              <label
                className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                  scope === 'all' ? 'border-red-500 bg-red-50 dark:bg-red-900/20' : 'border-gray-200 dark:border-neutral-700 hover:bg-gray-50 dark:hover:bg-neutral-800'
                }`}
              >
                <input
                  type="radio"
                  name="delete-scope"
                  value="all"
                  checked={scope === 'all'}
                  onChange={() => setScope('all')}
                  className="mt-1"
                />
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-900 dark:text-white">전체 삭제</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    같은 반복 일정의 모든 세션(과거 포함)을 삭제합니다.
                    {countsLoading ? ' (집계 중…)' : ` (${totalCount}건)`}
                  </div>
                </div>
              </label>
            </>
          )}

          <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900 rounded-lg">
            <AlertTriangle size={16} className="text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
            <div className="text-xs text-red-700 dark:text-red-300">
              연관된 예약도 함께 삭제됩니다. 이 작업은 되돌릴 수 없습니다.
            </div>
          </div>
        </div>

        <div className="p-5 border-t dark:border-neutral-800 flex gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 px-4 py-2 border dark:border-neutral-700 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors disabled:opacity-50"
          >
            취소
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading || countsLoading}
            className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Trash2 size={16} /> {loading ? '삭제 중…' : '삭제'}
          </button>
        </div>
      </div>
    </div>
  );
}
