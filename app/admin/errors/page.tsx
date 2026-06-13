"use client";

import { useState, useEffect, useCallback } from 'react';
import { fetchWithAuth } from '@/lib/api/auth-fetch';
import { AlertTriangle, Loader2, CheckCircle2, RefreshCw, ChevronDown, ChevronRight } from 'lucide-react';

interface ErrorLog {
  id: string;
  created_at: string;
  last_seen_at: string;
  level: 'error' | 'warning' | 'fatal';
  source: string;
  message: string;
  url: string | null;
  status_code: number | null;
  user_id: string | null;
  academy_id: string | null;
  occurrences: number;
  resolved: boolean;
}

const LEVEL_STYLE: Record<string, string> = {
  fatal: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
  error: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400',
  warning: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
};

export default function AdminErrorsPage() {
  const [logs, setLogs] = useState<ErrorLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [resolvedFilter, setResolvedFilter] = useState<'false' | 'true' | 'all'>('false');
  const [levelFilter, setLevelFilter] = useState<'all' | 'fatal' | 'error' | 'warning'>('all');
  const [q, setQ] = useState('');
  const [unresolvedCount, setUnresolvedCount] = useState(0);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const params = new URLSearchParams({ resolved: resolvedFilter, level: levelFilter });
      if (q.trim()) params.set('q', q.trim());
      const res = await fetchWithAuth(`/api/admin/errors?${params.toString()}`);
      const json = await res.json();
      if (!res.ok) { setLoadError(json.error || '불러오기 실패'); setLogs([]); return; }
      setLogs(json.data || []);
      setUnresolvedCount(json.unresolvedCount || 0);
    } catch {
      setLoadError('네트워크 오류가 발생했습니다.');
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [resolvedFilter, levelFilter, q]);

  useEffect(() => { load(); }, [resolvedFilter, levelFilter]); // q는 버튼/엔터로

  const resolve = async (id: string, resolved: boolean) => {
    try {
      await fetchWithAuth('/api/admin/errors', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, resolved }),
      });
      load();
    } catch { /* noop */ }
  };

  const fmt = (s: string) => new Date(s).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <AlertTriangle className="text-red-500" size={22} />
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">에러 감지</h1>
          {unresolvedCount > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-red-600 text-white text-xs font-bold">미해결 {unresolvedCount}</span>
          )}
        </div>
        <button onClick={load} disabled={loading} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-800 text-gray-500">
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">앱/관리자에서 발생한 클라이언트·API 오류가 자동 수집됩니다. (10분 내 동일 오류는 누적)</p>

      {/* 필터 */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {(['false', 'all', 'true'] as const).map((v) => (
          <button key={v} onClick={() => setResolvedFilter(v)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium ${resolvedFilter === v ? 'bg-gray-900 dark:bg-white text-white dark:text-black' : 'bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-gray-300'}`}>
            {v === 'false' ? '미해결' : v === 'true' ? '해결됨' : '전체'}
          </button>
        ))}
        <span className="w-px h-5 bg-gray-200 dark:bg-neutral-700 mx-1" />
        {(['all', 'fatal', 'error', 'warning'] as const).map((v) => (
          <button key={v} onClick={() => setLevelFilter(v)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium ${levelFilter === v ? 'bg-gray-900 dark:bg-white text-white dark:text-black' : 'bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-gray-300'}`}>
            {v === 'all' ? '전체 레벨' : v}
          </button>
        ))}
        <div className="flex-1 min-w-[180px]">
          <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && load()}
            placeholder="메시지 검색 후 Enter"
            className="w-full px-3 py-1.5 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm text-gray-900 dark:text-white" />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="animate-spin text-gray-400" size={28} /></div>
      ) : loadError ? (
        <div className="text-center py-12 text-red-500 text-sm">{loadError} <button onClick={load} className="underline ml-2">다시 시도</button></div>
      ) : logs.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <CheckCircle2 className="mx-auto mb-3 text-green-500" size={40} />
          <p>{resolvedFilter === 'false' ? '미해결 오류가 없습니다. 👍' : '오류 기록이 없습니다.'}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {logs.map((log) => (
            <div key={log.id} className="border border-gray-200 dark:border-neutral-800 rounded-xl bg-white dark:bg-neutral-900">
              <div className="flex items-start gap-3 p-3">
                <span className={`px-2 py-0.5 rounded text-[11px] font-bold shrink-0 ${LEVEL_STYLE[log.level] || LEVEL_STYLE.error}`}>{log.level}</span>
                <div className="flex-1 min-w-0">
                  <button onClick={() => setExpanded(expanded === log.id ? null : log.id)} className="flex items-start gap-1.5 text-left w-full">
                    {expanded === log.id ? <ChevronDown size={15} className="mt-0.5 shrink-0 text-gray-400" /> : <ChevronRight size={15} className="mt-0.5 shrink-0 text-gray-400" />}
                    <span className="text-sm font-medium text-gray-900 dark:text-white break-all">{log.message}</span>
                  </button>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 ml-5 text-xs text-gray-500 dark:text-gray-400">
                    <span className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-neutral-800">{log.source}</span>
                    {log.status_code && <span>HTTP {log.status_code}</span>}
                    {log.occurrences > 1 && <span className="text-orange-500 font-medium">×{log.occurrences}</span>}
                    <span>{fmt(log.last_seen_at)}</span>
                  </div>
                  {expanded === log.id && (
                    <div className="mt-2 ml-5 text-xs text-gray-500 dark:text-gray-400 space-y-1 break-all">
                      {log.url && <div>📍 {log.url}</div>}
                      {log.academy_id && <div>학원: {log.academy_id}</div>}
                      {log.user_id && <div>사용자: {log.user_id}</div>}
                      <div>최초: {fmt(log.created_at)}</div>
                    </div>
                  )}
                </div>
                <button onClick={() => resolve(log.id, !log.resolved)}
                  className={`shrink-0 px-2.5 py-1 rounded-lg text-xs font-medium ${log.resolved ? 'bg-gray-100 dark:bg-neutral-800 text-gray-500' : 'bg-green-600 text-white hover:bg-green-700'}`}>
                  {log.resolved ? '되돌리기' : '해결'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
