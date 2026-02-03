"use client";

import { useState } from 'react';
import { X, Calendar } from 'lucide-react';

interface TicketExtensionRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  userTicketId: string;
  ticketName: string;
  maxExtensionDays: number | null;
  onSuccess: () => void;
}

export function TicketExtensionRequestModal({
  isOpen,
  onClose,
  userTicketId,
  ticketName,
  maxExtensionDays,
  onSuccess,
}: TicketExtensionRequestModalProps) {
  const [requestType, setRequestType] = useState<'EXTENSION' | 'PAUSE'>('EXTENSION');
  const [absentStart, setAbsentStart] = useState('');
  const [absentEnd, setAbsentEnd] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!absentStart || !absentEnd) {
      setError('휴가/불참 기간(시작일·종료일)을 선택해주세요.');
      return;
    }
    const start = new Date(absentStart);
    const end = new Date(absentEnd);
    if (end < start) {
      setError('종료일은 시작일 이후여야 합니다.');
      return;
    }
    if (requestType === 'EXTENSION' && maxExtensionDays != null) {
      const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      if (days > maxExtensionDays) {
        setError(`연장 신청은 최대 ${maxExtensionDays}일까지 가능합니다.`);
        return;
      }
    }
    setLoading(true);
    try {
      const res = await fetch('/api/ticket-extension-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_ticket_id: userTicketId,
          request_type: requestType,
          absent_start_date: absentStart,
          absent_end_date: absentEnd,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '신청에 실패했습니다.');
      alert('신청이 접수되었습니다. 관리자 승인 후 반영됩니다.');
      setAbsentStart('');
      setAbsentEnd('');
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
                ? '휴가/불참 기간만큼 만료일이 연장됩니다.'
                : '해당 기간만큼 유효기간이 연장됩니다.'}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">시작일</label>
              <input
                type="date"
                value={absentStart}
                onChange={(e) => setAbsentStart(e.target.value)}
                className="w-full px-3 py-2 border dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">종료일</label>
              <input
                type="date"
                value={absentEnd}
                onChange={(e) => setAbsentEnd(e.target.value)}
                className="w-full px-3 py-2 border dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-gray-900 dark:text-white"
              />
            </div>
          </div>
          {maxExtensionDays != null && requestType === 'EXTENSION' && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              이 학원은 연장 신청 시 최대 {maxExtensionDays}일까지 가능합니다.
            </p>
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
