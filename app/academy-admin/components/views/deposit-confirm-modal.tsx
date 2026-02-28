'use client';

interface DepositConfirmModalProps {
  /** 입금확인 대상 주문 (입금자명·금액 표시용) */
  order: { id: string; amount: number; depositor_name?: string | null; orderer_name?: string | null; user_name?: string | null };
  onConfirm: () => void;
  onCancel: () => void;
}

/** 입금확인 버튼 클릭 시 표시하는 최종 확인 팝업 */
export function DepositConfirmModal({ order, onConfirm, onCancel }: DepositConfirmModalProps) {
  const depositorLabel =
    order.depositor_name?.trim() && order.depositor_name !== order.orderer_name
      ? `${order.orderer_name || order.user_name || '—'} / 입금: ${order.depositor_name}`
      : (order.orderer_name || order.user_name || '—').toString();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 dark:bg-black/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="deposit-confirm-title"
    >
      <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="p-6 border-b border-slate-100 dark:border-neutral-800">
          <h3 id="deposit-confirm-title" className="text-xl font-bold text-slate-800 dark:text-white">
            입금 확인이 되었나요?
          </h3>
        </div>
        <div className="p-6 space-y-4">
          <div className="flex justify-between items-center py-2 border-b border-slate-100 dark:border-neutral-800">
            <span className="text-slate-500 dark:text-slate-400">입금자명</span>
            <span className="font-bold text-slate-800 dark:text-white">{depositorLabel}</span>
          </div>
          <div className="flex justify-between items-center pt-2">
            <span className="text-slate-500 dark:text-slate-400">금액</span>
            <span className="text-xl font-bold text-slate-800 dark:text-white">
              {order.amount.toLocaleString()}원
            </span>
          </div>
        </div>
        <div className="p-4 bg-slate-50 dark:bg-neutral-800 flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 px-4 py-3 bg-white dark:bg-neutral-900 border border-slate-300 dark:border-neutral-700 text-slate-700 dark:text-slate-300 rounded-xl font-medium hover:bg-slate-50 dark:hover:bg-neutral-800 transition-colors"
          >
            취소
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 px-4 py-3 bg-emerald-600 dark:bg-emerald-500 text-white rounded-xl font-bold hover:bg-emerald-700 dark:hover:bg-emerald-600 transition-colors"
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );
}
