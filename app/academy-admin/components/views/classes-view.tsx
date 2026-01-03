"use client";

import { useState, useEffect } from 'react';
import { Users, Plus } from 'lucide-react';
import { SectionHeader } from '../common/section-header';
import { ClassModal } from './classes/class-modal';
import { getSupabaseClient } from '@/lib/utils/supabase-client';

interface ClassesViewProps {
  academyId: string;
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function ClassesView({ academyId }: ClassesViewProps) {
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showClassModal, setShowClassModal] = useState(false);
  const [selectedClass, setSelectedClass] = useState<any>(null);
  const [selectedDate, setSelectedDate] = useState(new Date());

  useEffect(() => {
    loadClasses();
  }, [academyId, selectedDate]);

  const loadClasses = async () => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      setLoading(false);
      return;
    }

    try {
      // 이번 주의 시작일과 종료일 계산
      const startOfWeek = new Date(selectedDate);
      startOfWeek.setDate(selectedDate.getDate() - selectedDate.getDay() + 1); // 월요일
      startOfWeek.setHours(0, 0, 0, 0);

      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6); // 일요일
      endOfWeek.setHours(23, 59, 59, 999);

      const { data, error } = await supabase
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
        .gte('start_time', startOfWeek.toISOString())
        .lte('start_time', endOfWeek.toISOString())
        .order('start_time', { ascending: true });

      if (error) throw error;
      setClasses(data || []);
    } catch (error) {
      console.error('Error loading classes:', error);
    } finally {
      setLoading(false);
    }
  };

  const getClassesForDay = (dayIndex: number) => {
    const startOfWeek = new Date(selectedDate);
    startOfWeek.setDate(selectedDate.getDate() - selectedDate.getDay() + 1);
    startOfWeek.setDate(startOfWeek.getDate() + dayIndex);
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfDay = new Date(startOfWeek);
    endOfDay.setHours(23, 59, 59, 999);

    return classes.filter((classItem) => {
      const classDate = new Date(classItem.start_time);
      return classDate >= startOfWeek && classDate <= endOfDay;
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
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
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-gray-800 dark:text-white">클래스 / 시간표 관리</h2>
          <div className="flex gap-2">
            <button
              onClick={() => {
                setSelectedClass(null);
                setShowClassModal(true);
              }}
              className="bg-gray-900 dark:bg-gray-100 hover:bg-gray-800 dark:hover:bg-gray-200 text-white dark:text-gray-900 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors shadow-sm"
            >
              <Plus size={16} /> 클래스 추가
            </button>
          </div>
        </div>

        <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-sm border border-gray-100 dark:border-neutral-800 p-6 overflow-x-auto">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-4">
              <button
                onClick={() => {
                  const prevWeek = new Date(selectedDate);
                  prevWeek.setDate(prevWeek.getDate() - 7);
                  setSelectedDate(prevWeek);
                }}
                className="p-2 hover:bg-gray-100 dark:hover:bg-neutral-800 rounded-full transition-colors"
              >
                ←
              </button>
              <div className="text-center">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                  {selectedDate.toLocaleDateString('ko-KR', { month: 'long', year: 'numeric' })}
                </h3>
              </div>
              <button
                onClick={() => {
                  const nextWeek = new Date(selectedDate);
                  nextWeek.setDate(nextWeek.getDate() + 7);
                  setSelectedDate(nextWeek);
                }}
                className="p-2 hover:bg-gray-100 dark:hover:bg-neutral-800 rounded-full transition-colors"
              >
                →
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-4 min-w-[800px]">
            {DAYS.map((day, dayIndex) => {
              const dayClasses = getClassesForDay(dayIndex);
              return (
                <div key={day} className="text-center">
                  <div className="font-bold text-gray-800 dark:text-white mb-4 py-2 bg-gray-100 dark:bg-neutral-800 rounded-lg">
                    {day}
                  </div>
                  <div className="space-y-3 min-h-[300px]">
                    {dayClasses.map((classItem) => (
                      <div
                        key={classItem.id}
                        className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-100 dark:border-blue-900/30 text-left hover:shadow-md transition-shadow cursor-pointer relative overflow-hidden group"
                        onClick={() => {
                          setSelectedClass(classItem);
                          setShowClassModal(true);
                        }}
                      >
                        <div className="absolute top-0 left-0 w-1 h-full bg-blue-500 dark:bg-blue-400"></div>
                        <p className="text-xs font-bold text-blue-700 dark:text-blue-400 mb-1">
                          {formatTime(classItem.start_time)}
                        </p>
                        <p className="font-bold text-gray-800 dark:text-white text-sm truncate">
                          {classItem.title || '-'}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {classItem.instructors?.name_kr || classItem.instructors?.name_en || '-'} 강사 |{' '}
                          {classItem.halls?.name || '-'}
                        </p>
                        <div className="mt-2 flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400 bg-white dark:bg-neutral-800 px-2 py-1 rounded w-fit">
                          <Users size={12} /> {classItem.current_students || 0}명
                        </div>
                      </div>
                    ))}
                    {dayClasses.length === 0 && (
                      <div className="h-full flex items-center justify-center text-gray-300 dark:text-gray-600 text-xs border-dashed border-2 dark:border-neutral-700 rounded-lg">
                        수업 없음
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {showClassModal && (
        <ClassModal
          academyId={academyId}
          classData={selectedClass}
          onClose={() => {
            setShowClassModal(false);
            setSelectedClass(null);
            loadClasses();
          }}
        />
      )}
    </>
  );
}
