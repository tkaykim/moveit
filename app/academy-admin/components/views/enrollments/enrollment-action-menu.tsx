"use client";

import { useState, useRef, useEffect } from 'react';
import { MoreVertical, CheckCircle2, Clock, XCircle, UserCheck, Trash2 } from 'lucide-react';

interface EnrollmentActionMenuProps {
  enrollment: {
    id: string;
    status: string;
    schedule_id: string | null;
    user_tickets?: { tickets?: { ticket_type?: string } } | null;
  };
  onStatusChange: (bookingId: string, newStatus: string, options?: { restoreTicket?: boolean }) => Promise<void>;
  onDelete?: (bookingId: string) => Promise<void>;
}

export function EnrollmentActionMenu({
  enrollment,
  onStatusChange,
  onDelete,
}: EnrollmentActionMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleStatusChange = async (newStatus: string, options?: { restoreTicket?: boolean }) => {
    if (isLoading) return;

    const confirmMessage = {
      CONFIRMED: '대기중 예약을 확정하시겠습니까?',
      COMPLETED: '출석 처리를 하시겠습니까?',
      CANCELLED: '예약을 취소하시겠습니까?',
      PENDING: '예약을 대기 상태로 변경하시겠습니까?',
    }[newStatus] || '상태를 변경하시겠습니까?';

    if (!confirm(confirmMessage)) {
      return;
    }

    // 취소 시 쿠폰제(횟수제) 수강권이면 수강권 반환 여부 선택
    let restoreTicket: boolean | undefined;
    if (newStatus === 'CANCELLED' && enrollment.user_tickets?.tickets?.ticket_type === 'COUNT') {
      restoreTicket = confirm('수강권 횟수를 회원에게 반환하시겠습니까?');
    }

    setIsLoading(true);
    try {
      await onStatusChange(enrollment.id, newStatus, restoreTicket !== undefined ? { restoreTicket } : undefined);
      setIsOpen(false);
    } catch (error) {
      console.error('Error changing status:', error);
      alert('상태 변경에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    if (!confirm('정말로 이 예약을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
      return;
    }

    setIsLoading(true);
    try {
      await onDelete(enrollment.id);
      setIsOpen(false);
    } catch (error) {
      console.error('Error deleting booking:', error);
      alert('삭제에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const currentStatus = enrollment.status || 'PENDING';

  // 상태별 가능한 액션
  const getAvailableActions = () => {
    const actions: Array<{
      label: string;
      icon: typeof CheckCircle2;
      status?: string;
      onClick: () => void;
      className?: string;
    }> = [];

    // PENDING -> CONFIRMED
    if (currentStatus === 'PENDING') {
      actions.push({
        label: '확정하기',
        icon: CheckCircle2,
        status: 'CONFIRMED',
        onClick: () => handleStatusChange('CONFIRMED'),
        className: 'text-green-600 dark:text-green-400',
      });
    }

    // CONFIRMED -> COMPLETED (출석)
    if (currentStatus === 'CONFIRMED') {
      actions.push({
        label: '출석 처리',
        icon: UserCheck,
        status: 'COMPLETED',
        onClick: () => handleStatusChange('COMPLETED'),
        className: 'text-blue-600 dark:text-blue-400',
      });
    }

    // CONFIRMED 또는 PENDING -> CANCELLED (쿠폰제일 때 취소 후 수강권 반환 여부 선택)
    if (currentStatus === 'CONFIRMED' || currentStatus === 'PENDING') {
      actions.push({
        label: enrollment.user_tickets?.tickets?.ticket_type === 'COUNT' ? '취소하기 (반환 여부 선택)' : '취소하기',
        icon: XCircle,
        status: 'CANCELLED',
        onClick: () => handleStatusChange('CANCELLED'),
        className: 'text-red-600 dark:text-red-400',
      });
    }

    // COMPLETED -> CONFIRMED (출석 취소)
    if (currentStatus === 'COMPLETED') {
      actions.push({
        label: '출석 취소',
        icon: Clock,
        status: 'CONFIRMED',
        onClick: () => handleStatusChange('CONFIRMED'),
        className: 'text-yellow-600 dark:text-yellow-400',
      });
    }

    // CANCELLED -> PENDING (취소 복구)
    if (currentStatus === 'CANCELLED') {
      actions.push({
        label: '대기 상태로 복구',
        icon: Clock,
        status: 'PENDING',
        onClick: () => handleStatusChange('PENDING'),
        className: 'text-neutral-600 dark:text-neutral-400',
      });
    }

    return actions;
  };

  const availableActions = getAvailableActions();

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isLoading}
        className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 disabled:opacity-50 disabled:cursor-not-allowed p-1 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800"
      >
        <MoreVertical size={18} />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-1 w-48 bg-white dark:bg-neutral-800 rounded-lg shadow-lg border border-neutral-200 dark:border-neutral-700 z-50 py-1">
          {availableActions.length > 0 ? (
            availableActions.map((action, index) => {
              const Icon = action.icon;
              return (
                <button
                  key={index}
                  onClick={action.onClick}
                  disabled={isLoading}
                  className={`w-full px-4 py-2 text-left text-sm flex items-center gap-2 hover:bg-neutral-100 dark:hover:bg-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed ${
                    action.className || 'text-neutral-700 dark:text-neutral-300'
                  }`}
                >
                  <Icon size={16} />
                  {action.label}
                </button>
              );
            })
          ) : (
            <div className="px-4 py-2 text-sm text-neutral-500 dark:text-neutral-400">
              사용 가능한 작업이 없습니다
            </div>
          )}

          {onDelete && (
            <>
              <div className="border-t border-neutral-200 dark:border-neutral-700 my-1" />
              <button
                onClick={handleDelete}
                disabled={isLoading}
                className="w-full px-4 py-2 text-left text-sm flex items-center gap-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Trash2 size={16} />
                삭제하기
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
