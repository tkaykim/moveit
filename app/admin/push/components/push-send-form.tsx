"use client";

import { useState } from 'react';
import { Send, Loader2, CheckCircle, XCircle } from 'lucide-react';

interface PushSendFormProps {
  usersWithTokens: any[];
  totalTokens: number;
  onSent: () => void;
}

export function PushSendForm({ usersWithTokens, totalTokens, onSent }: PushSendFormProps) {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [target, setTarget] = useState<'all' | 'specific'>('all');
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleSend = async () => {
    if (!title.trim() || !message.trim()) {
      setResult({ success: false, message: '제목과 내용을 입력하세요.' });
      return;
    }

    if (target === 'specific' && selectedUsers.length === 0) {
      setResult({ success: false, message: '발송 대상을 선택하세요.' });
      return;
    }

    setSending(true);
    setResult(null);

    try {
      const res = await fetch('/api/admin/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          message: message.trim(),
          target,
          user_ids: target === 'specific' ? selectedUsers : [],
          trigger_worker: true,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setResult({
          success: true,
          message: `발송 완료! 토큰 ${data.summary?.total_tokens || 0}개, 유저 ${data.summary?.logged_in_users || 0}명`,
        });
        onSent();
      } else {
        setResult({ success: false, message: data.error || '발송 실패' });
      }
    } catch (err: any) {
      setResult({ success: false, message: err.message });
    } finally {
      setSending(false);
    }
  };

  const toggleUser = (userId: string) => {
    setSelectedUsers(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  return (
    <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-6">
      <h2 className="text-lg font-bold text-neutral-900 dark:text-white mb-4">푸시 알림 발송</h2>

      <div className="space-y-4">
        {/* 제목 */}
        <div>
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">제목</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="알림 제목"
            className="w-full px-4 py-2.5 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-sm focus:ring-2 focus:ring-primary dark:focus:ring-[#CCFF00] outline-none"
          />
        </div>

        {/* 내용 */}
        <div>
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">내용</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="알림 내용을 입력하세요"
            rows={3}
            className="w-full px-4 py-2.5 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-sm focus:ring-2 focus:ring-primary dark:focus:ring-[#CCFF00] outline-none resize-none"
          />
        </div>

        {/* 발송 대상 */}
        <div>
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">발송 대상</label>
          <div className="flex gap-3">
            <button
              onClick={() => setTarget('all')}
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium border transition-all ${
                target === 'all'
                  ? 'bg-primary dark:bg-[#CCFF00] text-black border-primary dark:border-[#CCFF00]'
                  : 'bg-white dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 border-neutral-200 dark:border-neutral-700'
              }`}
            >
              전체 발송 ({totalTokens}대)
            </button>
            <button
              onClick={() => setTarget('specific')}
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium border transition-all ${
                target === 'specific'
                  ? 'bg-primary dark:bg-[#CCFF00] text-black border-primary dark:border-[#CCFF00]'
                  : 'bg-white dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 border-neutral-200 dark:border-neutral-700'
              }`}
            >
              특정 유저
            </button>
          </div>
        </div>

        {/* 유저 선택 (특정 유저일 때) */}
        {target === 'specific' && (
          <div className="max-h-48 overflow-y-auto border border-neutral-200 dark:border-neutral-700 rounded-lg">
            {usersWithTokens.length === 0 ? (
              <div className="p-4 text-sm text-neutral-500 text-center">토큰이 등록된 유저가 없습니다</div>
            ) : (
              usersWithTokens.map((user: any) => (
                <label
                  key={user.id}
                  className="flex items-center gap-3 px-4 py-2.5 hover:bg-neutral-50 dark:hover:bg-neutral-800 cursor-pointer border-b border-neutral-100 dark:border-neutral-800 last:border-0"
                >
                  <input
                    type="checkbox"
                    checked={selectedUsers.includes(user.id)}
                    onChange={() => toggleUser(user.id)}
                    className="w-4 h-4 rounded border-neutral-300 text-primary focus:ring-primary"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-neutral-900 dark:text-white truncate">
                      {user.display_name || user.email || user.id.slice(0, 8)}
                    </p>
                    <p className="text-xs text-neutral-500 truncate">{user.email}</p>
                  </div>
                  <span className="text-xs text-neutral-400">{user.tokens?.length || 0}대</span>
                </label>
              ))
            )}
          </div>
        )}

        {/* 결과 메시지 */}
        {result && (
          <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${
            result.success
              ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
              : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'
          }`}>
            {result.success ? <CheckCircle size={16} /> : <XCircle size={16} />}
            {result.message}
          </div>
        )}

        {/* 발송 버튼 */}
        <button
          onClick={handleSend}
          disabled={sending || !title.trim() || !message.trim()}
          className="w-full py-3 bg-primary dark:bg-[#CCFF00] text-black font-bold rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
        >
          {sending ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              발송 중...
            </>
          ) : (
            <>
              <Send size={18} />
              푸시 알림 발송
            </>
          )}
        </button>
      </div>
    </div>
  );
}
