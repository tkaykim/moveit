"use client";

import { useState, useEffect } from 'react';
import { Clock, Play, CheckCircle2, Calendar } from 'lucide-react';
import { getSupabaseClient } from '@/lib/utils/supabase-client';
import { DailyLogModal } from './logs/daily-log-modal';

interface TodayClassesSectionProps {
  academyId: string;
}

interface ClassWithDetails {
  id: string;
  title: string | null;
  start_time: string | null;
  end_time: string | null;
  academy_id: string;
  instructor_id: string | null;
  hall_id: string | null;
  current_students: number | null;
  max_students: number | null;
  is_canceled: boolean;
  instructors: {
    id: string;
    name_kr: string | null;
    name_en: string | null;
  } | null;
  halls: {
    id: string;
    name: string;
  } | null;
}

type ClassStatus = 'past' | 'ongoing' | 'upcoming';

interface ClassifiedClass {
  class: ClassWithDetails;
  status: ClassStatus;
}

export function TodayClassesSection({ academyId }: TodayClassesSectionProps) {
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  const [classes, setClasses] = useState<ClassifiedClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [showLogModal, setShowLogModal] = useState(false);
  const [selectedClass, setSelectedClass] = useState<ClassWithDetails | null>(null);
  const [selectedLog, setSelectedLog] = useState<any>(null);

  // KST 시간 업데이트 (1초마다)
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // 오늘 수업 목록 로드
  useEffect(() => {
    loadTodaySchedules();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [academyId]);

  // 일지 데이터 로드
  const loadLogForClass = async (classId: string) => {
    const supabase = getSupabaseClient();
    if (!supabase) return null;

    try {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('daily_logs')
        .select('*')
        .eq('academy_id', academyId)
        .eq('class_id', classId)
        .eq('log_date', today)
        .single();

      if (error && error.code !== 'PGRST116') throw error; // PGRST116은 데이터 없음
      return data || null;
    } catch (error) {
      console.error('Error loading log:', error);
      return null;
    }
  };

  // 현재 시간이 변경될 때마다 수업 상태 재분류
  useEffect(() => {
    if (classes.length > 0) {
      setClasses((prev) => {
        return prev.map((item) => {
          const status = classifyClassStatus(item.class, currentTime);
          return { ...item, status };
        });
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTime]);

  const loadTodaySchedules = async () => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      setLoading(false);
      return;
    }

    try {
      // KST 기준 오늘 날짜 계산
      const now = new Date();
      // KST 시간대의 오늘 날짜 구하기
      const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Seoul',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
      const kstDateString = formatter.format(now); // YYYY-MM-DD 형식
      const kstDate = new Date(`${kstDateString}T00:00:00+09:00`);
      
      const startOfDay = new Date(kstDate);
      const endOfDay = new Date(kstDate);
      endOfDay.setHours(23, 59, 59, 999);

      // 오늘 날짜의 classes 가져오기 (KST 기준)
      // PostgreSQL에서 KST 날짜로 필터링하기 위해 raw SQL 사용
      const { data: todayClasses, error } = await (supabase as any)
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
        .not('start_time', 'is', null)
        .gte('start_time', startOfDay.toISOString())
        .lte('start_time', endOfDay.toISOString())
        .order('start_time', { ascending: true });

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }

      // KST 기준으로 오늘 날짜 필터링 (클라이언트 측에서 정확히 확인)
      const todayKSTString = formatter.format(now); // YYYY-MM-DD 형식
      
      const filteredClasses = (todayClasses || []).filter((cls: ClassWithDetails) => {
        if (!cls.start_time) return false;
        // start_time을 KST로 변환하여 날짜 문자열 추출
        const classStartDate = new Date(cls.start_time);
        const classStartKSTString = formatter.format(classStartDate);
        return classStartKSTString === todayKSTString;
      });

      // 수업 상태 분류
      const classified = filteredClasses.map((cls: ClassWithDetails) => ({
        class: cls,
        status: classifyClassStatus(cls, currentTime),
      }));

      setClasses(classified);
    } catch (error) {
      console.error('Error loading today schedules:', error);
    } finally {
      setLoading(false);
    }
  };

  const classifyClassStatus = (
    cls: ClassWithDetails,
    now: Date
  ): ClassStatus => {
    if (!cls.start_time || !cls.end_time) return 'upcoming';
    
    const startTime = new Date(cls.start_time);
    const endTime = new Date(cls.end_time);

    if (endTime < now) return 'past';
    if (startTime <= now && now < endTime) return 'ongoing';
    return 'upcoming';
  };

  const formatTime = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('ko-KR', {
      timeZone: 'Asia/Seoul',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  };

  const formatCurrentTime = (): string => {
    return currentTime.toLocaleString('ko-KR', {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  };

  // 홀별로 수업 그룹화
  const classesByHall = classes.reduce((acc, item) => {
    const hallId = item.class.hall_id || 'no-hall';
    const hallName = item.class.halls?.name || '홀 미지정';
    
    if (!acc[hallId]) {
      acc[hallId] = {
        hallId,
        hallName,
        past: [],
        ongoing: [],
        upcoming: [],
      };
    }
    
    acc[hallId][item.status].push(item.class);
    return acc;
  }, {} as Record<string, {
    hallId: string;
    hallName: string;
    past: ClassWithDetails[];
    ongoing: ClassWithDetails[];
    upcoming: ClassWithDetails[];
  }>);

  const halls = Object.values(classesByHall);

  if (loading) {
    return (
      <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-sm border border-gray-100 dark:border-neutral-800 p-6">
        <div className="text-center text-gray-500 dark:text-gray-400">로딩 중...</div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-neutral-900 rounded-lg sm:rounded-xl shadow-sm border border-gray-100 dark:border-neutral-800 p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 sm:mb-6 gap-3">
        <div>
          <h3 className="font-bold text-base sm:text-lg text-gray-800 dark:text-white mb-1">
            오늘의 수업 일정
          </h3>
          <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-600 dark:text-gray-400">
            <Clock size={14} />
            <span className="font-mono">{formatCurrentTime()} (KST)</span>
          </div>
        </div>
        <div className="text-left sm:text-right">
          <div className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
            {classes.length}건
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">오늘 예정</div>
        </div>
      </div>

      {classes.length === 0 ? (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400 text-sm">
          오늘 예정된 수업이 없습니다.
        </div>
      ) : (
        <>
          {/* 모바일: 가로 배치 테이블 형태 */}
          <div className="block sm:hidden overflow-x-auto">
            <table className="w-full border-collapse min-w-[500px]">
              <thead>
                <tr className="border-b-2 border-gray-200 dark:border-neutral-700">
                  <th className="text-left py-2 px-2 font-semibold text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-neutral-800 text-xs">
                    홀
                  </th>
                  <th className="text-center py-2 px-2 font-semibold text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-neutral-800 opacity-60 text-xs">
                    지난 수업
                  </th>
                  <th className="text-center py-2 px-2 font-semibold text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 text-xs">
                    진행 중
                  </th>
                  <th className="text-center py-2 px-2 font-semibold text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 text-xs">
                    예정 수업
                  </th>
                </tr>
              </thead>
              <tbody>
                {halls.map((hall) => (
                  <tr key={hall.hallId} className="border-b border-gray-100 dark:border-neutral-800">
                    <td className="py-3 px-2 font-semibold text-gray-900 dark:text-white align-top text-xs">
                      {hall.hallName}
                    </td>
                    <td className="py-3 px-2 align-top opacity-60">
                      <div className="space-y-1.5">
                        {hall.past.length === 0 ? (
                          <div className="text-gray-400 dark:text-gray-500 text-xs">-</div>
                        ) : (
                          hall.past.map((cls) => (
                            <ClassCell 
                              key={cls.id} 
                              class={cls} 
                              status="past"
                              onClick={async () => {
                                setSelectedClass(cls);
                                const log = await loadLogForClass(cls.id);
                                setSelectedLog(log);
                                setShowLogModal(true);
                              }}
                            />
                          ))
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-2 align-top bg-green-50/30 dark:bg-green-900/10">
                      <div className="space-y-1.5">
                        {hall.ongoing.length === 0 ? (
                          <div className="text-gray-400 dark:text-gray-500 text-xs">-</div>
                        ) : (
                          hall.ongoing.map((cls) => (
                            <ClassCell 
                              key={cls.id} 
                              class={cls} 
                              status="ongoing"
                              onClick={async () => {
                                setSelectedClass(cls);
                                const log = await loadLogForClass(cls.id);
                                setSelectedLog(log);
                                setShowLogModal(true);
                              }}
                            />
                          ))
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-2 align-top bg-blue-50/30 dark:bg-blue-900/10">
                      <div className="space-y-1.5">
                        {hall.upcoming.length === 0 ? (
                          <div className="text-gray-400 dark:text-gray-500 text-xs">-</div>
                        ) : (
                          hall.upcoming.map((cls) => (
                            <ClassCell 
                              key={cls.id} 
                              class={cls} 
                              status="upcoming"
                              onClick={async () => {
                                setSelectedClass(cls);
                                const log = await loadLogForClass(cls.id);
                                setSelectedLog(log);
                                setShowLogModal(true);
                              }}
                            />
                          ))
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 데스크톱: 테이블 형태 */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b-2 border-gray-200 dark:border-neutral-700">
                  <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-neutral-800">
                    홀
                  </th>
                  <th className="text-center py-3 px-4 font-semibold text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-neutral-800 opacity-60">
                    지난 수업
                  </th>
                  <th className="text-center py-3 px-4 font-semibold text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20">
                    진행 중인 수업
                  </th>
                  <th className="text-center py-3 px-4 font-semibold text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20">
                    예정 수업
                  </th>
                </tr>
              </thead>
              <tbody>
                {halls.map((hall) => (
                  <tr key={hall.hallId} className="border-b border-gray-100 dark:border-neutral-800 hover:bg-gray-50 dark:hover:bg-neutral-800/50">
                    <td className="py-4 px-4 font-semibold text-gray-900 dark:text-white align-top">
                      {hall.hallName}
                    </td>
                    <td className="py-4 px-4 align-top opacity-60">
                      <div className="space-y-2">
                        {hall.past.length === 0 ? (
                          <div className="text-gray-400 dark:text-gray-500 text-sm">-</div>
                        ) : (
                          hall.past.map((cls) => (
                            <ClassCell 
                              key={cls.id} 
                              class={cls} 
                              status="past"
                              onClick={async () => {
                                setSelectedClass(cls);
                                const log = await loadLogForClass(cls.id);
                                setSelectedLog(log);
                                setShowLogModal(true);
                              }}
                            />
                          ))
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-4 align-top bg-green-50/30 dark:bg-green-900/10">
                      <div className="space-y-2">
                        {hall.ongoing.length === 0 ? (
                          <div className="text-gray-400 dark:text-gray-500 text-sm">-</div>
                        ) : (
                          hall.ongoing.map((cls) => (
                            <ClassCell 
                              key={cls.id} 
                              class={cls} 
                              status="ongoing"
                              onClick={async () => {
                                setSelectedClass(cls);
                                const log = await loadLogForClass(cls.id);
                                setSelectedLog(log);
                                setShowLogModal(true);
                              }}
                            />
                          ))
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-4 align-top bg-blue-50/30 dark:bg-blue-900/10">
                      <div className="space-y-2">
                        {hall.upcoming.length === 0 ? (
                          <div className="text-gray-400 dark:text-gray-500 text-sm">-</div>
                        ) : (
                          hall.upcoming.map((cls) => (
                            <ClassCell 
                              key={cls.id} 
                              class={cls} 
                              status="upcoming"
                              onClick={async () => {
                                setSelectedClass(cls);
                                const log = await loadLogForClass(cls.id);
                                setSelectedLog(log);
                                setShowLogModal(true);
                              }}
                            />
                          ))
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {showLogModal && selectedClass && (
        <DailyLogModal
          academyId={academyId}
          classItem={selectedClass}
          log={selectedLog}
          onClose={() => {
            setShowLogModal(false);
            setSelectedClass(null);
            setSelectedLog(null);
            loadTodaySchedules();
          }}
        />
      )}
    </div>
  );
}

interface ClassCellProps {
  class: ClassWithDetails;
  status: ClassStatus;
  onClick?: () => void;
}

function ClassCell({ class: cls, status, onClick }: ClassCellProps) {
  const instructorName = cls.instructors?.name_kr || cls.instructors?.name_en || null;
  const formatTime = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('ko-KR', {
      timeZone: 'Asia/Seoul',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  };

  return (
    <div 
      className={`p-1.5 sm:p-3 rounded border cursor-pointer transition-all hover:shadow-md ${
        status === 'past' 
          ? 'border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-800/50 opacity-75 hover:opacity-100' 
          : status === 'ongoing'
          ? 'border-green-300 dark:border-green-800 bg-green-100 dark:bg-green-900/20 hover:bg-green-200 dark:hover:bg-green-900/30'
          : 'border-blue-300 dark:border-blue-800 bg-blue-100 dark:bg-blue-900/20 hover:bg-blue-200 dark:hover:bg-blue-900/30'
      }`}
      onClick={onClick}
    >
      <div className="font-semibold text-[10px] sm:text-sm text-gray-900 dark:text-white mb-0.5 sm:mb-1 line-clamp-1">
        {cls.title || '수업명 없음'}
      </div>
      {cls.start_time && (
        <div className="text-[9px] sm:text-xs text-gray-600 dark:text-gray-400 mb-0.5 sm:mb-1 font-medium">
          {formatTime(cls.start_time)}
          {cls.end_time && ` - ${formatTime(cls.end_time)}`}
        </div>
      )}
      <div className="hidden sm:block text-xs text-gray-600 dark:text-gray-400 space-y-0.5">
        {instructorName && (
          <div>강사: {instructorName}</div>
        )}
        {cls.max_students !== null && (
          <div>인원: {cls.current_students || 0} / {cls.max_students}명</div>
        )}
      </div>
    </div>
  );
}

