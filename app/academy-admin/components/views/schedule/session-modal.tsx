"use client";

import { useState, useEffect } from 'react';
import { X, Users, Clock, MapPin, User, Lock, Unlock, Trash2, Ban, Link2, Check, Edit2, Save, UserCog } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { getSupabaseClient } from '@/lib/utils/supabase-client';
import { formatKSTTime, formatKSTDate } from '@/lib/utils/kst-time';
import { AccessConfig } from '@/types/database';
import { formatExclusiveClassText } from '@/lib/utils/exclusive-class';
import { getClassColor, CLASS_CARD_COLOR_KEYS, CLASS_CARD_COLOR_LABELS, CLASS_CARD_COLORS } from '@/lib/constants/class-colors';

interface SessionModalProps {
  session: any;
  academyId?: string;
  onClose: () => void;
}

export function SessionModal({ session, academyId, onClose }: SessionModalProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [linkedTicketNames, setLinkedTicketNames] = useState<string[]>([]);
  
  // 편집 폼 상태
  const [formData, setFormData] = useState({
    startDate: '',
    startTime: '',
    endTime: '',
    instructorId: session.instructor_id || '',
    hallId: session.hall_id || '',
    maxStudents: session.max_students || 20,
    cardColor: (session.card_color ?? session.classes?.card_color) || '',
  });
  
  // 강사 및 홀 목록
  const [instructors, setInstructors] = useState<any[]>([]);
  const [halls, setHalls] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(false);

  const accessConfig = session.classes?.access_config as AccessConfig | null;

  const exclusiveText = formatExclusiveClassText({
    ticketNames: linkedTicketNames,
    requiredGroup: accessConfig?.requiredGroup,
  });
  const isExclusive = !!exclusiveText;

  // 세션 데이터에서 날짜/시간 파싱
  useEffect(() => {
    if (session.start_time) {
      const startDateTime = new Date(session.start_time);
      const endDateTime = session.end_time ? new Date(session.end_time) : null;
      
      // 로컬 날짜 포맷 (YYYY-MM-DD)
      const year = startDateTime.getFullYear();
      const month = String(startDateTime.getMonth() + 1).padStart(2, '0');
      const day = String(startDateTime.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;
      
      // 로컬 시간 포맷 (HH:MM)
      const startHour = String(startDateTime.getHours()).padStart(2, '0');
      const startMin = String(startDateTime.getMinutes()).padStart(2, '0');
      const startTimeStr = `${startHour}:${startMin}`;
      
      let endTimeStr = '';
      if (endDateTime) {
        const endHour = String(endDateTime.getHours()).padStart(2, '0');
        const endMin = String(endDateTime.getMinutes()).padStart(2, '0');
        endTimeStr = `${endHour}:${endMin}`;
      }
      
      setFormData(prev => ({
        ...prev,
        startDate: dateStr,
        startTime: startTimeStr,
        endTime: endTimeStr,
        instructorId: session.instructor_id || '',
        hallId: session.hall_id || '',
        maxStudents: session.max_students || 20,
        cardColor: (session.card_color ?? session.classes?.card_color) || '',
      }));
    }
  }, [session]);

  // 클래스에 연결된 수강권 이름 로드 (내부 코드 'advanced' 등 노출 방지)
  useEffect(() => {
    const classId = session?.classes?.id;
    if (!classId) {
      setLinkedTicketNames([]);
      return;
    }

    const supabase = getSupabaseClient();
    if (!supabase) {
      setLinkedTicketNames([]);
      return;
    }

    let cancelled = false;
    const run = async () => {
      try {
        const { data: ticketClassesData, error } = await (supabase as any)
          .from('ticket_classes')
          .select('ticket_id')
          .eq('class_id', classId);

        if (error) throw error;
        const ticketIds = (ticketClassesData || []).map((tc: any) => tc?.ticket_id).filter(Boolean);
        if (ticketIds.length === 0) {
          if (!cancelled) setLinkedTicketNames([]);
          return;
        }

        const { data: ticketsData } = await (supabase as any)
          .from('tickets')
          .select('id, name')
          .in('id', ticketIds);

        const names = (ticketsData || [])
          .map((t: any) => (typeof t?.name === 'string' ? t.name : ''))
          .filter(Boolean);

        if (!cancelled) setLinkedTicketNames(names);
      } catch (e) {
        if (!cancelled) setLinkedTicketNames([]);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [session?.classes?.id]);

  // academyId가 있거나 편집 모드에 들어갈 때 강사/홀 데이터 로드
  const loadEditData = async () => {
    if (loadingData) return;
    setLoadingData(true);
    
    const supabase = getSupabaseClient();
    if (!supabase) {
      setLoadingData(false);
      return;
    }

    try {
      // 세션의 클래스에서 academy_id 가져오기
      const targetAcademyId = academyId || session.classes?.academy_id;
      
      if (!targetAcademyId) {
        // academy_id가 없으면 class_id로 조회
        const { data: classData } = await supabase
          .from('classes')
          .select('academy_id')
          .eq('id', session.class_id)
          .single();
        
        if (classData?.academy_id) {
          await loadAcademyData(supabase, classData.academy_id);
        }
      } else {
        await loadAcademyData(supabase, targetAcademyId);
      }
    } catch (error) {
      console.error('Error loading edit data:', error);
    } finally {
      setLoadingData(false);
    }
  };

  const loadAcademyData = async (supabase: any, targetAcademyId: string) => {
    // 홀 목록 가져오기
    const { data: hallsData } = await supabase
      .from('halls')
      .select('*')
      .eq('academy_id', targetAcademyId)
      .order('name', { ascending: true });
    setHalls(hallsData || []);

    // 강사 목록 가져오기 (academy_instructors 조인)
    const { data: instructorsData } = await supabase
      .from('academy_instructors')
      .select(`
        instructor_id,
        instructors (
          id,
          name_kr,
          name_en
        )
      `)
      .eq('academy_id', targetAcademyId)
      .eq('is_active', true);
    
    const formattedInstructors = (instructorsData || [])
      .map((ai: any) => ai.instructors)
      .filter((i: any) => i !== null);
    setInstructors(formattedInstructors);
  };

  const handleCopyLink = async () => {
    const bookingUrl = `${window.location.origin}/book/session/${session.id}`;
    try {
      await navigator.clipboard.writeText(bookingUrl);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch (err) {
      // Fallback for browsers that don't support clipboard API
      const textArea = document.createElement('textarea');
      textArea.value = bookingUrl;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    }
  };

  const handleStartEdit = async () => {
    await loadEditData();
    setIsEditing(true);
  };

  const handleSave = async () => {
    if (!formData.startDate || !formData.startTime || !formData.endTime) {
      alert('날짜와 시간을 모두 입력해주세요.');
      return;
    }

    // 종료시각이 시작시각보다 뒤인지 검증
    const startDateTime = new Date(`${formData.startDate}T${formData.startTime}:00`);
    const endDateTime = new Date(`${formData.startDate}T${formData.endTime}:00`);
    
    if (endDateTime <= startDateTime) {
      alert('종료 시간은 시작 시간보다 뒤여야 합니다.');
      return;
    }

    setLoading(true);
    const supabase = getSupabaseClient();
    if (!supabase) {
      alert('데이터베이스 연결에 실패했습니다.');
      setLoading(false);
      return;
    }

    try {
      // 로컬 시간을 ISO 형식으로 변환 (이미 검증 완료)
      const startDateTime = new Date(`${formData.startDate}T${formData.startTime}:00`);
      const endDateTime = new Date(`${formData.startDate}T${formData.endTime}:00`);

      const updateData: any = {
        start_time: startDateTime.toISOString(),
        end_time: endDateTime.toISOString(),
        max_students: formData.maxStudents,
      };

      // instructor_id와 hall_id는 빈 문자열이면 null로 설정
      if (formData.instructorId) {
        updateData.instructor_id = formData.instructorId;
      } else {
        updateData.instructor_id = null;
      }

      if (formData.hallId) {
        updateData.hall_id = formData.hallId;
      } else {
        updateData.hall_id = null;
      }

      updateData.card_color = formData.cardColor?.trim() || null;

      const { error } = await supabase
        .from('schedules')
        .update(updateData)
        .eq('id', session.id);

      if (error) throw error;
      
      alert('세션이 수정되었습니다.');
      onClose();
    } catch (error: any) {
      console.error('Error updating session:', error);
      alert(`세션 수정에 실패했습니다: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };
  
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
    setLoading(true);
    const supabase = getSupabaseClient();
    if (!supabase) {
      alert('데이터베이스 연결에 실패했습니다.');
      setLoading(false);
      return;
    }

    try {
      // 먼저 연관된 예약이 있는지 확인
      const { data: bookings, error: bookingsError } = await supabase
        .from('bookings')
        .select('id, status')
        .eq('schedule_id', session.id);

      if (bookingsError) throw bookingsError;

      const hasBookings = bookings && bookings.length > 0;
      const confirmedBookings = bookings?.filter((b: any) => b.status === 'CONFIRMED' || b.status === 'PENDING') || [];

      // 예약이 있는 경우 사용자에게 확인
      if (hasBookings) {
        const confirmMessage = confirmedBookings.length > 0
          ? `이 세션에 ${confirmedBookings.length}개의 예약이 있습니다. 예약을 모두 취소하고 세션을 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.`
          : `이 세션에 ${bookings.length}개의 예약 기록이 있습니다. 모두 삭제하고 세션을 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.`;
        
        if (!window.confirm(confirmMessage)) {
          setLoading(false);
          return;
        }

        // 연관된 예약 삭제
        const { error: deleteBookingsError } = await supabase
          .from('bookings')
          .delete()
          .eq('schedule_id', session.id);

        if (deleteBookingsError) throw deleteBookingsError;
      } else {
        if (!window.confirm('이 세션을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
          setLoading(false);
          return;
        }
      }

      // 스케줄 삭제
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
      <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b dark:border-neutral-800 flex justify-between items-center">
          <h3 className="text-xl font-bold text-gray-800 dark:text-white">
            {isEditing ? '세션 수정' : '세션 상세'}
          </h3>
          <div className="flex items-center gap-2">
            {!isEditing && (
              <button
                onClick={handleStartEdit}
                className="p-2 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                title="수정"
              >
                <Edit2 size={18} />
              </button>
            )}
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {/* 포스터 */}
          {session.classes?.poster_url && (
            <div className="relative w-full aspect-[3/4] max-h-64 rounded-xl overflow-hidden bg-gray-100 dark:bg-neutral-800">
              <Image
                src={session.classes.poster_url}
                alt={session.classes?.title || '수업 포스터'}
                fill
                className="object-contain"
                sizes="(max-width: 768px) 100vw, 500px"
              />
            </div>
          )}

          {/* 클래스 정보 (읽기 전용) */}
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

          {isEditing ? (
            // 편집 모드
            <div className="space-y-4">
              {loadingData ? (
                <div className="text-center py-4 text-gray-500">데이터 로딩 중...</div>
              ) : (
                <>
                  {/* 날짜 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      날짜
                    </label>
                    <input
                      type="date"
                      value={formData.startDate}
                      onChange={(e) => setFormData(prev => ({ ...prev, startDate: e.target.value }))}
                      className="w-full px-3 py-2 border dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  {/* 시간 */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        시작 시간
                      </label>
                      <input
                        type="time"
                        value={formData.startTime}
                        onChange={(e) => setFormData(prev => ({ ...prev, startTime: e.target.value }))}
                        className="w-full px-3 py-2 border dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        종료 시간
                      </label>
                      <input
                        type="time"
                        value={formData.endTime}
                        onChange={(e) => setFormData(prev => ({ ...prev, endTime: e.target.value }))}
                        className="w-full px-3 py-2 border dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>

                  {/* 강사 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      강사
                    </label>
                    <select
                      value={formData.instructorId}
                      onChange={(e) => setFormData(prev => ({ ...prev, instructorId: e.target.value }))}
                      className="w-full px-3 py-2 border dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">강사 선택 (선택사항)</option>
                      {instructors.map((instructor) => (
                        <option key={instructor.id} value={instructor.id}>
                          {instructor.name_kr || instructor.name_en || '이름 없음'}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* 홀 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      홀
                    </label>
                    <select
                      value={formData.hallId}
                      onChange={(e) => setFormData(prev => ({ ...prev, hallId: e.target.value }))}
                      className="w-full px-3 py-2 border dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">홀 선택 (선택사항)</option>
                      {halls.map((hall) => (
                        <option key={hall.id} value={hall.id}>
                          {hall.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* 최대 수강생 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      최대 수강생
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={formData.maxStudents}
                      onChange={(e) => setFormData(prev => ({ ...prev, maxStudents: parseInt(e.target.value) || 1 }))}
                      className="w-full px-3 py-2 border dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  {/* 카드 색상 (이 세션만 적용, 미지정 시 클래스 색상 사용) */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">카드 색상</label>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, cardColor: '' }))}
                        className={`px-2 py-1 rounded text-xs font-medium border transition-colors ${!formData.cardColor ? 'ring-2 ring-blue-500 border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-200 dark:border-neutral-600 bg-white dark:bg-neutral-800'}`}
                      >
                        기본(클래스 색상)
                      </button>
                      {CLASS_CARD_COLOR_KEYS.map((key) => {
                        const style = CLASS_CARD_COLORS[key];
                        const isSelected = formData.cardColor === key;
                        return (
                          <button
                            key={key}
                            type="button"
                            onClick={() => setFormData(prev => ({ ...prev, cardColor: key }))}
                            className={`px-2 py-1 rounded text-xs font-medium border ${style.bg} ${style.border} ${style.text} ${isSelected ? 'ring-2 ring-offset-1 ring-neutral-800 dark:ring-neutral-200' : ''}`}
                          >
                            {CLASS_CARD_COLOR_LABELS[key]}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* 저장/취소 버튼 */}
                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={() => setIsEditing(false)}
                      disabled={loading}
                      className="flex-1 px-4 py-2 border dark:border-neutral-700 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors disabled:opacity-50"
                    >
                      취소
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={loading}
                      className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      <Save size={16} /> {loading ? '저장 중...' : '저장'}
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            // 읽기 모드
            <>
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
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 text-gray-600 dark:text-gray-400">
                  <Users size={18} />
                  <span>
                    {session.current_students || 0} / {session.max_students || 20}명
                  </span>
                </div>
                {academyId && (
                  <button
                    onClick={() => {
                      onClose();
                      router.push(`/academy-admin/${academyId}/enrollments?schedule_id=${session.id}`);
                    }}
                    className="px-3 py-1.5 text-xs bg-primary dark:bg-[#CCFF00] text-black rounded-lg hover:opacity-90 flex items-center gap-1.5 font-medium"
                    title="신청자 관리하기"
                  >
                    <UserCog size={14} />
                    신청자 관리하기
                  </button>
                )}
              </div>

              {/* 접근 권한 */}
              <div className="bg-slate-50 dark:bg-neutral-800 p-4 rounded-lg">
                <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                  {isExclusive ? <Lock size={14} /> : <Unlock size={14} />}
                  수강 권한
                </h5>
                <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                  {isExclusive ? (
                    <div className="text-indigo-600 dark:text-indigo-400 font-medium">
                      {exclusiveText}
                    </div>
                  ) : (
                    <div className="text-green-600 dark:text-green-400">전용 제한 없음</div>
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

              {/* 결제 링크 복사 */}
              <button
                onClick={handleCopyLink}
                className={`w-full px-4 py-3 rounded-lg font-medium flex items-center justify-center gap-2 transition-all ${
                  linkCopied
                    ? 'bg-green-500 text-white'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
              >
                {linkCopied ? (
                  <>
                    <Check size={18} />
                    링크가 복사되었습니다!
                  </>
                ) : (
                  <>
                    <Link2 size={18} />
                    결제 링크 복사
                  </>
                )}
              </button>

              {/* 버튼 */}
              <div className="flex gap-3 pt-2">
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
            </>
          )}
        </div>
      </div>
    </div>
  );
}
