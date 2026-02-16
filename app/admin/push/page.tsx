"use client";

import { useState, useEffect, useCallback } from 'react';
import { PushDashboard } from './components/push-dashboard';
import { PushSendForm } from './components/push-send-form';
import { PushHistory } from './components/push-history';

interface PushStatus {
  summary: {
    total_users: number;
    users_with_tokens: number;
    total_active_tokens: number;
    android_tokens: number;
    ios_tokens: number;
  };
  users_with_tokens: any[];
  recent_queue: any[];
}

export default function AdminPushPage() {
  const [status, setStatus] = useState<PushStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/push');
      if (!res.ok) throw new Error((await res.json()).error || '조회 실패');
      const data = await res.json();
      setStatus(data);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">푸시 알림 관리</h1>
        <p className="text-sm text-neutral-500 mt-1">디바이스 토큰 현황 확인 및 푸시 알림 발송</p>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      <PushDashboard status={status} loading={loading} />
      <PushSendForm
        usersWithTokens={status?.users_with_tokens || []}
        totalTokens={status?.summary?.total_active_tokens || 0}
        onSent={fetchStatus}
      />
      <PushHistory queue={status?.recent_queue || []} loading={loading} />
    </div>
  );
}
