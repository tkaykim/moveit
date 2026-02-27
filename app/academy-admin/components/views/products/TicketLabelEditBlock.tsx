"use client";

import { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, Settings2 } from 'lucide-react';
import { getSupabaseClient } from '@/lib/utils/supabase-client';
import { DEFAULT_TICKET_LABELS, TICKET_LABEL_MAX_LENGTH } from '@/lib/constants/ticket-labels';

interface TicketLabelEditBlockProps {
  academyId: string;
  initialLabels: {
    ticket_label_regular: string | null;
    ticket_label_popup: string | null;
    ticket_label_workshop: string | null;
  } | null;
  onSaved?: () => void;
}

export function TicketLabelEditBlock({
  academyId,
  initialLabels,
  onSaved,
}: TicketLabelEditBlockProps) {
  const [expanded, setExpanded] = useState(false);
  const [regular, setRegular] = useState(initialLabels?.ticket_label_regular ?? '');
  const [popup, setPopup] = useState(initialLabels?.ticket_label_popup ?? '');
  const [workshop, setWorkshop] = useState(initialLabels?.ticket_label_workshop ?? '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setRegular(initialLabels?.ticket_label_regular ?? '');
    setPopup(initialLabels?.ticket_label_popup ?? '');
    setWorkshop(initialLabels?.ticket_label_workshop ?? '');
  }, [initialLabels]);

  const handleSave = async () => {
    const supabase = getSupabaseClient();
    if (!supabase || !academyId) return;
    setSaving(true);
    try {
      const { error } = await (supabase as any)
        .from('academies')
        .update({
          ticket_label_regular: regular.trim() || null,
          ticket_label_popup: popup.trim() || null,
          ticket_label_workshop: workshop.trim() || null,
        })
        .eq('id', academyId);
      if (error) throw error;
      onSaved?.();
    } catch (e: any) {
      alert(e?.message || '저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-sm border border-gray-100 dark:border-neutral-800 overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="w-full p-4 flex items-center justify-between bg-gray-50 dark:bg-neutral-800/50 hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Settings2 size={18} className="text-gray-500 dark:text-neutral-400" />
          <span className="font-medium text-gray-800 dark:text-white">수강권 유형 표기 변경</span>
        </div>
        {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
      </button>
      {expanded && (
        <div className="p-4 pt-0 space-y-4">
          <p className="text-sm text-gray-500 dark:text-neutral-400">
            회원에게 보이는 수강권 유형 이름입니다. 비워두면 기본 이름이 표시됩니다. (최대 {TICKET_LABEL_MAX_LENGTH}자)
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-neutral-400 mb-1">
                기간제 (기본: {DEFAULT_TICKET_LABELS.regular})
              </label>
              <input
                type="text"
                maxLength={TICKET_LABEL_MAX_LENGTH}
                value={regular}
                onChange={(e) => setRegular(e.target.value)}
                placeholder={DEFAULT_TICKET_LABELS.regular}
                className="w-full px-3 py-2 border border-gray-200 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-900 text-gray-900 dark:text-white text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-neutral-400 mb-1">
                쿠폰제/횟수제 (기본: {DEFAULT_TICKET_LABELS.popup})
              </label>
              <input
                type="text"
                maxLength={TICKET_LABEL_MAX_LENGTH}
                value={popup}
                onChange={(e) => setPopup(e.target.value)}
                placeholder={DEFAULT_TICKET_LABELS.popup}
                className="w-full px-3 py-2 border border-gray-200 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-900 text-gray-900 dark:text-white text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-neutral-400 mb-1">
                워크샵/특강 (기본: {DEFAULT_TICKET_LABELS.workshop})
              </label>
              <input
                type="text"
                maxLength={TICKET_LABEL_MAX_LENGTH}
                value={workshop}
                onChange={(e) => setWorkshop(e.target.value)}
                placeholder={DEFAULT_TICKET_LABELS.workshop}
                className="w-full px-3 py-2 border border-gray-200 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-900 text-gray-900 dark:text-white text-sm"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-gray-900 dark:bg-[#CCFF00] text-white dark:text-black text-sm font-medium disabled:opacity-50"
            >
              {saving ? '저장 중…' : '저장'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
