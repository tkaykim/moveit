"use client";

import { useState, useEffect } from 'react';
import { X, Plus, Edit2, Trash2, Clock, Users, MapPin, User, Zap, Repeat } from 'lucide-react';
import { getSupabaseClient } from '@/lib/utils/supabase-client';
import { formatKSTTime } from '@/lib/utils/kst-time';
import { RecurringScheduleModal } from './recurring-schedule-modal';
import { SessionModal } from './session-modal';

interface DailyScheduleModalProps {
  academyId: string;
  selectedDate: Date;
  classMasters: any[];
  halls: any[];
  onClose: () => void;
}

const DIFFICULTY_LABELS: Record<string, string> = {
  BEGINNER: '초급',
  INTERMEDIATE: '중급',
  ADVANCED: '고급',
};

const DIFFICULTY_COLORS: Record<string, string> = {
  BEGINNER: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  INTERMEDIATE: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  ADVANCED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

export function DailyScheduleModal({ 
  academyId, 
  selectedDate, 
  classMasters, 
  halls, 
  onClose 
}: DailyScheduleModalProps) {
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedSession, setSelectedSession] = useState<any>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  useEffect(() => {
    loadSessions();
  }, [selectedDate]);

  const loadSessions = async () => {
    setLoading(true);
    const supabase = getSupabaseClient();
    if (!supabase) {
      setLoading(false);
      return;
    }

    try {
      // 선택된 날짜의 년/월/일 추출
      const year = selectedDate.getFullYear();
      const month = selectedDate.getMonth();
      const day = selectedDate.getDate();
      
      // 해당 날짜의 시작과 끝 (로컬 시간 기준)
      const startOfDay = new Date(year, month, day, 0, 0, 0, 0);
      const endOfDay = new Date(year, month, day, 23, 59, 59, 999);

      // 해당 아카데미의 클래스 ID 목록
      const classIds = classMasters.map((c: any) => c.id);
      
      if (classIds.length === 0) {
        setSessions([]);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('schedules')
        .select(`
          *,
          classes (
            id,
            title,
            genre,
            difficulty_level,
            class_type,
            price
          ),
          instructors (
            id,
            name_kr,
            name_en
          ),
          halls (
            id,
            name
          )
        `)
        .in('class_id', classIds)
        .eq('is_canceled', false)
        .order('start_time', { ascending: true });

      if (error) throw error;

      // 로컬 시간 기준으로 해당 날짜의 세션만 필터링
      const filteredSessions = (data || []).filter((session: any) => {
        if (!session.start_time) return false;
        const sessionDate = new Date(session.start_time);
        return sessionDate >= startOfDay && sessionDate <= endOfDay;
      });
      
      setSessions(filteredSessions);
    } catch (error) {
      console.error('Error loading sessions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (sessionId: string) => {
    const supabase = getSupabaseClient();
    if (!supabase) return;

    try {
      const { error } = await supabase
        .from('schedules')
        .update({ is_canceled: true })
        .eq('id', sessionId);

      if (error) throw error;
      
      alert('수업이 삭제되었습니다.');
      setDeleteConfirm(null);
      loadSessions();
    } catch (error: any) {
      console.error('Error deleting session:', error);
      alert(`삭제 실패: ${error.message}`);
    }
  };

  const formatDateString = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const dayOfWeek = ['일', '월', '화', '수', '목', '금', '토'][date.getDay()];
    return `${year}년 ${month}월 ${day}일 (${dayOfWeek})`;
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 dark:bg-black/60 backdrop-blur-sm">
        <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden max-h-[90vh] flex flex-col">
          {/* 헤더 */}
          <div className="p-6 border-b dark:border-neutral-800 flex justify-between items-center shrink-0">
            <div>
              <h3 className="text-xl font-bold text-gray-800 dark:text-white">
                {formatDateString(selectedDate)}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {sessions.length}개의 수업
              </p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
              <X size={20} />
            </button>
          </div>

          {/* 수업 추가 버튼 */}
          <div className="p-4 border-b dark:border-neutral-800 shrink-0">
            <button
              onClick={() => setShowAddModal(true)}
              className="w-full py-3 border-2 border-dashed border-gray-300 dark:border-neutral-700 rounded-lg text-gray-500 dark:text-gray-400 hover:border-blue-500 hover:text-blue-500 dark:hover:border-blue-400 dark:hover:text-blue-400 transition-colors flex items-center justify-center gap-2"
            >
              <Plus size={18} />
              수업 추가
            </button>
          </div>

          {/* 수업 목록 */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {loading ? (
              <div className="text-center text-gray-500 dark:text-gray-400 py-8">
                로딩 중...
              </div>
            ) : sessions.length === 0 ? (
              <div className="text-center text-gray-400 dark:text-gray-500 py-12">
                <Clock size={48} className="mx-auto mb-4 opacity-30" />
                <p>이 날짜에 등록된 수업이 없습니다.</p>
                <p className="text-sm mt-2">위 버튼을 눌러 수업을 추가하세요.</p>
              </div>
            ) : (
              sessions.map((session) => {
                const difficulty = session.classes?.difficulty_level || 'BEGINNER';
                const isPopup = session.classes?.class_type === 'popup';

                return (
                  <div
                    key={session.id}
                    role="button"
                    tabIndex={0}
                    className="bg-gray-50 dark:bg-neutral-800 rounded-xl p-4 hover:shadow-md transition-shadow cursor-pointer hover:bg-gray-100 dark:hover:bg-neutral-700"
                    onClick={() => {
                      setSelectedSession(session);
                      setShowEditModal(true);
                    }}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        {/* 시간 및 타입 */}
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-lg font-bold text-gray-800 dark:text-white">
                            {formatKSTTime(session.start_time)} - {formatKSTTime(session.end_time)}
                          </span>
                          {isPopup ? (
                            <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs rounded-full flex items-center gap-1">
                              <Zap size={10} /> 팝업
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 text-xs rounded-full flex items-center gap-1">
                              <Repeat size={10} /> 정규
                            </span>
                          )}
                        </div>

                        {/* 클래스 제목 */}
                        <h4 className="font-bold text-gray-900 dark:text-white text-lg mb-2">
                          {session.classes?.title || '제목 없음'}
                        </h4>

                        {/* 상세 정보 */}
                        <div className="flex flex-wrap gap-3 text-sm text-gray-600 dark:text-gray-400">
                          {/* 강사 */}
                          <div className="flex items-center gap-1">
                            <User size={14} />
                            <span>{session.instructors?.name_kr || session.instructors?.name_en || '강사 미지정'}</span>
                          </div>
                          {/* 홀 */}
                          {session.halls?.name && (
                            <div className="flex items-center gap-1">
                              <MapPin size={14} />
                              <span>{session.halls.name}</span>
                            </div>
                          )}
                          {/* 인원 */}
                          <div className="flex items-center gap-1">
                            <Users size={14} />
                            <span>{session.current_students || 0}/{session.max_students || 0}</span>
                          </div>
                          {/* 난이도 */}
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${DIFFICULTY_COLORS[difficulty]}`}>
                            {DIFFICULTY_LABELS[difficulty] || difficulty}
                          </span>
                          {/* 가격 (팝업인 경우) */}
                          {isPopup && session.classes?.price && (
                            <span className="text-amber-600 dark:text-amber-400 font-medium">
                              {session.classes.price.toLocaleString()}원
                            </span>
                          )}
                        </div>
                      </div>

                      {/* 액션 버튼 */}
                      <div className="flex gap-2 ml-4">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedSession(session);
                            setShowEditModal(true);
                          }}
                          className="p-2 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                          title="수정"
                        >
                          <Edit2 size={18} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteConfirm(session.id);
                          }}
                          className="p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                          title="삭제"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>

                    {/* 삭제 확인 */}
                    {deleteConfirm === session.id && (
                      <div 
                        className="mt-3 pt-3 border-t dark:border-neutral-700 flex items-center justify-between"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span className="text-sm text-red-600 dark:text-red-400">
                          정말 삭제하시겠습니까?
                        </span>
                        <div className="flex gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteConfirm(null);
                            }}
                            className="px-3 py-1 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-neutral-700 rounded"
                          >
                            취소
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(session.id);
                            }}
                            className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700"
                          >
                            삭제
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* 하단 버튼 */}
          <div className="p-4 border-t dark:border-neutral-800 shrink-0">
            <button
              onClick={onClose}
              className="w-full py-3 bg-gray-100 dark:bg-neutral-800 text-gray-700 dark:text-gray-300 rounded-lg font-medium hover:bg-gray-200 dark:hover:bg-neutral-700 transition-colors"
            >
              닫기
            </button>
          </div>
        </div>
      </div>

      {/* 수업 추가 모달 */}
      {showAddModal && (
        <RecurringScheduleModal
          academyId={academyId}
          classMasters={classMasters}
          halls={halls}
          initialDate={selectedDate}
          onClose={() => {
            setShowAddModal(false);
            loadSessions();
          }}
          onClassCreated={() => {
            loadSessions(); // 클래스 생성 후 데이터 새로고침
          }}
        />
      )}

      {/* 수업 수정 모달 */}
      {showEditModal && selectedSession && (
        <SessionModal
          session={selectedSession}
          academyId={academyId}
          onClose={() => {
            setShowEditModal(false);
            setSelectedSession(null);
            loadSessions();
          }}
        />
      )}
    </>
  );
}
