"use client";

import { useState } from 'react';
import { X, Users, Clock, MapPin, User, Lock, Unlock, Trash2, Ban } from 'lucide-react';
import { getSupabaseClient } from '@/lib/utils/supabase-client';
import { formatKSTTime, formatKSTDate } from '@/lib/utils/kst-time';
import { AccessConfig } from '@/types/database';

interface SessionModalProps {
  session: any;
  onClose: () => void;
}

export function SessionModal({ session, onClose }: SessionModalProps) {
  const [loading, setLoading] = useState(false);

  const accessConfig = session.classes?.access_config as AccessConfig | null;
  
  const handleCancel = async () => {
    if (!window.confirm('이 세션을 취소하시겠습니까?')) return;
    
    setLoading(true);
    const supabase = getSupabaseClient();
    if (!supabase) {
      alert('데이터베이스 연결에 실패했습니다.');
      setLoading(false);
      return;
    }

    try {
      const { error } = await supabase
        .from('schedules')
        .update({ is_canceled: true })
        .eq('id', session.id);

      if (error) throw error;
      alert('세션이 취소되었습니다.');
      onClose();
    } catch (error: any) {
      console.error('Error canceling session:', error);
      alert(`세션 취소에 실패했습니다: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('이 세션을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) return;
    
    setLoading(true);
    const supabase = getSupabaseClient();
    if (!supabase) {
      alert('데이터베이스 연결에 실패했습니다.');
      setLoading(false);
      return;
    }

    try {
      const { error } = await supabase
        .from('schedules')
        .delete()
        .eq('id', session.id);

      if (error) throw error;
      alert('세션이 삭제되었습니다.');
      onClose();
    } catch (error: any) {
      console.error('Error deleting session:', error);
      alert(`세션 삭제에 실패했습니다: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 dark:bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
        <div className="p-6 border-b dark:border-neutral-800 flex justify-between items-center">
          <h3 className="text-xl font-bold text-gray-800 dark:text-white">
            세션 상세
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* 클래스 정보 */}
          <div>
            <h4 className="text-lg font-bold text-gray-900 dark:text-white">
              {session.classes?.title || '제목 없음'}
            </h4>
            <div className="flex items-center gap-2 mt-1">
              {session.classes?.genre && (
                <span className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-gray-400 rounded">
                  {session.classes.genre}
                </span>
              )}
              {session.classes?.difficulty_level && (
                <span className="text-xs px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded">
                  {session.classes.difficulty_level}
                </span>
              )}
            </div>
          </div>

          {/* 시간 정보 */}
          <div className="flex items-center gap-3 text-gray-600 dark:text-gray-400">
            <Clock size={18} />
            <div>
              <div className="font-medium text-gray-900 dark:text-white">
                {session.start_time && formatKSTDate(new Date(session.start_time))}
              </div>
              <div className="text-sm">
                {session.start_time && formatKSTTime(session.start_time)} - {session.end_time && formatKSTTime(session.end_time)}
              </div>
            </div>
          </div>

          {/* 강사 */}
          {session.instructors && (
            <div className="flex items-center gap-3 text-gray-600 dark:text-gray-400">
              <User size={18} />
              <span>{session.instructors.name_kr || session.instructors.name_en}</span>
            </div>
          )}

          {/* 홀 */}
          {session.halls && (
            <div className="flex items-center gap-3 text-gray-600 dark:text-gray-400">
              <MapPin size={18} />
              <span>{session.halls.name}</span>
            </div>
          )}

          {/* 수강생 현황 */}
          <div className="flex items-center gap-3 text-gray-600 dark:text-gray-400">
            <Users size={18} />
            <span>
              {session.current_students || 0} / {session.max_students || 20}명
            </span>
          </div>

          {/* 접근 권한 */}
          <div className="bg-slate-50 dark:bg-neutral-800 p-4 rounded-lg">
            <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
              {accessConfig?.requiredGroup ? <Lock size={14} /> : <Unlock size={14} />}
              수강 권한
            </h5>
            <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
              {accessConfig?.requiredGroup ? (
                <div className="text-indigo-600 dark:text-indigo-400 font-medium">
                  {accessConfig.requiredGroup} 전용
                </div>
              ) : (
                <div className="text-green-600 dark:text-green-400">그룹 제한 없음</div>
              )}
              <div className="flex gap-2">
                {accessConfig?.allowRegularTicket !== false && (
                  <span className="text-blue-600 dark:text-blue-400">🎫 수강권</span>
                )}
                {accessConfig?.allowCoupon === true && (
                  <span className="text-amber-600 dark:text-amber-400">🏷️ 쿠폰</span>
                )}
                {accessConfig?.allowRegularTicket === false && accessConfig?.allowCoupon !== true && (
                  <span className="text-red-600 dark:text-red-400">🔒 전용만</span>
                )}
              </div>
            </div>
          </div>

          {/* 버튼 */}
          <div className="flex gap-3 pt-4">
            <button
              onClick={handleCancel}
              disabled={loading}
              className="flex-1 px-4 py-2 border border-amber-500 text-amber-600 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Ban size={16} /> 취소
            </button>
            <button
              onClick={handleDelete}
              disabled={loading}
              className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Trash2 size={16} /> 삭제
            </button>
          </div>

          <button
            onClick={onClose}
            className="w-full px-4 py-2 border dark:border-neutral-700 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
