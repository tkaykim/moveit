"use client";

import { fetchWithAuth } from '@/lib/api/auth-fetch';

import { useState } from 'react';
import { X } from 'lucide-react';

interface TicketExtensionRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  userTicketId: string;
  ticketName: string;
  /** 현재 수강권 만료일 (YYYY-MM-DD). 없으면 표시 생략 */
  expiryDate: string | null;
  maxExtensionDays: number | null;
  onSuccess: () => void;
}

export function TicketExtensionRequestModal({
  isOpen,
  onClose,
  userTicketId,
  ticketName,
  expiryDate,
  maxExtensionDays,
  onSuccess,
}: TicketExtensionRequestModalProps) {
  const [requestType, setRequestType] = useState<'EXTENSION' | 'PAUSE'>('EXTENSION');
  const [extensionDays, setExtensionDays] = useState<number | ''>('');
  const [absentStart, setAbsentStart] = useState('');
  const [absentEnd, setAbsentEnd] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const formatDate = (d: Date) => d.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });

  const todayStr = (() => {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  })();

  // 연장 요약 계산
  const extensionSummary = (() => {
    let days = 0;
    if (requestType === 'EXTENSION') {
      days = typeof extensionDays === 'number' && extensionDays > 0 ? extensionDays : 0;
    } else if (requestType === 'PAUSE' && absentStart && absentEnd) {
      const start = new Date(absentStart);
      const end = new Date(absentEnd);
      if (end >= start) {
        days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      }
    }
    if (days <= 0) return null;
    const currentExpiry = expiryDate ? new Date(expiryDate) : null;
    const newExpiry = currentExpiry
      ? new Date(currentExpiry.getTime() + days * 24 * 60 * 60 * 1000)
      : null;
    return { extensionDays: days, currentExpiry, newExpiry };
  })();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!reason.trim()) {
      setError('사유를 입력해주세요.');
      return;
    }

    if (requestType === 'EXTENSION') {
      if (!extensionDays || extensionDays <= 0) {
        setError('연장 일수를 입력해주세요.');
        return;
      }
      if (maxExtensionDays != null && extensionDays > maxExtensionDays) {
        setError(`연장은 최대 ${maxExtensionDays}일까지 가능합니다.`);
        return;
      }
    }

    if (requestType === 'PAUSE') {
      if (!absentStart || !absentEnd) {
        setError('일시정지 기간(시작일·종료일)을 선택해주세요.');
        return;
      }
      const start = new Date(absentStart);
      const end = new Date(absentEnd);
      if (end < start) {
        setError('종료일은 시작일 이후여야 합니다.');
        return;
      }
      if (start < new Date(todayStr) || end < new Date(todayStr)) {
        setError('시작일과 종료일은 오늘 이후로 선택해주세요.');
        return;
      }
      const pauseDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      if (maxExtensionDays != null && pauseDays > maxExtensionDays) {
        setError(`일시정지는 최대 ${maxExtensionDays}일까지 가능합니다.`);
        return;
      }
    }

    setLoading(true);
    try {
      const res = await fetchWithAuth('/api/ticket-extension-requests', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_ticket_id: userTicketId,
          request_type: requestType,
          extension_days: requestType === 'EXTENSION' ? extensionDays : undefined,
          absent_start_date: requestType === 'PAUSE' ? absentStart : undefined,
          absent_end_date: requestType === 'PAUSE' ? absentEnd : undefined,
          reason: reason.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '신청에 실패했습니다.');
      alert('신청이 접수되었습니다. 관리자 승인 후 반영됩니다.');
      setExtensionDays('');
      setAbsentStart('');
      setAbsentEnd('');
      setReason('');
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || '신청에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 dark:bg-black/70">
      <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-4 border-b dark:border-neutral-800 flex justify-between items-center">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">연장/일시정지 신청</h3>
          <button type="button" onClick={onClose} className="p-1 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            수강권: <span className="font-medium text-gray-900 dark:text-white">{ticketName}</span>
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">신청 유형</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setRequestType('EXTENSION')}
                className={`flex-1 py-2 rounded-lg text-sm font-medium ${
                  requestType === 'EXTENSION'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-gray-400'
                }`}
              >
                연장 신청
              </button>
              <button
                type="button"
                onClick={() => setRequestType('PAUSE')}
                className={`flex-1 py-2 rounded-lg text-sm font-medium ${
                  requestType === 'PAUSE'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-gray-400'
                }`}
              >
                일시정지
              </button>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {requestType === 'EXTENSION'
                ? '입력한 일수만큼 만료일이 연장됩니다.'
                : '일시정지 기간만큼 만료일이 뒤로 밀립니다.'}
            </p>
          </div>

          {requestType === 'EXTENSION' ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">연장 일수</label>
              <input
                type="number"
                min={1}
                max={maxExtensionDays ?? 365}
                value={extensionDays}
                onChange={(e) => setExtensionDays(e.target.value ? parseInt(e.target.value) : '')}
                placeholder="예: 7"
                className="w-full px-3 py-2 border dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-gray-900 dark:text-white"
              />
              {maxExtensionDays != null && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  이 학원은 최대 {maxExtensionDays}일까지 가능합니다.
                </p>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">시작일</label>
                <input
                  type="date"
                  value={absentStart}
                  min={todayStr}
                  onChange={(e) => setAbsentStart(e.target.value)}
                  className="w-full px-3 py-2 border dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">종료일</label>
                <input
                  type="date"
                  value={absentEnd}
                  min={todayStr}
                  onChange={(e) => setAbsentEnd(e.target.value)}
                  className="w-full px-3 py-2 border dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-gray-900 dark:text-white"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              사유 <span className="text-red-500">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="연장/일시정지 사유를 입력해주세요."
              rows={2}
              className="w-full px-3 py-2 border dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-gray-900 dark:text-white resize-none"
            />
          </div>

          {extensionSummary && (
            <div className="rounded-lg border border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-800/50 p-3 space-y-1.5 text-sm">
              <p className="font-medium text-gray-900 dark:text-white">신청 요약</p>
              <p className="text-gray-600 dark:text-gray-400">
                연장 일수: <span className="font-medium text-gray-900 dark:text-white">{extensionSummary.extensionDays}일</span>
              </p>
              {extensionSummary.currentExpiry && (
                <p className="text-gray-600 dark:text-gray-400">
                  연장 전 만료일: <span className="font-medium text-gray-900 dark:text-white">{formatDate(extensionSummary.currentExpiry)}</span>
                </p>
              )}
              {extensionSummary.newExpiry && (
                <p className="text-gray-600 dark:text-gray-400">
                  연장 후 만료일: <span className="font-medium text-primary dark:text-[#CCFF00]">{formatDate(extensionSummary.newExpiry)}</span>
                </p>
              )}
              {!extensionSummary.currentExpiry && (
                <p className="text-gray-500 dark:text-gray-500 text-xs">이 수강권은 만료일이 없어 연장 후 만료일만 적용됩니다.</p>
              )}
            </div>
          )}

          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 border dark:border-neutral-700 rounded-xl text-gray-700 dark:text-gray-300 font-medium"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2.5 bg-primary dark:bg-[#CCFF00] text-black font-bold rounded-xl disabled:opacity-50"
            >
              {loading ? '신청 중...' : '신청하기'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
