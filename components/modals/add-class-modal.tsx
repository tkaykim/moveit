"use client";

import { useState, useEffect } from 'react';
import { X, Plus } from 'lucide-react';
import { getSupabaseClient } from '@/lib/utils/supabase-client';
import { Academy, Hall, Instructor, Class } from '@/lib/supabase/types';
import { convertKSTInputToUTC } from '@/lib/utils/kst-time';

const GENRES = ['Choreo', 'hiphop', 'locking', 'waacking', 'popping', 'krump', 'voguing', 'breaking(bboying)'] as const;

// 클래스 유형 한글 매핑
const CLASS_TYPE_OPTIONS = [
  { value: 'REGULAR', label: '정규반' },
  { value: 'ONE_DAY', label: '원데이' },
  { value: 'PRIVATE', label: '개인레슨' },
  { value: 'RENTAL', label: '대관' },
  { value: 'popup', label: '팝업' },
  { value: 'workshop', label: '워크샵' },
] as const;

interface AddClassModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: () => void;
  academy: Academy | { id: string; [key: string]: any } | null;
  day: string;
  time: string;
  weekStartDate: Date;
  defaultHallId?: string | null;
}

export const AddClassModal = ({ isOpen, onClose, onSubmit, academy, day, time, weekStartDate, defaultHallId }: AddClassModalProps) => {
  const [halls, setHalls] = useState<Hall[]>([]);
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    class_id: '',
    hall_id: '',
    instructor_id: '',
    max_students: 20,
    class_type: 'ONE_DAY', // 기본값: 원데이 (단일 수업)
    // 정기 수업용 필드
    start_date: '', // 시작 날짜 (YYYY-MM-DD)
    start_time: '', // 시작 시간 (HH:mm)
    end_date: '', // 종료 날짜 (YYYY-MM-DD)
    end_time: '', // 종료 시간 (HH:mm)
    selected_days: [] as number[], // 선택된 요일 [0=일, 1=월, ..., 6=토]
  });

  useEffect(() => {
    if (isOpen && academy) {
      loadData();
      // 기본 홀 ID 설정
      if (defaultHallId) {
        setFormData((prev) => ({ ...prev, hall_id: defaultHallId }));
      } else {
        setFormData((prev) => ({ ...prev, hall_id: '' }));
      }

      // 정기 수업 기본값 설정 (현재 주의 시작일과 종료일)
      const today = new Date();
      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() - today.getDay()); // 일요일
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 12 * 7); // 12주 후

      const timeHours = time ? parseInt(time.split(':')[0]) : 14;
      const timeMinutes = time ? time.split(':')[1] : '00';
      const endHours = String(timeHours + 1).padStart(2, '0');

      setFormData((prev) => ({
        ...prev,
        start_date: startOfWeek.toISOString().split('T')[0],
        end_date: endOfWeek.toISOString().split('T')[0],
        start_time: time || '14:00',
        end_time: `${endHours}:${timeMinutes}`,
      }));
    }
  }, [isOpen, academy, defaultHallId, time]);

  useEffect(() => {
    if (formData.hall_id && halls.length > 0) {
      const selectedHall = halls.find(h => h.id === formData.hall_id);
      if (selectedHall && selectedHall.capacity && selectedHall.capacity > 0) {
        setFormData((prev) => ({ ...prev, max_students: selectedHall.capacity || 20 }));
      }
    }
  }, [formData.hall_id, halls]);

  const loadData = async () => {
    const supabase = getSupabaseClient() as any;
    if (!supabase || !academy) return;

    try {
      const academyId = (academy as any).academyId || academy.id;

      const [hallsRes, instructorsRes, classesRes] = await Promise.all([
        supabase
          .from('halls')
          .select('*')
          .eq('academy_id', academyId)
          .order('name', { ascending: true }),
        supabase
          .from('instructors')
          .select('*')
          .order('name_kr', { ascending: true }),
        supabase
          .from('classes')
          .select('*')
          .eq('academy_id', academyId)
          .order('created_at', { ascending: false }),
      ]);

      if (hallsRes.error) throw hallsRes.error;
      if (instructorsRes.error) throw instructorsRes.error;
      if (classesRes.error) throw classesRes.error;

      setHalls(hallsRes.data || []);
      setInstructors(instructorsRes.data || []);
      setClasses(classesRes.data || []);
      
      // 기본 홀 ID가 있고 홀 목록에 있으면 자동 선택
      if (defaultHallId && hallsRes.data) {
        const hallExists = hallsRes.data.find((h: Hall) => h.id === defaultHallId);
        if (hallExists) {
          setFormData((prev) => ({ 
            ...prev, 
            hall_id: defaultHallId,
            max_students: hallExists.capacity || 20
          }));
        }
      }
    } catch (error) {
      console.error('Error loading data:', error);
      alert('데이터를 불러오는데 실패했습니다.');
    }
  };

  const checkScheduleOverlap = async (startTimeUTC: string, endTimeUTC: string, hallId: string | null) => {
    // 홀이 없으면 겹침 체크 안함 (홀 없이는 겹칠 수 없음)
    if (!hallId) {
      console.log('홀이 선택되지 않아 겹침 체크를 건너뜁니다.');
      return false;
    }
    
    const supabase = getSupabaseClient() as any;
    if (!supabase) return false;

    try {
      // 같은 홀의 모든 취소되지 않은 스케줄 조회
      const { data: schedules, error } = await supabase
        .from('schedules')
        .select('*')
        .eq('hall_id', hallId)
        .eq('is_canceled', false);

      if (error) {
        console.error('Error fetching schedules:', error);
        throw error;
      }

      if (!schedules || schedules.length === 0) {
        return false;
      }

      const newStart = new Date(startTimeUTC).getTime();
      const newEnd = new Date(endTimeUTC).getTime();

      console.log(`조회된 스케줄 수: ${schedules.length}개`);

      // 시간 겹침 체크: 새 수업의 시작시간~종료시간 범위 내에 기존 수업의 시작시간~종료시간이 겹치는지 확인
      const hasOverlap = schedules.some((schedule: any) => {
        if (!schedule.start_time || !schedule.end_time) return false;
        
        const existingStart = new Date(schedule.start_time).getTime();
        const existingEnd = new Date(schedule.end_time).getTime();
        
        // 겹침 조건: 새 수업 시작 < 기존 수업 종료 AND 새 수업 종료 > 기존 수업 시작
        // 예: 기존 14:00~15:00, 새 14:30~16:00 → 14:30 < 15:00 (true) AND 16:00 > 14:00 (true) → 겹침
        const overlaps = newStart < existingEnd && newEnd > existingStart;
        
        console.log(`스케줄 ${schedule.id} 체크:`, {
          기존수업: {
            시작: schedule.start_time,
            종료: schedule.end_time,
            시작타임스탬프: existingStart,
            종료타임스탬프: existingEnd
          },
          새수업: {
            시작: startTimeUTC,
            종료: endTimeUTC,
            시작타임스탬프: newStart,
            종료타임스탬프: newEnd
          },
          조건1: `newStart(${newStart}) < existingEnd(${existingEnd}) = ${newStart < existingEnd}`,
          조건2: `newEnd(${newEnd}) > existingStart(${existingStart}) = ${newEnd > existingStart}`,
          겹침: overlaps
        });
        
        return overlaps;
      });

      return hasOverlap;
    } catch (error) {
      console.error('Error checking schedule overlap:', error);
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = getSupabaseClient() as any;
    if (!supabase || !academy || !formData.class_id) return;

    setLoading(true);

    try {
      const academyId = (academy as any).academyId || academy.id;
      const isRegularClass = formData.class_type === 'REGULAR';

      // 선택한 클래스의 class_type 업데이트
      const { error: classUpdateError } = await supabase
        .from('classes')
        .update({ class_type: formData.class_type })
        .eq('id', formData.class_id);

      if (classUpdateError) {
        console.warn('클래스 유형 업데이트 실패:', classUpdateError);
      }

      if (isRegularClass) {
        // 정기 수업 처리
        if (!formData.start_date || !formData.end_date || !formData.start_time || !formData.end_time) {
          alert('정기 수업은 시작/종료 날짜와 시간을 모두 입력해주세요.');
          setLoading(false);
          return;
        }

        if (formData.selected_days.length === 0) {
          alert('최소 하나의 요일을 선택해주세요.');
          setLoading(false);
          return;
        }

        // 날짜 검증
        const startDate = new Date(formData.start_date);
        const endDate = new Date(formData.end_date);
        if (endDate < startDate) {
          alert('종료 날짜는 시작 날짜보다 이후여야 합니다.');
          setLoading(false);
          return;
        }

        // 정기 수업 템플릿 생성
        const [startHours, startMinutes] = formData.start_time.split(':').map(Number);
        const [endHours, endMinutes] = formData.end_time.split(':').map(Number);

        const recurringScheduleData = {
          class_id: formData.class_id,
          academy_id: academyId,
          start_date: formData.start_date,
          end_date: formData.end_date,
          start_time: `${String(startHours).padStart(2, '0')}:${String(startMinutes).padStart(2, '0')}:00`,
          end_time: `${String(endHours).padStart(2, '0')}:${String(endMinutes).padStart(2, '0')}:00`,
          days_of_week: formData.selected_days,
          hall_id: formData.hall_id || null,
          instructor_id: formData.instructor_id || null,
          max_students: Number(formData.max_students),
          is_active: true,
        };

        const { data: recurringSchedule, error: recurringError } = await supabase
          .from('recurring_schedules')
          .insert([recurringScheduleData])
          .select()
          .single();

        if (recurringError) throw recurringError;

        // 선택된 기간과 요일에 대해 모든 스케줄 생성
        const schedulesToInsert: any[] = [];
        const currentDate = new Date(startDate);
        const endDateObj = new Date(endDate);

        while (currentDate <= endDateObj) {
          const dayOfWeek = currentDate.getDay(); // 0=일요일, 1=월요일, ..., 6=토요일
          
          if (formData.selected_days.includes(dayOfWeek)) {
            // 이 날짜에 수업 생성
            const year = currentDate.getFullYear();
            const month = String(currentDate.getMonth() + 1).padStart(2, '0');
            const dayStr = String(currentDate.getDate()).padStart(2, '0');
            
            const kstStartString = `${year}-${month}-${dayStr}T${formData.start_time}`;
            const kstEndString = `${year}-${month}-${dayStr}T${formData.end_time}`;

            const startTimeUTC = convertKSTInputToUTC(kstStartString);
            const endTimeUTC = convertKSTInputToUTC(kstEndString);

            if (!startTimeUTC || !endTimeUTC) {
              throw new Error('시간 변환에 실패했습니다.');
            }

            schedulesToInsert.push({
              class_id: formData.class_id,
              hall_id: formData.hall_id || null,
              instructor_id: formData.instructor_id || null,
              start_time: startTimeUTC,
              end_time: endTimeUTC,
              max_students: Number(formData.max_students),
              current_students: 0,
              is_canceled: false,
              recurring_schedule_id: recurringSchedule.id,
            });
          }

          currentDate.setDate(currentDate.getDate() + 1);
        }

        // 모든 스케줄 일괄 생성
        if (schedulesToInsert.length > 0) {
          const { error: scheduleError } = await supabase
            .from('schedules')
            .insert(schedulesToInsert);

          if (scheduleError) throw scheduleError;
        }

        alert(`정기 수업이 추가되었습니다. (총 ${schedulesToInsert.length}개 스케줄)`);
      } else {
        // 일반 수업 처리 (기존 로직)
        const DAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
        const dayIndex = DAYS.indexOf(day);
        if (dayIndex === -1) throw new Error('Invalid day');

        // KST 기준으로 날짜 생성
        const targetDate = new Date(weekStartDate);
        targetDate.setDate(weekStartDate.getDate() + dayIndex);
        
        // 시간 파싱 (KST 기준)
        const [hours, minutes] = time.split(':').map(Number);
        
        // KST 시간으로 datetime-local 형식 문자열 생성
        const year = targetDate.getFullYear();
        const month = String(targetDate.getMonth() + 1).padStart(2, '0');
        const dayStr = String(targetDate.getDate()).padStart(2, '0');
        const hoursStr = String(hours).padStart(2, '0');
        const minutesStr = String(minutes).padStart(2, '0');
        const kstInputString = `${year}-${month}-${dayStr}T${hoursStr}:${minutesStr}`;
        
        // 종료 시간 (기본 1시간 후, KST 기준)
        const endHours = hours + 1;
        const endHoursStr = String(endHours).padStart(2, '0');
        const endKstInputString = `${year}-${month}-${dayStr}T${endHoursStr}:${minutesStr}`;

        // KST 입력값을 UTC로 변환하여 저장
        const startTimeUTC = convertKSTInputToUTC(kstInputString);
        const endTimeUTC = convertKSTInputToUTC(endKstInputString);

        if (!startTimeUTC || !endTimeUTC) {
          throw new Error('시간 변환에 실패했습니다.');
        }

        // 종료 시간이 시작 시간보다 앞서는지 확인
        if (new Date(endTimeUTC) <= new Date(startTimeUTC)) {
          alert('종료 시간은 시작 시간보다 이후여야 합니다.');
          setLoading(false);
          return;
        }

        // 시간과 홀이 모두 겹치는 수업이 있는지 확인
        if (formData.hall_id) {
          const hasOverlap = await checkScheduleOverlap(
            startTimeUTC,
            endTimeUTC,
            formData.hall_id
          );

          if (hasOverlap) {
            const confirm = window.confirm('겹치는 수업이 있습니다. 시간/홀을 모두 확인해주세요. 이대로 등록하시겠습니까?');
            if (!confirm) {
              setLoading(false);
              return;
            }
          }
        }

        // 스케줄 생성
        const scheduleData: any = {
          class_id: formData.class_id,
          hall_id: formData.hall_id || null,
          instructor_id: formData.instructor_id || null,
          start_time: startTimeUTC,
          end_time: endTimeUTC,
          max_students: Number(formData.max_students),
          current_students: 0,
          is_canceled: false,
        };

        const { error: scheduleError } = await supabase
          .from('schedules')
          .insert([scheduleData]);

        if (scheduleError) throw scheduleError;

        alert('수업이 추가되었습니다.');
      }

      onSubmit();
      onClose();
      setFormData({
        class_id: '',
        hall_id: '',
        instructor_id: '',
        max_students: 20,
        class_type: 'ONE_DAY',
        start_date: '',
        start_time: '',
        end_date: '',
        end_time: '',
        selected_days: [],
      });
    } catch (error) {
      console.error('Error adding class:', error);
      alert('수업 추가에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const DAY_NAMES = ["월", "화", "수", "목", "금", "토", "일"];
  const DAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
  const dayIndex = DAYS.indexOf(day);
  const dayName = dayIndex !== -1 ? DAY_NAMES[dayIndex] : day;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in" 
        onClick={onClose} 
      />
      <div className="relative w-full max-w-[420px] bg-white dark:bg-neutral-900 rounded-t-3xl p-6 animate-in slide-in-from-bottom duration-300 border-t border-neutral-200 dark:border-neutral-800 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="w-12 h-1 bg-neutral-300 dark:bg-neutral-700 rounded-full mx-auto mb-6" />
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-black text-black dark:text-white">수업 추가</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-full transition-colors"
          >
            <X size={20} className="text-neutral-600 dark:text-neutral-400" />
          </button>
        </div>

        <div className="mb-6 p-4 bg-neutral-100 dark:bg-neutral-800 rounded-xl">
          <div className="text-sm text-neutral-600 dark:text-neutral-400 mb-1">날짜 및 시간</div>
          <div className="text-lg font-bold text-black dark:text-white">
            {dayName}요일 {time}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-black dark:text-white mb-2">
              클래스 *
            </label>
            <select
              required
              value={formData.class_id}
              onChange={(e) => setFormData({ ...formData, class_id: e.target.value })}
              className="w-full px-4 py-2 bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-black dark:text-white"
            >
              <option value="">클래스 선택</option>
              {classes.map((cls) => (
                <option key={cls.id} value={cls.id}>
                  {cls.title || `${cls.genre || 'ALL'} 클래스`}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-black dark:text-white mb-2">
              클래스 유형 *
            </label>
            <select
              required
              value={formData.class_type}
              onChange={(e) => setFormData({ ...formData, class_type: e.target.value })}
              className="w-full px-4 py-2 bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-black dark:text-white"
            >
              {CLASS_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {formData.class_type === 'REGULAR' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-black dark:text-white mb-2">
                    시작 날짜 *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    className="w-full px-4 py-2 bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-black dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-black dark:text-white mb-2">
                    종료 날짜 *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.end_date}
                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                    min={formData.start_date}
                    className="w-full px-4 py-2 bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-black dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-black dark:text-white mb-2">
                    시작 시간 *
                  </label>
                  <input
                    type="time"
                    required
                    value={formData.start_time}
                    onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                    className="w-full px-4 py-2 bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-black dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-black dark:text-white mb-2">
                    종료 시간 *
                  </label>
                  <input
                    type="time"
                    required
                    value={formData.end_time}
                    onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                    className="w-full px-4 py-2 bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-black dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-black dark:text-white mb-2">
                  수업 요일 * (최소 1개 선택)
                </label>
                <div className="flex gap-2 flex-wrap">
                  {[
                    { value: 0, label: '일' },
                    { value: 1, label: '월' },
                    { value: 2, label: '화' },
                    { value: 3, label: '수' },
                    { value: 4, label: '목' },
                    { value: 5, label: '금' },
                    { value: 6, label: '토' },
                  ].map((dayOption) => {
                    const isSelected = formData.selected_days.includes(dayOption.value);
                    return (
                      <button
                        key={dayOption.value}
                        type="button"
                        onClick={() => {
                          if (isSelected) {
                            setFormData({
                              ...formData,
                              selected_days: formData.selected_days.filter(d => d !== dayOption.value),
                            });
                          } else {
                            setFormData({
                              ...formData,
                              selected_days: [...formData.selected_days, dayOption.value],
                            });
                          }
                        }}
                        className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                          isSelected
                            ? 'bg-neutral-900 dark:bg-[#CCFF00] text-white dark:text-black'
                            : 'bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300'
                        }`}
                      >
                        {dayOption.label}
                      </button>
                    );
                  })}
                </div>
                {formData.selected_days.length > 0 && (
                  <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
                    선택된 요일: {formData.selected_days.map(d => ['일', '월', '화', '수', '목', '금', '토'][d]).join(', ')}요일
                  </p>
                )}
              </div>
            </>
          )}

          <div>
            <label className="block text-sm font-medium text-black dark:text-white mb-2">
              홀
            </label>
            <select
              value={formData.hall_id}
              onChange={(e) => {
                const selectedHall = halls.find(h => h.id === e.target.value);
                setFormData({ 
                  ...formData, 
                  hall_id: e.target.value,
                  max_students: selectedHall?.capacity || 20
                });
              }}
              disabled={halls.length === 0}
              className="w-full px-4 py-2 bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-black dark:text-white disabled:opacity-50"
            >
              <option value="">홀 선택 (선택사항)</option>
              {halls.map((hall) => (
                <option key={hall.id} value={hall.id}>
                  {hall.name} {hall.capacity && hall.capacity > 0 && `(${hall.capacity}명)`}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-black dark:text-white mb-2">
              강사
            </label>
            <select
              value={formData.instructor_id}
              onChange={(e) => setFormData({ ...formData, instructor_id: e.target.value })}
              className="w-full px-4 py-2 bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-black dark:text-white"
            >
              <option value="">강사 선택 (선택사항)</option>
              {instructors.map((instructor) => {
                const nameKr = instructor.name_kr;
                const nameEn = instructor.name_en;
                const displayName = nameKr && nameEn 
                  ? `${nameKr} (${nameEn})` 
                  : nameKr || nameEn || '-';
                return (
                  <option key={instructor.id} value={instructor.id}>
                    {displayName}
                  </option>
                );
              })}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-black dark:text-white mb-2">
              최대 인원 *
            </label>
            <input
              type="number"
              required
              min="1"
              value={formData.max_students}
              onChange={(e) => setFormData({ ...formData, max_students: Number(e.target.value) })}
              className="w-full px-4 py-2 bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-black dark:text-white"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-neutral-200 dark:bg-neutral-800 text-black dark:text-white font-bold py-4 rounded-xl"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-[2] bg-neutral-900 dark:bg-[#CCFF00] text-white dark:text-black font-black py-4 rounded-xl text-lg disabled:opacity-50"
            >
              {loading ? '추가 중...' : '수업 추가'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

