"use client";

import { useState } from 'react';
import { X, Minus, Plus, AlertTriangle } from 'lucide-react';
import { getSupabaseClient } from '@/lib/utils/supabase-client';

interface TicketAdjustModalProps {
  ticket: {
    id: string;
    remaining_count: number | null;
    status: string;
    tickets: {
      id: string;
      name: string;
      ticket_type: string;
      total_count?: number | null;
    };
  };
  studentName: string;
  academyId: string;
  onClose: () => void;
  onSuccess: () => void;
}

type AdjustMode = 'deduct' | 'add';

export function TicketAdjustModal({
  ticket,
  studentName,
  academyId,
  onClose,
  onSuccess,
}: TicketAdjustModalProps) {
  const [mode, setMode] = useState<AdjustMode>('deduct');
  const [amount, setAmount] = useState(1);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const currentCount = ticket.remaining_count ?? 0;
  const delta = mode === 'deduct' ? -amount : amount;
  const newCount = currentCount + delta;
  const isValid = amount > 0 && reason.trim().length > 0 && newCount >= 0;

  const handleSubmit = async () => {
    if (!isValid) return;
    setLoading(true);
    setError('');

    try {
      const supabase = getSupabaseClient();
      if (!supabase) throw new Error('인증 정보를 확인할 수 없습니다.');

      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      const res = await fetch(`/api/academy-admin/${academyId}/adjust-ticket-count`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          user_ticket_id: ticket.id,
          delta,
          reason: reason.trim(),
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || '횟수 조정에 실패했습니다.');
      }

      onSuccess();
    } catch (e: any) {
      setError(e.message || '알 수 없는 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 dark:bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
        <div className="p-5 border-b dark:border-neutral-800 flex justify-between items-center">
          <h3 className="text-lg font-bold text-gray-800 dark:text-white">
            횟수 조정
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-5 space-y-5">
          <div className="bg-gray-50 dark:bg-neutral-800 rounded-xl p-4 space-y-1.5">
            <div className="text-sm text-gray-500 dark:text-gray-400">회원</div>
            <div className="font-medium text-gray-900 dark:text-white">{studentName}</div>
            <div className="text-sm text-gray-500 dark:text-gray-400 mt-2">수강권</div>
            <div className="font-medium text-gray-900 dark:text-white">{ticket.tickets.name}</div>
            <div className="text-sm text-gray-500 dark:text-gray-400 mt-2">현재 잔여 횟수</div>
            <div className="text-xl font-bold text-blue-600 dark:text-blue-400">
              {currentCount}회
              {ticket.tickets.total_count != null && (
                <span className="text-sm font-normal text-gray-400 dark:text-gray-500 ml-1">
                  / {ticket.tickets.total_count}회
                </span>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              조정 유형
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setMode('deduct')}
                className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                  mode === 'deduct'
                    ? 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-800 text-red-700 dark:text-red-400'
                    : 'border-gray-200 dark:border-neutral-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-neutral-800'
                }`}
              >
                <Minus size={16} />
                차감
              </button>
              <button
                type="button"
                onClick={() => setMode('add')}
                className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                  mode === 'add'
                    ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-800 text-green-700 dark:text-green-400'
                    : 'border-gray-200 dark:border-neutral-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-neutral-800'
                }`}
              >
                <Plus size={16} />
                충전
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {mode === 'deduct' ? '차감' : '충전'} 횟수
            </label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setAmount((a) => Math.max(1, a - 1))}
                disabled={amount <= 1}
                className="w-10 h-10 flex items-center justify-center rounded-lg border dark:border-neutral-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-neutral-800 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Minus size={16} />
              </button>
              <input
                type="number"
                min={1}
                max={mode === 'deduct' ? currentCount : 999}
                value={amount}
                onChange={(e) => {
                  const v = parseInt(e.target.value, 10);
                  if (!isNaN(v) && v >= 0) setAmount(v);
                }}
                className="w-20 text-center text-lg font-bold border dark:border-neutral-700 rounded-lg py-2 bg-white dark:bg-neutral-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 outline-none"
              />
              <button
                type="button"
                onClick={() => setAmount((a) => a + 1)}
                disabled={mode === 'deduct' && amount >= currentCount}
                className="w-10 h-10 flex items-center justify-center rounded-lg border dark:border-neutral-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-neutral-800 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Plus size={16} />
              </button>
            </div>
          </div>

          {newCount >= 0 && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-gray-500 dark:text-gray-400">조정 후 잔여:</span>
              <span className={`font-bold text-lg ${
                mode === 'deduct' ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'
              }`}>
                {currentCount} → {newCount}회
              </span>
            </div>
          )}

          {mode === 'deduct' && newCount < 0 && (
            <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg text-sm text-red-600 dark:text-red-400">
              <AlertTriangle size={16} className="flex-shrink-0" />
              잔여 횟수보다 많이 차감할 수 없습니다.
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              사유 <span className="text-red-500">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="횟수 조정 사유를 입력해주세요"
              rows={3}
              className="w-full border dark:border-neutral-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-neutral-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 outline-none resize-none"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg text-sm text-red-600 dark:text-red-400">
              <AlertTriangle size={16} className="flex-shrink-0" />
              {error}
            </div>
          )}
        </div>

        <div className="p-5 border-t dark:border-neutral-800 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="flex-1 px-4 py-2.5 border dark:border-neutral-700 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors text-sm font-medium disabled:opacity-50"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!isValid || loading}
            className={`flex-1 px-4 py-2.5 rounded-lg text-white text-sm font-medium transition-colors disabled:opacity-50 ${
              mode === 'deduct'
                ? 'bg-red-600 hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600'
                : 'bg-green-600 hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600'
            }`}
          >
            {loading ? '처리 중...' : mode === 'deduct' ? `${amount}회 차감` : `${amount}회 충전`}
          </button>
        </div>
      </div>
    </div>
  );
}
