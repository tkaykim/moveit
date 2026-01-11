"use client";

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { getSupabaseClient } from '@/lib/utils/supabase-client';

interface DiscountModalProps {
  academyId: string;
  discount?: any;
  onClose: () => void;
}

export function DiscountModal({ academyId, discount, onClose }: DiscountModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    discount_type: 'PERCENT',
    discount_value: 0,
    is_active: true,
    valid_from: '',
    valid_until: '',
    description: '',
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (discount) {
      setFormData({
        name: discount.name || '',
        discount_type: discount.discount_type || 'PERCENT',
        discount_value: discount.discount_value || 0,
        is_active: discount.is_active !== false,
        valid_from: discount.valid_from || '',
        valid_until: discount.valid_until || '',
        description: discount.description || '',
      });
    }
  }, [discount]);

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
        discount_type: formData.discount_type,
        discount_value: formData.discount_value,
        is_active: formData.is_active,
        valid_from: formData.valid_from || null,
        valid_until: formData.valid_until || null,
        description: formData.description || null,
      };

      if (discount) {
        const { error } = await supabase
          .from('discounts')
          .update({ ...data, updated_at: new Date().toISOString() })
          .eq('id', discount.id);

        if (error) throw error;
        alert('할인 정책이 수정되었습니다.');
      } else {
        const { error } = await supabase.from('discounts').insert([data]);

        if (error) throw error;
        alert('할인 정책이 등록되었습니다.');
      }

      onClose();
    } catch (error: any) {
      console.error('Error saving discount:', error);
      alert(`할인 정책 저장에 실패했습니다: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 dark:bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
        <div className="p-6 border-b dark:border-neutral-800 flex justify-between items-center">
          <h3 className="text-xl font-bold text-gray-800 dark:text-white">
            {discount ? '할인 정책 수정' : '할인 정책 등록'}
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
              정책명 *
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
              할인 유형 *
            </label>
            <select
              className="w-full border dark:border-neutral-700 rounded-lg px-3 py-2 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
              value={formData.discount_type}
              onChange={(e) => setFormData({ ...formData, discount_type: e.target.value })}
            >
              <option value="PERCENT">비율 (%)</option>
              <option value="FIXED">고정 금액 (원)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              할인 값 *
            </label>
            <input
              type="number"
              required
              min="0"
              max={formData.discount_type === 'PERCENT' ? 100 : undefined}
              className="w-full border dark:border-neutral-700 rounded-lg px-3 py-2 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
              value={formData.discount_value}
              onChange={(e) =>
                setFormData({ ...formData, discount_value: parseInt(e.target.value) || 0 })
              }
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {formData.discount_type === 'PERCENT'
                ? '0-100 사이의 값을 입력하세요'
                : '원 단위로 입력하세요'}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              유효 시작일
            </label>
            <input
              type="date"
              className="w-full border dark:border-neutral-700 rounded-lg px-3 py-2 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
              value={formData.valid_from}
              onChange={(e) => setFormData({ ...formData, valid_from: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              유효 종료일
            </label>
            <input
              type="date"
              className="w-full border dark:border-neutral-700 rounded-lg px-3 py-2 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
              value={formData.valid_until}
              onChange={(e) => setFormData({ ...formData, valid_until: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              설명
            </label>
            <textarea
              className="w-full border dark:border-neutral-700 rounded-lg px-3 py-2 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
              rows={2}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_active"
              className="w-4 h-4"
              checked={formData.is_active}
              onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
            />
            <label htmlFor="is_active" className="text-sm text-gray-700 dark:text-gray-300">
              활성화
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










