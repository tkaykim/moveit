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
    max_students: 0, // 정원
    current_students: 0, // 신청자 수
    present_students: 0, // 실제 출석자 수
    content: '',
    notes: '',
    video_url: '',
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (classItem) {
      setFormData({
        max_students: classItem.max_students || 0, // 정원
        current_students: classItem.current_students || 0, // 신청자 수
        present_students: classItem.present_students || 0, // 실제 출석자 수
        content: log?.content || '',
        notes: log?.notes || '',
        video_url: classItem.video_url || '',
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
      
      // classes 데이터 업데이트 (max_students, current_students, present_students, video_url)
      const classUpdateData = {
        max_students: formData.max_students,
        current_students: formData.current_students,
        present_students: formData.present_students,
        video_url: formData.video_url || null,
      };

      // classes 업데이트
      const { error: classError } = await supabase
        .from('classes')
        .update(classUpdateData)
        .eq('id', classItem.id);

      if (classError) throw classError;

      // daily_logs 데이터 (수업 내용과 특이사항만 저장)
      const logData = {
        academy_id: academyId,
        class_id: classItem.id,
        log_date: today,
        content: formData.content || null,
        notes: formData.notes || null,
        status: 'COMPLETED',
      };

      // daily_logs 저장/업데이트
      if (log) {
        const { error } = await supabase
          .from('daily_logs')
          .update({ ...logData, updated_at: new Date().toISOString() })
          .eq('id', log.id);

        if (error) throw error;
        alert('일지가 수정되었습니다.');
      } else {
        const { error } = await supabase.from('daily_logs').insert([logData]);

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
              정원 (최대 수강생 수) *
            </label>
            <input
              type="number"
              required
              min="0"
              className="w-full border dark:border-neutral-700 rounded-lg px-3 py-2 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
              value={formData.max_students}
              onChange={(e) =>
                setFormData({ ...formData, max_students: parseInt(e.target.value) || 0 })
              }
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              classes.max_students - 수업 정원
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              신청자 수 (현재 수강생 수) *
            </label>
            <input
              type="number"
              required
              min="0"
              max={formData.max_students}
              className="w-full border dark:border-neutral-700 rounded-lg px-3 py-2 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
              value={formData.current_students}
              onChange={(e) =>
                setFormData({ ...formData, current_students: parseInt(e.target.value) || 0 })
              }
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              classes.current_students - 수업을 신청한 학생 수
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              실제 출석자 수 *
            </label>
            <input
              type="number"
              required
              min="0"
              max={formData.current_students}
              className="w-full border dark:border-neutral-700 rounded-lg px-3 py-2 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
              value={formData.present_students}
              onChange={(e) =>
                setFormData({ ...formData, present_students: parseInt(e.target.value) || 0 })
              }
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              classes.present_students - 실제로 출석한 학생 수
            </p>
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

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              수업영상 링크
            </label>
            <input
              type="url"
              className="w-full border dark:border-neutral-700 rounded-lg px-3 py-2 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
              value={formData.video_url}
              onChange={(e) => setFormData({ ...formData, video_url: e.target.value })}
              placeholder="https://youtube.com/watch?v=..."
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              YouTube, Vimeo 등 영상 링크를 입력하세요.
            </p>
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

