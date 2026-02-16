"use client";

import { Clock, CheckCircle, XCircle, Loader2 } from 'lucide-react';

interface PushHistoryProps {
  queue: any[];
  loading: boolean;
}

export function PushHistory({ queue, loading }: PushHistoryProps) {
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'sent':
        return <span className="inline-flex items-center gap-1 text-xs text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-2 py-0.5 rounded-full"><CheckCircle size={12} /> 발송됨</span>;
      case 'failed':
        return <span className="inline-flex items-center gap-1 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-2 py-0.5 rounded-full"><XCircle size={12} /> 실패</span>;
      case 'pending':
        return <span className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded-full"><Loader2 size={12} className="animate-spin" /> 대기</span>;
      default:
        return <span className="text-xs text-neutral-500">{status}</span>;
    }
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleString('ko-KR', {
      month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  return (
    <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-6">
      <div className="flex items-center gap-2 mb-4">
        <Clock size={18} className="text-neutral-500" />
        <h2 className="text-lg font-bold text-neutral-900 dark:text-white">최근 발송 이력</h2>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-14 bg-neutral-100 dark:bg-neutral-800 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : queue.length === 0 ? (
        <div className="text-center py-8 text-neutral-500 text-sm">아직 발송 이력이 없습니다</div>
      ) : (
        <div className="space-y-2">
          {queue.map((item: any) => (
            <div
              key={item.id}
              className="flex items-center justify-between p-3 bg-neutral-50 dark:bg-neutral-800/50 rounded-lg"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-neutral-900 dark:text-white truncate">{item.title}</p>
                <p className="text-xs text-neutral-500 truncate">{item.body}</p>
              </div>
              <div className="flex items-center gap-3 ml-4 shrink-0">
                {getStatusBadge(item.status)}
                <span className="text-xs text-neutral-400">{formatTime(item.created_at)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
