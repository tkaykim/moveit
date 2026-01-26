"use client";

import { useState, useEffect } from 'react';
import {
  ClipboardList,
  FileText,
  AlertCircle,
  ChevronRight,
  ChevronLeft,
  ChevronUp,
  ChevronDown,
  Calendar,
} from 'lucide-react';
import { SectionHeader } from '../common/section-header';
import { DailyLogModal } from './logs/daily-log-modal';
import { getSupabaseClient } from '@/lib/utils/supabase-client';

interface DailyLogViewProps {
  academyId: string;
}

export function DailyLogView({ academyId }: DailyLogViewProps) {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [logs, setLogs] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [operationNote, setOperationNote] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [showLogModal, setShowLogModal] = useState(false);
  const [selectedLog, setSelectedLog] = useState<any>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);

  useEffect(() => {
    loadData();
  }, [academyId, selectedDate]);

  const loadData = async () => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      setLoading(false);
      return;
    }

    try {
      const dateStr = selectedDate.toISOString().split('T')[0];

      // 선택한 날짜의 스케줄 로드
      const startOfDay = new Date(selectedDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(selectedDate);
      endOfDay.setHours(23, 59, 59, 999);

      // 먼저 해당 학원의 클래스 ID 목록 조회
      const { data: academyClasses, error: classError } = await supabase
        .from('classes')
        .select('id')
        .eq('academy_id', academyId)
        .eq('is_canceled', false);

      if (classError) throw classError;

      const classIds = (academyClasses || []).map((c: any) => c.id);

      let schedulesData: any[] = [];
      if (classIds.length > 0) {
        // schedules 테이블에서 선택한 날짜의 수업 일정 조회
        const { data: schedules, error: schedulesError } = await supabase
          .from('schedules')
          .select(`
            *,
            classes (
              id,
              title,
              genre,
              difficulty_level,
              academy_id,
              video_url
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
          .gte('start_time', startOfDay.toISOString())
          .lte('start_time', endOfDay.toISOString())
          .order('start_time', { ascending: true });

        if (schedulesError) throw schedulesError;
        schedulesData = schedules || [];
      }
      setClasses(schedulesData);

      // 오늘의 일지 로드
      const { data: logsData, error: logsError } = await supabase
        .from('daily_logs')
        .select('*')
        .eq('academy_id', academyId)
        .eq('log_date', dateStr)
        .order('created_at', { ascending: true });

      if (logsError) throw logsError;

      // 스케줄과 일지 매칭 (class_id + log_date 기준)
      const logsMap = new Map(
        (logsData || []).map((log: any) => [`${log.class_id}_${log.log_date}`, log])
      );
      const combinedData = schedulesData.map((scheduleItem: any) => {
        const classId = scheduleItem.class_id;
        const logKey = `${classId}_${dateStr}`;
        const log = logsMap.get(logKey);
        return {
          ...scheduleItem,
          log: log || null,
        };
      });
      setLogs(combinedData);

      // 운영 메모 로드
      const { data: noteData } = await supabase
        .from('operation_notes')
        .select('content')
        .eq('academy_id', academyId)
        .eq('note_date', dateStr)
        .single();

      setOperationNote(noteData?.content || '');
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveNote = async () => {
    const supabase = getSupabaseClient();
    if (!supabase) return;

    try {
      const dateStr = selectedDate.toISOString().split('T')[0];
      const { error } = await supabase.from('operation_notes').upsert(
        {
          academy_id: academyId,
          note_date: dateStr,
          content: operationNote,
        },
        {
          onConflict: 'academy_id,note_date',
        }
      );

      if (error) throw error;
      alert('운영 메모가 저장되었습니다.');
    } catch (error: any) {
      console.error('Error saving note:', error);
      alert(`메모 저장에 실패했습니다: ${error.message}`);
    }
  };

  const completedCount = logs.filter((l) => l.log?.status === 'COMPLETED').length;
  const pendingCount = logs.length - completedCount;
  const hasNotes = logs.some((l) => l.log?.notes);

  const goToToday = () => {
    setSelectedDate(new Date());
  };

  const goToPrevDay = () => {
    const prevDay = new Date(selectedDate);
    prevDay.setDate(prevDay.getDate() - 1);
    setSelectedDate(prevDay);
  };

  const goToNextDay = () => {
    const nextDay = new Date(selectedDate);
    nextDay.setDate(nextDay.getDate() + 1);
    setSelectedDate(nextDay);
  };

  const isToday = () => {
    const today = new Date();
    return (
      selectedDate.getDate() === today.getDate() &&
      selectedDate.getMonth() === today.getMonth() &&
      selectedDate.getFullYear() === today.getFullYear()
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500 dark:text-gray-400">로딩 중...</div>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        <SectionHeader title="업무 및 수업 일지" />

        {/* 날짜 선택 및 요약 */}
        <div className="bg-white dark:bg-neutral-900 p-4 md:p-6 rounded-xl shadow-sm border border-gray-100 dark:border-neutral-800">
          {/* 날짜 네비게이션 - 모바일 최적화 */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            {/* 날짜 선택 영역 */}
            <div className="flex items-center justify-between md:justify-start gap-2 md:gap-4 flex-1">
              <button
                onClick={goToPrevDay}
                className="p-2.5 md:p-2 hover:bg-gray-100 dark:hover:bg-neutral-800 rounded-lg transition-colors active:scale-95"
                aria-label="이전 날짜"
              >
                <ChevronLeft size={22} className="text-gray-600 dark:text-gray-400" />
              </button>
              
              <button
                onClick={() => setShowDatePicker(true)}
                className="flex-1 md:flex-none text-center px-3 py-2 hover:bg-gray-50 dark:hover:bg-neutral-800 rounded-lg transition-colors"
              >
                <div className="flex items-center justify-center gap-2">
                  <Calendar size={18} className="text-gray-500 dark:text-gray-400" />
                  <div>
                    <h3 className="text-base md:text-xl font-bold text-gray-900 dark:text-white">
                      {selectedDate.toLocaleDateString('ko-KR', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </h3>
                    <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400">
                      {selectedDate.toLocaleDateString('ko-KR', { weekday: 'long' })}
                    </p>
                  </div>
                </div>
              </button>
              
              <button
                onClick={goToNextDay}
                className="p-2.5 md:p-2 hover:bg-gray-100 dark:hover:bg-neutral-800 rounded-lg transition-colors active:scale-95"
                aria-label="다음 날짜"
              >
                <ChevronRight size={22} className="text-gray-600 dark:text-gray-400" />
              </button>
            </div>

            {/* 오늘로 이동 버튼 - 모바일에서만 표시 */}
            {!isToday() && (
              <button
                onClick={goToToday}
                className="md:hidden w-full py-2 px-4 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg text-sm font-semibold hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
              >
                오늘로 이동
              </button>
            )}

            {/* 요약 정보 - 모바일에서는 아래로 */}
            <div className="flex md:flex-row gap-3 md:gap-4 pt-2 md:pt-0 border-t md:border-t-0 border-gray-200 dark:border-neutral-700">
              <div className="flex-1 md:flex-none text-center md:text-right">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">작성 완료</p>
                <p className="text-sm md:text-base font-bold text-blue-600 dark:text-blue-400">
                  {completedCount} / {logs.length} 건
                </p>
              </div>
              <div className="hidden md:block h-10 w-px bg-gray-200 dark:bg-neutral-700"></div>
              <div className="flex-1 md:flex-none text-center md:text-right">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">특이사항</p>
                <p className="text-sm md:text-base font-bold text-red-500 dark:text-red-400">
                  {hasNotes ? 1 : 0} 건
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* 날짜 선택 모달 */}
        {showDatePicker && (
          <div
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() => setShowDatePicker(false)}
          >
            <div
              className="bg-white dark:bg-neutral-900 rounded-xl p-6 w-full max-w-sm shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-bold mb-4 text-gray-900 dark:text-white">날짜 선택</h3>
              <input
                type="date"
                value={selectedDate.toISOString().split('T')[0]}
                onChange={(e) => {
                  setSelectedDate(new Date(e.target.value));
                  setShowDatePicker(false);
                }}
                className="w-full p-3 border border-gray-300 dark:border-neutral-700 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 outline-none bg-white dark:bg-neutral-800 text-gray-900 dark:text-white"
              />
              <div className="flex gap-2 mt-4">
                <button
                  onClick={goToToday}
                  className="flex-1 py-2 px-4 bg-blue-600 dark:bg-blue-500 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors"
                >
                  오늘
                </button>
                <button
                  onClick={() => setShowDatePicker(false)}
                  className="flex-1 py-2 px-4 bg-gray-200 dark:bg-neutral-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-semibold hover:bg-gray-300 dark:hover:bg-neutral-600 transition-colors"
                >
                  취소
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 왼쪽: 수업 리스트 */}
          <div className="lg:col-span-2 space-y-4">
            <h3 className="font-bold text-gray-800 dark:text-white flex items-center gap-2">
              <ClipboardList size={18} /> 수업 별 기록
            </h3>

            {logs.length === 0 ? (
              <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                오늘 예정된 수업이 없습니다.
              </div>
            ) : (
              logs.map((item) => {
                const log = item.log;
                const status = log?.status || 'PENDING';
                const time = item.start_time 
                  ? new Date(item.start_time).toLocaleTimeString('ko-KR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : '-';

                const hasWarning = status === 'PENDING' || log?.notes;
                
                return (
                  <div
                    key={item.id}
                    className={`bg-white dark:bg-neutral-900 rounded-xl shadow-sm border overflow-hidden transition-all ${
                      expandedLogId === item.id
                        ? 'ring-2 ring-blue-500 dark:ring-blue-400 border-transparent'
                        : hasWarning
                        ? 'border-yellow-300 dark:border-yellow-700 bg-yellow-50/30 dark:bg-yellow-900/10 hover:bg-yellow-50 dark:hover:bg-yellow-900/20'
                        : 'border-gray-100 dark:border-neutral-800'
                    }`}
                  >
                    <div
                      className={`p-3 md:p-4 flex items-start md:items-center justify-between cursor-pointer transition-colors gap-3 ${
                        hasWarning
                          ? 'hover:bg-yellow-100 dark:hover:bg-yellow-900/30'
                          : 'hover:bg-gray-50 dark:hover:bg-neutral-800'
                      }`}
                      onClick={() => setExpandedLogId(expandedLogId === item.id ? null : item.id)}
                    >
                      <div className="flex items-start md:items-center gap-3 md:gap-4 flex-1 min-w-0">
                        <div
                          className={`px-2.5 md:px-3 py-1 rounded text-xs md:text-sm font-bold whitespace-nowrap flex-shrink-0 ${
                            status === 'COMPLETED'
                              ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                              : 'bg-gray-100 dark:bg-neutral-800 text-gray-500 dark:text-gray-400'
                          }`}
                        >
                          {time}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="font-bold text-sm md:text-base text-gray-800 dark:text-white break-words">
                            {item.classes?.title || item.title || '-'}
                          </h4>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 break-words">
                            {item.instructors?.name_kr || item.instructors?.name_en || '-'} 강사
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 md:gap-3 flex-shrink-0">
                        {status === 'PENDING' && (
                          <span className="text-xs text-red-500 dark:text-red-400 font-bold flex items-center gap-1 whitespace-nowrap">
                            <AlertCircle size={12} />
                            <span className="hidden sm:inline">미작성</span>
                          </span>
                        )}
                        {expandedLogId === item.id ? (
                          <ChevronUp size={20} className="text-gray-400 dark:text-gray-500 flex-shrink-0" />
                        ) : (
                          <ChevronDown size={20} className="text-gray-400 dark:text-gray-500 flex-shrink-0" />
                        )}
                      </div>
                    </div>

                    {/* 확장 영역 (일지 상세) */}
                    {expandedLogId === item.id && (
                      <div className="p-3 md:p-4 border-t border-gray-100 dark:border-neutral-800 bg-slate-50 dark:bg-neutral-800/50">
                        {log ? (
                          <>
                            <div className="mb-4">
                              <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-2 uppercase">
                                출석 현황
                              </label>
                              <div className="space-y-2">
                                <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                                  <div className="flex-1 h-2 bg-gray-200 dark:bg-neutral-700 rounded-full overflow-hidden">
                                    <div
                                      className="h-full bg-green-500 dark:bg-green-400"
                                      style={{
                                        width: `${((item.present_students || 0) / (item.current_students || 1)) * 100}%`,
                                      }}
                                    ></div>
                                  </div>
                                  <span className="text-xs sm:text-sm font-bold text-gray-700 dark:text-gray-300 whitespace-nowrap">
                                    출석: {item.present_students || 0}명
                                  </span>
                                </div>
                                <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                                  <div>정원: {item.max_students || 0}명</div>
                                  <div>신청자: {item.current_students || 0}명</div>
                                  <div>출석자: {item.present_students || 0}명</div>
                                </div>
                              </div>
                            </div>

                            <div className="mb-4">
                              <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1 uppercase">
                                수업 진도 및 내용
                              </label>
                              <p className="text-sm text-gray-800 dark:text-white bg-white dark:bg-neutral-900 p-3 rounded border border-gray-200 dark:border-neutral-700 whitespace-pre-wrap break-words">
                                {log.content || '내용 없음'}
                              </p>
                            </div>

                            <div className="mb-4">
                              <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1 uppercase text-red-500 dark:text-red-400">
                                특이사항 (학생/시설)
                              </label>
                              <p className="text-sm text-gray-800 dark:text-white bg-white dark:bg-neutral-900 p-3 rounded border border-gray-200 dark:border-neutral-700 whitespace-pre-wrap break-words">
                                {log.notes || '특이사항 없음'}
                              </p>
                            </div>

                            {(log?.video_url || item.video_url || item.classes?.video_url) && (
                              <div className="mb-4">
                                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1 uppercase">
                                  수업영상 링크
                                </label>
                                <a
                                  href={log?.video_url || item.video_url || item.classes?.video_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs sm:text-sm text-blue-600 dark:text-blue-400 hover:underline break-all block"
                                >
                                  {log?.video_url || item.video_url || item.classes?.video_url}
                                </a>
                              </div>
                            )}

                            <div className="mt-4">
                              <button
                              onClick={() => {
                                setSelectedLog({ classItem: item, log: item.log });
                                setShowLogModal(true);
                              }}
                                className="w-full sm:w-auto bg-blue-600 dark:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors"
                              >
                                일지 수정하기
                              </button>
                            </div>
                          </>
                        ) : (
                          <div className="text-center py-4">
                            <button
                              onClick={() => {
                                setSelectedLog({ classItem: item, log: null });
                                setShowLogModal(true);
                              }}
                              className="w-full sm:w-auto bg-blue-600 dark:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors"
                            >
                              일지 작성하기
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* 오른쪽: 운영 메모 */}
          <div className="space-y-4">
            <h3 className="font-bold text-gray-800 dark:text-white flex items-center gap-2">
              <FileText size={18} /> 운영 메모
            </h3>
            <div className="bg-white dark:bg-neutral-900 p-3 md:p-4 rounded-xl shadow-sm border border-gray-100 dark:border-neutral-800 h-fit">
              <textarea
                className="w-full h-32 md:h-40 p-3 text-sm border border-gray-200 dark:border-neutral-700 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 outline-none resize-none mb-3 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                placeholder="오늘 센터 운영 관련 특이사항을 자유롭게 기록하세요. (예: A홀 에어컨 점검 필요, 비품 화장지 구매 완료 등)"
                value={operationNote}
                onChange={(e) => setOperationNote(e.target.value)}
              />
              <button
                onClick={handleSaveNote}
                className="w-full bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 py-2.5 md:py-2 rounded-lg text-sm font-bold hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors active:scale-95"
              >
                메모 저장
              </button>
            </div>

            {pendingCount > 0 && (
              <div className="bg-yellow-50 dark:bg-yellow-900/20 p-3 md:p-4 rounded-xl border border-yellow-200 dark:border-yellow-900/30">
                <h4 className="font-bold text-yellow-800 dark:text-yellow-400 text-sm mb-2 flex items-center gap-2">
                  <AlertCircle size={14} /> 알림
                </h4>
                <p className="text-xs text-yellow-700 dark:text-yellow-300 break-words">
                  미작성된 수업 일지가 {pendingCount}건 있습니다.
                  <br className="hidden sm:block" />
                  <span className="sm:hidden"> </span>
                  퇴근 전 반드시 작성 부탁드립니다.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {showLogModal && (
        <DailyLogModal
          academyId={academyId}
          classItem={selectedLog?.classItem}
          log={selectedLog?.log}
          onClose={() => {
            setShowLogModal(false);
            setSelectedLog(null);
            loadData();
          }}
        />
      )}
    </>
  );
}
