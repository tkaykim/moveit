"use client";

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { getSupabaseClient } from '@/lib/utils/supabase-client';

interface DailyLogModalProps {
  academyId: string;
  classItem: any;
  log?: any;
  onClose: () => void;
}

export function DailyLogModal({ academyId, classItem, log, onClose }: DailyLogModalProps) {
  const [formData, setFormData] = useState({
    total_students: 0,
    present_students: 0,
    content: '',
    notes: '',
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (log) {
      setFormData({
        total_students: log.total_students || 0,
        present_students: log.present_students || 0,
        content: log.content || '',
        notes: log.notes || '',
      });
    } else if (classItem) {
      setFormData({
        total_students: classItem.max_students || 0,
        present_students: classItem.current_students || 0,
        content: '',
        notes: '',
      });
    }
  }, [log, classItem]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const supabase = getSupabaseClient();
    if (!supabase || !classItem) {
      alert('데이터베이스 연결에 실패했습니다.');
      setLoading(false);
      return;
    }

    try {
      const today = new Date().toISOString().split('T')[0];
      const data = {
        academy_id: academyId,
        class_id: classItem.id,
        log_date: today,
        total_students: formData.total_students,
        present_students: formData.present_students,
        content: formData.content || null,
        notes: formData.notes || null,
        status: 'COMPLETED',
      };

      if (log) {
        const { error } = await supabase
          .from('daily_logs')
          .update({ ...data, updated_at: new Date().toISOString() })
          .eq('id', log.id);

        if (error) throw error;
        alert('일지가 수정되었습니다.');
      } else {
        const { error } = await supabase.from('daily_logs').insert([data]);

        if (error) throw error;
        alert('일지가 작성되었습니다.');
      }

      onClose();
    } catch (error: any) {
      console.error('Error saving log:', error);
      alert(`일지 저장에 실패했습니다: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (!classItem) return null;

  const time = new Date(classItem.start_time).toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 dark:bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b dark:border-neutral-800 flex justify-between items-center sticky top-0 bg-white dark:bg-neutral-900">
          <h3 className="text-xl font-bold text-gray-800 dark:text-white">
            {log ? '일지 수정' : '일지 작성'} - {classItem.title || '-'} ({time})
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
              총 학생 수 *
            </label>
            <input
              type="number"
              required
              min="0"
              className="w-full border dark:border-neutral-700 rounded-lg px-3 py-2 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
              value={formData.total_students}
              onChange={(e) =>
                setFormData({ ...formData, total_students: parseInt(e.target.value) || 0 })
              }
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              출석 학생 수 *
            </label>
            <input
              type="number"
              required
              min="0"
              max={formData.total_students}
              className="w-full border dark:border-neutral-700 rounded-lg px-3 py-2 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
              value={formData.present_students}
              onChange={(e) =>
                setFormData({ ...formData, present_students: parseInt(e.target.value) || 0 })
              }
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              수업 진도 및 내용
            </label>
            <textarea
              className="w-full border dark:border-neutral-700 rounded-lg px-3 py-2 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
              rows={4}
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              placeholder="오늘 진행한 수업 내용을 입력하세요..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 text-red-500 dark:text-red-400">
              특이사항 (학생/시설)
            </label>
            <input
              type="text"
              className="w-full border dark:border-neutral-700 rounded-lg px-3 py-2 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="부상자, 상담 필요 학생 등..."
            />
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

