"use client";

import { useState } from 'react';
import { X, Repeat, Zap, Calendar } from 'lucide-react';
import { getSupabaseClient } from '@/lib/utils/supabase-client';
import { generateSessionDates, formatDateToYMD, DAY_NAMES_KR } from '@/lib/utils/schedule-generator';

interface RecurringScheduleModalProps {
  academyId: string;
  classMasters: any[];
  halls: any[];
  onClose: () => void;
}

export function RecurringScheduleModal({ academyId, classMasters, halls, onClose }: RecurringScheduleModalProps) {
  const [type, setType] = useState<'regular' | 'popup'>('regular');
  const [formData, setFormData] = useState({
    class_id: '',
    hall_id: '',
    instructor_id: '',
    start_date: formatDateToYMD(new Date()),
    end_date: formatDateToYMD(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)), // 30일 후
    start_time: '18:00',
    end_time: '19:20',
    days_of_week: [] as number[],
    interval_weeks: 1,
    max_students: 20,
    // 팝업용
    popup_date: formatDateToYMD(new Date()),
  });
  const [loading, setLoading] = useState(false);
  const [previewCount, setPreviewCount] = useState(0);

  // 선택된 클래스의 정보
  const selectedClass = classMasters.find(c => c.id === formData.class_id);

  // 요일 토글
  const toggleDay = (dayIndex: number) => {
    setFormData(prev => ({
      ...prev,
      days_of_week: prev.days_of_week.includes(dayIndex)
        ? prev.days_of_week.filter(d => d !== dayIndex)
        : [...prev.days_of_week, dayIndex].sort(),
    }));
  };

  // 생성될 세션 수 미리보기
  const updatePreview = () => {
    if (type === 'popup') {
      setPreviewCount(1);
      return;
    }
    
    if (formData.days_of_week.length === 0) {
      setPreviewCount(0);
      return;
    }

    const dates = generateSessionDates(
      new Date(formData.start_date),
      new Date(formData.end_date),
      formData.days_of_week,
      formData.interval_weeks
    );
    setPreviewCount(dates.length);
  };

  // formData 변경 시 미리보기 업데이트
  useState(() => {
    updatePreview();
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.class_id) {
      alert('클래스를 선택해주세요.');
      return;
    }

    if (type === 'regular' && formData.days_of_week.length === 0) {
      alert('요일을 선택해주세요.');
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
      if (type === 'popup') {
        // 팝업/특강: 단일 세션 생성
        const startDateTime = new Date(`${formData.popup_date}T${formData.start_time}:00`);
        const endDateTime = new Date(`${formData.popup_date}T${formData.end_time}:00`);

        const { error } = await supabase
          .from('schedules')
          .insert({
            class_id: formData.class_id,
            hall_id: formData.hall_id || null,
            instructor_id: formData.instructor_id || selectedClass?.instructor_id || null,
            start_time: startDateTime.toISOString(),
            end_time: endDateTime.toISOString(),
            max_students: formData.max_students,
            current_students: 0,
            is_canceled: false,
            recurring_schedule_id: null,
          });

        if (error) throw error;
        alert('스케줄이 생성되었습니다!');
      } else {
        // 정규 반복: recurring_schedules 생성 후 세션들 생성
        // 1. 반복 규칙 저장
        const { data: recurringSchedule, error: recurringError } = await supabase
          .from('recurring_schedules')
          .insert({
            academy_id: academyId,
            class_id: formData.class_id,
            hall_id: formData.hall_id || null,
            instructor_id: formData.instructor_id || selectedClass?.instructor_id || null,
            start_date: formData.start_date,
            end_date: formData.end_date,
            start_time: formData.start_time,
            end_time: formData.end_time,
            days_of_week: formData.days_of_week,
            interval_weeks: formData.interval_weeks,
            max_students: formData.max_students,
            is_active: true,
          })
          .select()
          .single();

        if (recurringError) throw recurringError;

        // 2. 날짜 생성
        const dates = generateSessionDates(
          new Date(formData.start_date),
          new Date(formData.end_date),
          formData.days_of_week,
          formData.interval_weeks
        );

        if (dates.length === 0) {
          alert('생성될 스케줄이 없습니다. 날짜 범위와 요일을 확인해주세요.');
          setLoading(false);
          return;
        }

        // 3. 세션들 일괄 생성
        const sessions = dates.map(date => {
          const startDateTime = new Date(date);
          const [startHour, startMin] = formData.start_time.split(':').map(Number);
          startDateTime.setHours(startHour, startMin, 0, 0);

          const endDateTime = new Date(date);
          const [endHour, endMin] = formData.end_time.split(':').map(Number);
          endDateTime.setHours(endHour, endMin, 0, 0);

          return {
            class_id: formData.class_id,
            hall_id: formData.hall_id || null,
            instructor_id: formData.instructor_id || selectedClass?.instructor_id || null,
            start_time: startDateTime.toISOString(),
            end_time: endDateTime.toISOString(),
            max_students: formData.max_students,
            current_students: 0,
            is_canceled: false,
            recurring_schedule_id: recurringSchedule.id,
          };
        });

        const { error: sessionsError } = await supabase
          .from('schedules')
          .insert(sessions);

        if (sessionsError) throw sessionsError;

        alert(`스케줄 ${dates.length}건이 생성되었습니다!`);
      }

      onClose();
    } catch (error: any) {
      console.error('Error creating schedule:', error);
      alert(`스케줄 생성에 실패했습니다: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 dark:bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl max-w-xl w-full overflow-hidden max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b dark:border-neutral-800 flex justify-between items-center sticky top-0 bg-white dark:bg-neutral-900 z-10">
          <h3 className="text-xl font-bold text-gray-800 dark:text-white">
            스케줄 생성
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* 유형 선택 */}
          <div className="grid grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => setType('regular')}
              className={`p-4 rounded-lg border flex flex-col items-center gap-2 transition-colors ${
                type === 'regular'
                  ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-500 text-indigo-700 dark:text-indigo-400'
                  : 'bg-gray-50 dark:bg-neutral-800 border-gray-200 dark:border-neutral-700'
              }`}
            >
              <Repeat className="w-6 h-6" />
              <span className="font-semibold">정규 반복 수업</span>
            </button>
            <button
              type="button"
              onClick={() => setType('popup')}
              className={`p-4 rounded-lg border flex flex-col items-center gap-2 transition-colors ${
                type === 'popup'
                  ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-500 text-amber-700 dark:text-amber-400'
                  : 'bg-gray-50 dark:bg-neutral-800 border-gray-200 dark:border-neutral-700'
              }`}
            >
              <Zap className="w-6 h-6" />
              <span className="font-semibold">팝업/특강</span>
            </button>
          </div>

          {/* 클래스 선택 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              클래스 선택 *
            </label>
            <select
              required
              className="w-full border dark:border-neutral-700 rounded-lg px-3 py-2 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
              value={formData.class_id}
              onChange={(e) => {
                const cls = classMasters.find(c => c.id === e.target.value);
                setFormData({
                  ...formData,
                  class_id: e.target.value,
                  instructor_id: cls?.instructor_id || '',
                });
              }}
            >
              <option value="">클래스를 선택하세요</option>
              {classMasters.map((cls) => (
                <option key={cls.id} value={cls.id}>
                  {cls.title} ({cls.instructors?.name_kr || cls.instructors?.name_en || '강사 미지정'})
                </option>
              ))}
            </select>
          </div>

          {/* 홀 선택 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              홀
            </label>
            <select
              className="w-full border dark:border-neutral-700 rounded-lg px-3 py-2 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
              value={formData.hall_id}
              onChange={(e) => setFormData({ ...formData, hall_id: e.target.value })}
            >
              <option value="">선택 안함</option>
              {halls.map((hall) => (
                <option key={hall.id} value={hall.id}>{hall.name}</option>
              ))}
            </select>
          </div>

          {type === 'regular' ? (
            <>
              {/* 반복 설정 */}
              <div className="bg-indigo-50/50 dark:bg-indigo-900/10 p-4 rounded-lg border border-indigo-100 dark:border-indigo-900/30 space-y-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  반복 설정
                </label>
                
                {/* 주기 */}
                <div className="flex items-center gap-2">
                  <span className="text-sm">매</span>
                  <select
                    className="border dark:border-neutral-700 rounded px-2 py-1 text-sm bg-white dark:bg-neutral-900"
                    value={formData.interval_weeks}
                    onChange={(e) => setFormData({ ...formData, interval_weeks: Number(e.target.value) })}
                  >
                    {[1, 2, 3, 4].map(n => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                  <span className="text-sm">주 간격 반복</span>
                </div>

                {/* 요일 선택 */}
                <div className="flex gap-2">
                  {DAY_NAMES_KR.map((day, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => toggleDay(index)}
                      className={`w-9 h-9 rounded-full text-xs font-bold transition-colors ${
                        formData.days_of_week.includes(index)
                          ? 'bg-indigo-600 text-white'
                          : 'bg-white dark:bg-neutral-800 border border-gray-300 dark:border-neutral-600 text-gray-400'
                      }`}
                    >
                      {day}
                    </button>
                  ))}
                </div>

                {/* 기간 */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">시작일</label>
                    <input
                      type="date"
                      required
                      className="w-full border dark:border-neutral-700 rounded px-2 py-1 text-sm bg-white dark:bg-neutral-900"
                      value={formData.start_date}
                      onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">종료일</label>
                    <input
                      type="date"
                      required
                      className="w-full border dark:border-neutral-700 rounded px-2 py-1 text-sm bg-white dark:bg-neutral-900"
                      value={formData.end_date}
                      onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            </>
          ) : (
            /* 팝업: 단일 날짜 */
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                날짜 *
              </label>
              <input
                type="date"
                required
                className="w-full border dark:border-neutral-700 rounded-lg px-3 py-2 bg-white dark:bg-neutral-900"
                value={formData.popup_date}
                onChange={(e) => setFormData({ ...formData, popup_date: e.target.value })}
              />
            </div>
          )}

          {/* 시간 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                시작 시간 *
              </label>
              <input
                type="time"
                required
                className="w-full border dark:border-neutral-700 rounded-lg px-3 py-2 bg-white dark:bg-neutral-900"
                value={formData.start_time}
                onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                종료 시간 *
              </label>
              <input
                type="time"
                required
                className="w-full border dark:border-neutral-700 rounded-lg px-3 py-2 bg-white dark:bg-neutral-900"
                value={formData.end_time}
                onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
              />
            </div>
          </div>

          {/* 최대 인원 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              최대 인원
            </label>
            <input
              type="number"
              min="1"
              className="w-full border dark:border-neutral-700 rounded-lg px-3 py-2 bg-white dark:bg-neutral-900"
              value={formData.max_students}
              onChange={(e) => setFormData({ ...formData, max_students: parseInt(e.target.value) || 20 })}
            />
          </div>

          {/* 미리보기 */}
          {type === 'regular' && formData.days_of_week.length > 0 && (
            <div className="bg-gray-50 dark:bg-neutral-800 p-3 rounded-lg text-sm text-gray-600 dark:text-gray-400">
              <Calendar className="inline w-4 h-4 mr-1" />
              생성될 스케줄: 약 <strong>{
                generateSessionDates(
                  new Date(formData.start_date),
                  new Date(formData.end_date),
                  formData.days_of_week,
                  formData.interval_weeks
                ).length
              }건</strong>
            </div>
          )}

          {/* 버튼 */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 border dark:border-neutral-700 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-3 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-lg font-bold hover:bg-slate-800 dark:hover:bg-slate-200 transition-colors disabled:opacity-50"
            >
              {loading ? '생성 중...' : '스케줄 생성하기'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
