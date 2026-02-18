"use client";

import { useState, useEffect, useCallback } from 'react';
import { X, Search, User } from 'lucide-react';
import { fetchWithAuth } from '@/lib/api/auth-fetch';

interface ScheduleSummary {
  id: string;
  start_time: string;
  end_time: string;
  classes?: { title: string | null };
  academies?: { name_kr: string | null };
}

interface SubstituteCandidate {
  id: string;
  name_kr: string | null;
  name_en: string | null;
}

interface InstructorSubstituteRequestModalProps {
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

export function InstructorSubstituteRequestModal({
  isOpen,
  onClose,
  schedule,
  onSuccess,
}: InstructorSubstituteRequestModalProps) {
  const [reason, setReason] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [candidates, setCandidates] = useState<SubstituteCandidate[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [directName, setDirectName] = useState('');
  const [useDirectName, setUseDirectName] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchCandidates = useCallback(async (q: string) => {
    if (!schedule?.id) return;
    setSearchLoading(true);
    try {
      const url = `/api/instructor/schedule/${schedule.id}/substitute-candidates${q ? `?q=${encodeURIComponent(q)}` : ''}`;
      const res = await fetchWithAuth(url);
      const data = await res.json();
      if (res.ok) setCandidates(data.instructors || []);
      else setCandidates([]);
    } catch {
      setCandidates([]);
    } finally {
      setSearchLoading(false);
    }
  }, [schedule?.id]);

  useEffect(() => {
    if (!isOpen || !schedule?.id) return;
    const t = setTimeout(() => fetchCandidates(searchQuery), 300);
    return () => clearTimeout(t);
  }, [isOpen, schedule?.id, searchQuery, fetchCandidates]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!reason.trim()) {
      setError('사유를 입력해주세요.');
      return;
    }
    if (!useDirectName && !selectedId) {
      setError('대강 강사를 검색에서 선택하거나, 직접 입력을 선택해 이름을 입력해주세요.');
      return;
    }
    if (useDirectName && !directName.trim()) {
      setError('대강 강사 이름을 입력해주세요.');
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
          request_type: 'SUBSTITUTE',
          reason: reason.trim(),
          requested_instructor_id: useDirectName ? null : selectedId || null,
          requested_instructor_name: useDirectName ? directName.trim() : null,
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

  const displayName = useDirectName
    ? directName.trim() || '(이름 입력)'
    : selectedId
      ? candidates.find((c) => c.id === selectedId)?.name_kr || candidates.find((c) => c.id === selectedId)?.name_en || '(선택됨)'
      : '(검색 후 선택 또는 직접 입력)';

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4">
      <div
        className="bg-white dark:bg-neutral-900 w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-700 px-4 py-3 flex items-center justify-between">
          <h2 className="text-lg font-bold text-black dark:text-white">대강 신청</h2>
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
            <label className="block text-sm font-medium text-black dark:text-white mb-2">대강 강사</label>
            <div className="flex gap-2 mb-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="mode"
                  checked={!useDirectName}
                  onChange={() => { setUseDirectName(false); setDirectName(''); }}
                />
                <span className="text-sm">검색해서 선택</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="mode"
                  checked={useDirectName}
                  onChange={() => { setUseDirectName(true); setSelectedId(null); }}
                />
                <span className="text-sm">직접 입력</span>
              </label>
            </div>
            {!useDirectName ? (
              <>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={18} />
                  <input
                    type="text"
                    placeholder="강사 이름 검색"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-black dark:text-white"
                  />
                </div>
                <div className="mt-2 max-h-40 overflow-y-auto border border-neutral-200 dark:border-neutral-700 rounded-lg">
                  {searchLoading && <div className="p-3 text-sm text-neutral-500">검색 중...</div>}
                  {!searchLoading && candidates.length === 0 && <div className="p-3 text-sm text-neutral-500">검색어를 입력하면 같은 학원 강사 목록이 표시됩니다.</div>}
                  {!searchLoading && candidates.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => { setSelectedId(c.id); }}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-neutral-100 dark:hover:bg-neutral-700 ${selectedId === c.id ? 'bg-primary/10 dark:bg-primary/20' : ''}`}
                    >
                      <User size={16} />
                      <span className="text-black dark:text-white">{c.name_kr || c.name_en || '-'}</span>
                    </button>
                  ))}
                </div>
                <p className="text-xs text-neutral-500 mt-1">선택: {displayName}</p>
              </>
            ) : (
              <input
                type="text"
                placeholder="대강 강사 이름"
                value={directName}
                onChange={(e) => setDirectName(e.target.value)}
                className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-black dark:text-white"
              />
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-black dark:text-white mb-2">사유 (필수)</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="대강 신청 사유를 입력해주세요."
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
