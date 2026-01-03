"use client";

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { getSupabaseClient } from '@/lib/utils/supabase-client';
import { InstructorSelector } from './instructor-selector';
import { convertUTCToKSTForInput, convertKSTInputToUTC, dateToKSTInput } from '@/lib/utils/kst-time';
import { formatNumberInput, parseNumberFromString, formatNumberWithCommas } from '@/lib/utils/number-format';

interface ClassModalProps {
  academyId: string;
  classData?: any;
  defaultDate?: Date;
  defaultHallId?: string;
  onClose: () => void;
}

const GENRES = ['Choreo', 'hiphop', 'locking', 'waacking', 'popping', 'krump', 'voguing', 'breaking(bboying)'];
const DIFFICULTY_LEVELS = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'];
const CLASS_TYPES = ['regular', 'popup', 'workshop', 'ONE_DAY', 'PRIVATE', 'RENTAL'];

export function ClassModal({ academyId, classData, defaultDate, defaultHallId, onClose }: ClassModalProps) {
  const [isRegularClass, setIsRegularClass] = useState(false); // 정규 수업 여부
  const [formData, setFormData] = useState({
    title: '',
    song: '',
    genre: '',
    difficulty_level: 'BEGINNER',
    class_type: 'regular',
    price: 0,
    description: '',
    start_time: '',
    end_time: '',
    instructor_id: '',
    hall_id: '',
    max_students: 0,
    // 페이 관련 필드
    base_salary: '',
    base_student_count: '',
    additional_salary_per_student: '',
    // 정규 수업 관련 필드
    start_date: '', // 시작 날짜 (YYYY-MM-DD)
    end_date: '', // 종료 날짜 (YYYY-MM-DD)
    start_time_only: '', // 시작 시간 (HH:mm)
    end_time_only: '', // 종료 시간 (HH:mm)
    selected_days: [] as number[], // 선택된 요일 [0=일, 1=월, ..., 6=토]
  });
  const [halls, setHalls] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadData();
    if (classData) {
      // 정규 수업인지 확인 (recurring_schedule_id가 있으면 정규 수업)
      const checkRegularClass = async () => {
        const supabase = getSupabaseClient();
        if (!supabase) return;
        
        // schedules 테이블에서 recurring_schedule_id가 있는지 확인
        const { data: schedules } = await supabase
          .from('schedules')
          .select('recurring_schedule_id')
          .eq('class_id', classData.id)
          .limit(1);
        
        if (schedules && schedules.length > 0 && schedules[0].recurring_schedule_id) {
          setIsRegularClass(true);
          // recurring_schedules에서 정보 가져오기
          const { data: recurringSchedule } = await supabase
            .from('recurring_schedules')
            .select('*')
            .eq('id', schedules[0].recurring_schedule_id)
            .single();
          
          if (recurringSchedule) {
            setFormData((prev) => ({
              ...prev,
              start_date: recurringSchedule.start_date,
              end_date: recurringSchedule.end_date,
              start_time_only: recurringSchedule.start_time?.slice(0, 5) || '',
              end_time_only: recurringSchedule.end_time?.slice(0, 5) || '',
              selected_days: recurringSchedule.days_of_week || [],
            }));
          }
        }
      };
      
      checkRegularClass();
      
      // UTC 시간을 KST로 변환하여 표시
      setFormData((prev) => ({
        ...prev,
        title: classData.title || '',
        song: classData.song || '',
        genre: classData.genre || '',
        difficulty_level: classData.difficulty_level || 'BEGINNER',
        class_type: classData.class_type || 'regular',
        price: classData.price || 0,
        description: classData.description || '',
        start_time: convertUTCToKSTForInput(classData.start_time),
        end_time: convertUTCToKSTForInput(classData.end_time),
        instructor_id: classData.instructor_id || '',
        hall_id: classData.hall_id || '',
        max_students: classData.max_students || 0,
        base_salary: formatNumberWithCommas(classData.base_salary || 0),
        base_student_count: classData.base_student_count ? String(classData.base_student_count) : '',
        additional_salary_per_student: formatNumberWithCommas(classData.additional_salary_per_student || 0),
      }));
    } else if (defaultDate) {
      // 새 클래스 추가 시 기본 날짜와 시간 설정 (KST 기준)
      const kstDate = new Date(defaultDate);
      // 시간이 오전이면 오후 2시로 변경, 오후면 그대로 유지
      if (kstDate.getHours() < 12) {
        kstDate.setHours(14, 0, 0, 0); // 오후 2시 기본
      }
      const dateStr = dateToKSTInput(kstDate);
      
      const endDate = new Date(kstDate);
      endDate.setHours(endDate.getHours() + 1);
      const endDateStr = dateToKSTInput(endDate);
      
      // 정규 수업용 기본값 설정
      const startDateOnly = kstDate.toISOString().split('T')[0];
      const endDateOnly = new Date(kstDate);
      endDateOnly.setDate(endDateOnly.getDate() + 12 * 7); // 12주 후
      const endDateOnlyStr = endDateOnly.toISOString().split('T')[0];
      const startTimeOnly = '14:00';
      const endTimeOnly = '15:00';
      
      setFormData((prev) => ({
        ...prev,
        start_time: dateStr,
        end_time: endDateStr,
        hall_id: defaultHallId || '',
        start_date: startDateOnly,
        end_date: endDateOnlyStr,
        start_time_only: startTimeOnly,
        end_time_only: endTimeOnly,
      }));
    } else {
      // 새 클래스 추가 시 오후 2시 기본 설정
      const now = new Date();
      now.setHours(14, 0, 0, 0); // 오후 2시 기본
      const dateStr = dateToKSTInput(now);
      
      const endDate = new Date(now);
      endDate.setHours(endDate.getHours() + 1);
      const endDateStr = dateToKSTInput(endDate);
      
      // 정규 수업용 기본값 설정
      const startDateOnly = now.toISOString().split('T')[0];
      const endDateOnly = new Date(now);
      endDateOnly.setDate(endDateOnly.getDate() + 12 * 7); // 12주 후
      const endDateOnlyStr = endDateOnly.toISOString().split('T')[0];
      const startTimeOnly = '14:00';
      const endTimeOnly = '15:00';
      
      setFormData((prev) => ({
        ...prev,
        start_time: dateStr,
        end_time: endDateStr,
        start_date: startDateOnly,
        end_date: endDateOnlyStr,
        start_time_only: startTimeOnly,
        end_time_only: endTimeOnly,
      }));
    }
  }, [classData, academyId, defaultDate, defaultHallId]);

  const loadData = async () => {
    const supabase = getSupabaseClient();
    if (!supabase) return;

    try {
      const { data: hallsData } = await supabase
        .from('halls')
        .select('*')
        .eq('academy_id', academyId);
      setHalls(hallsData || []);
      
      // 기본 홀 ID가 있고 홀 목록에 있으면 자동 선택
      if (defaultHallId && hallsData && !classData) {
        const hallExists = hallsData.find((h: any) => h.id === defaultHallId);
        if (hallExists) {
          setFormData((prev) => ({ 
            ...prev, 
            hall_id: defaultHallId,
            max_students: hallExists.capacity || 0
          }));
        }
      }
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  const checkScheduleOverlap = async (startTimeUTC: string, endTimeUTC: string, hallId: string | null, excludeScheduleId?: string) => {
    if (!hallId) return false; // 홀이 없으면 겹침 체크 안함
    
    const supabase = getSupabaseClient();
    if (!supabase) return false;

    try {
      // 같은 홀의 모든 취소되지 않은 스케줄 조회
      let query = supabase
        .from('schedules')
        .select('*')
        .eq('hall_id', hallId)
        .eq('is_canceled', false);

      if (excludeScheduleId) {
        query = query.neq('id', excludeScheduleId);
      }

      const { data: schedules, error } = await query;

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
    setLoading(true);

    const supabase = getSupabaseClient();
    if (!supabase) {
      alert('데이터베이스 연결에 실패했습니다.');
      setLoading(false);
      return;
    }

    try {
      // 수업명이 비어있고 강사가 선택되어 있으면 강사 이름으로 자동 설정
      let title = formData.title;
      if (!title && formData.instructor_id) {
        const { data: instructor } = await supabase
          .from('instructors')
          .select('name_kr, name_en')
          .eq('id', formData.instructor_id)
          .single();
        
        if (instructor) {
          title = instructor.name_kr || instructor.name_en || '';
        }
      }

      // 클래스 기본 정보 저장 (정규 수업과 단일 수업 공통)
      const classDataToSave = {
        academy_id: academyId,
        title: title,
        song: formData.song || null,
        genre: formData.genre || null,
        difficulty_level: formData.difficulty_level,
        class_type: isRegularClass ? 'REGULAR' : formData.class_type,
        price: formData.price,
        description: formData.description || null,
        instructor_id: formData.instructor_id || null,
        hall_id: formData.hall_id || null,
        max_students: formData.max_students,
        base_salary: parseNumberFromString(formData.base_salary),
        base_student_count: formData.base_student_count ? parseInt(formData.base_student_count, 10) : null,
        additional_salary_per_student: formData.additional_salary_per_student ? parseNumberFromString(formData.additional_salary_per_student) : null,
      };

      let classId: string;

      if (classData) {
        // 수정 모드
        const { data: updatedClass, error: updateError } = await supabase
          .from('classes')
          .update(classDataToSave)
          .eq('id', classData.id)
          .select()
          .single();

        if (updateError) throw updateError;
        classId = updatedClass.id;
        alert('클래스가 수정되었습니다.');
      } else {
        // 신규 등록
        const { data: newClass, error: insertError } = await supabase
          .from('classes')
          .insert([classDataToSave])
          .select()
          .single();

        if (insertError) throw insertError;
        classId = newClass.id;
      }

      if (isRegularClass) {
        // 정규 수업 처리
        if (!formData.start_date || !formData.end_date || !formData.start_time_only || !formData.end_time_only) {
          alert('정규 수업은 시작/종료 날짜와 시간을 모두 입력해주세요.');
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

        // 정규 수업 템플릿 데이터
        const recurringScheduleData = {
          class_id: classId,
          academy_id: academyId,
          start_date: formData.start_date,
          end_date: formData.end_date,
          start_time: formData.start_time_only + ':00',
          end_time: formData.end_time_only + ':00',
          days_of_week: formData.selected_days,
          hall_id: formData.hall_id || null,
          instructor_id: formData.instructor_id || null,
          max_students: formData.max_students,
          is_active: true,
        };

        let recurringScheduleId: string;

        if (classData) {
          // 수정 모드: 기존 recurring_schedule 찾기
          const { data: existingSchedules } = await supabase
            .from('schedules')
            .select('recurring_schedule_id')
            .eq('class_id', classData.id)
            .limit(1);

          if (existingSchedules && existingSchedules.length > 0 && existingSchedules[0].recurring_schedule_id) {
            // 기존 recurring_schedule 업데이트
            const { error: updateError } = await supabase
              .from('recurring_schedules')
              .update(recurringScheduleData)
              .eq('id', existingSchedules[0].recurring_schedule_id);

            if (updateError) throw updateError;
            recurringScheduleId = existingSchedules[0].recurring_schedule_id;

            // 기존 스케줄 삭제
            const { error: deleteError } = await supabase
              .from('schedules')
              .delete()
              .eq('recurring_schedule_id', recurringScheduleId);

            if (deleteError) throw deleteError;
          } else {
            // 기존 recurring_schedule이 없으면 새로 생성
            const { data: newRecurringSchedule, error: insertError } = await supabase
              .from('recurring_schedules')
              .insert([recurringScheduleData])
              .select()
              .single();

            if (insertError) throw insertError;
            recurringScheduleId = newRecurringSchedule.id;
          }
        } else {
          // 신규 등록
          const { data: newRecurringSchedule, error: insertError } = await supabase
            .from('recurring_schedules')
            .insert([recurringScheduleData])
            .select()
            .single();

          if (insertError) throw insertError;
          recurringScheduleId = newRecurringSchedule.id;
        }

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
            
            const kstStartString = `${year}-${month}-${dayStr}T${formData.start_time_only}`;
            const kstEndString = `${year}-${month}-${dayStr}T${formData.end_time_only}`;

            const startTimeUTC = convertKSTInputToUTC(kstStartString);
            const endTimeUTC = convertKSTInputToUTC(kstEndString);

            if (!startTimeUTC || !endTimeUTC) {
              throw new Error('시간 변환에 실패했습니다.');
            }

            schedulesToInsert.push({
              class_id: classId,
              hall_id: formData.hall_id || null,
              instructor_id: formData.instructor_id || null,
              start_time: startTimeUTC,
              end_time: endTimeUTC,
              max_students: formData.max_students,
              current_students: 0,
              is_canceled: false,
              recurring_schedule_id: recurringScheduleId,
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

        alert(`정규 수업이 ${classData ? '수정' : '등록'}되었습니다. (총 ${schedulesToInsert.length}개 스케줄)`);
      } else {
        // 단일 수업 처리
        // KST 시간을 UTC로 변환하여 저장
        const startTimeUTC = convertKSTInputToUTC(formData.start_time);
        const endTimeUTC = convertKSTInputToUTC(formData.end_time);

        if (!startTimeUTC || !endTimeUTC) {
          alert('시간을 올바르게 입력해주세요.');
          setLoading(false);
          return;
        }

        // 종료 시간이 시작 시간보다 앞서는지 확인
        if (new Date(endTimeUTC) <= new Date(startTimeUTC)) {
          alert('종료 시간은 시작 시간보다 이후여야 합니다.');
          setLoading(false);
          return;
        }

        // 시간과 홀이 모두 겹치는 수업이 있는지 확인
        if (formData.hall_id) {
          console.log('겹침 체크 시작:', { startTimeUTC, endTimeUTC, hallId: formData.hall_id, excludeId: classData?.id });
          const hasOverlap = await checkScheduleOverlap(
            startTimeUTC,
            endTimeUTC,
            formData.hall_id,
            classData?.id
          );
          console.log('겹침 체크 결과:', hasOverlap);

          if (hasOverlap) {
            const confirm = window.confirm('겹치는 수업이 있습니다. 시간/홀을 모두 확인해주세요. 이대로 등록하시겠습니까?');
            if (!confirm) {
              setLoading(false);
              return;
            }
          }
        }

        // 단일 수업의 경우 classes 테이블에 start_time과 end_time 저장
        const { error: updateError } = await supabase
          .from('classes')
          .update({
            start_time: startTimeUTC,
            end_time: endTimeUTC,
          })
          .eq('id', classId);

        if (updateError) throw updateError;

        if (classData) {
          // 수정 모드: 기존 스케줄 업데이트
          const { data: existingSchedules } = await supabase
            .from('schedules')
            .select('id')
            .eq('class_id', classId)
            .is('recurring_schedule_id', null)
            .limit(1);

          if (existingSchedules && existingSchedules.length > 0) {
            // 기존 스케줄 업데이트
            const { error: scheduleUpdateError } = await supabase
              .from('schedules')
              .update({
                hall_id: formData.hall_id || null,
                instructor_id: formData.instructor_id || null,
                start_time: startTimeUTC,
                end_time: endTimeUTC,
                max_students: formData.max_students,
              })
              .eq('id', existingSchedules[0].id);

            if (scheduleUpdateError) throw scheduleUpdateError;
          } else {
            // 기존 스케줄이 없으면 새로 생성
            const scheduleData = {
              class_id: classId,
              hall_id: formData.hall_id || null,
              instructor_id: formData.instructor_id || null,
              start_time: startTimeUTC,
              end_time: endTimeUTC,
              max_students: formData.max_students,
              current_students: 0,
              is_canceled: false,
            };

            const { error: scheduleError } = await supabase
              .from('schedules')
              .insert([scheduleData]);

            if (scheduleError) throw scheduleError;
          }
        } else {
          // 신규 등록: schedules 테이블에 저장
          const scheduleData = {
            class_id: classId,
            hall_id: formData.hall_id || null,
            instructor_id: formData.instructor_id || null,
            start_time: startTimeUTC,
            end_time: endTimeUTC,
            max_students: formData.max_students,
            current_students: 0,
            is_canceled: false,
          };

          const { error: scheduleError } = await supabase
            .from('schedules')
            .insert([scheduleData]);

          if (scheduleError) throw scheduleError;

          alert('단일 수업이 등록되었습니다.');
        }
      }

      onClose();
    } catch (error: any) {
      console.error('Error saving class:', error);
      alert(`클래스 저장에 실패했습니다: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 dark:bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b dark:border-neutral-800 flex justify-between items-center sticky top-0 bg-white dark:bg-neutral-900">
          <h3 className="text-xl font-bold text-gray-800 dark:text-white">
            {classData ? '클래스 수정' : '클래스 등록'}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <InstructorSelector
            academyId={academyId}
            selectedInstructorId={formData.instructor_id}
            onSelect={(instructorId) => setFormData({ ...formData, instructor_id: instructorId })}
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              수업명 {formData.instructor_id && <span className="text-xs text-gray-500">(비워두면 강사 이름으로 자동 등록)</span>}
            </label>
            <input
              type="text"
              className="w-full border dark:border-neutral-700 rounded-lg px-3 py-2 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder={formData.instructor_id ? "강사 이름으로 자동 등록됩니다" : ""}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              장르
            </label>
            <select
              className="w-full border dark:border-neutral-700 rounded-lg px-3 py-2 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
              value={formData.genre}
              onChange={(e) => setFormData({ ...formData, genre: e.target.value })}
            >
              <option value="">선택하세요</option>
              {GENRES.map((genre) => (
                <option key={genre} value={genre}>
                  {genre}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              난이도
            </label>
            <select
              className="w-full border dark:border-neutral-700 rounded-lg px-3 py-2 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
              value={formData.difficulty_level}
              onChange={(e) => setFormData({ ...formData, difficulty_level: e.target.value })}
            >
              {DIFFICULTY_LEVELS.map((level) => (
                <option key={level} value={level}>
                  {level}
                </option>
              ))}
            </select>
          </div>

          {/* 수업 유형 선택 (정규 수업 / 단일 수업) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              수업 유형 *
            </label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="class_mode"
                  value="single"
                  checked={!isRegularClass}
                  onChange={() => setIsRegularClass(false)}
                  className="w-4 h-4 text-blue-600"
                />
                <span className="text-gray-700 dark:text-gray-300">단일 수업</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="class_mode"
                  value="regular"
                  checked={isRegularClass}
                  onChange={() => setIsRegularClass(true)}
                  className="w-4 h-4 text-blue-600"
                />
                <span className="text-gray-700 dark:text-gray-300">정규 수업</span>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              클래스 유형
            </label>
            <select
              className="w-full border dark:border-neutral-700 rounded-lg px-3 py-2 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
              value={formData.class_type}
              onChange={(e) => setFormData({ ...formData, class_type: e.target.value })}
            >
              {CLASS_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>

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
                <option key={hall.id} value={hall.id}>
                  {hall.name}
                </option>
              ))}
            </select>
          </div>

          {isRegularClass ? (
            <>
              {/* 정규 수업 입력 필드 */}
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-300 mb-3">정규 수업 설정</h4>
                
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      시작 날짜 *
                    </label>
                    <input
                      type="date"
                      required
                      value={formData.start_date}
                      onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                      className="w-full border dark:border-neutral-700 rounded-lg px-3 py-2 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      종료 날짜 *
                    </label>
                    <input
                      type="date"
                      required
                      value={formData.end_date}
                      onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                      min={formData.start_date}
                      className="w-full border dark:border-neutral-700 rounded-lg px-3 py-2 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      시작 시간 *
                    </label>
                    <input
                      type="time"
                      required
                      value={formData.start_time_only}
                      onChange={(e) => setFormData({ ...formData, start_time_only: e.target.value })}
                      className="w-full border dark:border-neutral-700 rounded-lg px-3 py-2 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      종료 시간 *
                    </label>
                    <input
                      type="time"
                      required
                      value={formData.end_time_only}
                      onChange={(e) => setFormData({ ...formData, end_time_only: e.target.value })}
                      className="w-full border dark:border-neutral-700 rounded-lg px-3 py-2 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
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
                              ? 'bg-blue-600 dark:bg-blue-500 text-white'
                              : 'bg-gray-200 dark:bg-neutral-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-neutral-600'
                          }`}
                        >
                          {dayOption.label}
                        </button>
                      );
                    })}
                  </div>
                  {formData.selected_days.length > 0 && (
                    <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                      선택된 요일: {formData.selected_days.map(d => ['일', '월', '화', '수', '목', '금', '토'][d]).join(', ')}요일
                    </p>
                  )}
                </div>
              </div>
            </>
          ) : (
            <>
              {/* 단일 수업 입력 필드 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    시작 시간 *
                  </label>
                  <input
                    type="datetime-local"
                    required
                    className="w-full border dark:border-neutral-700 rounded-lg px-3 py-2 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
                    value={formData.start_time}
                    onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    종료 시간 *
                  </label>
                  <input
                    type="datetime-local"
                    required
                    className="w-full border dark:border-neutral-700 rounded-lg px-3 py-2 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
                    value={formData.end_time}
                    onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                  />
                </div>
              </div>
            </>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              가격
            </label>
            <input
              type="number"
              min="0"
              className="w-full border dark:border-neutral-700 rounded-lg px-3 py-2 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
              value={formData.price}
              onChange={(e) => setFormData({ ...formData, price: parseInt(e.target.value) || 0 })}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              최대 인원
            </label>
            <input
              type="number"
              min="0"
              className="w-full border dark:border-neutral-700 rounded-lg px-3 py-2 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
              value={formData.max_students}
              onChange={(e) => setFormData({ ...formData, max_students: parseInt(e.target.value) || 0 })}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              곡명
            </label>
            <input
              type="text"
              className="w-full border dark:border-neutral-700 rounded-lg px-3 py-2 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
              value={formData.song}
              onChange={(e) => setFormData({ ...formData, song: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              설명
            </label>
            <textarea
              className="w-full border dark:border-neutral-700 rounded-lg px-3 py-2 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
              rows={3}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
          </div>

          {/* 페이 책정 섹션 */}
          <div className="border-t dark:border-neutral-800 pt-4 mt-4">
            <h4 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">페이 책정</h4>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  기본급 * <span className="text-xs text-gray-500">(원)</span>
                </label>
                <input
                  type="text"
                  required
                  className="w-full border dark:border-neutral-700 rounded-lg px-3 py-2 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
                  value={formData.base_salary}
                  onChange={(e) => {
                    const formatted = formatNumberInput(e.target.value);
                    setFormData({ ...formData, base_salary: formatted });
                  }}
                  placeholder="예: 50,000"
                />
              </div>

              <div className="bg-gray-50 dark:bg-neutral-800 p-4 rounded-lg space-y-3">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                  인원이 <span className="font-semibold">기본 인원 수</span> 이상일 경우, 기본 인원을 제외한 추가 인원당 추가 지급
                </p>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      기본 인원 수 <span className="text-xs text-gray-500">(명)</span>
                    </label>
                    <input
                      type="number"
                      min="1"
                      className="w-full border dark:border-neutral-700 rounded-lg px-3 py-2 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
                      value={formData.base_student_count}
                      onChange={(e) => {
                        const value = e.target.value;
                        // 숫자만 허용
                        if (value === '' || /^\d+$/.test(value)) {
                          setFormData({ ...formData, base_student_count: value });
                        }
                      }}
                      placeholder="예: 10"
                    />
                    <p className="text-xs text-gray-500 mt-1">이 인원까지는 기본급만 지급</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      추가 인원당 금액 <span className="text-xs text-gray-500">(원)</span>
                    </label>
                    <input
                      type="text"
                      className="w-full border dark:border-neutral-700 rounded-lg px-3 py-2 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
                      value={formData.additional_salary_per_student}
                      onChange={(e) => {
                        const formatted = formatNumberInput(e.target.value);
                        setFormData({ ...formData, additional_salary_per_student: formatted });
                      }}
                      placeholder="예: 5,000"
                    />
                    <p className="text-xs text-gray-500 mt-1">기본 인원 초과 시 인원당 추가 지급</p>
                  </div>
                </div>

                <div className="text-xs text-gray-500 dark:text-gray-400 bg-white dark:bg-neutral-900 p-2 rounded border border-gray-200 dark:border-neutral-700">
                  <p className="font-semibold mb-1">예시:</p>
                  <p>기본급: 50,000원, 기본 인원: 10명, 추가 인원당: 5,000원</p>
                  <p>→ 10명까지: 50,000원, 11명: 55,000원, 12명: 60,000원</p>
                  <p className="mt-2 text-gray-400">* 기본급만 있는 경우: 기본 인원 수와 추가 인원당 금액은 비워두세요</p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            {classData && (
              <button
                type="button"
                onClick={async () => {
                  if (!window.confirm('정말 이 클래스를 삭제하시겠습니까?')) return;
                  
                  setLoading(true);
                  const supabase = getSupabaseClient();
                  if (!supabase) {
                    alert('데이터베이스 연결에 실패했습니다.');
                    setLoading(false);
                    return;
                  }

                  try {
                    // 정규 수업인 경우 관련된 모든 스케줄과 recurring_schedule 삭제
                    if (isRegularClass) {
                      // recurring_schedule_id 찾기
                      const { data: schedules } = await supabase
                        .from('schedules')
                        .select('recurring_schedule_id')
                        .eq('class_id', classData.id)
                        .limit(1);
                      
                      if (schedules && schedules.length > 0 && schedules[0].recurring_schedule_id) {
                        // 관련된 모든 스케줄 삭제
                        const { error: scheduleDeleteError } = await supabase
                          .from('schedules')
                          .delete()
                          .eq('recurring_schedule_id', schedules[0].recurring_schedule_id);
                        
                        if (scheduleDeleteError) throw scheduleDeleteError;
                        
                        // recurring_schedule 삭제
                        const { error: recurringDeleteError } = await supabase
                          .from('recurring_schedules')
                          .delete()
                          .eq('id', schedules[0].recurring_schedule_id);
                        
                        if (recurringDeleteError) throw recurringDeleteError;
                      }
                    } else {
                      // 단일 수업인 경우 해당 스케줄만 삭제
                      const { error: scheduleDeleteError } = await supabase
                        .from('schedules')
                        .delete()
                        .eq('class_id', classData.id);
                      
                      if (scheduleDeleteError) throw scheduleDeleteError;
                    }
                    
                    // 클래스 삭제
                    const { error: classDeleteError } = await supabase
                      .from('classes')
                      .delete()
                      .eq('id', classData.id);
                    
                    if (classDeleteError) throw classDeleteError;
                    
                    alert('클래스가 삭제되었습니다.');
                    onClose();
                  } catch (error: any) {
                    console.error('Error deleting class:', error);
                    alert(`클래스 삭제에 실패했습니다: ${error.message}`);
                  } finally {
                    setLoading(false);
                  }
                }}
                disabled={loading}
                className="px-4 py-2 bg-red-600 dark:bg-red-500 text-white rounded-lg hover:bg-red-700 dark:hover:bg-red-600 transition-colors disabled:opacity-50"
              >
                삭제
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border dark:border-neutral-700 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors disabled:opacity-50"
            >
              {loading ? '저장 중...' : '저장'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

