"use client";

import { usePushNotification } from '@/contexts/PushNotificationContext';

interface NotificationBadgeProps {
  className?: string;
}

/**
 * 읽지 않은 알림 수를 표시하는 뱃지 컴포넌트
 * 아이콘 위에 겹쳐 사용
 */
export function NotificationBadge({ className = '' }: NotificationBadgeProps) {
  const { unreadCount } = usePushNotification();

  if (unreadCount <= 0) return null;

  return (
    <span
      className={`absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center ${className}`}
    >
      {unreadCount > 99 ? '99+' : unreadCount}
    </span>
  );
}
