"use client";

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { getSupabaseClient } from '@/lib/utils/supabase-client';

interface StudentDetailModalProps {
  student: any;
  academyId: string;
  onClose: () => void;
}

export function StudentDetailModal({ student, academyId, onClose }: StudentDetailModalProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    nickname: '',
    phone: '',
    email: '',
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (student) {
      setFormData({
        name: student.name || '',
        nickname: student.nickname || '',
        phone: student.phone || '',
        email: student.email || '',
      });
    }
  }, [student]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const supabase = getSupabaseClient();
    if (!supabase || !student) {
      alert('데이터베이스 연결에 실패했습니다.');
      setLoading(false);
      return;
    }

    try {
      const { error } = await supabase
        .from('users')
        .update(formData)
        .eq('id', student.id);

      if (error) throw error;
      alert('학생 정보가 수정되었습니다.');
      setIsEditing(false);
      onClose();
    } catch (error: any) {
      console.error('Error updating student:', error);
      alert(`학생 정보 수정에 실패했습니다: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 dark:bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b dark:border-neutral-800 flex justify-between items-center sticky top-0 bg-white dark:bg-neutral-900">
          <h3 className="text-xl font-bold text-gray-800 dark:text-white">
            {student.name || student.nickname || '학생 정보'}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X size={20} />
          </button>
        </div>

        {isEditing ? (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                이름
              </label>
              <input
                type="text"
                className="w-full border dark:border-neutral-700 rounded-lg px-3 py-2 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                닉네임
              </label>
              <input
                type="text"
                className="w-full border dark:border-neutral-700 rounded-lg px-3 py-2 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
                value={formData.nickname}
                onChange={(e) => setFormData({ ...formData, nickname: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                전화번호
              </label>
              <input
                type="tel"
                className="w-full border dark:border-neutral-700 rounded-lg px-3 py-2 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                이메일
              </label>
              <input
                type="email"
                className="w-full border dark:border-neutral-700 rounded-lg px-3 py-2 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
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
        ) : (
          <div className="p-6 space-y-6">
            <div>
              <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">기본 정보</h4>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">이름</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {student.name || '-'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">닉네임</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {student.nickname || '-'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">전화번호</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {student.phone || '-'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">이메일</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {student.email || '-'}
                  </span>
                </div>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">수강권 정보</h4>
              <div className="space-y-2">
                {student.user_tickets && student.user_tickets.length > 0 ? (
                  student.user_tickets.map((ticket: any) => (
                    <div
                      key={ticket.id}
                      className="p-3 border dark:border-neutral-700 rounded-lg bg-gray-50 dark:bg-neutral-800"
                    >
                      <div className="flex justify-between items-center">
                        <span className="font-medium text-gray-900 dark:text-white">
                          {ticket.tickets?.name || '-'}
                        </span>
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          잔여: {ticket.remaining_count}회
                        </span>
                      </div>
                      {ticket.expiry_date && (
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          만료일: {new Date(ticket.expiry_date).toLocaleDateString('ko-KR')}
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="text-gray-500 dark:text-gray-400 text-sm">수강권이 없습니다.</div>
                )}
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                onClick={() => setIsEditing(true)}
                className="flex-1 px-4 py-2 border dark:border-neutral-700 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors"
              >
                수정
              </button>
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors"
              >
                닫기
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

