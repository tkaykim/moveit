"use client";

import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { MoreVertical, CheckCircle2, Clock, XCircle, UserCheck, UserX, Landmark, RotateCcw } from 'lucide-react';

interface EnrollmentActionMenuProps {
  enrollment: {
    id: string;
    status: string;
    schedule_id: string | null;
    user_ticket_id?: string | null;
    bank_transfer_order_id?: string | null;
    user_tickets?: { tickets?: { ticket_type?: string } } | null;
  };
  onStatusChange: (bookingId: string, newStatus: string, options?: { restoreTicket?: boolean }) => Promise<void>;
  /** 환불 모달 열기 (수강권 결제건 역추적해 환불) */
  onRefund?: (enrollment: { id: string; user_ticket_id?: string | null }) => void;
}

export function EnrollmentActionMenu({
  enrollment,
  onStatusChange,
  onRefund,
}: EnrollmentActionMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const updateMenuPosition = useCallback(() => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const menuWidth = 192; // w-48 = 12rem = 192px
    const menuEstimatedHeight = 200;
    const viewportHeight = window.innerHeight;

    // 메뉴가 화면 아래로 넘어가면 위로 표시
    const spaceBelow = viewportHeight - rect.bottom;
    const showAbove = spaceBelow < menuEstimatedHeight && rect.top > menuEstimatedHeight;

    setMenuPosition({
      top: showAbove ? rect.top + window.scrollY - menuEstimatedHeight : rect.bottom + window.scrollY + 4,
      left: rect.right + window.scrollX - menuWidth,
    });
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        menuRef.current && !menuRef.current.contains(event.target as Node) &&
        buttonRef.current && !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    const handleScrollOrResize = () => {
      if (isOpen) {
        updateMenuPosition();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      window.addEventListener('scroll', handleScrollOrResize, true);
      window.addEventListener('resize', handleScrollOrResize);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [isOpen, updateMenuPosition]);

  const handleStatusChange = async (newStatus: string, options?: { restoreTicket?: boolean }) => {
    if (isLoading) return;

    const confirmMessage = {
      CONFIRMED: '대기중 예약을 확정하시겠습니까?',
      COMPLETED: '출석 처리를 하시겠습니까?',
      CANCELLED: '예약을 취소하시겠습니까?',
      PENDING: '예약을 대기 상태로 변경하시겠습니까?',
      ABSENT: '결석 처리를 하시겠습니까? (수업 인원 수에서 제외됩니다)',
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
      if (enrollment.bank_transfer_order_id) {
        // 계좌이체 PENDING 예약: 수동 확정 차단, 안내 항목 표시
        actions.push({
          label: '수동 입금확인 탭에서 처리',
          icon: Landmark,
          onClick: () => alert('계좌이체 예약은 수동 입금확인 탭에서 입금 확인 후 자동으로 확정됩니다.'),
          className: 'text-amber-600 dark:text-amber-400',
        });
      } else {
        actions.push({
          label: '확정하기',
          icon: CheckCircle2,
          status: 'CONFIRMED',
          onClick: () => handleStatusChange('CONFIRMED'),
          className: 'text-green-600 dark:text-green-400',
        });
      }
    }

    // CONFIRMED -> COMPLETED (출석) / ABSENT (결석)
    if (currentStatus === 'CONFIRMED') {
      actions.push({
        label: '출석 처리',
        icon: UserCheck,
        status: 'COMPLETED',
        onClick: () => handleStatusChange('COMPLETED'),
        className: 'text-blue-600 dark:text-blue-400',
      });
      actions.push({
        label: '결석 처리',
        icon: UserX,
        status: 'ABSENT',
        onClick: () => handleStatusChange('ABSENT'),
        className: 'text-red-600 dark:text-red-400',
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

    // COMPLETED -> CONFIRMED (출석 취소) / ABSENT (결석으로 전환)
    if (currentStatus === 'COMPLETED') {
      actions.push({
        label: '출석 취소',
        icon: Clock,
        status: 'CONFIRMED',
        onClick: () => handleStatusChange('CONFIRMED'),
        className: 'text-yellow-600 dark:text-yellow-400',
      });
      actions.push({
        label: '결석으로 변경',
        icon: UserX,
        status: 'ABSENT',
        onClick: () => handleStatusChange('ABSENT'),
        className: 'text-red-600 dark:text-red-400',
      });
    }

    // ABSENT -> CONFIRMED (결석 취소)
    if (currentStatus === 'ABSENT') {
      actions.push({
        label: '결석 취소 (구입 승인 복구)',
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

  const handleToggle = () => {
    if (!isOpen) {
      updateMenuPosition();
    }
    setIsOpen(!isOpen);
  };

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={handleToggle}
        disabled={isLoading}
        className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 disabled:opacity-50 disabled:cursor-not-allowed p-1 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800"
      >
        <MoreVertical size={18} />
      </button>

      {isOpen && menuPosition && createPortal(
        <div
          ref={menuRef}
          className="fixed w-48 bg-white dark:bg-neutral-800 rounded-lg shadow-lg border border-neutral-200 dark:border-neutral-700 z-[9999] py-1"
          style={{
            top: `${menuPosition.top}px`,
            left: `${menuPosition.left}px`,
            position: 'absolute',
          }}
        >
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

          {onRefund && enrollment.user_ticket_id && (
            <>
              <div className="border-t border-neutral-200 dark:border-neutral-700 my-1" />
              <button
                onClick={() => { onRefund({ id: enrollment.id, user_ticket_id: enrollment.user_ticket_id }); setIsOpen(false); }}
                disabled={isLoading}
                className="w-full px-4 py-2 text-left text-sm flex items-center gap-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <RotateCcw size={16} />
                결제 환불
              </button>
            </>
          )}

        </div>,
        document.body
      )}
    </div>
  );
}
