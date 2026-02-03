"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { X, Repeat, Zap, Calendar, Tag, Users, ChevronLeft, ChevronRight, CheckCircle2, CheckSquare, Square, Plus, Ticket, Search, ChevronDown } from 'lucide-react';
import { getSupabaseClient } from '@/lib/utils/supabase-client';
import { generateSessionDates, formatDateToYMD, DAY_NAMES_KR } from '@/lib/utils/schedule-generator';
import { FreeAccessConfig } from '@/types/database';
import { ClassMasterModal } from '../class-masters/class-master-modal';
import { TicketModal } from '../products/ticket-modal';

interface RecurringScheduleModalProps {
  academyId: string;
  classMasters: any[];
  halls: any[];
  initialDate?: Date;
  onClose: () => void;
  onClassCreated?: () => void; // 클래스 생성 후 리프레시용
}

interface Instructor {
  id: string;
  name_kr: string | null;
  name_en: string | null;
}

export function RecurringScheduleModal({ academyId, classMasters, halls, initialDate, onClose, onClassCreated }: RecurringScheduleModalProps) {
  const [type, setType] = useState<'regular' | 'popup' | 'workshop'>('regular');
  const [currentStep, setCurrentStep] = useState(1);
  
  // 초기 날짜 설정
  const defaultDate = initialDate || new Date();
  const defaultDateStr = formatDateToYMD(defaultDate);
  const defaultEndDate = formatDateToYMD(new Date(defaultDate.getTime() + 30 * 24 * 60 * 60 * 1000));
  
  // 클래스 검색 및 선택 관련 상태
  const [classSearchQuery, setClassSearchQuery] = useState('');
  const [isClassDropdownOpen, setIsClassDropdownOpen] = useState(false);
  const [showClassMasterModal, setShowClassMasterModal] = useState(false);
  const [showTicketModal, setShowTicketModal] = useState(false);
  const classDropdownRef = useRef<HTMLDivElement>(null);
  
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
  
  // 정규 수업용 수강권 선택 상태
  const [regularSelectedTicketIds, setRegularSelectedTicketIds] = useState<string[]>([]);
  const [regularLinkedTicketIds, setRegularLinkedTicketIds] = useState<string[]>([]); // 기존 연결된 수강권

  // 팝업/워크샵용 폼 데이터
  const [popupData, setPopupData] = useState({
    title: '',
    genre: '',
    difficulty_level: '',
    price: 30000,
    instructor_name: '', // 강사 이름 직접 입력
    hall_id: '',
    popup_date: defaultDateStr,
    start_time: '14:00',
    end_time: '16:00',
    max_students: 30,
    // 무료 수강 가능 클래스 (팝업 전용)
    free_access_enabled: false,
    free_access_class_ids: [] as string[],
  });

  // 워크샵용 수강권 선택
  const [selectedTicketIds, setSelectedTicketIds] = useState<string[]>([]);
  const [availableTickets, setAvailableTickets] = useState<any[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(false);

  const [loading, setLoading] = useState(false);
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [loadingInstructors, setLoadingInstructors] = useState(true);

  const GENRES = ['Choreo', 'hiphop', 'locking', 'waacking', 'popping', 'krump', 'voguing', 'breaking(bboying)'];
  const DIFFICULTY_LEVELS = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'];

  // 강사 목록 로드
  useEffect(() => {
    loadInstructors();
  }, [academyId]);

  // 수강권 목록 로드 (정규 수업 및 워크샵용)
  useEffect(() => {
    if (type === 'workshop' || type === 'regular') {
      loadTickets();
    }
  }, [type, academyId]);

  // 클래스 선택 시 기존 연결된 수강권 로드
  useEffect(() => {
    if (formData.class_id && type === 'regular') {
      loadLinkedTickets(formData.class_id);
    }
  }, [formData.class_id, type]);

  // 클래스 드롭다운 외부 클릭 감지
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (classDropdownRef.current && !classDropdownRef.current.contains(event.target as Node)) {
        setIsClassDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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

  const loadTickets = useCallback(async () => {
    setLoadingTickets(true);
    const supabase = getSupabaseClient();
    if (!supabase) {
      setLoadingTickets(false);
      return;
    }

    try {
      // 해당 학원의 모든 판매 중인 수강권 조회
      const { data, error } = await supabase
        .from('tickets')
        .select('id, name, ticket_type, price, is_general, valid_days, total_count')
        .eq('academy_id', academyId)
        .eq('is_on_sale', true)
        .or('is_coupon.is.null,is_coupon.eq.false')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAvailableTickets(data || []);
    } catch (error) {
      console.error('Error loading tickets:', error);
      setAvailableTickets([]);
    } finally {
      setLoadingTickets(false);
    }
  }, [academyId]);

  // 클래스에 연결된 수강권 로드
  const loadLinkedTickets = async (classId: string) => {
    const supabase = getSupabaseClient();
    if (!supabase) return;

    try {
      const { data, error } = await supabase
        .from('ticket_classes')
        .select('ticket_id')
        .eq('class_id', classId);

      if (error) {
        console.error('Error loading linked tickets:', error);
        return;
      }

      if (data && data.length > 0) {
        const linkedIds = data.map((item: any) => item.ticket_id);
        setRegularLinkedTicketIds(linkedIds);
        setRegularSelectedTicketIds(linkedIds);
      } else {
        setRegularLinkedTicketIds([]);
        setRegularSelectedTicketIds([]);
      }
    } catch (error) {
      console.error('Error loading linked tickets:', error);
    }
  };

  // 선택된 클래스의 정보
  const selectedClass = classMasters.find(c => c.id === formData.class_id);

  // 정규 클래스만 필터링 (정규 수업 선택용)
  const regularClasses = classMasters.filter(c => {
    const classType = c.class_type || 'regular';
    return classType === 'regular' || classType === 'REGULAR';
  });

  // 검색 필터링된 정규 클래스 목록
  const filteredRegularClasses = regularClasses.filter(cls => {
    if (!classSearchQuery.trim()) return true;
    const query = classSearchQuery.toLowerCase();
    const title = (cls.title || '').toLowerCase();
    const instructorName = (cls.instructors?.name_kr || cls.instructors?.name_en || '').toLowerCase();
    return title.includes(query) || instructorName.includes(query);
  });

  // 정규 수업용 수강권 토글
  const toggleRegularTicket = (ticketId: string) => {
    setRegularSelectedTicketIds(prev =>
      prev.includes(ticketId)
        ? prev.filter(id => id !== ticketId)
        : [...prev, ticketId]
    );
  };

  // 정규 수업용 전체 수강권 선택/해제
  const handleSelectAllRegularTickets = () => {
    if (regularSelectedTicketIds.length === availableTickets.length) {
      setRegularSelectedTicketIds([]);
    } else {
      setRegularSelectedTicketIds(availableTickets.map(t => t.id));
    }
  };

  // 클래스 선택 핸들러
  const handleSelectClass = (cls: any) => {
    setFormData({
      ...formData,
      class_id: cls.id,
      instructor_id: cls.instructor_id || '',
    });
    setClassSearchQuery(cls.title || '');
    setIsClassDropdownOpen(false);
  };

  // 요일 토글
  const toggleDay = (dayIndex: number) => {
    setFormData(prev => ({
      ...prev,
      days_of_week: prev.days_of_week.includes(dayIndex)
        ? prev.days_of_week.filter(d => d !== dayIndex)
        : [...prev.days_of_week, dayIndex].sort(),
    }));
  };

  // 무료 수강 가능 클래스 토글
  const toggleFreeAccessClass = (classId: string) => {
    setPopupData(prev => ({
      ...prev,
      free_access_class_ids: prev.free_access_class_ids.includes(classId)
        ? prev.free_access_class_ids.filter(id => id !== classId)
        : [...prev.free_access_class_ids, classId],
    }));
  };

  // 수강권 토글 (워크샵용)
  const toggleTicket = (ticketId: string) => {
    setSelectedTicketIds(prev =>
      prev.includes(ticketId)
        ? prev.filter(id => id !== ticketId)
        : [...prev, ticketId]
    );
  };

  // 전체 수강권 선택/해제
  const handleSelectAllTickets = () => {
    if (selectedTicketIds.length === availableTickets.length) {
      setSelectedTicketIds([]);
    } else {
      setSelectedTicketIds(availableTickets.map(t => t.id));
    }
  };

  // Step 이동
  const handleNextStep = () => {
    if (currentStep === 1) {
      setCurrentStep(2);
    } else if (currentStep === 2) {
      // 유효성 검사
      if (type === 'regular') {
        if (!formData.class_id) {
          alert('클래스를 선택해주세요.');
          return;
        }
        if (formData.days_of_week.length === 0) {
          alert('요일을 선택해주세요.');
          return;
        }
      } else {
        if (!popupData.title.trim()) {
          alert('수업 제목을 입력해주세요.');
          return;
        }
        if (!popupData.instructor_name.trim()) {
          alert('강사 이름을 입력해주세요.');
          return;
        }
      }
      setCurrentStep(3);
    }
  };

  const handlePrevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = async () => {
    // Step 3이 아니면 제출하지 않음
    if (currentStep !== 3) {
      console.log('handleSubmit called but not on Step 3, currentStep:', currentStep);
      return;
    }

    // 팝업/워크샵의 경우 필수 데이터 재검증
    if (type === 'popup' || type === 'workshop') {
      if (!popupData.title.trim()) {
        alert('수업 제목을 입력해주세요.');
        setCurrentStep(2);
        return;
      }
      if (!popupData.instructor_name.trim()) {
        alert('강사 이름을 입력해주세요.');
        setCurrentStep(2);
        return;
      }
    } else if (type === 'regular') {
      if (!formData.class_id) {
        alert('클래스를 선택해주세요.');
        setCurrentStep(2);
        return;
      }
      if (formData.days_of_week.length === 0) {
        alert('요일을 선택해주세요.');
        setCurrentStep(2);
        return;
      }
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
        // 팝업 생성
        const freeAccessConfig: FreeAccessConfig | null = 
          popupData.free_access_enabled && popupData.free_access_class_ids.length > 0
            ? {
                enabled: true,
                target_class_ids: popupData.free_access_class_ids,
              }
            : null;

        // 1. classes 테이블에 팝업 클래스 생성
        const { data: newClass, error: classError } = await supabase
          .from('classes')
          .insert({
            academy_id: academyId,
            title: popupData.title,
            genre: popupData.genre || null,
            difficulty_level: popupData.difficulty_level || null,
            class_type: 'popup',
            price: popupData.price,
            instructor_id: null, // 강사는 이름만 저장
            hall_id: popupData.hall_id || null,
            max_students: popupData.max_students,
            is_active: true,
            access_config: {
              requiredGroup: null,
              allowRegularTicket: false,
              allowCoupon: true,
              allowPopup: true,
              allowWorkshop: false,
            },
            free_access_config: freeAccessConfig,
          })
          .select('id')
          .single();

        if (classError) throw classError;

        // 시간 검증
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
            instructor_id: null,
            start_time: startDateTime.toISOString(),
            end_time: endDateTime.toISOString(),
            max_students: popupData.max_students,
            current_students: 0,
            is_canceled: false,
            recurring_schedule_id: null,
          });

        if (scheduleError) throw scheduleError;
        alert('팝업 클래스가 생성되었습니다!');

      } else if (type === 'workshop') {
        // 워크샵 생성
        // 1. classes 테이블에 워크샵 클래스 생성
        const { data: newClass, error: classError } = await supabase
          .from('classes')
          .insert({
            academy_id: academyId,
            title: popupData.title,
            genre: popupData.genre || null,
            difficulty_level: popupData.difficulty_level || null,
            class_type: 'workshop',
            price: popupData.price,
            instructor_id: null,
            hall_id: popupData.hall_id || null,
            max_students: popupData.max_students,
            is_active: true,
            access_config: {
              requiredGroup: null,
              allowRegularTicket: false,
              allowCoupon: false,
              allowPopup: false,
              allowWorkshop: true,
            },
          })
          .select('id')
          .single();

        if (classError) throw classError;

        // 시간 검증
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
            instructor_id: null,
            start_time: startDateTime.toISOString(),
            end_time: endDateTime.toISOString(),
            max_students: popupData.max_students,
            current_students: 0,
            is_canceled: false,
            recurring_schedule_id: null,
          });

        if (scheduleError) throw scheduleError;

        // 3. ticket_classes 테이블에 수강권 연결
        if (selectedTicketIds.length > 0) {
          const linkData = selectedTicketIds.map(ticketId => ({
            ticket_id: ticketId,
            class_id: newClass.id,
          }));

          const { error: linkError } = await supabase
            .from('ticket_classes')
            .insert(linkData);

          if (linkError) {
            console.error('Error linking tickets:', linkError);
          }
        }

        alert(`워크샵이 생성되었습니다!${selectedTicketIds.length > 0 ? `\n${selectedTicketIds.length}개의 수강권이 연결되었습니다.` : ''}`);

      } else {
        // 정규 수업 생성
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

        // 수강권 연결 업데이트 (선택된 수강권이 기존과 다른 경우)
        const hasChanges = 
          regularSelectedTicketIds.length !== regularLinkedTicketIds.length ||
          !regularSelectedTicketIds.every(id => regularLinkedTicketIds.includes(id));

        if (hasChanges) {
          // 기존 연결 삭제
          await supabase
            .from('ticket_classes')
            .delete()
            .eq('class_id', formData.class_id);

          // 새 연결 저장
          if (regularSelectedTicketIds.length > 0) {
            const linkData = regularSelectedTicketIds.map(ticketId => ({
              ticket_id: ticketId,
              class_id: formData.class_id,
            }));

            const { error: linkError } = await supabase
              .from('ticket_classes')
              .insert(linkData);

            if (linkError) {
              console.error('Error linking tickets:', linkError);
            }
          }
        }

        const ticketMessage = regularSelectedTicketIds.length > 0
          ? `\n${regularSelectedTicketIds.length}개의 수강권이 연결되었습니다.`
          : '';
        alert(`스케줄 ${dates.length}건이 생성되었습니다!${ticketMessage}`);
      }

      onClose();
    } catch (error: any) {
      console.error('Error creating schedule:', error);
      alert(`스케줄 생성에 실패했습니다: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Step 표시기 렌더링
  const renderStepIndicator = () => (
    <div className="flex items-center justify-center mb-6 px-6 pt-4">
      {[1, 2, 3].map((step) => (
        <div key={step} className="flex items-center">
          <div className={`flex flex-col items-center ${currentStep >= step ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400'}`}>
            <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 ${
              currentStep > step 
                ? 'bg-blue-600 dark:bg-blue-500 border-blue-600 dark:border-blue-500 text-white' 
                : currentStep === step
                ? 'border-blue-600 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-neutral-900 text-gray-400'
            }`}>
              {currentStep > step ? (
                <CheckCircle2 size={20} />
              ) : (
                <span className="font-semibold">{step}</span>
              )}
            </div>
            <span className="text-xs mt-1 font-medium">
              {step === 1 ? '유형 선택' : step === 2 ? '기본 정보' : '수강 설정'}
            </span>
          </div>
          {step < 3 && (
            <div className={`w-16 h-0.5 mx-2 ${currentStep > step ? 'bg-blue-600 dark:bg-blue-400' : 'bg-gray-300 dark:bg-gray-600'}`} />
          )}
        </div>
      ))}
    </div>
  );

  // Step 1: 유형 선택
  const renderStep1 = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">스케줄 유형 선택</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">생성할 스케줄의 유형을 선택해주세요.</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <button
          type="button"
          onClick={() => setType('regular')}
          className={`p-6 rounded-xl border-2 flex flex-col items-center gap-3 transition-all ${
            type === 'regular'
              ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-500 text-blue-700 dark:text-blue-400 shadow-lg scale-105'
              : 'bg-gray-50 dark:bg-neutral-800 border-gray-200 dark:border-neutral-700 hover:border-blue-300 dark:hover:border-blue-700'
          }`}
        >
          <Repeat className="w-8 h-8" />
          <span className="font-bold text-lg">Regular</span>
          <span className="text-xs text-gray-500 dark:text-gray-400 text-center">정규 반복 수업<br/>기존 클래스(반) 선택</span>
        </button>

        <button
          type="button"
          onClick={() => setType('popup')}
          className={`p-6 rounded-xl border-2 flex flex-col items-center gap-3 transition-all ${
            type === 'popup'
              ? 'bg-purple-50 dark:bg-purple-900/20 border-purple-500 text-purple-700 dark:text-purple-400 shadow-lg scale-105'
              : 'bg-gray-50 dark:bg-neutral-800 border-gray-200 dark:border-neutral-700 hover:border-purple-300 dark:hover:border-purple-700'
          }`}
        >
          <Zap className="w-8 h-8" />
          <span className="font-bold text-lg">Popup</span>
          <span className="text-xs text-gray-500 dark:text-gray-400 text-center">1회성 팝업 수업<br/>Popup 수강권으로 수강</span>
        </button>

        <button
          type="button"
          onClick={() => setType('workshop')}
          className={`p-6 rounded-xl border-2 flex flex-col items-center gap-3 transition-all ${
            type === 'workshop'
              ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-500 text-amber-700 dark:text-amber-400 shadow-lg scale-105'
              : 'bg-gray-50 dark:bg-neutral-800 border-gray-200 dark:border-neutral-700 hover:border-amber-300 dark:hover:border-amber-700'
          }`}
        >
          <Tag className="w-8 h-8" />
          <span className="font-bold text-lg">Workshop</span>
          <span className="text-xs text-gray-500 dark:text-gray-400 text-center">집중 워크샵<br/>특정 수강권 필요</span>
        </button>
      </div>
    </div>
  );

  // Step 2: 기본 정보 입력
  const renderStep2 = () => {
    if (type === 'regular') {
      return (
        <div className="space-y-6">
          <div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">정규 수업 설정</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">반복 스케줄의 기본 정보를 설정해주세요.</p>
          </div>

          {/* 클래스 선택 - 검색+드롭다운 */}
          <div ref={classDropdownRef}>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              클래스(반) 선택 *
            </label>
            <div className="relative">
              <div className="relative">
                <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="클래스명 또는 강사명으로 검색..."
                  className="w-full border dark:border-neutral-700 rounded-lg pl-11 pr-10 py-3 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  value={classSearchQuery}
                  onChange={(e) => {
                    setClassSearchQuery(e.target.value);
                    setIsClassDropdownOpen(true);
                    // 검색 중에는 선택 해제
                    if (formData.class_id && e.target.value !== selectedClass?.title) {
                      setFormData({ ...formData, class_id: '' });
                    }
                  }}
                  onFocus={() => setIsClassDropdownOpen(true)}
                />
                <button
                  type="button"
                  onClick={() => setIsClassDropdownOpen(!isClassDropdownOpen)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <ChevronDown size={20} className={`transition-transform ${isClassDropdownOpen ? 'rotate-180' : ''}`} />
                </button>
              </div>

              {/* 드롭다운 목록 */}
              {isClassDropdownOpen && (
                <div className="absolute z-20 w-full mt-1 bg-white dark:bg-neutral-900 border dark:border-neutral-700 rounded-lg shadow-lg max-h-64 overflow-y-auto">
                  {/* 새 클래스 만들기 버튼 */}
                  <button
                    type="button"
                    onClick={() => {
                      setShowClassMasterModal(true);
                      setIsClassDropdownOpen(false);
                    }}
                    className="w-full px-4 py-3 flex items-center gap-3 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 border-b dark:border-neutral-700 font-medium"
                  >
                    <Plus size={20} />
                    새 클래스(반) 만들기
                  </button>

                  {filteredRegularClasses.length === 0 ? (
                    <div className="px-4 py-6 text-center text-gray-500 dark:text-gray-400">
                      {classSearchQuery ? (
                        <>
                          <p className="font-medium">검색 결과가 없습니다</p>
                          <p className="text-sm mt-1">새 클래스를 만들어보세요</p>
                        </>
                      ) : (
                        <>
                          <p className="font-medium">등록된 정규 클래스가 없습니다</p>
                          <p className="text-sm mt-1">위 버튼을 눌러 클래스를 만들어주세요</p>
                        </>
                      )}
                    </div>
                  ) : (
                    filteredRegularClasses.map((cls) => (
                      <div
                        key={cls.id}
                        onClick={() => handleSelectClass(cls)}
                        className={`px-4 py-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-neutral-800 border-b dark:border-neutral-700 last:border-b-0 ${
                          formData.class_id === cls.id ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                        }`}
                      >
                        <div className="font-medium text-gray-900 dark:text-white">
                          {cls.title}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2">
                          <span>{cls.instructors?.name_kr || cls.instructors?.name_en || '강사 미지정'}</span>
                          {cls.genre && (
                            <span className="px-1.5 py-0.5 bg-gray-100 dark:bg-neutral-700 rounded text-xs">
                              {cls.genre}
                            </span>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* 선택된 클래스 표시 */}
            {selectedClass && (
              <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-blue-700 dark:text-blue-400">{selectedClass.title}</p>
                    <p className="text-sm text-blue-600 dark:text-blue-500">
                      {selectedClass.instructors?.name_kr || selectedClass.instructors?.name_en || '강사 미지정'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setFormData({ ...formData, class_id: '' });
                      setClassSearchQuery('');
                      setRegularSelectedTicketIds([]);
                      setRegularLinkedTicketIds([]);
                    }}
                    className="text-blue-400 hover:text-blue-600"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 홀 선택 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              홀
            </label>
            <select
              className="w-full border dark:border-neutral-700 rounded-lg px-4 py-3 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
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
                  className={`w-10 h-10 rounded-full text-sm font-bold transition-colors ${
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
                  className="w-full border dark:border-neutral-700 rounded px-3 py-2 text-sm bg-white dark:bg-neutral-900"
                  value={formData.start_date}
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">종료일</label>
                <input
                  type="date"
                  required
                  className="w-full border dark:border-neutral-700 rounded px-3 py-2 text-sm bg-white dark:bg-neutral-900"
                  value={formData.end_date}
                  onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                />
              </div>
            </div>
          </div>

          {/* 시간 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                시작 시간 *
              </label>
              <input
                type="time"
                required
                className="w-full border dark:border-neutral-700 rounded-lg px-4 py-3 bg-white dark:bg-neutral-900"
                value={formData.start_time}
                onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                종료 시간 *
              </label>
              <input
                type="time"
                required
                className="w-full border dark:border-neutral-700 rounded-lg px-4 py-3 bg-white dark:bg-neutral-900"
                value={formData.end_time}
                onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
              />
            </div>
          </div>

          {/* 최대 인원 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              최대 인원
            </label>
            <input
              type="number"
              min="1"
              className="w-full border dark:border-neutral-700 rounded-lg px-4 py-3 bg-white dark:bg-neutral-900"
              value={formData.max_students}
              onChange={(e) => setFormData({ ...formData, max_students: parseInt(e.target.value) || 20 })}
            />
          </div>

          {/* 미리보기 */}
          {formData.days_of_week.length > 0 && (
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg text-sm text-blue-700 dark:text-blue-400 flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              <span>생성될 스케줄: 약 <strong>{
                generateSessionDates(
                  new Date(formData.start_date),
                  new Date(formData.end_date),
                  formData.days_of_week,
                  formData.interval_weeks
                ).length
              }건</strong></span>
            </div>
          )}
        </div>
      );
    }

    // Popup / Workshop 기본 정보
    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
            {type === 'popup' ? '팝업 클래스' : '워크샵'} 정보
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {type === 'popup' ? '팝업 클래스' : '워크샵'}의 기본 정보를 입력해주세요.
          </p>
        </div>

        {/* 수업 제목 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            수업 제목 *
          </label>
          <input
            type="text"
            required
            placeholder={type === 'popup' ? '예: 특별 팝업 클래스' : '예: 살사 기초 워크샵'}
            className="w-full border dark:border-neutral-700 rounded-lg px-4 py-3 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
            value={popupData.title}
            onChange={(e) => setPopupData({ ...popupData, title: e.target.value })}
          />
        </div>

        {/* 강사 이름 (직접 입력) */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            강사 *
          </label>
          <input
            type="text"
            required
            placeholder="강사 이름을 입력하세요"
            className="w-full border dark:border-neutral-700 rounded-lg px-4 py-3 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
            value={popupData.instructor_name}
            onChange={(e) => setPopupData({ ...popupData, instructor_name: e.target.value })}
          />
        </div>

        {/* 장르, 난이도 */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              장르
            </label>
            <select
              className="w-full border dark:border-neutral-700 rounded-lg px-4 py-3 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
              value={popupData.genre}
              onChange={(e) => setPopupData({ ...popupData, genre: e.target.value })}
            >
              <option value="">선택 안함</option>
              {GENRES.map((genre) => (
                <option key={genre} value={genre}>{genre}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              난이도
            </label>
            <select
              className="w-full border dark:border-neutral-700 rounded-lg px-4 py-3 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
              value={popupData.difficulty_level}
              onChange={(e) => setPopupData({ ...popupData, difficulty_level: e.target.value })}
            >
              <option value="">선택 안함</option>
              {DIFFICULTY_LEVELS.map((level) => (
                <option key={level} value={level}>
                  {level === 'BEGINNER' ? '초급' : level === 'INTERMEDIATE' ? '중급' : '고급'}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 홀 선택 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            홀
          </label>
          <select
            className="w-full border dark:border-neutral-700 rounded-lg px-4 py-3 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
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
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            날짜 *
          </label>
          <input
            type="date"
            required
            className="w-full border dark:border-neutral-700 rounded-lg px-4 py-3 bg-white dark:bg-neutral-900"
            value={popupData.popup_date}
            onChange={(e) => setPopupData({ ...popupData, popup_date: e.target.value })}
          />
        </div>

        {/* 시간 */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              시작 시간 *
            </label>
            <input
              type="time"
              required
              className="w-full border dark:border-neutral-700 rounded-lg px-4 py-3 bg-white dark:bg-neutral-900"
              value={popupData.start_time}
              onChange={(e) => setPopupData({ ...popupData, start_time: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              종료 시간 *
            </label>
            <input
              type="time"
              required
              className="w-full border dark:border-neutral-700 rounded-lg px-4 py-3 bg-white dark:bg-neutral-900"
              value={popupData.end_time}
              onChange={(e) => setPopupData({ ...popupData, end_time: e.target.value })}
            />
          </div>
        </div>

        {/* 최대 인원 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            최대 인원
          </label>
          <input
            type="number"
            min="1"
            className="w-full border dark:border-neutral-700 rounded-lg px-4 py-3 bg-white dark:bg-neutral-900"
            value={popupData.max_students}
            onChange={(e) => setPopupData({ ...popupData, max_students: parseInt(e.target.value) || 30 })}
          />
        </div>
      </div>
    );
  };

  // Step 3: 수강 설정
  const renderStep3 = () => {
    if (type === 'regular') {
      // 정규 수업 - 수강권 선택 UI 추가
      return (
        <div className="space-y-6">
          <div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">수강권 설정</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">이 수업을 수강할 수 있는 수강권을 선택해주세요.</p>
          </div>

          {/* 스케줄 요약 */}
          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-200 dark:border-blue-800">
            <div className="flex items-center gap-3 mb-3">
              <Repeat className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <div>
                <p className="font-bold text-gray-900 dark:text-white text-sm">
                  {selectedClass?.title || '클래스 선택됨'}
                </p>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  {selectedClass?.instructors?.name_kr || selectedClass?.instructors?.name_en || '강사 미지정'}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 dark:text-gray-400">
              <div>기간: {formData.start_date} ~ {formData.end_date}</div>
              <div>요일: {formData.days_of_week.map(d => DAY_NAMES_KR[d]).join(', ')}</div>
              <div>시간: {formData.start_time} ~ {formData.end_time}</div>
              <div className="font-bold text-blue-600 dark:text-blue-400">
                스케줄 {generateSessionDates(
                  new Date(formData.start_date),
                  new Date(formData.end_date),
                  formData.days_of_week,
                  formData.interval_weeks
                ).length}건
              </div>
            </div>
          </div>

          {/* 수강권 선택 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
              <Ticket size={16} /> 이 수업을 수강할 수 있는 수강권
            </label>

            {loadingTickets ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                <p>수강권 목록을 불러오는 중...</p>
              </div>
            ) : availableTickets.length === 0 ? (
              <div className="space-y-3">
                <div className="bg-amber-50 dark:bg-amber-900/20 border-2 border-amber-200 dark:border-amber-800 rounded-xl p-6 text-center">
                  <Ticket size={32} className="mx-auto mb-3 text-amber-600 dark:text-amber-400" />
                  <p className="text-sm font-medium text-amber-700 dark:text-amber-400 mb-1">
                    등록된 수강권이 없습니다
                  </p>
                  <p className="text-xs text-amber-600 dark:text-amber-500">
                    아래 버튼을 눌러 새 수강권을 만들어주세요.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowTicketModal(true)}
                  className="w-full py-3 border-2 border-blue-400 dark:border-blue-600 bg-blue-50 dark:bg-blue-900/20 rounded-xl text-blue-600 dark:text-blue-400 text-sm font-medium hover:bg-blue-100 dark:hover:bg-blue-900/30 flex items-center justify-center gap-2 transition-all"
                >
                  <Plus size={18} /> 새 수강권 만들기
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {/* 전체 선택 */}
                <div
                  onClick={handleSelectAllRegularTickets}
                  className="flex items-center gap-3 p-4 bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 border-2 border-blue-200 dark:border-blue-800 rounded-xl cursor-pointer hover:from-blue-100 hover:to-blue-200 dark:hover:from-blue-900/30 dark:hover:to-blue-800/30 transition-all"
                >
                  {regularSelectedTicketIds.length === availableTickets.length ? (
                    <CheckSquare size={24} className="text-blue-600 dark:text-blue-400 shrink-0" />
                  ) : regularSelectedTicketIds.length > 0 ? (
                    <div className="w-6 h-6 border-2 border-blue-600 dark:border-blue-400 bg-blue-600 dark:bg-blue-500 rounded flex items-center justify-center">
                      <div className="w-3 h-0.5 bg-white" />
                    </div>
                  ) : (
                    <Square size={24} className="text-gray-400 shrink-0" />
                  )}
                  <div className="flex-1">
                    <span className="font-semibold text-gray-900 dark:text-white block">
                      전체 선택
                    </span>
                    <span className="text-xs text-gray-600 dark:text-gray-400">
                      모든 수강권을 선택/해제합니다
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-bold text-blue-600 dark:text-blue-400 block">
                      {regularSelectedTicketIds.length} / {availableTickets.length}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">선택됨</span>
                  </div>
                </div>

                {/* 수강권 목록 */}
                <div className="grid gap-2 max-h-48 overflow-y-auto pr-2">
                  {availableTickets.map((ticket) => {
                    const isSelected = regularSelectedTicketIds.includes(ticket.id);
                    return (
                      <div
                        key={ticket.id}
                        onClick={() => toggleRegularTicket(ticket.id)}
                        className={`flex items-center gap-3 p-3 border-2 rounded-xl cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-400 dark:border-blue-600'
                            : 'bg-white dark:bg-neutral-900 border-gray-200 dark:border-neutral-700 hover:border-blue-300 dark:hover:border-blue-700'
                        }`}
                      >
                        {isSelected ? (
                          <CheckSquare size={20} className="text-blue-600 dark:text-blue-400 shrink-0" />
                        ) : (
                          <Square size={20} className="text-gray-400 shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-gray-900 dark:text-white truncate text-sm">
                            {ticket.name}
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            {ticket.is_general && (
                              <span className="px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded text-xs">
                                전체 이용
                              </span>
                            )}
                            {ticket.ticket_type === 'PERIOD' && ticket.valid_days && (
                              <span className="px-1.5 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded text-xs">
                                {ticket.valid_days}일
                              </span>
                            )}
                            {ticket.ticket_type === 'COUNT' && ticket.total_count && (
                              <span className="px-1.5 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded text-xs">
                                {ticket.total_count}회
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* 새 수강권 만들기 */}
                <button
                  type="button"
                  onClick={() => setShowTicketModal(true)}
                  className="w-full py-3 border-2 border-gray-300 dark:border-neutral-700 border-dashed rounded-xl text-gray-500 dark:text-gray-400 text-sm hover:bg-gray-50 dark:hover:bg-neutral-800 hover:border-blue-400 dark:hover:border-blue-600 flex items-center justify-center gap-2 transition-all"
                >
                  <Plus size={18} /> 새 수강권 만들기
                </button>
              </div>
            )}
          </div>

          {/* 선택 상태 요약 */}
          {availableTickets.length > 0 && (
            <div className={`p-4 rounded-xl border-2 ${
              regularSelectedTicketIds.length > 0
                ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
                : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
            }`}>
              {regularSelectedTicketIds.length > 0 ? (
                <div className="flex items-start gap-2">
                  <CheckSquare size={18} className="text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-blue-700 dark:text-blue-400">
                      {regularSelectedTicketIds.length}개의 수강권이 선택되었습니다
                    </p>
                    <p className="text-xs text-blue-600 dark:text-blue-500 mt-1">
                      선택한 수강권으로 이 수업을 수강할 수 있습니다.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-2">
                  <Square size={18} className="text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
                      수강권이 선택되지 않았습니다
                    </p>
                    <p className="text-xs text-amber-600 dark:text-amber-500 mt-1">
                      수강권을 선택하지 않으면 이 수업은 어떤 수강권으로도 수강할 수 없습니다.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      );
    }

    if (type === 'popup') {
      return (
        <div className="space-y-6">
          <div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">팝업 클래스 수강 설정</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">무료 수강 조건을 설정해주세요. 가격은 수강권(상품)에서 설정합니다.</p>
          </div>

          {/* 무료 수강 설정 */}
          <div className="bg-green-50 dark:bg-green-900/10 p-5 rounded-xl border-2 border-green-200 dark:border-green-800 space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                <Users size={18} className="text-green-600" />
                기간제 수강권 보유자 무료 수강
              </label>
              <button
                type="button"
                onClick={() => setPopupData({ ...popupData, free_access_enabled: !popupData.free_access_enabled })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  popupData.free_access_enabled ? 'bg-green-600' : 'bg-gray-300 dark:bg-neutral-600'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    popupData.free_access_enabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {popupData.free_access_enabled && (
              <>
                <p className="text-xs text-green-700 dark:text-green-400">
                  아래에서 선택한 정규 클래스의 기간제 수강권을 보유한 회원은 이 팝업을 무료로 수강할 수 있습니다.
                </p>

                <div className="max-h-48 overflow-y-auto border dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-900">
                  {regularClasses.length === 0 ? (
                    <div className="p-4 text-sm text-gray-400 text-center">
                      등록된 정규 클래스가 없습니다.
                    </div>
                  ) : (
                    regularClasses.map((cls) => {
                      const isSelected = popupData.free_access_class_ids.includes(cls.id);
                      return (
                        <div
                          key={cls.id}
                          onClick={() => toggleFreeAccessClass(cls.id)}
                          className="flex items-center gap-3 p-3 border-b dark:border-neutral-700 last:border-b-0 cursor-pointer hover:bg-gray-50 dark:hover:bg-neutral-800"
                        >
                          {isSelected ? (
                            <CheckSquare size={20} className="text-green-600 dark:text-green-400 shrink-0" />
                          ) : (
                            <Square size={20} className="text-gray-400 shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-900 dark:text-white truncate">
                              {cls.title}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {cls.instructors?.name_kr || cls.instructors?.name_en || '강사 미지정'}
                            </p>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {popupData.free_access_class_ids.length > 0 && (
                  <p className="text-xs text-green-600 dark:text-green-400 font-medium">
                    {popupData.free_access_class_ids.length}개의 정규 클래스 기간제 수강권 보유자가 무료 수강 가능
                  </p>
                )}
              </>
            )}

            {!popupData.free_access_enabled && (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                활성화하면 특정 정규 클래스 기간제 수강권 보유자가 이 팝업을 무료로 수강할 수 있습니다.
              </p>
            )}
          </div>

          {/* 안내 */}
          <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg text-sm text-purple-700 dark:text-purple-400">
            <p className="flex items-center gap-2">
              <Zap size={16} />
              Popup 클래스는 <strong>Popup 수강권</strong>으로 신청 가능합니다.
            </p>
          </div>
        </div>
      );
    }

    // Workshop
    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">워크샵(특강) 수강권 설정</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">이 워크샵을 수강할 수 있는 수강권을 선택해주세요. 가격은 수강권(상품)에서 설정합니다.</p>
        </div>

        {/* 수강권 선택 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
            <Ticket size={16} /> 이 워크샵을 수강할 수 있는 수강권
          </label>

          {loadingTickets ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600 mx-auto mb-2"></div>
              <p>수강권 목록을 불러오는 중...</p>
            </div>
          ) : availableTickets.length === 0 ? (
            <div className="bg-amber-50 dark:bg-amber-900/20 border-2 border-amber-200 dark:border-amber-800 rounded-xl p-6 text-center">
              <Ticket size={32} className="mx-auto mb-3 text-amber-600 dark:text-amber-400" />
              <p className="text-sm font-medium text-amber-700 dark:text-amber-400 mb-1">
                등록된 수강권이 없습니다
              </p>
              <p className="text-xs text-amber-600 dark:text-amber-500">
                상품 관리에서 수강권을 먼저 등록해주세요.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* 전체 선택 */}
              <div
                onClick={handleSelectAllTickets}
                className="flex items-center gap-3 p-4 bg-gradient-to-r from-amber-50 to-amber-100 dark:from-amber-900/20 dark:to-amber-800/20 border-2 border-amber-200 dark:border-amber-800 rounded-xl cursor-pointer hover:from-amber-100 hover:to-amber-200 dark:hover:from-amber-900/30 dark:hover:to-amber-800/30 transition-all"
              >
                {selectedTicketIds.length === availableTickets.length ? (
                  <CheckSquare size={24} className="text-amber-600 dark:text-amber-400 shrink-0" />
                ) : selectedTicketIds.length > 0 ? (
                  <div className="w-6 h-6 border-2 border-amber-600 dark:border-amber-400 bg-amber-600 dark:bg-amber-500 rounded flex items-center justify-center">
                    <div className="w-3 h-0.5 bg-white" />
                  </div>
                ) : (
                  <Square size={24} className="text-gray-400 shrink-0" />
                )}
                <div className="flex-1">
                  <span className="font-semibold text-gray-900 dark:text-white block">
                    전체 선택
                  </span>
                  <span className="text-xs text-gray-600 dark:text-gray-400">
                    모든 수강권을 선택/해제합니다
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-lg font-bold text-amber-600 dark:text-amber-400 block">
                    {selectedTicketIds.length} / {availableTickets.length}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">선택됨</span>
                </div>
              </div>

              {/* 수강권 목록 */}
              <div className="grid gap-3 max-h-64 overflow-y-auto pr-2">
                {availableTickets.map((ticket) => {
                  const isSelected = selectedTicketIds.includes(ticket.id);
                  return (
                    <div
                      key={ticket.id}
                      onClick={() => toggleTicket(ticket.id)}
                      className={`flex items-center gap-4 p-4 border-2 rounded-xl cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-400 dark:border-amber-600 shadow-md'
                          : 'bg-white dark:bg-neutral-900 border-gray-200 dark:border-neutral-700 hover:border-amber-300 dark:hover:border-amber-700 hover:shadow-sm'
                      }`}
                    >
                      {isSelected ? (
                        <CheckSquare size={22} className="text-amber-600 dark:text-amber-400 shrink-0" />
                      ) : (
                        <Square size={22} className="text-gray-400 shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-gray-900 dark:text-white mb-1 truncate">
                          {ticket.name}
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          {ticket.is_general && (
                            <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-md text-xs font-medium">
                              전체 이용
                            </span>
                          )}
                          {ticket.ticket_type === 'PERIOD' && ticket.valid_days && (
                            <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-md text-xs">
                              {ticket.valid_days}일
                            </span>
                          )}
                          {ticket.ticket_type === 'COUNT' && ticket.total_count && (
                            <span className="px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded-md text-xs">
                              {ticket.total_count}회
                            </span>
                          )}
                          {ticket.price && (
                            <span className="px-2 py-1 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-md text-xs font-medium">
                              {ticket.price.toLocaleString()}원
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* 선택 상태 요약 */}
        {availableTickets.length > 0 && (
          <div className={`p-4 rounded-xl border-2 ${
            selectedTicketIds.length > 0
              ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
              : 'bg-gray-50 dark:bg-neutral-800 border-gray-200 dark:border-neutral-700'
          }`}>
            {selectedTicketIds.length > 0 ? (
              <div className="flex items-start gap-2">
                <CheckSquare size={18} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
                    {selectedTicketIds.length}개의 수강권이 선택되었습니다
                  </p>
                  <p className="text-xs text-amber-600 dark:text-amber-500 mt-1">
                    선택한 수강권으로 이 워크샵을 수강할 수 있습니다.
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-2">
                <Square size={18} className="text-gray-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    수강권이 선택되지 않았습니다
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    수강권을 선택하지 않으면 이 워크샵은 어떤 수강권으로도 수강할 수 없습니다.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 안내 */}
        <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-lg text-sm text-amber-700 dark:text-amber-400">
          <p className="flex items-center gap-2">
            <Tag size={16} />
            Workshop은 선택한 <strong>수강권</strong>을 보유한 회원만 신청 가능합니다.
          </p>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 dark:bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b dark:border-neutral-800 flex justify-between items-center sticky top-0 bg-white dark:bg-neutral-900 z-10">
          <h3 className="text-xl font-bold text-gray-800 dark:text-white">
            스케줄 생성
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <X size={20} />
          </button>
        </div>

        {/* Step Indicator */}
        {renderStepIndicator()}

        <div className="p-6">
          <div className="space-y-6">
            {/* Step Content */}
            {currentStep === 1 && renderStep1()}
            {currentStep === 2 && renderStep2()}
            {currentStep === 3 && renderStep3()}

            {/* Navigation Buttons */}
            <div className="flex gap-3 pt-6 border-t dark:border-neutral-800">
              {currentStep > 1 && (
                <button
                  type="button"
                  onClick={handlePrevStep}
                  className="flex items-center gap-2 px-6 py-3 border dark:border-neutral-700 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors"
                >
                  <ChevronLeft size={20} />
                  이전
                </button>
              )}
              <div className="flex-1" />
              {currentStep < 3 ? (
                <button
                  type="button"
                  onClick={handleNextStep}
                  className={`flex items-center gap-2 px-6 py-3 text-white rounded-lg transition-colors ${
                    type === 'regular'
                      ? 'bg-blue-600 hover:bg-blue-700'
                      : type === 'popup'
                      ? 'bg-purple-600 hover:bg-purple-700'
                      : 'bg-amber-600 hover:bg-amber-700'
                  }`}
                >
                  다음
                  <ChevronRight size={20} />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={loading}
                  className={`flex items-center gap-2 px-6 py-3 text-white rounded-lg font-bold transition-colors disabled:opacity-50 ${
                    type === 'regular'
                      ? 'bg-blue-600 hover:bg-blue-700'
                      : type === 'popup'
                      ? 'bg-purple-600 hover:bg-purple-700'
                      : 'bg-amber-600 hover:bg-amber-700'
                  }`}
                >
                  {loading ? '생성 중...' : (
                    type === 'regular' ? '스케줄 생성' : 
                    type === 'popup' ? 'Popup 생성' : 'Workshop 생성'
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 클래스 생성 모달 */}
      {showClassMasterModal && (
        <ClassMasterModal
          academyId={academyId}
          onClose={() => {
            setShowClassMasterModal(false);
            // 클래스 생성 후 부모 컴포넌트에 알림
            onClassCreated?.();
          }}
        />
      )}

      {/* 수강권 생성 모달 */}
      {showTicketModal && (
        <TicketModal
          academyId={academyId}
          ticket={null}
          onClose={() => {
            setShowTicketModal(false);
            // 수강권 생성 후 목록 새로고침
            loadTickets();
          }}
        />
      )}
    </div>
  );
}
