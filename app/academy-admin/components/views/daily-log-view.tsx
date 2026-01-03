"use client";

import { useState, useEffect } from 'react';
import {
  ClipboardList,
  FileText,
  AlertCircle,
  ChevronRight,
  ChevronUp,
  ChevronDown,
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

      // 오늘의 클래스 로드
      const startOfDay = new Date(selectedDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(selectedDate);
      endOfDay.setHours(23, 59, 59, 999);

      const { data: classesData, error: classesError } = await supabase
        .from('classes')
        .select(`
          *,
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
        .eq('academy_id', academyId)
        .eq('is_canceled', false)
        .gte('start_time', startOfDay.toISOString())
        .lte('start_time', endOfDay.toISOString())
        .order('start_time', { ascending: true });

      if (classesError) throw classesError;
      setClasses(classesData || []);

      // 오늘의 일지 로드
      const { data: logsData, error: logsError } = await supabase
        .from('daily_logs')
        .select('*')
        .eq('academy_id', academyId)
        .eq('log_date', dateStr)
        .order('created_at', { ascending: true });

      if (logsError) throw logsError;

      // 클래스와 일지 매칭
      const logsMap = new Map((logsData || []).map((log: any) => [log.class_id, log]));
      const combinedData = (classesData || []).map((classItem: any) => {
        const log = logsMap.get(classItem.id);
        return {
          ...classItem,
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
        <div className="bg-white dark:bg-neutral-900 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => {
                const prevDay = new Date(selectedDate);
                prevDay.setDate(prevDay.getDate() - 1);
                setSelectedDate(prevDay);
              }}
              className="p-2 hover:bg-gray-100 dark:hover:bg-neutral-800 rounded-full transition-colors"
            >
              <ChevronRight size={20} className="rotate-180 text-gray-600 dark:text-gray-400" />
            </button>
            <div className="text-center">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                {selectedDate.toLocaleDateString('ko-KR', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {selectedDate.toLocaleDateString('ko-KR', { weekday: 'long' })}
              </p>
            </div>
            <button
              onClick={() => {
                const nextDay = new Date(selectedDate);
                nextDay.setDate(nextDay.getDate() + 1);
                setSelectedDate(nextDay);
              }}
              className="p-2 hover:bg-gray-100 dark:hover:bg-neutral-800 rounded-full transition-colors"
            >
              <ChevronRight size={20} className="text-gray-600 dark:text-gray-400" />
            </button>
          </div>
          <div className="flex gap-4">
            <div className="text-right">
              <p className="text-xs text-gray-500 dark:text-gray-400">작성 완료</p>
              <p className="font-bold text-blue-600 dark:text-blue-400">
                {completedCount} / {logs.length} 건
              </p>
            </div>
            <div className="h-10 w-px bg-gray-200 dark:bg-neutral-700"></div>
            <div className="text-right">
              <p className="text-xs text-gray-500 dark:text-gray-400">특이사항</p>
              <p className="font-bold text-red-500 dark:text-red-400">{hasNotes ? 1 : 0} 건</p>
            </div>
          </div>
        </div>

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
                const time = new Date(item.start_time).toLocaleTimeString('ko-KR', {
                  hour: '2-digit',
                  minute: '2-digit',
                });

                return (
                  <div
                    key={item.id}
                    className={`bg-white dark:bg-neutral-900 rounded-xl shadow-sm border overflow-hidden transition-all ${
                      expandedLogId === item.id
                        ? 'ring-2 ring-blue-500 dark:ring-blue-400 border-transparent'
                        : 'border-gray-100 dark:border-neutral-800'
                    }`}
                  >
                    <div
                      className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors"
                      onClick={() => setExpandedLogId(expandedLogId === item.id ? null : item.id)}
                    >
                      <div className="flex items-center gap-4">
                        <div
                          className={`px-3 py-1 rounded text-sm font-bold ${
                            status === 'COMPLETED'
                              ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                              : 'bg-gray-100 dark:bg-neutral-800 text-gray-500 dark:text-gray-400'
                          }`}
                        >
                          {time}
                        </div>
                        <div>
                          <h4 className="font-bold text-gray-800 dark:text-white">
                            {item.title || '-'}
                          </h4>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {item.instructors?.name_kr || item.instructors?.name_en || '-'} 강사
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {status === 'PENDING' && (
                          <span className="text-xs text-red-500 dark:text-red-400 font-bold flex items-center gap-1">
                            <AlertCircle size={12} /> 미작성
                          </span>
                        )}
                        {expandedLogId === item.id ? (
                          <ChevronUp size={20} className="text-gray-400 dark:text-gray-500" />
                        ) : (
                          <ChevronDown size={20} className="text-gray-400 dark:text-gray-500" />
                        )}
                      </div>
                    </div>

                    {/* 확장 영역 (일지 상세) */}
                    {expandedLogId === item.id && (
                      <div className="p-4 border-t border-gray-100 dark:border-neutral-800 bg-slate-50 dark:bg-neutral-800/50">
                        {log ? (
                          <>
                            <div className="mb-4">
                              <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-2 uppercase">
                                출석 현황
                              </label>
                              <div className="flex items-center gap-2">
                                <div className="flex-1 h-2 bg-gray-200 dark:bg-neutral-700 rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-green-500 dark:bg-green-400"
                                    style={{
                                      width: `${((log.present_students || 0) / (log.total_students || 1)) * 100}%`,
                                    }}
                                  ></div>
                                </div>
                                <span className="text-sm font-bold text-gray-700 dark:text-gray-300">
                                  {log.present_students || 0} / {log.total_students || 0} 명
                                </span>
                              </div>
                            </div>

                            <div className="mb-4">
                              <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1 uppercase">
                                수업 진도 및 내용
                              </label>
                              <p className="text-sm text-gray-800 dark:text-white bg-white dark:bg-neutral-900 p-3 rounded border border-gray-200 dark:border-neutral-700">
                                {log.content || '내용 없음'}
                              </p>
                            </div>

                            <div className="mb-4">
                              <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1 uppercase text-red-500 dark:text-red-400">
                                특이사항 (학생/시설)
                              </label>
                              <p className="text-sm text-gray-800 dark:text-white bg-white dark:bg-neutral-900 p-3 rounded border border-gray-200 dark:border-neutral-700">
                                {log.notes || '특이사항 없음'}
                              </p>
                            </div>
                          </>
                        ) : (
                          <div className="text-center py-4">
                            <button
                              onClick={() => {
                                setSelectedLog({ classItem: item, log: null });
                                setShowLogModal(true);
                              }}
                              className="bg-blue-600 dark:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors"
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
            <div className="bg-white dark:bg-neutral-900 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-neutral-800 h-fit">
              <textarea
                className="w-full h-40 p-3 text-sm border border-gray-200 dark:border-neutral-700 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 outline-none resize-none mb-3 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                placeholder="오늘 센터 운영 관련 특이사항을 자유롭게 기록하세요. (예: A홀 에어컨 점검 필요, 비품 화장지 구매 완료 등)"
                value={operationNote}
                onChange={(e) => setOperationNote(e.target.value)}
              />
              <button
                onClick={handleSaveNote}
                className="w-full bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 py-2 rounded-lg text-sm font-bold hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors"
              >
                메모 저장
              </button>
            </div>

            {pendingCount > 0 && (
              <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-xl border border-yellow-200 dark:border-yellow-900/30">
                <h4 className="font-bold text-yellow-800 dark:text-yellow-400 text-sm mb-2 flex items-center gap-2">
                  <AlertCircle size={14} /> 알림
                </h4>
                <p className="text-xs text-yellow-700 dark:text-yellow-300">
                  미작성된 수업 일지가 {pendingCount}건 있습니다.
                  <br />
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
