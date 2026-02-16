"use client";

import { Bell, CalendarCheck, Ticket, MessageSquare, AlertCircle, ShoppingCart, X } from 'lucide-react';
import type { Notification, NotificationType } from '@/types/notifications';

interface NotificationItemProps {
  notification: Notification;
  onRead: (id: string) => void;
}

const typeConfig: Record<NotificationType, { icon: typeof Bell; color: string; label: string }> = {
  booking_confirmed: { icon: CalendarCheck, color: 'text-green-500', label: '예약' },
  booking_cancelled: { icon: X, color: 'text-red-500', label: '예약 취소' },
  ticket_purchased: { icon: ShoppingCart, color: 'text-blue-500', label: '구매' },
  ticket_expiry: { icon: Ticket, color: 'text-orange-500', label: '수강권' },
  class_reminder: { icon: Bell, color: 'text-purple-500', label: '수업 알림' },
  class_cancelled: { icon: AlertCircle, color: 'text-red-500', label: '수업 취소' },
  consultation_new: { icon: MessageSquare, color: 'text-blue-500', label: '상담' },
  consultation_reply: { icon: MessageSquare, color: 'text-green-500', label: '상담 답변' },
  extension_approved: { icon: Ticket, color: 'text-green-500', label: '연장 승인' },
  extension_rejected: { icon: Ticket, color: 'text-red-500', label: '연장 거절' },
  system: { icon: Bell, color: 'text-neutral-500', label: '시스템' },
  marketing: { icon: Bell, color: 'text-yellow-500', label: '프로모션' },
};

function getRelativeTime(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return '방금 전';
  if (diffMin < 60) return `${diffMin}분 전`;
  if (diffHour < 24) return `${diffHour}시간 전`;
  if (diffDay < 7) return `${diffDay}일 전`;
  return date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
}

export function NotificationItem({ notification, onRead }: NotificationItemProps) {
  const config = typeConfig[notification.type as NotificationType] || typeConfig.system;
  const Icon = config.icon;

  const handleClick = () => {
    if (!notification.is_read) {
      onRead(notification.id);
    }

    // data에 url이 있으면 이동
    if (notification.data?.url) {
      window.location.href = notification.data.url;
    }
  };

  return (
    <button
      onClick={handleClick}
      className={`w-full text-left p-4 flex gap-3 transition-colors active:scale-[0.98] ${
        notification.is_read
          ? 'bg-white dark:bg-neutral-950'
          : 'bg-primary/5 dark:bg-[#CCFF00]/5'
      }`}
    >
      <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
        notification.is_read
          ? 'bg-neutral-100 dark:bg-neutral-800'
          : 'bg-primary/10 dark:bg-[#CCFF00]/10'
      }`}>
        <Icon size={18} className={config.color} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
            notification.is_read
              ? 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500'
              : 'bg-primary/10 dark:bg-[#CCFF00]/10 text-primary dark:text-[#CCFF00]'
          }`}>
            {config.label}
          </span>
          <span className="text-[10px] text-neutral-400">
            {getRelativeTime(notification.created_at)}
          </span>
          {!notification.is_read && (
            <span className="w-1.5 h-1.5 rounded-full bg-primary dark:bg-[#CCFF00] ml-auto flex-shrink-0" />
          )}
        </div>
        <p className="text-sm font-bold text-black dark:text-white truncate">
          {notification.title}
        </p>
        <p className="text-xs text-neutral-500 dark:text-neutral-400 line-clamp-2 mt-0.5">
          {notification.body}
        </p>
      </div>
    </button>
  );
}
