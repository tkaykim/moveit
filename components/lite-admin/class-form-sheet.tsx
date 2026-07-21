'use client';

import { useState } from 'react';
import { X, Trash2 } from 'lucide-react';
import { fetchWithAuth } from '@/lib/api/auth-fetch';

export interface Refs {
  classGroups: { id: string; name: string; is_special: boolean }[];
  halls: { id: string; name: string }[];
  memberships: { id: string; name: string }[];
}

export interface EditTarget {
  schedule_id: string;
  class_id: string;
  class_title: string;
  class_group_id: string | null;
  instructor_name: string | null;
  hall_id: string | null;
  max_students: number | null;
  start_time: string;
  end_time: string | null;
  is_canceled: boolean;
}

function isoToKstDate(iso: string): string {
  return new Date(new Date(iso).getTime() + 9 * 3600_000).toISOString().slice(0, 10);
}
function isoToKstTime(iso: string): string {
  return new Date(new Date(iso).getTime() + 9 * 3600_000).toISOString().slice(11, 16);
}

const inputCls =
  'w-full h-12 px-3 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-[15px]';
const labelCls = 'block text-[12px] font-bold text-neutral-500 mb-1.5';

/**
 * 수업 추가 / 수정 시트.
 * - 추가: 제목·수업군(필수)·강사·홀·날짜·시간·정원·반복·전문반전용 → POST /api/a/[id]/classes
 * - 수정: 시간·정원·강사·홀·수업군 → PATCH /api/a/[id]/schedules/[scheduleId]
 * - 휴강: 같은 PATCH 로 { isCanceled:true } (소프트, 자동 환불/연장/알림은 기존 파이프라인)
 */
export function ClassFormSheet({
  academyId,
  brand,
  refs,
  mode,
  defaultDate,
  edit,
  onClose,
  onSaved,
}: {
  academyId: string;
  brand: string;
  refs: Refs;
  mode: 'create' | 'edit';
  defaultDate: string;
  edit?: EditTarget;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(edit?.class_title ?? '');
  const [classGroupId, setClassGroupId] = useState(edit?.class_group_id ?? '');
  const [instructorName, setInstructorName] = useState(edit?.instructor_name ?? '');
  const [hallId, setHallId] = useState(edit?.hall_id ?? '');
  const [audienceMembershipId, setAudienceMembershipId] = useState('');
  const [date, setDate] = useState(edit ? isoToKstDate(edit.start_time) : defaultDate);
  const [startTime, setStartTime] = useState(edit ? isoToKstTime(edit.start_time) : '19:00');
  const [endTime, setEndTime] = useState(
    edit?.end_time ? isoToKstTime(edit.end_time) : '20:30'
  );
  const [capacity, setCapacity] = useState(String(edit?.max_students ?? 20));
  const [repeatWeeks, setRepeatWeeks] = useState(1);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    if (busy) return;
    setErr(null);
    if (mode === 'create' && !title.trim()) return setErr('수업 제목을 입력해 주세요.');
    if (!classGroupId) return setErr('수업군을 선택해 주세요. (예약을 열려면 필수예요)');
    setBusy(true);
    try {
      let res: Response;
      if (mode === 'create') {
        res = await fetchWithAuth(`/api/a/${academyId}/classes`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            title: title.trim(),
            classGroupId,
            instructorName: instructorName.trim() || null,
            hallId: hallId || null,
            audienceMembershipId: audienceMembershipId || null,
            capacity: Number(capacity) || 20,
            date,
            startTime,
            endTime,
            repeatWeeks,
          }),
        });
      } else {
        res = await fetchWithAuth(`/api/a/${academyId}/schedules/${edit!.schedule_id}`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            date,
            startTime,
            endTime,
            capacity: Number(capacity) || undefined,
            instructorName: instructorName.trim() || null,
            hallId: hallId || null,
            classGroupId: classGroupId || undefined,
          }),
        });
      }
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(json?.error || '저장에 실패했어요.');
        return;
      }
      onSaved();
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const cancelClass = async () => {
    if (!edit || busy) return;
    if (!window.confirm('이 수업을 휴강 처리할까요?\n신청 학생의 횟수 복구·기간 연장·안내는 자동으로 이뤄져요.')) return;
    setBusy(true);
    try {
      const res = await fetchWithAuth(`/api/a/${academyId}/schedules/${edit.schedule_id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ isCanceled: true }),
      });
      if (res.ok) {
        onSaved();
        onClose();
      } else {
        setErr('휴강 처리에 실패했어요.');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40" role="dialog" aria-modal="true" data-testid="class-form-sheet">
      <button type="button" aria-label="닫기" className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute inset-x-0 bottom-0 mx-auto max-w-lg bg-white dark:bg-neutral-950 rounded-t-3xl max-h-[92dvh] flex flex-col">
        <div className="px-5 pt-4 pb-3 border-b border-neutral-100 dark:border-neutral-800 flex items-center">
          <p className="text-[17px] font-extrabold">{mode === 'create' ? '수업 추가' : '수업 수정'}</p>
          <button
            type="button"
            aria-label="닫기"
            onClick={onClose}
            className="ml-auto w-9 h-9 flex items-center justify-center rounded-full bg-neutral-100 dark:bg-neutral-800"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {mode === 'create' && (
            <div>
              <label className={labelCls}>수업 제목</label>
              <input
                data-testid="field-title"
                className={inputCls}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="예: 초급 힙합"
              />
            </div>
          )}

          <div>
            <label className={labelCls}>수업군 (예약 열림에 필수)</label>
            <select
              data-testid="field-group"
              className={inputCls}
              value={classGroupId}
              onChange={(e) => setClassGroupId(e.target.value)}
            >
              <option value="">선택해 주세요</option>
              {refs.classGroups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                  {g.is_special ? ' (특별)' : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>강사명</label>
              <input
                data-testid="field-instructor"
                className={inputCls}
                value={instructorName}
                onChange={(e) => setInstructorName(e.target.value)}
                placeholder="강사 이름"
              />
            </div>
            <div>
              <label className={labelCls}>홀 (선택)</label>
              <select
                data-testid="field-hall"
                className={inputCls}
                value={hallId}
                onChange={(e) => setHallId(e.target.value)}
              >
                <option value="">미지정</option>
                {refs.halls.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className={labelCls}>날짜</label>
            <input
              data-testid="field-date"
              type="date"
              className={inputCls}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>시작</label>
              <input
                data-testid="field-start"
                type="time"
                className={inputCls}
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div>
              <label className={labelCls}>종료</label>
              <input
                data-testid="field-end"
                type="time"
                className={inputCls}
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>정원</label>
              <input
                data-testid="field-capacity"
                type="number"
                min={1}
                className={inputCls}
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
              />
            </div>
            {mode === 'create' && (
              <div>
                <label className={labelCls}>반복</label>
                <select
                  data-testid="field-repeat"
                  className={inputCls}
                  value={repeatWeeks}
                  onChange={(e) => setRepeatWeeks(Number(e.target.value))}
                >
                  <option value={1}>단회</option>
                  <option value={4}>매주 · 4주</option>
                  <option value={8}>매주 · 8주</option>
                  <option value={12}>매주 · 12주</option>
                </select>
              </div>
            )}
          </div>

          {mode === 'create' && refs.memberships.length > 0 && (
            <div>
              <label className={labelCls}>전문반 전용 (선택)</label>
              <select
                data-testid="field-audience"
                className={inputCls}
                value={audienceMembershipId}
                onChange={(e) => setAudienceMembershipId(e.target.value)}
              >
                <option value="">전체 공개</option>
                {refs.memberships.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} 전용
                  </option>
                ))}
              </select>
            </div>
          )}

          {err && <p className="text-[13px] font-semibold text-red-500">{err}</p>}
        </div>

        <div className="px-5 py-3 border-t border-neutral-100 dark:border-neutral-800 space-y-2" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 12px)' }}>
          <button
            type="button"
            data-testid="class-form-save"
            disabled={busy}
            onClick={submit}
            className="w-full h-12 rounded-xl font-extrabold text-white text-[15px] disabled:opacity-50"
            style={{ backgroundColor: brand }}
          >
            {busy ? '저장 중...' : mode === 'create' ? '수업 만들기' : '저장'}
          </button>
          {mode === 'edit' && !edit?.is_canceled && (
            <button
              type="button"
              data-testid="class-form-cancel-class"
              disabled={busy}
              onClick={cancelClass}
              className="w-full h-11 rounded-xl font-bold text-[14px] flex items-center justify-center gap-1.5 text-red-600 border border-red-200 dark:border-red-900/50 disabled:opacity-50"
            >
              <Trash2 size={15} /> 휴강 처리
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
