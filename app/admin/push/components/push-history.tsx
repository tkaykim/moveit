"use client";

import { useState } from 'react';
import {
  Clock, CheckCircle, XCircle, Loader2, ChevronDown, ChevronUp,
  MessageSquare, ExternalLink, ArrowUpRight,
} from 'lucide-react';

interface PushHistoryProps {
  queue: any[];
  loading: boolean;
}

export function PushHistory({ queue, loading }: PushHistoryProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'sent':
        return (
          <span className="inline-flex items-center gap-1 text-xs text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-2 py-0.5 rounded-full">
            <CheckCircle size={12} /> 발송완료
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-2 py-0.5 rounded-full">
            <XCircle size={12} /> 실패
          </span>
        );
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded-full">
            <Loader2 size={12} className="animate-spin" /> 대기
          </span>
        );
      case 'processing':
        return (
          <span className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded-full">
            <Loader2 size={12} className="animate-spin" /> 처리중
          </span>
        );
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

  const formatFullTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleString('ko-KR', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
  };

  const toggle = (id: string) => {
    setExpandedId(prev => prev === id ? null : id);
  };

  return (
    <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden">
      <div className="px-6 py-4 border-b border-neutral-100 dark:border-neutral-800 flex items-center gap-2">
        <Clock size={18} className="text-neutral-500" />
        <h2 className="text-lg font-bold text-neutral-900 dark:text-white">발송 이력</h2>
        <span className="text-xs text-neutral-400 ml-auto">{queue.length}건</span>
      </div>

      <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
        {loading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 bg-neutral-100 dark:bg-neutral-800 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : queue.length === 0 ? (
          <div className="text-center py-12 px-6">
            <MessageSquare size={32} className="mx-auto text-neutral-300 dark:text-neutral-600 mb-3" />
            <p className="text-neutral-500 text-sm">아직 발송 이력이 없습니다</p>
            <p className="text-neutral-400 text-xs mt-1">위에서 첫 알림을 보내보세요</p>
          </div>
        ) : (
          queue.map((item: any) => {
            const isExpanded = expandedId === item.id;
            const data = item.data || {};
            const hasPath = data.path;
            const hasUrl = data.url;
            const hasImage = data.image_url;
            const displayStyle = data.display_style;

            return (
              <div key={item.id} className="group">
                {/* 요약 행 */}
                <button
                  onClick={() => toggle(item.id)}
                  className="w-full flex items-center gap-3 px-6 py-3.5 text-left hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-neutral-900 dark:text-white truncate">{item.title}</p>
                    <p className="text-xs text-neutral-500 truncate mt-0.5">{item.body}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {/* 태그들 */}
                    <div className="hidden sm:flex items-center gap-1.5">
                      {hasImage && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400">
                          IMG
                        </span>
                      )}
                      {displayStyle && displayStyle !== 'default' && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400">
                          {displayStyle === 'big_text' ? '긴글' : displayStyle === 'big_picture' ? '이미지' : displayStyle}
                        </span>
                      )}
                      {(hasPath || hasUrl) && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 flex items-center gap-0.5">
                          <ArrowUpRight size={8} /> 링크
                        </span>
                      )}
                    </div>
                    {getStatusBadge(item.status)}
                    <span className="text-[10px] text-neutral-400 tabular-nums min-w-[4.5rem] text-right">{formatTime(item.created_at)}</span>
                    {isExpanded ? <ChevronUp size={14} className="text-neutral-400" /> : <ChevronDown size={14} className="text-neutral-400" />}
                  </div>
                </button>

                {/* 상세 내용 */}
                {isExpanded && (
                  <div className="px-6 pb-4 bg-neutral-50 dark:bg-neutral-800/30">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <DetailRow label="ID" value={item.id.slice(0, 8) + '...'} />
                      <DetailRow label="생성시각" value={formatFullTime(item.created_at)} />
                      {item.processed_at && <DetailRow label="처리시각" value={formatFullTime(item.processed_at)} />}
                      {item.error_message && (
                        <div className="col-span-full">
                          <span className="text-neutral-400">오류: </span>
                          <span className="text-red-500">{item.error_message}</span>
                        </div>
                      )}

                      {/* data 필드 */}
                      {displayStyle && (
                        <DetailRow label="표시방식" value={
                          displayStyle === 'default' ? '기본' :
                          displayStyle === 'big_text' ? '긴 글 확장' :
                          displayStyle === 'big_picture' ? '이미지 포함' : displayStyle
                        } />
                      )}
                      {hasPath && (
                        <DetailRow label="앱 내 경로" value={data.path} />
                      )}
                      {hasUrl && (
                        <div className="flex items-center gap-1">
                          <span className="text-neutral-400">외부 URL: </span>
                          <a href={data.url} target="_blank" rel="noopener noreferrer" className="text-primary dark:text-[#CCFF00] underline flex items-center gap-0.5">
                            {data.url.substring(0, 40)}{data.url.length > 40 ? '...' : ''} <ExternalLink size={10} />
                          </a>
                        </div>
                      )}
                      {hasImage && (
                        <div className="col-span-full">
                          <span className="text-neutral-400 block mb-1">첨부 이미지:</span>
                          <div className="w-32 h-20 rounded overflow-hidden bg-neutral-200 dark:bg-neutral-700">
                            <img
                              src={data.image_url}
                              alt="첨부 이미지"
                              className="w-full h-full object-cover"
                              onError={(e) => (e.currentTarget.style.display = 'none')}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-neutral-400">{label}: </span>
      <span className="text-neutral-700 dark:text-neutral-300 font-medium">{value}</span>
    </div>
  );
}
