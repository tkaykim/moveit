'use client';

import { useState } from 'react';
import { X, Check, UserX, RotateCcw, Phone } from 'lucide-react';
import { fetchWithAuth } from '@/lib/api/auth-fetch';
import { CopyLinkButton } from '@/components/share/copy-link-button';

export interface RosterStudent {
  booking_id: string;
  student_name: string;
  contact: string | null;
  ticket_name: string | null;
  attendance_state: 'ATTENDED' | 'BOOKED' | 'CANCELLED' | 'PENDING';
  attendance_label: string;
  from_held_order: boolean;
}

export interface RosterOccurrence {
  schedule_id: string;
  class_title: string;
  instructor_name: string | null;
  start_time: string;
  end_time: string | null;
  is_canceled: boolean;
  max_students: number | null;
  booked_count: number;
  attended_count: number;
  held_count: number;
  students: RosterStudent[];
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Seoul',
  });
}

const STATE_STYLE: Record<RosterStudent['attendance_state'], string> = {
  ATTENDED: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  BOOKED: 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300',
  CANCELLED: 'bg-neutral-100 text-neutral-400 dark:bg-neutral-800 dark:text-neutral-500',
  PENDING: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
};

/**
 * 신청자 명단 시트 (하단 슬라이드업).
 * 한 줄 = 한 학생. 원탭 출석/결석/되돌리기 — 기존 예약 상태 API(/api/bookings/[id]/status)를 그대로 쓴다.
 * 스태프 전이는 이미 서버에서 인가된다. 중복 탭은 서버가 멱등 처리한다.
 */
export function RosterSheet({
  slug,
  occurrence,
  onClose,
  onChanged,
}: {
  slug: string;
  occurrence: RosterOccurrence;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const shareUrl = `${origin}/s/${slug}/c/${occurrence.schedule_id}`;

  const setStatus = async (bookingId: string, status: 'COMPLETED' | 'ABSENT' | 'CONFIRMED') => {
    if (busy) return;
    setBusy(bookingId + status);
    try {
      const res = await fetchWithAuth(`/api/bookings/${bookingId}/status`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (res.ok) onChanged();
    } finally {
      setBusy(null);
    }
  };

  const students = occurrence.students ?? [];

  return (
    <div className="fixed inset-0 z-40" role="dialog" aria-modal="true" data-testid="roster-sheet">
      <button type="button" aria-label="닫기" className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute inset-x-0 bottom-0 mx-auto max-w-lg bg-white dark:bg-neutral-950 rounded-t-3xl max-h-[86dvh] flex flex-col">
        {/* 헤더 */}
        <div className="px-5 pt-4 pb-3 border-b border-neutral-100 dark:border-neutral-800">
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-[17px] font-extrabold truncate">{occurrence.class_title}</p>
              <p className="text-xs text-neutral-500 mt-0.5">
                {fmtTime(occurrence.start_time)}
                {occurrence.end_time ? `–${fmtTime(occurrence.end_time)}` : ''}
                {occurrence.instructor_name ? ` · ${occurrence.instructor_name}` : ''}
                {occurrence.is_canceled ? ' · 휴강' : ''}
              </p>
            </div>
            <button
              type="button"
              aria-label="닫기"
              onClick={onClose}
              className="w-9 h-9 flex items-center justify-center rounded-full bg-neutral-100 dark:bg-neutral-800 flex-shrink-0"
            >
              <X size={18} />
            </button>
          </div>
          <div className="flex items-center gap-2 mt-3">
            <span className="text-[12px] font-bold text-neutral-500">
              신청 {occurrence.booked_count}
              {typeof occurrence.max_students === 'number' ? `/${occurrence.max_students}` : ''} · 출석 {occurrence.attended_count}
            </span>
            <CopyLinkButton
              url={shareUrl}
              label="신청링크 복사"
              copiedLabel="복사됐어요"
              testId="copy-share-link"
              className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-neutral-300 dark:border-neutral-700 px-2.5 py-1.5 text-[12px] font-semibold text-neutral-700 dark:text-neutral-200"
            />
          </div>
        </div>

        {/* 명단 */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {students.length === 0 ? (
            <p className="py-12 text-center text-sm text-neutral-400">아직 신청자가 없어요</p>
          ) : (
            <ul className="space-y-2" data-testid="roster-list">
              {students.map((s) => {
                const canAttend = s.attendance_state === 'BOOKED';
                const attended = s.attendance_state === 'ATTENDED';
                return (
                  <li
                    key={s.booking_id}
                    data-testid="roster-row"
                    data-booking-id={s.booking_id}
                    data-state={s.attendance_state}
                    className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800"
                  >
                    <div className="flex items-center gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-[14px] font-bold truncate">{s.student_name}</p>
                        <p className="text-[11px] text-neutral-500 truncate mt-0.5 flex items-center gap-2">
                          {s.contact && (
                            <span className="inline-flex items-center gap-0.5">
                              <Phone size={10} /> {s.contact}
                            </span>
                          )}
                          {s.ticket_name && <span className="truncate">{s.ticket_name}</span>}
                        </p>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded-md text-[11px] font-bold flex-shrink-0 ${STATE_STYLE[s.attendance_state]}`}
                      >
                        {s.attendance_label}
                      </span>
                    </div>

                    {/* 원탭 액션 */}
                    {s.attendance_state !== 'CANCELLED' && (
                      <div className="flex gap-2 mt-2.5">
                        {attended ? (
                          <button
                            type="button"
                            data-testid="act-undo"
                            disabled={!!busy}
                            onClick={() => setStatus(s.booking_id, 'CONFIRMED')}
                            className="flex-1 h-10 rounded-lg text-[13px] font-bold flex items-center justify-center gap-1 bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 disabled:opacity-50"
                          >
                            <RotateCcw size={14} /> 되돌리기
                          </button>
                        ) : (
                          <>
                            <button
                              type="button"
                              data-testid="act-attend"
                              disabled={!!busy || !canAttend}
                              onClick={() => setStatus(s.booking_id, 'COMPLETED')}
                              className="flex-1 h-10 rounded-lg text-[13px] font-bold flex items-center justify-center gap-1 text-white disabled:opacity-40"
                              style={{ backgroundColor: '#059669' }}
                            >
                              <Check size={15} /> 출석
                            </button>
                            <button
                              type="button"
                              data-testid="act-absent"
                              disabled={!!busy || (!canAttend && s.attendance_state !== 'PENDING')}
                              onClick={() => setStatus(s.booking_id, 'ABSENT')}
                              className="flex-1 h-10 rounded-lg text-[13px] font-bold flex items-center justify-center gap-1 border border-neutral-300 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 disabled:opacity-40"
                            >
                              <UserX size={15} /> 결석
                            </button>
                          </>
                        )}
                      </div>
                    )}
                    {s.attendance_state === 'PENDING' && (
                      <p className="mt-1.5 text-[10px] text-amber-600 dark:text-amber-400">
                        입금 확인 전이에요 (입금·결제 탭은 준비 중)
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
