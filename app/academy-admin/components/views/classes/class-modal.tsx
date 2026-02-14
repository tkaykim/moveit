"use client";

import { useState, useEffect, useCallback } from 'react';
import { X, Ticket, CheckSquare, Square, ChevronLeft, ChevronRight, CheckCircle2, Info, Plus } from 'lucide-react';
import { getSupabaseClient } from '@/lib/utils/supabase-client';
import { TicketModal } from '../products/ticket-modal';
import { ImageUpload } from '@/components/common/image-upload';
import { uploadFile, deleteFile, extractFilePathFromUrl } from '@/lib/utils/storage';
// import { InstructorSelector } from './instructor-selector';
import { convertUTCToKSTForInput, convertKSTInputToUTC, dateToKSTInput } from '@/lib/utils/kst-time';
import { formatNumberInput, parseNumberFromString, formatNumberWithCommas } from '@/lib/utils/number-format';

interface ClassModalProps {
  academyId: string;
  classData?: any;
  defaultDate?: Date;
  defaultHallId?: string;
  onClose: () => void;
}

const GENRES = ['Choreo', 'hiphop', 'locking', 'waacking', 'popping', 'krump', 'voguing', 'breaking(bboying)', 'heels', 'kpop', 'house', '기타'];
const DIFFICULTY_LEVELS = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'];
const CLASS_TYPES = [
  { value: 'regular', label: 'Regular (정규)' },
  { value: 'popup', label: 'Popup (팝업)' },
  { value: 'workshop', label: 'Workshop (워크샵)' },
];

export function ClassModal({ academyId, classData, defaultDate, defaultHallId, onClose }: ClassModalProps) {
  const [formData, setFormData] = useState({
    title: '',
    song: '',
    genre: '',
    difficulty_level: '',
    class_type: 'regular',
    price: 0,
    description: '',
    start_time: '',
    end_time: '',
    instructor_id: '',
    instructor_name: '', // 강사 이름 직접 입력
    hall_id: '',
    max_students: 0,
    // 페이 관련 필드
    base_salary: '',
    base_student_count: '',
    additional_salary_per_student: '',
  });
  const [halls, setHalls] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [availableTickets, setAvailableTickets] = useState<any[]>([]);
  const [selectedTicketIds, setSelectedTicketIds] = useState<string[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(false);
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [currentStep, setCurrentStep] = useState<number>(1); // Step by Step: 1, 2, 3
  const [allowCoupon, setAllowCoupon] = useState<boolean>(false); // 쿠폰 허용 여부
  const [posterFile, setPosterFile] = useState<File | null>(null);
  const [posterUrl, setPosterUrl] = useState<string | null>(null);

  useEffect(() => {
    loadData();
    
    // 수강권 목록을 먼저 로드한 후, 수정 모드인 경우 연결된 수강권 로드
    const initializeTickets = async () => {
      await loadTickets();
      
      // 수정 모드인 경우 연결된 수강권 로드
      if (classData?.id) {
        // 수강권 목록이 로드된 후 연결 정보 로드
        console.log('수정 모드: 연결된 수강권 로드 시작, classId:', classData.id);
        await loadLinkedTickets(classData.id);
      } else {
        // 새 클래스 추가 시 선택 초기화 및 Step 1부터 시작
        setSelectedTicketIds([]);
        setCurrentStep(1);
      }
    };
    
    initializeTickets();
    
    if (classData) {
      // 수정 모드는 Step by Step 사용 안 함 (0 = 수정 모드)
      setCurrentStep(0);
      
      // 수정 모드에서 쿠폰 허용 여부 로드
      if (classData.access_config?.allow_coupon) {
        setAllowCoupon(true);
      }
      // UTC 시간을 KST로 변환하여 표시
      setFormData({
        title: classData.title || '',
        song: classData.song || '',
        genre: classData.genre?.split(',')[0]?.trim() || classData.genre || '',
        difficulty_level: classData.difficulty_level || '',
        instructor_name: '', // 나중에 로드
        class_type: (classData.class_type && ['regular', 'popup', 'workshop'].includes(classData.class_type)) 
          ? classData.class_type 
          : 'regular',
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
      });
      if (classData.poster_url) {
        setPosterUrl(classData.poster_url);
      }
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
      
      setFormData((prev) => ({
        ...prev,
        start_time: dateStr,
        end_time: endDateStr,
        hall_id: defaultHallId || '',
      }));
    } else {
      // 새 클래스 추가 시 오후 2시 기본 설정
      const now = new Date();
      now.setHours(14, 0, 0, 0); // 오후 2시 기본
      const dateStr = dateToKSTInput(now);
      
      const endDate = new Date(now);
      endDate.setHours(endDate.getHours() + 1);
      const endDateStr = dateToKSTInput(endDate);
      
      setFormData((prev) => ({
        ...prev,
        start_time: dateStr,
        end_time: endDateStr,
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

  const loadTickets = useCallback(async () => {
    setLoadingTickets(true);
    const supabase = getSupabaseClient();
    if (!supabase) {
      setLoadingTickets(false);
      return;
    }

    try {
      // 해당 학원의 모든 판매 중인 일반 수강권 조회 (쿠폰 제외)
      const { data, error } = await supabase
        .from('tickets')
        .select('id, name, ticket_type, price, is_general, is_coupon, valid_days, total_count')
        .eq('academy_id', academyId)
        .eq('is_on_sale', true)
        .or('is_coupon.is.null,is_coupon.eq.false') // 쿠폰 제외
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAvailableTickets(data || []);
      return data || [];
    } catch (error) {
      console.error('Error loading tickets:', error);
      setAvailableTickets([]);
      return [];
    } finally {
      setLoadingTickets(false);
    }
  }, [academyId]);

  // 포스터 업로드/삭제 처리
  const uploadPoster = async (classId: string): Promise<string | null> => {
    if (!posterFile) return posterUrl;
    try {
      if (posterUrl) {
        const oldPath = extractFilePathFromUrl(posterUrl);
        if (oldPath) await deleteFile('class-posters', oldPath).catch(() => {});
      }
      const url = await uploadFile('class-posters', posterFile, `${academyId}/${classId}`);
      return url;
    } catch (e) {
      console.error('Poster upload failed:', e);
      return posterUrl;
    }
  };

  const loadLinkedTickets = useCallback(async (classId: string) => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      console.error('Supabase client가 없습니다.');
      return;
    }

    try {
      console.log('loadLinkedTickets 호출됨, classId:', classId);
      // ticket_classes 테이블에서 해당 클래스에 연결된 수강권 조회
      const { data, error } = await supabase
        .from('ticket_classes')
        .select('ticket_id')
        .eq('class_id', classId);

      if (error) {
        console.error('Error loading linked tickets:', error);
        setSelectedTicketIds([]);
        return;
      }

      console.log('ticket_classes 조회 결과:', data);

      if (data && data.length > 0) {
        const linkedTicketIds = data.map((item: any) => item.ticket_id);
        console.log('연결된 수강권 ID 목록:', linkedTicketIds);
        setSelectedTicketIds(linkedTicketIds);
        console.log('연결된 수강권 로드 완료, selectedTicketIds 업데이트:', linkedTicketIds);
      } else {
        setSelectedTicketIds([]);
        console.log('연결된 수강권이 없습니다.');
      }
    } catch (error) {
      console.error('Error loading linked tickets:', error);
      setSelectedTicketIds([]);
    }
  }, []);

  const handleToggleTicket = (ticketId: string) => {
    console.log('handleToggleTicket 호출됨, ticketId:', ticketId);
    setSelectedTicketIds((prev) => {
      const newIds = prev.includes(ticketId)
        ? prev.filter((id) => id !== ticketId)
        : [...prev, ticketId];
      console.log('수강권 선택 상태 변경:', { prev, newIds, ticketId });
      return newIds;
    });
  };

  const handleSelectAllTickets = () => {
    console.log('handleSelectAllTickets 호출됨', {
      currentSelected: selectedTicketIds.length,
      totalTickets: availableTickets.length
    });
    if (selectedTicketIds.length === availableTickets.length) {
      console.log('전체 해제');
      setSelectedTicketIds([]);
    } else {
      const allIds = availableTickets.map((t) => t.id);
      console.log('전체 선택:', allIds);
      setSelectedTicketIds(allIds);
    }
  };

  // 수강권 모달과 동일한 선택 상태 계산
  const isAllTicketsSelected = availableTickets.length > 0 && selectedTicketIds.length === availableTickets.length;
  const isPartialTicketsSelected = selectedTicketIds.length > 0 && selectedTicketIds.length < availableTickets.length;


  const handleNextStep = () => {
    if (currentStep === 1) {
      // Step 1 -> Step 2: 클래스 유형이 선택되었는지 확인
      if (!formData.class_type) {
        alert('클래스 유형을 선택해주세요.');
        return;
      }
      setCurrentStep(2);
    } else if (currentStep === 2) {
      // Step 2 -> Step 3: 필수 정보 확인
      if (!formData.title.trim()) {
        alert('클래스명을 입력해주세요.');
        return;
      }
      // 강사 이름은 필수
      if (!formData.instructor_name.trim()) {
        alert('강사 이름을 입력해주세요.');
        return;
      }
      // 장르는 필수
      if (!formData.genre) {
        alert('장르를 선택해주세요.');
        return;
      }
      // 난이도, 홀, 최대 인원은 필수 아님
      setCurrentStep(3);
    }
  };

  const handlePrevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Step by Step 모드가 아닌 경우 (수정 모드)에만 기존 로직 실행
    if (classData) {
      // 수정 모드 로직은 기존과 동일
      await handleUpdateClass();
      return;
    }
    
    // Step 3에서만 실제 저장
    if (currentStep !== 3) {
      return;
    }
    
    // 수강권 선택 확인 (선택사항이지만 경고 표시)
    if (availableTickets.length > 0 && selectedTicketIds.length === 0) {
      const confirmMessage = '수강권이 선택되지 않았습니다. 이 클래스는 어떤 수강권으로도 들을 수 없게 됩니다.\n\n계속하시겠습니까?';
      if (!confirm(confirmMessage)) {
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

      // 클래스 기본 정보 저장
      const classDataToSave: any = {
        academy_id: academyId,
        title: title,
        song: formData.song || null,
        genre: formData.genre || null,
        difficulty_level: formData.difficulty_level || null,
        class_type: ['regular', 'popup', 'workshop'].includes(formData.class_type) 
          ? formData.class_type 
          : 'regular',
        price: formData.price,
        description: formData.description || null,
        instructor_id: formData.instructor_id || null,
        hall_id: formData.hall_id || null,
        max_students: formData.max_students,
        base_salary: parseNumberFromString(formData.base_salary),
        base_student_count: formData.base_student_count ? parseInt(formData.base_student_count, 10) : null,
        additional_salary_per_student: formData.additional_salary_per_student ? parseNumberFromString(formData.additional_salary_per_student) : null,
        access_config: {
          allowRegularTicket: true, // 정규 수강권은 ticket_classes로 관리
          allowCoupon: allowCoupon, // 레거시 호환
          allowPopup: allowCoupon, // 쿠폰제(횟수제) 수강권 허용 여부
        },
      };

      // start_time, end_time도 classes 테이블에 저장
      if (formData.start_time && formData.end_time) {
        const startTimeUTC = convertKSTInputToUTC(formData.start_time);
        const endTimeUTC = convertKSTInputToUTC(formData.end_time);
        if (startTimeUTC && endTimeUTC) {
          classDataToSave.start_time = startTimeUTC;
          classDataToSave.end_time = endTimeUTC;
        } else {
          // 시간 변환 실패 시 null로 설정
          classDataToSave.start_time = null;
          classDataToSave.end_time = null;
        }
      } else {
        // 시간이 비어있으면 null로 설정
        classDataToSave.start_time = null;
        classDataToSave.end_time = null;
      }

      let classId: string;

      if (classData) {
        // 포스터 업로드
        const finalPosterUrl = await uploadPoster(classData.id);
        classDataToSave.poster_url = finalPosterUrl ?? null;

        // 수정 모드: classes 테이블만 업데이트 (select 없이)
        const { error: updateError } = await supabase
          .from('classes')
          .update(classDataToSave)
          .eq('id', classData.id);

        if (updateError) {
          console.error('Update error:', updateError);
          throw updateError;
        }
        
        classId = classData.id;
      } else {
        // 신규 등록
        const { data: newClass, error: insertError } = await supabase
          .from('classes')
          .insert([classDataToSave])
          .select()
          .single();

        if (insertError) throw insertError;
        classId = newClass.id;

        // 포스터 업로드 (신규 등록 시)
        const finalPosterUrl = await uploadPoster(classId);
        if (finalPosterUrl) {
          await supabase.from('classes').update({ poster_url: finalPosterUrl }).eq('id', classId);
        }
      }

      // ticket_classes 테이블 처리
      // 1. 기존 연결 삭제
      const { error: deleteError } = await supabase
        .from('ticket_classes')
        .delete()
        .eq('class_id', classId);
      
      if (deleteError) {
        console.error('Error deleting ticket_classes:', deleteError);
        // 삭제 실패는 치명적이지 않을 수 있으므로 경고만
        console.warn('기존 수강권 연결 삭제 실패했지만 계속 진행합니다:', deleteError.message);
      }
      
      // 2. 선택된 수강권 연결 저장
      if (selectedTicketIds.length > 0) {
        // 선택된 수강권 ID가 실제로 존재하는지 확인
        const validTicketIds = selectedTicketIds.filter(ticketId => 
          availableTickets.some(t => t.id === ticketId)
        );
        
        if (validTicketIds.length !== selectedTicketIds.length) {
          console.warn('일부 수강권 ID가 유효하지 않습니다:', {
            selected: selectedTicketIds,
            valid: validTicketIds
          });
        }
        
        if (validTicketIds.length > 0) {
          const linkData = validTicketIds.map(ticketId => ({
            ticket_id: ticketId,
            class_id: classId,
          }));
          
          const { data: insertedData, error: linkError } = await supabase
            .from('ticket_classes')
            .insert(linkData)
            .select();
          
          if (linkError) {
            console.error('Error saving ticket_classes:', linkError);
            throw new Error(`수강권 연결 저장 실패: ${linkError.message}`);
          }
          
          console.log(`ticket_classes에 ${insertedData?.length || 0}개의 수강권 연결이 저장되었습니다.`, {
            classId,
            ticketIds: validTicketIds,
          });
        }
      } else {
        // 수강권이 선택되지 않은 경우 - 기존 연결만 삭제됨 (의도된 동작)
        console.log('수강권이 선택되지 않아 ticket_classes 연결이 저장되지 않습니다. 이 클래스는 어떤 수강권으로도 들을 수 없습니다.');
      }
      
      const successMessage = classData 
        ? `클래스가 수정되었습니다.${selectedTicketIds.length > 0 ? `\n${selectedTicketIds.length}개의 수강권이 연결되었습니다.` : '\n연결된 수강권이 없습니다.'}`
        : `클래스가 등록되었습니다.${selectedTicketIds.length > 0 ? `\n${selectedTicketIds.length}개의 수강권이 연결되었습니다.` : '\n연결된 수강권이 없습니다.'}`;
      
      alert(successMessage);
      onClose();
    } catch (error: any) {
      console.error('Error saving class:', error);
      alert(`클래스 저장에 실패했습니다: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateClass = async () => {
    // 수정 모드용 별도 함수 (기존 로직)
    if (!formData.genre) {
      alert('장르를 선택해주세요.');
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

      // 클래스 기본 정보 저장
      const classDataToSave: any = {
        academy_id: academyId,
        title: title,
        song: formData.song || null,
        genre: formData.genre || null,
        difficulty_level: formData.difficulty_level || null,
        class_type: ['regular', 'popup', 'workshop'].includes(formData.class_type) 
          ? formData.class_type 
          : 'regular',
        price: formData.price,
        description: formData.description || null,
        instructor_id: formData.instructor_id || null,
        hall_id: formData.hall_id || null,
        max_students: formData.max_students,
        base_salary: parseNumberFromString(formData.base_salary),
        base_student_count: formData.base_student_count ? parseInt(formData.base_student_count, 10) : null,
        additional_salary_per_student: formData.additional_salary_per_student ? parseNumberFromString(formData.additional_salary_per_student) : null,
        access_config: {
          allowRegularTicket: true, // 정규 수강권은 ticket_classes로 관리
          allowCoupon: allowCoupon, // 레거시 호환
          allowPopup: allowCoupon, // 쿠폰제(횟수제) 수강권 허용 여부
        },
      };

      // 포스터 업로드
      const finalPosterUrl = await uploadPoster(classData.id);
      classDataToSave.poster_url = finalPosterUrl ?? null;

      // start_time, end_time도 classes 테이블에 저장
      if (formData.start_time && formData.end_time) {
        const startTimeUTC = convertKSTInputToUTC(formData.start_time);
        const endTimeUTC = convertKSTInputToUTC(formData.end_time);
        if (startTimeUTC && endTimeUTC) {
          classDataToSave.start_time = startTimeUTC;
          classDataToSave.end_time = endTimeUTC;
        }
      }

      // 수정 모드: classes 테이블만 업데이트
      const { error: updateError } = await supabase
        .from('classes')
        .update(classDataToSave)
        .eq('id', classData.id);

      if (updateError) throw updateError;

      // ticket_classes 테이블 처리 - 수강권 모달과 동일한 로직
      // 1. 기존 연결 삭제
      const { error: deleteError } = await supabase
        .from('ticket_classes')
        .delete()
        .eq('class_id', classData.id);
      
      if (deleteError) {
        console.error('Error deleting ticket_classes:', deleteError);
        // 삭제 실패는 치명적이지 않을 수 있으므로 경고만
        console.warn('기존 수강권 연결 삭제 실패했지만 계속 진행합니다:', deleteError.message);
      }
      
      // 2. 선택된 수강권 연결 저장
      if (selectedTicketIds.length > 0) {
        // 선택된 수강권 ID가 실제로 존재하는지 확인
        const validTicketIds = selectedTicketIds.filter(ticketId => 
          availableTickets.some(t => t.id === ticketId)
        );
        
        if (validTicketIds.length !== selectedTicketIds.length) {
          console.warn('일부 수강권 ID가 유효하지 않습니다:', {
            selected: selectedTicketIds,
            valid: validTicketIds
          });
        }
        
        if (validTicketIds.length > 0) {
          const linkData = validTicketIds.map(ticketId => ({
            ticket_id: ticketId,
            class_id: classData.id,
          }));
          
          const { data: insertedData, error: linkError } = await supabase
            .from('ticket_classes')
            .insert(linkData)
            .select();
          
          if (linkError) {
            console.error('Error saving ticket_classes:', linkError);
            throw new Error(`수강권 연결 저장 실패: ${linkError.message}`);
          }
          
          console.log(`✅ ticket_classes에 ${insertedData?.length || 0}개의 수강권 연결이 저장되었습니다.`, {
            classId: classData.id,
            ticketIds: validTicketIds,
            insertedData
          });
        }
      } else {
        // 수강권이 선택되지 않은 경우 - 기존 연결만 삭제됨 (의도된 동작)
        console.log('⚠️ 수강권이 선택되지 않아 ticket_classes 연결이 저장되지 않습니다. 이 클래스는 어떤 수강권으로도 들을 수 없습니다.');
      }

      const successMessage = `클래스가 수정되었습니다.${selectedTicketIds.length > 0 ? `\n${selectedTicketIds.length}개의 수강권이 연결되었습니다.` : '\n연결된 수강권이 없습니다.'}`;
      console.log('✅ 클래스 수정 완료:', successMessage);
      alert(successMessage);
      onClose();
    } catch (error: any) {
      console.error('Error updating class:', error);
      alert(`클래스 수정에 실패했습니다: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Step by Step 렌더링 함수들
  const renderStepIndicator = () => {
    if (classData) return null; // 수정 모드는 Step 표시 안 함
    
    return (
      <div className="flex items-center justify-center mb-6">
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
                {step === 1 ? '유형 선택' : step === 2 ? '기본 정보' : '수강권 설정'}
              </span>
            </div>
            {step < 3 && (
              <div className={`w-16 h-0.5 mx-2 ${currentStep > step ? 'bg-blue-600 dark:bg-blue-400' : 'bg-gray-300 dark:bg-gray-600'}`} />
            )}
          </div>
        ))}
      </div>
    );
  };

  const renderStep1 = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">클래스 유형 선택</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">클래스 유형에 따라 사용 가능한 수강권이 결정됩니다.</p>
      </div>
      
      <div className="grid grid-cols-1 gap-4">
        {/* Regular */}
        <button
          type="button"
          onClick={() => setFormData({ ...formData, class_type: 'regular' })}
          className={`p-5 rounded-xl border-2 transition-all text-left ${
            formData.class_type === 'regular'
              ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-500 shadow-lg'
              : 'bg-white dark:bg-neutral-900 border-gray-200 dark:border-neutral-700 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-md'
          }`}
        >
          <div className="flex items-center gap-3 mb-2">
            <span className={`font-bold text-lg ${formData.class_type === 'regular' ? 'text-blue-700 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300'}`}>
              Regular (정규)
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 font-semibold">
              기간제 수강권 전용
            </span>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            정기적으로 진행되는 정규 수업. 기간제 수강권으로만 수강 가능합니다.
          </p>
        </button>

        {/* Popup */}
        <button
          type="button"
          onClick={() => setFormData({ ...formData, class_type: 'popup' })}
          className={`p-5 rounded-xl border-2 transition-all text-left ${
            formData.class_type === 'popup'
              ? 'bg-purple-50 dark:bg-purple-900/20 border-purple-500 shadow-lg'
              : 'bg-white dark:bg-neutral-900 border-gray-200 dark:border-neutral-700 hover:border-purple-300 dark:hover:border-purple-700 hover:shadow-md'
          }`}
        >
          <div className="flex items-center gap-3 mb-2">
            <span className={`font-bold text-lg ${formData.class_type === 'popup' ? 'text-purple-700 dark:text-purple-400' : 'text-gray-700 dark:text-gray-300'}`}>
              Popup (팝업)
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 font-semibold">
              쿠폰제(횟수제) 수강권 전용
            </span>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            특별 이벤트나 단기 수업. 쿠폰제(횟수제) 수강권으로만 수강 가능합니다.
          </p>
        </button>

        {/* Workshop */}
        <button
          type="button"
          onClick={() => setFormData({ ...formData, class_type: 'workshop' })}
          className={`p-5 rounded-xl border-2 transition-all text-left ${
            formData.class_type === 'workshop'
              ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-500 shadow-lg'
              : 'bg-white dark:bg-neutral-900 border-gray-200 dark:border-neutral-700 hover:border-amber-300 dark:hover:border-amber-700 hover:shadow-md'
          }`}
        >
          <div className="flex items-center gap-3 mb-2">
            <span className={`font-bold text-lg ${formData.class_type === 'workshop' ? 'text-amber-700 dark:text-amber-400' : 'text-gray-700 dark:text-gray-300'}`}>
              Workshop (워크샵)
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 font-semibold">
              워크샵(특강) 수강권 전용
            </span>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            집중 워크샵 형태의 수업. 워크샵(특강) 수강권으로만 수강 가능합니다.
          </p>
        </button>
      </div>

      {/* 안내 메시지 */}
      <div className="bg-gray-50 dark:bg-neutral-800 rounded-lg p-4 border border-gray-200 dark:border-neutral-700">
        <p className="text-xs text-gray-600 dark:text-gray-400">
          <Info size={14} className="inline mr-1 text-gray-500" />
          <strong>수강권 연동 안내:</strong> 클래스 유형에 따라 기본 수강권이 결정됩니다.
          필요시 Step 3에서 다른 유형의 수강권도 추가로 허용할 수 있습니다.
        </p>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">클래스 기본 정보</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">클래스의 기본 정보를 입력해주세요.</p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            클래스명 *
          </label>
          <input
            type="text"
            required
            className="w-full border dark:border-neutral-700 rounded-lg px-4 py-3 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            placeholder="예: K-Pop 기초반"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            강사 *
          </label>
          <input
            type="text"
            required
            className="w-full border dark:border-neutral-700 rounded-lg px-4 py-3 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
            value={formData.instructor_name || ''}
            onChange={(e) => setFormData({ ...formData, instructor_name: e.target.value, instructor_id: '' })}
            placeholder="예: 홍길동"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              장르 *
            </label>
            <select
              required
              className="w-full border dark:border-neutral-700 rounded-lg px-4 py-3 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
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
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              난이도
            </label>
            <select
              className="w-full border dark:border-neutral-700 rounded-lg px-4 py-3 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
              value={formData.difficulty_level}
              onChange={(e) => setFormData({ ...formData, difficulty_level: e.target.value })}
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

        <div className="grid grid-cols-2 gap-4">
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
                <option key={hall.id} value={hall.id}>
                  {hall.name} {hall.capacity ? `(${hall.capacity}명)` : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              최대 인원
            </label>
            <input
              type="number"
              min="0"
              className="w-full border dark:border-neutral-700 rounded-lg px-4 py-3 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
              value={formData.max_students || ''}
              onChange={(e) => setFormData({ ...formData, max_students: parseInt(e.target.value) || 0 })}
              placeholder="선택 안함"
            />
          </div>
        </div>

        <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              설명
            </label>
            <textarea
              className="w-full border dark:border-neutral-700 rounded-lg px-4 py-3 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
              rows={4}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="클래스에 대한 설명을 입력하세요"
            />
          </div>

          {/* 포스터 업로드 */}
          <ImageUpload
            currentImageUrl={posterUrl}
            onImageChange={(file) => setPosterFile(file)}
            onImageUrlChange={(url) => { setPosterUrl(url); setPosterFile(null); }}
            label="수업 포스터 (선택)"
            maxSizeMB={5}
          />
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">수강권 설정</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">이 수업을 들을 수 있는 수강권을 선택하고 쿠폰 허용 여부를 설정하세요.</p>
      </div>

      {/* 수강권 선택 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
          <Ticket size={14} /> 이 클래스를 들을 수 있는 수강권
        </label>

        <div className="border dark:border-neutral-700 rounded-lg overflow-hidden">
          {/* 전체 선택 헤더 - 클래스 수정 모달과 동일 */}
          <div
            onClick={handleSelectAllTickets}
            className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-neutral-800 border-b dark:border-neutral-700 cursor-pointer hover:bg-gray-100 dark:hover:bg-neutral-750"
          >
            {selectedTicketIds.length === availableTickets.length ? (
              <CheckSquare size={20} className="text-blue-600 dark:text-blue-400" />
            ) : selectedTicketIds.length > 0 ? (
              <div className="w-5 h-5 border-2 border-blue-600 dark:border-blue-400 bg-blue-600 dark:bg-blue-500 rounded flex items-center justify-center">
                <div className="w-2.5 h-0.5 bg-white" />
              </div>
            ) : (
              <Square size={20} className="text-gray-400" />
            )}
            <span className="font-medium text-gray-900 dark:text-white">
              전체 선택
            </span>
            <span className="ml-auto text-sm text-gray-500 dark:text-gray-400">
              {selectedTicketIds.length} / {availableTickets.length}
            </span>
          </div>

          {/* 수강권 목록 */}
          <div className="max-h-48 overflow-y-auto">
            {loadingTickets ? (
              <div className="p-4 text-center text-gray-500 dark:text-gray-400">
                수강권 목록 불러오는 중...
              </div>
            ) : availableTickets.length === 0 ? (
              <div className="p-4 text-center text-amber-600 dark:text-amber-400">
                <Info size={16} className="inline mr-1" />
                등록된 수강권이 없습니다.
              </div>
            ) : (
              availableTickets.map((ticket) => {
                const isSelected = selectedTicketIds.includes(ticket.id);
                return (
                  <div
                    key={ticket.id}
                    onClick={() => handleToggleTicket(ticket.id)}
                    className="flex items-center gap-3 p-3 border-b dark:border-neutral-700 last:border-b-0 cursor-pointer hover:bg-gray-50 dark:hover:bg-neutral-800"
                  >
                    {isSelected ? (
                      <CheckSquare size={18} className="text-blue-600 dark:text-blue-400 shrink-0" />
                    ) : (
                      <Square size={18} className="text-gray-400 shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900 dark:text-white truncate">
                        {ticket.name || '제목 없음'}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-2">
                        {ticket.ticket_type === 'PERIOD' && ticket.valid_days ? `${ticket.valid_days}일` : ''}
                        {ticket.ticket_type === 'COUNT' && ticket.total_count ? `${ticket.total_count}회` : ''}
                        {ticket.price && `• ${ticket.price.toLocaleString()}원`}
                        {ticket.is_general && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                            전체 이용
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
        
        {/* 새 수강권 만들기 버튼 - 클래스 수정 모달과 동일한 위치 및 동작 */}
        <button
          type="button"
          onClick={() => setShowTicketModal(true)}
          className="w-full mt-4 py-3 border border-gray-300 dark:border-neutral-700 border-dashed rounded-lg text-gray-500 dark:text-gray-400 text-sm hover:bg-gray-100 dark:hover:bg-neutral-800 flex items-center justify-center gap-2 transition-colors"
        >
          <Plus size={16} /> 새 수강권 만들기
        </button>
      </div>

      {/* 추가 수강권 허용 */}
      <div className="border-t dark:border-neutral-800 pt-6">
        <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
          추가 수강권 허용
        </h4>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
          기본 수강권 외에 다른 유형의 수강권으로도 이 수업을 수강할 수 있도록 허용합니다.
        </p>
        
        <div className="flex items-center justify-between p-4 bg-purple-50 dark:bg-purple-900/20 rounded-xl border border-purple-200 dark:border-purple-800">
          <div>
            <label className="block text-sm font-medium text-purple-700 dark:text-purple-400 mb-1">
              쿠폰제(횟수제) 수강권 허용
            </label>
            <p className="text-xs text-purple-600 dark:text-purple-500">
              쿠폰제(횟수제) 수강권으로도 이 수업을 수강할 수 있습니다
            </p>
          </div>
          <button
            type="button"
            onClick={() => setAllowCoupon(!allowCoupon)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              allowCoupon ? 'bg-purple-600' : 'bg-gray-300 dark:bg-gray-600'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                allowCoupon ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </div>

      {/* 선택 상태 요약 */}
      {availableTickets.length > 0 && (
        <div className={`p-4 rounded-xl border-2 ${
          selectedTicketIds.length > 0
            ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
            : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
        }`}>
          {selectedTicketIds.length > 0 ? (
            <div className="flex items-start gap-2">
              <CheckSquare size={18} className="text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-blue-700 dark:text-blue-400">
                  {selectedTicketIds.length}개의 수강권이 선택되었습니다
                </p>
                <p className="text-xs text-blue-600 dark:text-blue-500 mt-1">
                  선택한 수강권으로 이 수업을 수강할 수 있습니다.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-2">
              <div className="w-4 h-4 border-2 border-amber-600 dark:border-amber-400 rounded shrink-0 mt-0.5"></div>
              <div>
                <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
                  수강권이 선택되지 않았습니다
                </p>
                <p className="text-xs text-amber-600 dark:text-amber-500 mt-1">
                  수강권을 선택하지 않으면 이 수업은 어떤 수강권으로도 들을 수 없습니다.
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );

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

        {/* Step Indicator - 새 클래스 등록 시에만 표시 */}
        {!classData && renderStepIndicator()}

        <form onSubmit={handleSubmit} className="p-6">
          {/* 새 클래스 등록: Step by Step UI */}
          {!classData ? (
            <div className="space-y-6">
              {/* Step 1: 클래스 유형 선택 */}
              {currentStep === 1 && renderStep1()}

              {/* Step 2: 클래스 기본 정보 */}
              {currentStep === 2 && renderStep2()}

              {/* Step 3: 수강권 선택 및 쿠폰 허용 */}
              {currentStep === 3 && renderStep3()}

              {/* 네비게이션 버튼 */}
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
                    className="flex items-center gap-2 px-6 py-3 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors"
                  >
                    다음
                    <ChevronRight size={20} />
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex items-center gap-2 px-6 py-3 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors disabled:opacity-50"
                  >
                    {loading ? '저장 중...' : '완료'}
                  </button>
                )}
              </div>
            </div>
          ) : (
            /* 수정 모드: 기존 UI */
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  강사
                </label>
                <input
                  type="text"
                  className="w-full border dark:border-neutral-700 rounded-lg px-3 py-2 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
                  value={formData.instructor_name || ''}
                  onChange={(e) => setFormData({ ...formData, instructor_name: e.target.value, instructor_id: '' })}
                  placeholder="예: 홍길동"
                />
              </div>

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
              장르 *
            </label>
            <select
              required
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


          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              클래스 유형 *
            </label>
            <div className="grid grid-cols-3 gap-3">
              {CLASS_TYPES.map((type) => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => setFormData({ ...formData, class_type: type.value })}
                  className={`p-4 rounded-lg border-2 transition-colors ${
                    formData.class_type === type.value
                      ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-500 text-blue-700 dark:text-blue-400'
                      : 'bg-gray-50 dark:bg-neutral-800 border-gray-200 dark:border-neutral-700 hover:bg-gray-100 dark:hover:bg-neutral-750 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  <div className="font-semibold">{type.label}</div>
                </button>
              ))}
            </div>
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

          {/* 시간 입력 필드 */}
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

          {/* 포스터 업로드 */}
          <ImageUpload
            currentImageUrl={posterUrl}
            onImageChange={(file) => setPosterFile(file)}
            onImageUrlChange={(url) => { setPosterUrl(url); setPosterFile(null); }}
            label="수업 포스터 (선택)"
            maxSizeMB={5}
          />

          {/* 수강권 설정 섹션 - 수강권 모달의 클래스 선택 UI와 완전히 동일 */}
          <div className="border-t dark:border-neutral-800 pt-4 mt-4">
            {/* 수강권 선택 - 수강권 모달의 클래스 선택 UI와 완전히 동일 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                <Ticket size={14} /> 이 클래스를 들을 수 있는 수강권
              </label>

              <div className="border dark:border-neutral-700 rounded-lg overflow-hidden">
                {/* 전체 선택 헤더 - 수강권 모달과 동일 */}
                <div
                  onClick={handleSelectAllTickets}
                  className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-neutral-800 border-b dark:border-neutral-700 cursor-pointer hover:bg-gray-100 dark:hover:bg-neutral-750"
                >
                  {isAllTicketsSelected ? (
                    <CheckSquare size={20} className="text-blue-600 dark:text-blue-400" />
                  ) : isPartialTicketsSelected ? (
                    <div className="w-5 h-5 border-2 border-blue-600 dark:border-blue-400 bg-blue-600 dark:bg-blue-500 rounded flex items-center justify-center">
                      <div className="w-2.5 h-0.5 bg-white" />
                    </div>
                  ) : (
                    <Square size={20} className="text-gray-400" />
                  )}
                  <span className="font-medium text-gray-900 dark:text-white">
                    전체 선택
                  </span>
                  <span className="ml-auto text-sm text-gray-500 dark:text-gray-400">
                    {selectedTicketIds.length} / {availableTickets.length}
                  </span>
                </div>

                {/* 수강권 목록 */}
                <div className="max-h-48 overflow-y-auto">
                  {loadingTickets ? (
                    <div className="p-4 text-center text-gray-500 dark:text-gray-400">
                      수강권 목록 불러오는 중...
                    </div>
                  ) : availableTickets.length === 0 ? (
                    <div className="p-4 text-center text-amber-600 dark:text-amber-400">
                      <Info size={16} className="inline mr-1" />
                      등록된 수강권이 없습니다.
                    </div>
                  ) : (
                    availableTickets.map((ticket) => {
                      const isSelected = selectedTicketIds.includes(ticket.id);
                      return (
                        <div
                          key={ticket.id}
                          onClick={() => handleToggleTicket(ticket.id)}
                          className="flex items-center gap-3 p-3 border-b dark:border-neutral-700 last:border-b-0 cursor-pointer hover:bg-gray-50 dark:hover:bg-neutral-800"
                        >
                          {isSelected ? (
                            <CheckSquare size={18} className="text-blue-600 dark:text-blue-400 shrink-0" />
                          ) : (
                            <Square size={18} className="text-gray-400 shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-gray-900 dark:text-white truncate">
                              {ticket.name || '제목 없음'}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-2">
                              {ticket.ticket_type === 'PERIOD' && ticket.valid_days ? `${ticket.valid_days}일` : ''}
                              {ticket.ticket_type === 'COUNT' && ticket.total_count ? `${ticket.total_count}회` : ''}
                              {ticket.price && `• ${ticket.price.toLocaleString()}원`}
                              {ticket.is_general && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                                  전체 이용
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
              
              {isAllTicketsSelected && (
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">
                  모든 수강권에서 이 클래스를 수강할 수 있습니다.
                </p>
              )}
              
              {/* 새 수강권 만들기 버튼 */}
              <button
                type="button"
                onClick={() => setShowTicketModal(true)}
                className="w-full mt-4 py-3 border border-gray-300 dark:border-neutral-700 border-dashed rounded-lg text-gray-500 dark:text-gray-400 text-sm hover:bg-gray-100 dark:hover:bg-neutral-800 flex items-center justify-center gap-2 transition-colors"
              >
                <Plus size={16} /> 새 수강권 만들기
              </button>
            </div>

            {/* 추가 수강권 허용 */}
            <div className="border-t dark:border-neutral-800 pt-6 mt-6">
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                추가 수강권 허용
              </h4>
              <div className="flex items-center justify-between p-4 bg-purple-50 dark:bg-purple-900/20 rounded-xl border border-purple-200 dark:border-purple-800">
                <div>
                  <label className="block text-sm font-medium text-purple-700 dark:text-purple-400 mb-1">
                    쿠폰제(횟수제) 수강권 허용
                  </label>
                  <p className="text-xs text-purple-600 dark:text-purple-500">
                    쿠폰제(횟수제) 수강권으로도 이 수업을 수강할 수 있습니다
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setAllowCoupon(!allowCoupon)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    allowCoupon ? 'bg-purple-600' : 'bg-gray-300 dark:bg-gray-600'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      allowCoupon ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>
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

              {/* 수정 모드 버튼 */}
              <div className="flex gap-3 pt-4">
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
            </div>
          )}
        </form>
      </div>
      
      {showTicketModal && (
        <TicketModal
          academyId={academyId}
          ticket={null}
          onClose={() => {
            setShowTicketModal(false);
            // 수강권이 생성되면 목록 새로고침
            loadTickets();
          }}
        />
      )}
    </div>
  );
}

