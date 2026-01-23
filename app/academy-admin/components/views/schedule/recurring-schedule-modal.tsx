"use client";

import { useState, useEffect } from 'react';
import { X, Repeat, Zap, Calendar, Tag, Users } from 'lucide-react';
import { getSupabaseClient } from '@/lib/utils/supabase-client';
import { generateSessionDates, formatDateToYMD, DAY_NAMES_KR } from '@/lib/utils/schedule-generator';

interface RecurringScheduleModalProps {
  academyId: string;
  classMasters: any[];
  halls: any[];
  initialDate?: Date;
  onClose: () => void;
}

interface Instructor {
  id: string;
  name_kr: string | null;
  name_en: string | null;
}

export function RecurringScheduleModal({ academyId, classMasters, halls, initialDate, onClose }: RecurringScheduleModalProps) {
  const [type, setType] = useState<'regular' | 'popup'>('regular');
  
  // 초기 날짜 설정
  const defaultDate = initialDate || new Date();
  const defaultDateStr = formatDateToYMD(defaultDate);
  const defaultEndDate = formatDateToYMD(new Date(defaultDate.getTime() + 30 * 24 * 60 * 60 * 1000));
  
  // 정규 수업용 폼 데이터
  const [formData, setFormData] = useState({
    class_id: '',
    hall_id: '',
    instructor_id: '',
    start_date: defaultDateStr,
    end_date: defaultEndDate,
    start_time: '18:00',
    end_time: '19:20',
    days_of_week: [] as number[],
    interval_weeks: 1,
    max_students: 20,
  });

  // 팝업/워크샵용 폼 데이터
  const [popupData, setPopupData] = useState({
    title: '',
    price: 30000,
    instructor_id: '',
    hall_id: '',
    popup_date: defaultDateStr,
    start_time: '14:00',
    end_time: '16:00',
    max_students: 30,
    // 정규 수강생 할인
    discount_enabled: false,
    discount_class_ids: [] as string[],
    discount_amount: 10000,
  });

  const [loading, setLoading] = useState(false);
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [loadingInstructors, setLoadingInstructors] = useState(true);

  // 강사 목록 로드
  useEffect(() => {
    loadInstructors();
  }, [academyId]);

  const loadInstructors = async () => {
    setLoadingInstructors(true);
    const supabase = getSupabaseClient();
    if (!supabase) {
      setLoadingInstructors(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('instructors')
        .select('id, name_kr, name_en')
        .eq('academy_id', academyId)
        .order('name_kr');

      if (error) throw error;
      setInstructors(data || []);
    } catch (error) {
      console.error('Error loading instructors:', error);
    } finally {
      setLoadingInstructors(false);
    }
  };

  // 선택된 클래스의 정보
  const selectedClass = classMasters.find(c => c.id === formData.class_id);

  // 정규 클래스만 필터링 (정규 수업 선택용)
  const regularClasses = classMasters.filter(c => {
    const type = c.class_type || 'regular';
    return type === 'regular' || type === 'REGULAR';
  });
  
  // 정규 클래스 + 워크샵 필터링 (팝업 할인 대상용)
  const regularAndWorkshopClasses = classMasters.filter(c => {
    const type = c.class_type || 'regular';
    return type === 'regular' || type === 'REGULAR' || type === 'workshop';
  });

  // 요일 토글
  const toggleDay = (dayIndex: number) => {
    setFormData(prev => ({
      ...prev,
      days_of_week: prev.days_of_week.includes(dayIndex)
        ? prev.days_of_week.filter(d => d !== dayIndex)
        : [...prev.days_of_week, dayIndex].sort(),
    }));
  };

  // 할인 대상 클래스 토글
  const toggleDiscountClass = (classId: string) => {
    setPopupData(prev => ({
      ...prev,
      discount_class_ids: prev.discount_class_ids.includes(classId)
        ? prev.discount_class_ids.filter(id => id !== classId)
        : [...prev.discount_class_ids, classId],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setLoading(true);
    const supabase = getSupabaseClient();
    if (!supabase) {
      alert('데이터베이스 연결에 실패했습니다.');
      setLoading(false);
      return;
    }

    try {
      if (type === 'popup') {
        // 팝업/워크샵 생성
        if (!popupData.title.trim()) {
          alert('수업 제목을 입력해주세요.');
          setLoading(false);
          return;
        }

        // 1. classes 테이블에 팝업 클래스 생성
        const discountConfig = popupData.discount_enabled && popupData.discount_class_ids.length > 0
          ? {
              enabled: true,
              target_class_ids: popupData.discount_class_ids,
              discount_amount: popupData.discount_amount,
            }
          : null;

        const { data: newClass, error: classError } = await supabase
          .from('classes')
          .insert({
            academy_id: academyId,
            title: popupData.title,
            class_type: 'popup',
            price: popupData.price,
            instructor_id: popupData.instructor_id || null,
            hall_id: popupData.hall_id || null,
            max_students: popupData.max_students,
            is_active: true,
            access_config: {
              requiredGroup: null,
              allowRegularTicket: false,
              allowCoupon: true,
            },
            discount_config: discountConfig,
          })
          .select('id')
          .single();

        if (classError) throw classError;

        // 종료시각이 시작시각보다 뒤인지 검증
        const startDateTime = new Date(`${popupData.popup_date}T${popupData.start_time}:00`);
        const endDateTime = new Date(`${popupData.popup_date}T${popupData.end_time}:00`);
        
        if (endDateTime <= startDateTime) {
          alert('종료 시간은 시작 시간보다 뒤여야 합니다.');
          setLoading(false);
          return;
        }

        // 2. schedules 테이블에 스케줄 생성

        const { error: scheduleError } = await supabase
          .from('schedules')
          .insert({
            class_id: newClass.id,
            hall_id: popupData.hall_id || null,
            instructor_id: popupData.instructor_id || null,
            start_time: startDateTime.toISOString(),
            end_time: endDateTime.toISOString(),
            max_students: popupData.max_students,
            current_students: 0,
            is_canceled: false,
            recurring_schedule_id: null,
          });

        if (scheduleError) throw scheduleError;
        alert('팝업/워크샵이 생성되었습니다!');

      } else {
        // 정규 수업 생성
        if (!formData.class_id) {
          alert('클래스를 선택해주세요.');
          setLoading(false);
          return;
        }

        if (formData.days_of_week.length === 0) {
          alert('요일을 선택해주세요.');
          setLoading(false);
          return;
        }

        // 종료시각이 시작시각보다 뒤인지 검증
        const startTimeParts = formData.start_time.split(':').map(Number);
        const endTimeParts = formData.end_time.split(':').map(Number);
        const startMinutes = startTimeParts[0] * 60 + startTimeParts[1];
        const endMinutes = endTimeParts[0] * 60 + endTimeParts[1];
        
        if (endMinutes <= startMinutes) {
          alert('종료 시간은 시작 시간보다 뒤여야 합니다.');
          setLoading(false);
          return;
        }

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
              <span className="text-xs text-gray-500">클래스(반) 연결</span>
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
              <span className="font-semibold">팝업/워크샵</span>
              <span className="text-xs text-gray-500">1회성 쿠폰 수업</span>
            </button>
          </div>

          {type === 'regular' ? (
            /* ========== 정규 반복 수업 폼 ========== */
            <>
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
                  {regularClasses.map((cls) => (
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
              {formData.days_of_week.length > 0 && (
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
            </>
          ) : (
            /* ========== 팝업/워크샵 폼 ========== */
            <>
              {/* 수업 제목 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  수업 제목 *
                </label>
                <input
                  type="text"
                  required
                  placeholder="예: 살사 기초 워크샵"
                  className="w-full border dark:border-neutral-700 rounded-lg px-3 py-2 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
                  value={popupData.title}
                  onChange={(e) => setPopupData({ ...popupData, title: e.target.value })}
                />
              </div>

              {/* 가격 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  가격 (쿠폰 1매) *
                </label>
                <div className="relative">
                  <input
                    type="number"
                    required
                    min="0"
                    step="1000"
                    className="w-full border dark:border-neutral-700 rounded-lg px-3 py-2 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white pr-12"
                    value={popupData.price}
                    onChange={(e) => setPopupData({ ...popupData, price: parseInt(e.target.value) || 0 })}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">원</span>
                </div>
              </div>

              {/* 강사 선택 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  강사
                </label>
                <select
                  className="w-full border dark:border-neutral-700 rounded-lg px-3 py-2 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
                  value={popupData.instructor_id}
                  onChange={(e) => setPopupData({ ...popupData, instructor_id: e.target.value })}
                  disabled={loadingInstructors}
                >
                  <option value="">선택 안함</option>
                  {instructors.map((inst) => (
                    <option key={inst.id} value={inst.id}>
                      {inst.name_kr || inst.name_en || '이름 없음'}
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
                  value={popupData.hall_id}
                  onChange={(e) => setPopupData({ ...popupData, hall_id: e.target.value })}
                >
                  <option value="">선택 안함</option>
                  {halls.map((hall) => (
                    <option key={hall.id} value={hall.id}>{hall.name}</option>
                  ))}
                </select>
              </div>

              {/* 날짜 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  날짜 *
                </label>
                <input
                  type="date"
                  required
                  className="w-full border dark:border-neutral-700 rounded-lg px-3 py-2 bg-white dark:bg-neutral-900"
                  value={popupData.popup_date}
                  onChange={(e) => setPopupData({ ...popupData, popup_date: e.target.value })}
                />
              </div>

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
                    value={popupData.start_time}
                    onChange={(e) => setPopupData({ ...popupData, start_time: e.target.value })}
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
                    value={popupData.end_time}
                    onChange={(e) => setPopupData({ ...popupData, end_time: e.target.value })}
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
                  value={popupData.max_students}
                  onChange={(e) => setPopupData({ ...popupData, max_students: parseInt(e.target.value) || 30 })}
                />
              </div>

              {/* 정규 수강생 할인 */}
              <div className="bg-amber-50 dark:bg-amber-900/10 p-4 rounded-lg border border-amber-200 dark:border-amber-800 space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                    <Tag size={16} className="text-amber-600" />
                    정규 수강생 할인
                  </label>
                  <button
                    type="button"
                    onClick={() => setPopupData({ ...popupData, discount_enabled: !popupData.discount_enabled })}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      popupData.discount_enabled ? 'bg-amber-600' : 'bg-gray-300 dark:bg-neutral-600'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        popupData.discount_enabled ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                {popupData.discount_enabled && (
                  <>
                    {/* 할인 대상 클래스 선택 */}
                    <div>
                      <label className="block text-xs text-gray-600 dark:text-gray-400 mb-2">
                        할인 대상 (아래 클래스의 수강권 보유자에게 할인)
                      </label>
                      <div className="max-h-32 overflow-y-auto border dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-900">
                        {regularAndWorkshopClasses.length === 0 ? (
                          <div className="p-3 text-sm text-gray-400 text-center">
                            등록된 정규 클래스가 없습니다.
                          </div>
                        ) : (
                          regularAndWorkshopClasses.map((cls) => (
                            <div
                              key={cls.id}
                              onClick={() => toggleDiscountClass(cls.id)}
                              className="flex items-center gap-2 p-2 border-b dark:border-neutral-700 last:border-b-0 cursor-pointer hover:bg-gray-50 dark:hover:bg-neutral-800"
                            >
                              <input
                                type="checkbox"
                                checked={popupData.discount_class_ids.includes(cls.id)}
                                onChange={() => {}}
                                className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500"
                              />
                              <span className="text-sm text-gray-700 dark:text-gray-300">
                                {cls.title}
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    {/* 할인 금액 */}
                    <div>
                      <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                        할인 금액
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          min="0"
                          step="1000"
                          className="w-full border dark:border-neutral-700 rounded-lg px-3 py-2 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white pr-12"
                          value={popupData.discount_amount}
                          onChange={(e) => setPopupData({ ...popupData, discount_amount: parseInt(e.target.value) || 0 })}
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">원</span>
                      </div>
                      <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                        할인 적용 시 가격: {(popupData.price - popupData.discount_amount).toLocaleString()}원
                      </p>
                    </div>
                  </>
                )}

                {!popupData.discount_enabled && (
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    특정 정규 클래스 수강생에게 할인을 제공할 수 있습니다.
                  </p>
                )}
              </div>

              {/* 안내 */}
              <div className="bg-gray-50 dark:bg-neutral-800 p-3 rounded-lg text-xs text-gray-500 dark:text-gray-400">
                <p className="flex items-center gap-1">
                  <Users size={14} />
                  팝업/워크샵은 기본적으로 <strong className="text-amber-600">쿠폰</strong>으로만 신청 가능합니다.
                </p>
              </div>
            </>
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
              className={`flex-1 px-4 py-3 text-white rounded-lg font-bold transition-colors disabled:opacity-50 ${
                type === 'popup'
                  ? 'bg-amber-600 hover:bg-amber-700'
                  : 'bg-slate-900 dark:bg-slate-100 dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-200'
              }`}
            >
              {loading ? '생성 중...' : (type === 'popup' ? '팝업/워크샵 생성' : '스케줄 생성')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
