"use client";

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { getSupabaseClient } from '@/lib/utils/supabase-client';

interface TicketModalProps {
  academyId: string;
  ticket?: any;
  onClose: () => void;
}

export function TicketModal({ academyId, ticket, onClose }: TicketModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    price: 0,
    ticket_type: 'COUNT',
    total_count: null as number | null,
    valid_days: null as number | null,
    is_on_sale: true,
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (ticket) {
      setFormData({
        name: ticket.name || '',
        price: ticket.price || 0,
        ticket_type: ticket.ticket_type || 'COUNT',
        total_count: ticket.total_count,
        valid_days: ticket.valid_days,
        is_on_sale: ticket.is_on_sale !== false,
      });
    }
  }, [ticket]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const supabase = getSupabaseClient();
    if (!supabase) {
      alert('데이터베이스 연결에 실패했습니다.');
      setLoading(false);
      return;
    }

    try {
      const data = {
        academy_id: academyId,
        name: formData.name,
        price: formData.price,
        ticket_type: formData.ticket_type,
        total_count: formData.ticket_type === 'COUNT' ? formData.total_count : null,
        valid_days: formData.ticket_type === 'PERIOD' ? formData.valid_days : null,
        is_on_sale: formData.is_on_sale,
      };

      if (ticket) {
        const { error } = await supabase.from('tickets').update(data).eq('id', ticket.id);

        if (error) throw error;
        alert('수강권이 수정되었습니다.');
      } else {
        const { error } = await supabase.from('tickets').insert([data]);

        if (error) throw error;
        alert('수강권이 등록되었습니다.');
      }

      onClose();
    } catch (error: any) {
      console.error('Error saving ticket:', error);
      alert(`수강권 저장에 실패했습니다: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 dark:bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
        <div className="p-6 border-b dark:border-neutral-800 flex justify-between items-center">
          <h3 className="text-xl font-bold text-gray-800 dark:text-white">
            {ticket ? '수강권 수정' : '수강권 등록'}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              수강권명 *
            </label>
            <input
              type="text"
              required
              className="w-full border dark:border-neutral-700 rounded-lg px-3 py-2 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              가격 *
            </label>
            <input
              type="number"
              required
              min="0"
              className="w-full border dark:border-neutral-700 rounded-lg px-3 py-2 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
              value={formData.price}
              onChange={(e) => setFormData({ ...formData, price: parseInt(e.target.value) || 0 })}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              수강권 유형 *
            </label>
            <select
              className="w-full border dark:border-neutral-700 rounded-lg px-3 py-2 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
              value={formData.ticket_type}
              onChange={(e) => setFormData({ ...formData, ticket_type: e.target.value })}
            >
              <option value="COUNT">횟수제</option>
              <option value="PERIOD">기간제</option>
            </select>
          </div>

          {formData.ticket_type === 'COUNT' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                총 횟수 *
              </label>
              <input
                type="number"
                required
                min="1"
                className="w-full border dark:border-neutral-700 rounded-lg px-3 py-2 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
                value={formData.total_count || ''}
                onChange={(e) =>
                  setFormData({ ...formData, total_count: parseInt(e.target.value) || null })
                }
              />
            </div>
          )}

          {formData.ticket_type === 'PERIOD' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                유효 기간 (일) *
              </label>
              <input
                type="number"
                required
                min="1"
                className="w-full border dark:border-neutral-700 rounded-lg px-3 py-2 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
                value={formData.valid_days || ''}
                onChange={(e) =>
                  setFormData({ ...formData, valid_days: parseInt(e.target.value) || null })
                }
              />
            </div>
          )}

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_on_sale"
              className="w-4 h-4"
              checked={formData.is_on_sale}
              onChange={(e) => setFormData({ ...formData, is_on_sale: e.target.checked })}
            />
            <label htmlFor="is_on_sale" className="text-sm text-gray-700 dark:text-gray-300">
              판매 중
            </label>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border dark:border-neutral-700 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors disabled:opacity-50"
            >
              {loading ? '저장 중...' : '저장'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}




