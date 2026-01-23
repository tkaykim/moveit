"use client";

import { useState, useEffect, useRef } from 'react';
import { ChevronDown, Search, X } from 'lucide-react';
import { getSupabaseClient } from '@/lib/utils/supabase-client';
import { convertKSTInputToUTC } from '@/lib/utils/kst-time';

interface Schedule {
  id: string;
  start_time: string;
  end_time: string;
  classes: {
    id: string;
    title: string;
    academies: {
      id: string;
      name_kr?: string | null;
      name_en?: string | null;
    } | null;
  } | null;
  instructors: {
    id: string;
    name_kr?: string | null;
    name_en?: string | null;
  } | null;
  halls: {
    id: string;
    name: string;
  } | null;
}

interface ScheduleSelectorProps {
  value?: string;
  onChange: (scheduleId: string | null) => void;
  className?: string;
  academyId?: string; // 특정 학원의 스케줄만 필터링
  dateFilter?: string; // 날짜 필터 (YYYY-MM-DD 형식)
}

export function ScheduleSelector({ value, onChange, className = '', academyId, dateFilter }: ScheduleSelectorProps) {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [filteredSchedules, setFilteredSchedules] = useState<Schedule[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadSchedules();
  }, [academyId, dateFilter]);

  useEffect(() => {
    if (searchTerm) {
      const filtered = schedules.filter(schedule => {
        const classTitle = schedule.classes?.title?.toLowerCase() || '';
        const instructorKr = schedule.instructors?.name_kr?.toLowerCase() || '';
        const instructorEn = schedule.instructors?.name_en?.toLowerCase() || '';
        const academyKr = schedule.classes?.academies?.name_kr?.toLowerCase() || '';
        const academyEn = schedule.classes?.academies?.name_en?.toLowerCase() || '';
        const search = searchTerm.toLowerCase();
        
        return (
          classTitle.includes(search) ||
          instructorKr.includes(search) ||
          instructorEn.includes(search) ||
          academyKr.includes(search) ||
          academyEn.includes(search)
        );
      });
      setFilteredSchedules(filtered);
    } else {
      setFilteredSchedules(schedules);
    }
  }, [searchTerm, schedules]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadSchedules = async () => {
    const supabase = getSupabaseClient() as any;
    if (!supabase) {
      setLoading(false);
      return;
    }

    try {
      // academyId가 있으면 먼저 해당 학원의 class_id 목록을 가져옴
      let classIds: string[] = [];
      if (academyId) {
        const { data: classesData } = await supabase
          .from('classes')
          .select('id')
          .eq('academy_id', academyId);

        classIds = classesData?.map((c: any) => c.id) || [];

        // 해당 학원에 클래스가 없으면 빈 배열 반환
        if (classIds.length === 0) {
          setSchedules([]);
          setFilteredSchedules([]);
          setLoading(false);
          return;
        }
      }

      let query = supabase
        .from('schedules')
        .select(`
          id,
          start_time,
          end_time,
          class_id,
          classes (
            id,
            title,
            academies (
              id,
              name_kr,
              name_en
            )
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
        .eq('is_canceled', false);

      // academyId가 있으면 해당 학원의 클래스 ID로 필터링
      if (academyId && classIds.length > 0) {
        query = query.in('class_id', classIds);
      }

      // dateFilter가 있으면 해당 날짜의 스케줄만 필터링 (KST 기준)
      if (dateFilter) {
        // KST 기준으로 해당 날짜의 00:00:00 ~ 23:59:59를 UTC로 변환
        const startKST = `${dateFilter}T00:00`;
        const endKST = `${dateFilter}T23:59`;

        const startUTC = convertKSTInputToUTC(startKST);
        const endUTC = convertKSTInputToUTC(endKST);

        if (startUTC && endUTC) {
          // endUTC에 59초를 더해 23:59:59로 만듦
          const endUTCWithSeconds = new Date(endUTC);
          endUTCWithSeconds.setSeconds(59, 999);

          query = query.gte('start_time', startUTC).lte('start_time', endUTCWithSeconds.toISOString());
        }
      }

      const { data, error } = await query
        .order('start_time', { ascending: false })
        .limit(500);

      if (error) throw error;
      setSchedules(data || []);
      setFilteredSchedules(data || []);
    } catch (error) {
      console.error('Error loading schedules:', error);
    } finally {
      setLoading(false);
    }
  };

  const selectedSchedule = schedules.find(s => s.id === value);

  const formatScheduleLabel = (schedule: Schedule) => {
    const classTitle = schedule.classes?.title || '클래스 없음';
    const instructor = schedule.instructors
      ? schedule.instructors.name_kr || schedule.instructors.name_en || ''
      : '';
    const date = new Date(schedule.start_time);
    const dateStr = date.toLocaleDateString('ko-KR', {
      month: 'short',
      day: 'numeric',
    });
    const timeStr = date.toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
    });

    return `${classTitle}${instructor ? ` - ${instructor}` : ''} (${dateStr} ${timeStr})`;
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-2 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg text-left flex items-center justify-between hover:border-primary dark:hover:border-[#CCFF00] transition-colors"
      >
        <span className="text-sm text-neutral-700 dark:text-neutral-300 truncate">
          {selectedSchedule ? formatScheduleLabel(selectedSchedule) : '수업 선택'}
        </span>
        <ChevronDown
          size={16}
          className={`text-neutral-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg shadow-lg max-h-96 overflow-hidden">
          <div className="p-2 border-b border-neutral-200 dark:border-neutral-700">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
              <input
                type="text"
                placeholder="수업명, 강사명으로 검색..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-8 py-2 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded text-sm text-neutral-700 dark:text-neutral-300 focus:outline-none focus:ring-2 focus:ring-primary dark:focus:ring-[#CCFF00]"
                autoFocus
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          <div className="overflow-y-auto max-h-80">
            {loading ? (
              <div className="p-4 text-center text-sm text-neutral-500">로딩 중...</div>
            ) : (
              <>
                <button
                  onClick={() => {
                    onChange(null);
                    setIsOpen(false);
                    setSearchTerm('');
                  }}
                  className={`w-full px-4 py-2 text-left text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors ${
                    !value ? 'bg-primary/10 dark:bg-[#CCFF00]/10 font-medium' : 'text-neutral-700 dark:text-neutral-300'
                  }`}
                >
                  전체
                </button>
                {filteredSchedules.length === 0 ? (
                  <div className="p-4 text-center text-sm text-neutral-500">검색 결과가 없습니다.</div>
                ) : (
                  filteredSchedules.map((schedule) => (
                    <button
                      key={schedule.id}
                      onClick={() => {
                        onChange(schedule.id);
                        setIsOpen(false);
                        setSearchTerm('');
                      }}
                      className={`w-full px-4 py-2 text-left text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors ${
                        value === schedule.id
                          ? 'bg-primary/10 dark:bg-[#CCFF00]/10 font-medium'
                          : 'text-neutral-700 dark:text-neutral-300'
                      }`}
                    >
                      {formatScheduleLabel(schedule)}
                    </button>
                  ))
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
