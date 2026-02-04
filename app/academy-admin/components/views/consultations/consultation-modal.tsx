"use client";

import { useState, useEffect } from 'react';
import { X, Calendar, Clock, User, Tag } from 'lucide-react';
import { getSupabaseClient } from '@/lib/utils/supabase-client';

interface ConsultationModalProps {
  academyId: string;
  consultation?: any;
  onClose: () => void;
}

export function ConsultationModal({ academyId, consultation, onClose }: ConsultationModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    topic: '',
    status: 'NEW',
    scheduled_at: '',
    assigned_to: '',
    notes: '',
  });
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // 희망 방문 정보 (읽기전용)
  const visitDatetime = consultation?.visit_datetime;
  const categoryName = consultation?.consultation_categories?.name;
  const detail = consultation?.detail;

  useEffect(() => {
    loadUsers();
    if (consultation) {
      setFormData({
        name: consultation.name || '',
        phone: consultation.phone || '',
        topic: consultation.topic || '',
        status: consultation.status || 'NEW',
        scheduled_at: consultation.scheduled_at
          ? new Date(consultation.scheduled_at).toISOString().slice(0, 16)
          : '',
        assigned_to: consultation.assigned_to || '',
        notes: consultation.notes || '',
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [consultation, academyId]);

  const loadUsers = async () => {
    const supabase = getSupabaseClient();
    if (!supabase) return;

    try {
      // academy_students를 통해 해당 학원의 학생만 조회
      const { data: academyStudents, error: studentsError } = await supabase
        .from('academy_students')
        .select(`
          user_id,
          users (
            id,
            name,
            name_en,
            nickname
          )
        `)
        .eq('academy_id', academyId);

      if (studentsError) {
        console.error('Error loading academy students:', studentsError);
        setUsers([]);
      } else {
        // 중복 제거 및 users 정보만 추출
        const uniqueUsers = new Map();
        (academyStudents || []).forEach((academyStudent: any) => {
          const userId = academyStudent.user_id;
          if (academyStudent.users && !uniqueUsers.has(userId)) {
            uniqueUsers.set(userId, academyStudent.users);
          }
        });

        setUsers(Array.from(uniqueUsers.values()));
      }
    } catch (error) {
      console.error('Error loading users:', error);
      setUsers([]);
    }
  };

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
        phone: formData.phone || null,
        topic: formData.topic,
        status: formData.status,
        scheduled_at: formData.scheduled_at || null,
        assigned_to: formData.assigned_to || null,
        notes: formData.notes || null,
      };

      if (consultation) {
        const { error } = await supabase
          .from('consultations')
          .update({ ...data, updated_at: new Date().toISOString() })
          .eq('id', consultation.id);

        if (error) throw error;
        alert('상담 정보가 수정되었습니다.');
      } else {
        const { error } = await supabase.from('consultations').insert([data]);

        if (error) throw error;
        alert('상담이 등록되었습니다.');
      }

      onClose();
    } catch (error: any) {
      console.error('Error saving consultation:', error);
      alert(`상담 저장에 실패했습니다: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 dark:bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b dark:border-neutral-800 flex justify-between items-center flex-shrink-0">
          <h3 className="text-xl font-bold text-gray-800 dark:text-white">
            {consultation ? '상담 수정' : '상담 등록'}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
          {/* 고객 희망 정보 (읽기전용 - 기존 상담인 경우만) */}
          {consultation && (visitDatetime || categoryName || detail) && (
            <div className="bg-orange-50 dark:bg-orange-900/20 rounded-xl p-4 border border-orange-200 dark:border-orange-900/30 space-y-3">
              <h4 className="text-sm font-semibold text-orange-800 dark:text-orange-400 flex items-center gap-2">
                <User size={14} />
                고객 신청 정보
              </h4>
              
              {categoryName && (
                <div className="flex items-center gap-2 text-sm">
                  <Tag size={14} className="text-orange-600 dark:text-orange-400" />
                  <span className="text-gray-600 dark:text-gray-400">카테고리:</span>
                  <span className="font-medium text-gray-900 dark:text-white">{categoryName}</span>
                </div>
              )}
              
              {visitDatetime && (
                <div className="flex items-center gap-2 text-sm">
                  <Calendar size={14} className="text-orange-600 dark:text-orange-400" />
                  <span className="text-gray-600 dark:text-gray-400">희망 방문일시:</span>
                  <span className="font-medium text-orange-700 dark:text-orange-300">
                    {new Date(visitDatetime).toLocaleString('ko-KR', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      weekday: 'short',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>
                </div>
              )}
              
              {detail && (
                <div className="text-sm">
                  <span className="text-gray-600 dark:text-gray-400">상세 내용:</span>
                  <p className="mt-1 text-gray-900 dark:text-white bg-white dark:bg-neutral-800 rounded-lg p-2 text-sm">
                    {detail}
                  </p>
                </div>
              )}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              이름 *
            </label>
            <input
              type="text"
              required
              className="w-full border dark:border-neutral-700 rounded-lg px-3 py-2 bg-white dark:bg-neutral-800 text-gray-900 dark:text-white"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              전화번호
            </label>
            <input
              type="tel"
              className="w-full border dark:border-neutral-700 rounded-lg px-3 py-2 bg-white dark:bg-neutral-800 text-gray-900 dark:text-white"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              상담 주제 *
            </label>
            <input
              type="text"
              required
              className="w-full border dark:border-neutral-700 rounded-lg px-3 py-2 bg-white dark:bg-neutral-800 text-gray-900 dark:text-white"
              value={formData.topic}
              onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              상태
            </label>
            <select
              className="w-full border dark:border-neutral-700 rounded-lg px-3 py-2 bg-white dark:bg-neutral-800 text-gray-900 dark:text-white"
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
            >
              <option value="NEW">신규 문의</option>
              <option value="SCHEDULED">상담 예정</option>
              <option value="COMPLETED">등록 완료</option>
              <option value="CANCELLED">취소</option>
            </select>
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 border border-blue-200 dark:border-blue-900/30">
            <label className="block text-sm font-semibold text-blue-800 dark:text-blue-400 mb-2 flex items-center gap-2">
              <Clock size={14} />
              확정 상담 일시 (관리자 설정)
            </label>
            <input
              type="datetime-local"
              className="w-full border border-blue-200 dark:border-blue-800 rounded-lg px-3 py-2 bg-white dark:bg-neutral-800 text-gray-900 dark:text-white"
              value={formData.scheduled_at}
              onChange={(e) => setFormData({ ...formData, scheduled_at: e.target.value })}
            />
            <p className="text-xs text-blue-600 dark:text-blue-400 mt-1.5">
              * 고객의 희망 일시를 참고하여 실제 상담 일정을 확정하세요
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              담당자
            </label>
            <select
              className="w-full border dark:border-neutral-700 rounded-lg px-3 py-2 bg-white dark:bg-neutral-800 text-gray-900 dark:text-white"
              value={formData.assigned_to}
              onChange={(e) => setFormData({ ...formData, assigned_to: e.target.value })}
            >
              <option value="">선택 안함</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name || '-'}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              메모
            </label>
            <textarea
              className="w-full border dark:border-neutral-700 rounded-lg px-3 py-2 bg-white dark:bg-neutral-800 text-gray-900 dark:text-white"
              rows={3}
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border dark:border-neutral-700 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2.5 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors disabled:opacity-50 font-medium"
            >
              {loading ? '저장 중...' : '저장'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
