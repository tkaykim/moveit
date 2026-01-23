"use client";

import { CheckCircle2, XCircle, Clock, CheckCircle } from 'lucide-react';

interface BookingStatusBadgeProps {
  status: string;
  className?: string;
}

export function BookingStatusBadge({ status, className = '' }: BookingStatusBadgeProps) {
  const getStatusConfig = () => {
    switch (status) {
      case 'CONFIRMED':
        return {
          icon: CheckCircle2,
          text: '구입승인',
          bgColor: 'bg-green-100 dark:bg-green-900/30',
          textColor: 'text-green-800 dark:text-green-400',
          iconColor: 'text-green-600 dark:text-green-400',
        };
      case 'CANCELLED':
        return {
          icon: XCircle,
          text: '신청취소',
          bgColor: 'bg-red-100 dark:bg-red-900/30',
          textColor: 'text-red-800 dark:text-red-400',
          iconColor: 'text-red-600 dark:text-red-400',
        };
      case 'PENDING':
        return {
          icon: Clock,
          text: '대기중',
          bgColor: 'bg-yellow-100 dark:bg-yellow-900/30',
          textColor: 'text-yellow-800 dark:text-yellow-400',
          iconColor: 'text-yellow-600 dark:text-yellow-400',
        };
      case 'COMPLETED':
        return {
          icon: CheckCircle,
          text: '출석완료',
          bgColor: 'bg-blue-100 dark:bg-blue-900/30',
          textColor: 'text-blue-800 dark:text-blue-400',
          iconColor: 'text-blue-600 dark:text-blue-400',
        };
      default:
        return {
          icon: Clock,
          text: status || '알 수 없음',
          bgColor: 'bg-neutral-100 dark:bg-neutral-800',
          textColor: 'text-neutral-600 dark:text-neutral-400',
          iconColor: 'text-neutral-500 dark:text-neutral-500',
        };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full font-medium ${config.bgColor} ${config.textColor} ${className}`}
    >
      <Icon size={14} className={config.iconColor} />
      {config.text}
    </span>
  );
}
