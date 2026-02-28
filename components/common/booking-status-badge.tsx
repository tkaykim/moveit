"use client";

import { CheckCircle2, XCircle, Clock, CheckCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface BookingStatusBadgeProps {
  status: string;
  className?: string;
  /** CONFIRMED인데 수업 시간이 지난 경우 '미출석'으로 표시 */
  startTime?: string;
  /** 계좌이체 주문 연결 시 PENDING이면 '입금확인 대기중' 표시 */
  bankTransferOrderId?: string | null;
}

type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' | 'info';

export function BookingStatusBadge({ status, className = '', startTime, bankTransferOrderId }: BookingStatusBadgeProps) {
  const getStatusConfig = (): { icon: typeof Clock; text: string; variant: BadgeVariant } => {
    if (status === 'CONFIRMED' && startTime && new Date(startTime) <= new Date()) {
      return { icon: Clock, text: '미출석', variant: 'warning' };
    }
    switch (status) {
      case 'CONFIRMED':
        return { icon: CheckCircle2, text: '구입 승인', variant: 'success' };
      case 'CANCELLED':
        return { icon: XCircle, text: '신청 취소', variant: 'destructive' };
      case 'PENDING':
        return {
          icon: Clock,
          text: bankTransferOrderId ? '입금확인 대기' : '대기',
          variant: 'warning',
        };
      case 'COMPLETED':
        return { icon: CheckCircle, text: '출석 완료', variant: 'info' };
      default:
        return { icon: Clock, text: status || '알 수 없음', variant: 'secondary' };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  return (
    <Badge
      variant={config.variant}
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap font-medium',
        className
      )}
    >
      <Icon size={12} className="shrink-0" />
      <span>{config.text}</span>
    </Badge>
  );
}
