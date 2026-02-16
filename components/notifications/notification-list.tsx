"use client";

import { useState, useEffect, useCallback } from 'react';
import { Bell, CheckCheck } from 'lucide-react';
import { NotificationItem } from './notification-item';
import { authFetch } from '@/lib/supabase/auth-fetch';
import { usePushNotification } from '@/contexts/PushNotificationContext';
import type { Notification } from '@/types/notifications';

export function NotificationList() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const { refreshUnreadCount } = usePushNotification();
  const limit = 20;

  const fetchNotifications = useCallback(async (pageNum: number, append = false) => {
    try {
      const res = await authFetch(`/api/notifications?page=${pageNum}&limit=${limit}`);
      if (!res.ok) return;
      const data = await res.json();

      if (append) {
        setNotifications((prev) => [...prev, ...(data.notifications || [])]);
      } else {
        setNotifications(data.notifications || []);
      }
      setTotalCount(data.total_count || 0);
      setHasMore(pageNum * limit < (data.total_count || 0));
    } catch (error) {
      console.error('알림 목록 조회 실패:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications(1);
  }, [fetchNotifications]);

  const handleRead = async (id: string) => {
    try {
      await authFetch(`/api/notifications/${id}`, { method: 'PATCH' });
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true, status: 'read' as const } : n))
      );
      refreshUnreadCount();
    } catch (error) {
      console.error('읽음 처리 실패:', error);
    }
  };

  const handleReadAll = async () => {
    try {
      await authFetch('/api/notifications/read-all', { method: 'PATCH' });
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, is_read: true, status: 'read' as const }))
      );
      refreshUnreadCount();
    } catch (error) {
      console.error('전체 읽음 처리 실패:', error);
    }
  };

  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchNotifications(nextPage, true);
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="animate-spin w-6 h-6 border-2 border-primary dark:border-[#CCFF00] border-t-transparent rounded-full" />
        <p className="text-sm text-neutral-500 mt-3">알림을 불러오는 중...</p>
      </div>
    );
  }

  if (notifications.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-16 h-16 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center mb-4">
          <Bell size={28} className="text-neutral-400" />
        </div>
        <p className="text-base font-bold text-black dark:text-white mb-1">알림이 없습니다</p>
        <p className="text-sm text-neutral-500">새로운 알림이 오면 여기에 표시됩니다</p>
      </div>
    );
  }

  return (
    <div>
      {/* 전체 읽음 처리 버튼 */}
      {unreadCount > 0 && (
        <div className="px-4 py-2 border-b border-neutral-100 dark:border-neutral-800">
          <button
            onClick={handleReadAll}
            className="flex items-center gap-1.5 text-xs font-medium text-primary dark:text-[#CCFF00] active:opacity-70"
          >
            <CheckCheck size={14} />
            모두 읽음 처리 ({unreadCount})
          </button>
        </div>
      )}

      {/* 알림 목록 */}
      <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
        {notifications.map((notification) => (
          <NotificationItem
            key={notification.id}
            notification={notification}
            onRead={handleRead}
          />
        ))}
      </div>

      {/* 더 불러오기 */}
      {hasMore && (
        <div className="py-4 text-center">
          <button
            onClick={handleLoadMore}
            className="text-sm font-medium text-primary dark:text-[#CCFF00] active:opacity-70"
          >
            더 보기
          </button>
        </div>
      )}
    </div>
  );
}
