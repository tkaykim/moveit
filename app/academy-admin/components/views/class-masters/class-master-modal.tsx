"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { X, Ticket, Info, ToggleLeft, ToggleRight, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, CheckCircle2, CheckSquare, Square, Plus, Search, Zap, Tag } from 'lucide-react';
import { getSupabaseClient } from '@/lib/utils/supabase-client';
import { TicketModal } from '../products/ticket-modal';
import { ImageUpload } from '@/components/common/image-upload';
import { uploadFile, deleteFile, extractFilePathFromUrl } from '@/lib/utils/storage';
import type { AcademyTicketLabels } from '../hooks/useAcademyTicketLabels';
import { DEFAULT_TICKET_LABELS } from '@/lib/constants/ticket-labels';

interface ClassMasterModalProps {
  academyId: string;
  classData?: any;
  ticketLabels?: AcademyTicketLabels;
  onClose: () => void;
}

interface LinkedTicket {
  id: string;
  name: string;
  ticket_type: string;
  price: number | null;
}

const GENRES = ['Choreo', 'hiphop', 'locking', 'waacking', 'popping', 'krump', 'voguing', 'breaking(bboying)', 'heels', 'kpop', 'house', '기타'];
const DIFFICULTY_LEVELS = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'];
const CLASS_TYPES = [
  { value: 'regular', label: 'Regular (정규)' },
  { value: 'popup', label: 'Popup (팝업)' },
  { value: 'workshop', label: 'Workshop (워크샵)' },
];

export function ClassMasterModal({ academyId, classData, ticketLabels, onClose }: ClassMasterModalProps) {
  const labels = ticketLabels ?? { regular: DEFAULT_TICKET_LABELS.regular, popup: DEFAULT_TICKET_LABELS.popup, workshop: DEFAULT_TICKET_LABELS.workshop };
  const [formData, setFormData] = useState({
    title: '',
    genre: '',
    difficulty_level: '',
    class_type: 'regular',
    description: '',
    instructor_id: '',
    instructor_name: '', // 강사 이름 직접 입력
    hall_id: '',
    max_students: 0,
    allowRegularTicket: true,
    allowPopup: false,     // popup 수강권 허용 여부
    allowWorkshop: false,  // workshop 수강권 허용 여부
    is_active: true,
  });
  const [posterFile, setPosterFile] = useState<File | null>(null);
  const [posterUrl, setPosterUrl] = useState<string | null>(null);
  const [halls, setHalls] = useState<any[]>([]);
  const [linkedTickets, setLinkedTickets] = useState<LinkedTicket[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingTickets, setLoadingTickets] = useState(false);
  const [currentStep, setCurrentStep] = useState<number>(1); // Step by Step: 1, 2, 3 (0 = 수정 모드)
  const [availableTickets, setAvailableTickets] = useState<any[]>([]);
  const [selectedTicketIds, setSelectedTicketIds] = useState<string[]>([]);
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [ticketSearchQuery, setTicketSearchQuery] = useState('');

  // ticket_category 우선, 없으면 access_group → is_coupon (product-view와 동일한 분류 로직)
  const getTicketCategory = useCallback((ticket: any): 'regular' | 'popup' | 'workshop' => {
    if (ticket.ticket_category === 'popup' || ticket.ticket_category === 'workshop') return ticket.ticket_category;
    if (ticket.access_group === 'popup') return 'popup';
    if (ticket.access_group === 'workshop') return 'workshop';
    if (ticket.is_coupon === true && ticket.access_group !== 'regular') return 'popup';
    return 'regular';
  }, []);

  // 검색 필터링된 수강권 목록
  const filteredTickets = useMemo(() => {
    if (!ticketSearchQuery.trim()) return availableTickets;
    const query = ticketSearchQuery.toLowerCase();
    return availableTickets.filter(ticket => 
      (ticket.name?.toLowerCase().includes(query)) ||
      (ticket.ticket_type?.toLowerCase().includes(query))
    );
  }, [availableTickets, ticketSearchQuery]);

  // 카테고리별 수강권 (검색 필터 적용)
  const regularTickets = useMemo(() => filteredTickets.filter(t => getTicketCategory(t) === 'regular'), [filteredTickets, getTicketCategory]);
  const popupTickets = useMemo(() => filteredTickets.filter(t => getTicketCategory(t) === 'popup'), [filteredTickets, getTicketCategory]);
  const workshopTickets = useMemo(() => filteredTickets.filter(t => getTicketCategory(t) === 'workshop'), [filteredTickets, getTicketCategory]);

  // 아코디언 펼침 상태 (클래스 유형별 기본: 해당 유형 섹션만 열림)
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({ regular: true, popup: false, workshop: false });
  useEffect(() => {
    if (currentStep === 3 || classData) {
      // 정규/팝업/워크샵 동일하게 3종 모두 펼쳐서 표시
      setExpandedSections({ regular: true, popup: true, workshop: true });
    }
  }, [currentStep, classData]);

  useEffect(() => {
    loadHalls();
    
    // 수강권 목록은 항상 먼저 로드
    loadTickets();
    
    if (classData) {
      // 수정 모드는 Step by Step 사용 안 함
      setCurrentStep(0);
      
      setFormData({
        title: classData.title || '',
        genre: classData.genre?.split(',')[0]?.trim() || classData.genre || '',
        difficulty_level: classData.difficulty_level || '',
        class_type: (classData.class_type && ['regular', 'popup', 'workshop'].includes(classData.class_type)) 
          ? classData.class_type 
          : 'regular',
        description: classData.description || '',
        instructor_id: classData.instructor_id || '',
        instructor_name: '', // 나중에 로드
        hall_id: classData.hall_id || '',
        max_students: classData.max_students || 0,
        allowRegularTicket: classData.access_config?.allowRegularTicket !== false,
        allowPopup: classData.access_config?.allowPopup === true || classData.access_config?.allowCoupon === true, // 기존 allowCoupon도 호환
        allowWorkshop: classData.access_config?.allowWorkshop === true,
        is_active: classData.is_active !== false,
      });
      
      // 포스터 URL 로드
      if (classData.poster_url) {
        setPosterUrl(classData.poster_url);
      }

      // instructor_id가 있으면 강사 이름 로드
      if (classData.instructor_id) {
        loadInstructorName(classData.instructor_id);
      }
      
      // 수강권 목록이 로드된 후 연결된 수강권 로드
      const initializeLinkedTickets = async () => {
        // loadTickets가 완료될 때까지 대기
        await new Promise(resolve => setTimeout(resolve, 100));
        await loadLinkedTickets(classData.id);
      };
      initializeLinkedTickets();
    } else {
      // 새 클래스 등록 시 Step 1부터 시작
      setCurrentStep(1);
    }
  }, [classData, academyId]);

  const loadTickets = useCallback(async () => {
    setLoadingTickets(true);
    const supabase = getSupabaseClient();
    if (!supabase) {
      setLoadingTickets(false);
      return;
    }

    try {
      // 해당 학원의 모든 판매 중인 수강권 조회 (정규/팝업/워크샵 포함, is_coupon 필터 제거)
      const { data, error } = await supabase
        .from('tickets')
        .select('id, name, ticket_type, price, is_general, is_coupon, valid_days, total_count, ticket_category, access_group')
        .eq('academy_id', academyId)
        .eq('is_on_sale', true)
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

  const loadHalls = async () => {
    const supabase = getSupabaseClient();
    if (!supabase) return;

    try {
      const { data: hallsData } = await supabase
        .from('halls')
        .select('*')
        .eq('academy_id', academyId);
      setHalls(hallsData || []);
    } catch (error) {
      console.error('Error loading halls:', error);
    }
  };

  const loadInstructorName = async (instructorId: string) => {
    const supabase = getSupabaseClient();
    if (!supabase) return;

    try {
      const { data, error } = await supabase
        .from('instructors')
        .select('name_kr, name_en')
        .eq('id', instructorId)
        .single();

      if (!error && data) {
        const name = data.name_kr || data.name_en || '';
        setFormData(prev => ({ ...prev, instructor_name: name }));
      }
    } catch (error) {
      console.error('Error loading instructor name:', error);
    }
  };

  const loadLinkedTickets = async (classId: string) => {
    const supabase = getSupabaseClient();
    if (!supabase) return;

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
  };

  // 포스터 업로드/삭제 처리
  const uploadPoster = async (classId: string): Promise<string | null> => {
    if (!posterFile) return posterUrl; // 파일 변경 없으면 기존 URL 유지
    try {
      // 기존 포스터 삭제
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

  const handleNextStep = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
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

  const handlePrevStep = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };


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

  // Step 3에서는 클래스 유형 무관하게 정규/팝업/워크샵 3종 모두 표시·선택 가능
  const applicableTickets = useMemo(() => [...regularTickets, ...popupTickets, ...workshopTickets], [regularTickets, popupTickets, workshopTickets]);

  const getTicketsByCategory = useCallback((cat: 'regular' | 'popup' | 'workshop') => {
    if (cat === 'regular') return regularTickets;
    if (cat === 'popup') return popupTickets;
    return workshopTickets;
  }, [regularTickets, popupTickets, workshopTickets]);

  const handleSelectAllTickets = () => {
    if (selectedTicketIds.length === applicableTickets.length) {
      setSelectedTicketIds([]);
    } else {
      setSelectedTicketIds(applicableTickets.map((t) => t.id));
    }
  };

  const handleSelectAllForCategory = (cat: 'regular' | 'popup' | 'workshop') => {
    const list = getTicketsByCategory(cat);
    const ids = list.map((t) => t.id);
    const allSelected = ids.length > 0 && ids.every((id) => selectedTicketIds.includes(id));
    if (allSelected) {
      setSelectedTicketIds((prev) => prev.filter((id) => !ids.includes(id)));
    } else {
      setSelectedTicketIds((prev) => [...new Set([...prev, ...ids])]);
    }
  };

  const toggleSection = (cat: string) => {
    setExpandedSections((prev) => ({ ...prev, [cat]: !prev[cat] }));
  };

  // 수강권 모달과 동일한 선택 상태 계산 (applicable 기준)
  const isAllTicketsSelected = applicableTickets.length > 0 && selectedTicketIds.length === applicableTickets.length;
  const isPartialTicketsSelected = selectedTicketIds.length > 0 && selectedTicketIds.length < applicableTickets.length;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Step by Step 모드가 아닌 경우 (수정 모드)에만 기존 로직 실행
    if (classData) {
      await handleUpdateClass();
      return;
    }
    
    // 새 클래스 등록 시 Step 3에서만 실제 저장
    if (!classData && currentStep !== 3) {
      console.log('Step 3가 아니므로 저장하지 않습니다. currentStep:', currentStep);
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
      // 강사 이름이 직접 입력된 경우 title에 포함시키거나 별도 처리
      let finalTitle = formData.title;
      if (!formData.instructor_id && formData.instructor_name.trim()) {
        // 강사 이름이 직접 입력된 경우 title에 포함 (선택사항)
        // 또는 그냥 instructor_id만 null로 저장
      }

      // 선택된 수강권 중 팝업/워크샵이 있으면 allowPopup/allowWorkshop true (access_config 호환)
      const allowPopup = selectedTicketIds.some((id) => {
        const t = availableTickets.find((x) => x.id === id);
        return t && getTicketCategory(t) === 'popup';
      });
      const allowWorkshop = selectedTicketIds.some((id) => {
        const t = availableTickets.find((x) => x.id === id);
        return t && getTicketCategory(t) === 'workshop';
      });

      const dataToSave: any = {
        academy_id: academyId,
        title: finalTitle || null,
        genre: formData.genre || null,
        difficulty_level: formData.difficulty_level || null, // nullable
        class_type: ['regular', 'popup', 'workshop'].includes(formData.class_type) 
          ? formData.class_type 
          : 'regular',
        description: formData.description || null,
        instructor_id: formData.instructor_id || null, // nullable
        hall_id: formData.hall_id || null, // nullable
        max_students: formData.max_students > 0 ? formData.max_students : null, // nullable, 0이면 null
        is_active: formData.is_active,
        access_config: {
          requiredGroup: null,
          allowRegularTicket: false, // ticket_classes로 관리하므로 false
          allowCoupon: allowPopup, // 호환성: 선택된 팝업 수강권 있으면 true
          allowPopup,
          allowWorkshop,
        },
        start_time: null,
        end_time: null,
      };

      let classId: string;

      if (classData) {
        const { error } = await supabase
          .from('classes')
          .update(dataToSave)
          .eq('id', classData.id);

        if (error) throw error;
        classId = classData.id;
        
        // ticket_classes 테이블 처리는 handleUpdateClass에서 처리됨
        // 여기서는 새 클래스 등록 시에만 처리
      } else {
        const { data: newClass, error } = await supabase
          .from('classes')
          .insert([dataToSave])
          .select()
          .single();

        if (error) throw error;
        classId = newClass.id;
      }

      // 포스터 업로드
      const finalPosterUrl = await uploadPoster(classId);
      if (finalPosterUrl) {
        await supabase.from('classes').update({ poster_url: finalPosterUrl }).eq('id', classId);
      }

      // ticket_classes 테이블 처리
      // 1. 기존 연결 삭제 (신규 등록이므로 없을 수 있지만 안전을 위해)
      const { error: deleteError } = await supabase
        .from('ticket_classes')
        .delete()
        .eq('class_id', classId);
      
      if (deleteError) {
        console.warn('기존 수강권 연결 삭제 실패:', deleteError.message);
      }
      
      // 2. 선택된 수강권 연결 저장
      if (selectedTicketIds.length > 0) {
        const validTicketIds = selectedTicketIds.filter(ticketId => 
          availableTickets.some(t => t.id === ticketId)
        );
        
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
          
          console.log(`ticket_classes에 ${insertedData?.length || 0}개의 수강권 연결이 저장되었습니다.`);
        }
      }

      const successMessage = `클래스가 등록되었습니다.${selectedTicketIds.length > 0 ? `\n${selectedTicketIds.length}개의 수강권이 연결되었습니다.` : '\n연결된 수강권이 없습니다.'}`;
      alert(successMessage);
      onClose();
    } catch (error: any) {
      console.error('Error saving class:', error);
      alert(`클래스 저장에 실패했습니다: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!classData || !window.confirm('정말 이 클래스를 삭제하시겠습니까? 연결된 스케줄도 영향을 받을 수 있습니다.')) return;

    setLoading(true);
    const supabase = getSupabaseClient();
    if (!supabase) {
      alert('데이터베이스 연결에 실패했습니다.');
      setLoading(false);
      return;
    }

    try {
      const { error } = await supabase
        .from('classes')
        .update({ is_canceled: true })
        .eq('id', classData.id);

      if (error) throw error;
      alert('클래스가 삭제되었습니다.');
      onClose();
    } catch (error: any) {
      console.error('Error deleting class:', error);
      alert(`클래스 삭제에 실패했습니다: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateClass = async () => {
    // 수정 모드용 별도 함수
    setLoading(true);

    const supabase = getSupabaseClient();
    if (!supabase) {
      alert('데이터베이스 연결에 실패했습니다.');
      setLoading(false);
      return;
    }

    try {
      let finalTitle = formData.title;

      const allowPopup = selectedTicketIds.some((id) => {
        const t = availableTickets.find((x) => x.id === id);
        return t && getTicketCategory(t) === 'popup';
      });
      const allowWorkshop = selectedTicketIds.some((id) => {
        const t = availableTickets.find((x) => x.id === id);
        return t && getTicketCategory(t) === 'workshop';
      });

      const dataToSave: any = {
        academy_id: academyId,
        title: finalTitle || null,
        genre: formData.genre || null,
        difficulty_level: formData.difficulty_level || null, // nullable
        class_type: ['regular', 'popup', 'workshop'].includes(formData.class_type) 
          ? formData.class_type 
          : 'regular',
        description: formData.description || null,
        instructor_id: formData.instructor_id || null, // nullable
        hall_id: formData.hall_id || null, // nullable
        max_students: formData.max_students > 0 ? formData.max_students : null, // nullable, 0이면 null
        is_active: formData.is_active,
        access_config: {
          requiredGroup: null,
          allowRegularTicket: false,
          allowCoupon: allowPopup,
          allowPopup,
          allowWorkshop,
        },
        start_time: null,
        end_time: null,
      };

      // 포스터 업로드
      const finalPosterUrl = await uploadPoster(classData.id);
      dataToSave.poster_url = finalPosterUrl;

      const { error } = await supabase
        .from('classes')
        .update(dataToSave)
        .eq('id', classData.id);

      if (error) throw error;

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
        <p className="text-sm text-gray-500 dark:text-gray-400">이 클래스의 유형을 선택해주세요.</p>
      </div>
      
      <div className="grid grid-cols-3 gap-4">
        {CLASS_TYPES.map((type) => (
          <button
            key={type.value}
            type="button"
            onClick={() => setFormData({ ...formData, class_type: type.value })}
            className={`p-6 rounded-xl border-2 transition-all ${
              formData.class_type === type.value
                ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-500 text-blue-700 dark:text-blue-400 shadow-lg scale-105'
                : 'bg-white dark:bg-neutral-900 border-gray-200 dark:border-neutral-700 hover:border-blue-300 dark:hover:border-blue-700 text-gray-700 dark:text-gray-300 hover:shadow-md'
            }`}
          >
            <div className="font-bold text-lg mb-1">{type.label}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {type.value === 'regular' && '정기적으로 진행되는 정규 수업'}
              {type.value === 'popup' && '특별 이벤트나 단기 수업'}
              {type.value === 'workshop' && '집중 워크샵 형태의 수업'}
            </div>
          </button>
        ))}
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
            value={formData.instructor_name}
            onChange={(e) => {
              setFormData({ ...formData, instructor_name: e.target.value, instructor_id: '' });
            }}
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
              <option value="">선택하세요</option>
              {halls.map((hall) => (
                <option key={hall.id} value={hall.id}>
                  {hall.name} {hall.capacity ? `(${hall.capacity}명)` : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              최대 인원 *
            </label>
            <input
              type="number"
              required
              min="1"
              className="w-full border dark:border-neutral-700 rounded-lg px-4 py-3 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
              value={formData.max_students}
              onChange={(e) => setFormData({ ...formData, max_students: parseInt(e.target.value) || 20 })}
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

  const TICKET_SECTION_CONFIG: Record<'regular' | 'popup' | 'workshop', { label: string; headerBg: string; border: string; iconBg: string }> = {
    regular: { label: labels.regular, headerBg: 'bg-blue-50 dark:bg-blue-900/20', border: 'border-blue-200 dark:border-blue-800', iconBg: 'bg-blue-100 dark:bg-blue-900/40' },
    popup: { label: labels.popup, headerBg: 'bg-purple-50 dark:bg-purple-900/20', border: 'border-purple-200 dark:border-purple-800', iconBg: 'bg-purple-100 dark:bg-purple-900/40' },
    workshop: { label: labels.workshop, headerBg: 'bg-amber-50 dark:bg-amber-900/20', border: 'border-amber-200 dark:border-amber-800', iconBg: 'bg-amber-100 dark:bg-amber-900/40' },
  };

  const renderTicketCard = (ticket: any, isSelected: boolean) => (
    <div
      key={ticket.id}
      onClick={() => handleToggleTicket(ticket.id)}
      className={`flex items-center gap-4 p-4 border-2 rounded-xl cursor-pointer transition-all ${
        isSelected ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-400 dark:border-blue-600 shadow-md' : 'bg-white dark:bg-neutral-900 border-gray-200 dark:border-neutral-700 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-sm'
      }`}
    >
      {isSelected ? <CheckSquare size={22} className="text-blue-600 dark:text-blue-400 shrink-0" /> : <Square size={22} className="text-gray-400 shrink-0" />}
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-gray-900 dark:text-white mb-1 truncate">{ticket.name}</div>
        <div className="flex items-center gap-2 flex-wrap">
          {ticket.is_general && <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-md text-xs font-medium">전체 이용</span>}
          {ticket.ticket_type === 'PERIOD' && ticket.valid_days && <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-md text-xs">{ticket.valid_days}일</span>}
          {ticket.ticket_type === 'COUNT' && ticket.total_count && <span className="px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded-md text-xs">{ticket.total_count}회</span>}
          {ticket.price && <span className="px-2 py-1 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-md text-xs font-medium">{ticket.price.toLocaleString()}원</span>}
        </div>
      </div>
      {isSelected && <div className="shrink-0"><div className="w-2 h-2 bg-blue-600 dark:bg-blue-400 rounded-full animate-pulse" /></div>}
    </div>
  );

  // 클래스 유형 무관하게 정규/팝업/워크샵 3종 모두 동일하게 노출
  const step3Sections: ('regular' | 'popup' | 'workshop')[] = ['regular', 'popup', 'workshop'];

  const renderStep3 = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">수강권 설정</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">이 수업을 들을 수 있는 수강권을 정규/팝업/워크샵별로 선택하세요.</p>
      </div>

      {loadingTickets ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2" />
          <p>수강권 목록을 불러오는 중...</p>
        </div>
      ) : availableTickets.length === 0 ? (
        <div className="space-y-3">
          <div className="bg-amber-50 dark:bg-amber-900/20 border-2 border-amber-200 dark:border-amber-800 rounded-xl p-6 text-center">
            <Ticket size={32} className="mx-auto mb-3 text-amber-600 dark:text-amber-400" />
            <p className="text-sm font-medium text-amber-700 dark:text-amber-400 mb-1">등록된 수강권이 없습니다</p>
            <p className="text-xs text-amber-600 dark:text-amber-500">아래 버튼을 눌러 새 수강권을 만들어주세요.</p>
          </div>
          <button type="button" onClick={() => setShowTicketModal(true)} className="w-full py-3 border-2 border-blue-400 dark:border-blue-600 bg-blue-50 dark:bg-blue-900/20 rounded-xl text-blue-600 dark:text-blue-400 text-sm font-medium hover:bg-blue-100 dark:hover:bg-blue-900/30 flex items-center justify-center gap-2 transition-all">
            <Plus size={18} /> 새 수강권 만들기
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" placeholder="수강권 검색..." value={ticketSearchQuery} onChange={(e) => setTicketSearchQuery(e.target.value)} className="w-full pl-9 pr-3 py-3 border-2 dark:border-neutral-700 rounded-xl bg-gray-50 dark:bg-neutral-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
          </div>

          {step3Sections.map((cat) => {
            const list = getTicketsByCategory(cat);
            const config = TICKET_SECTION_CONFIG[cat];
            const isOpen = expandedSections[cat] ?? false;
            const sectionSelected = list.filter((t) => selectedTicketIds.includes(t.id)).length;
            const sectionAllSelected = list.length > 0 && list.every((t) => selectedTicketIds.includes(t.id));
            const Icon = cat === 'regular' ? Ticket : cat === 'popup' ? Zap : Tag;
            return (
              <div key={cat} className={`rounded-xl border-2 overflow-hidden ${config.border}`}>
                <button type="button" onClick={() => toggleSection(cat)} className={`w-full p-4 flex items-center justify-between ${config.headerBg} transition-colors hover:opacity-90`}>
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${config.iconBg}`}><Icon size={18} className={cat === 'regular' ? 'text-blue-500' : cat === 'popup' ? 'text-purple-500' : 'text-amber-500'} /></div>
                    <div className="text-left">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-gray-800 dark:text-white">{config.label}</h3>
                        <span className="text-xs font-bold px-2 py-0.5 rounded bg-white/60 dark:bg-black/20">{list.length}개</span>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">이 수강권으로 이 클래스를 수강할 수 있게 하려면 체크하세요.</p>
                    </div>
                  </div>
                  {isOpen ? <ChevronUp size={20} className="text-gray-400" /> : <ChevronDown size={20} className="text-gray-400" />}
                </button>
                {isOpen && (
                  <div className="p-4 space-y-2 border-t dark:border-neutral-800 bg-white dark:bg-neutral-900">
                    {list.length === 0 ? (
                      <div className="text-center py-4 text-gray-500 dark:text-gray-400 text-sm">{ticketSearchQuery ? `"${ticketSearchQuery}"에 대한 검색 결과가 없습니다.` : `등록된 ${config.label}이(가) 없습니다.`}</div>
                    ) : (
                      <>
                        <div onClick={() => handleSelectAllForCategory(cat)} className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-neutral-800 cursor-pointer hover:bg-gray-100 dark:hover:bg-neutral-750">
                          {sectionAllSelected ? <CheckSquare size={20} className="text-blue-600 dark:text-blue-400 shrink-0" /> : sectionSelected > 0 ? <div className="w-5 h-5 border-2 border-blue-600 dark:border-blue-400 bg-blue-600 dark:bg-blue-500 rounded flex items-center justify-center"><div className="w-2.5 h-0.5 bg-white" /></div> : <Square size={20} className="text-gray-400 shrink-0" />}
                          <span className="font-medium text-gray-900 dark:text-white text-sm">전체 선택</span>
                          <span className="ml-auto text-sm text-gray-500 dark:text-gray-400">{sectionSelected} / {list.length}</span>
                        </div>
                        <div className="grid gap-2 max-h-48 overflow-y-auto">
                          {list.map((ticket) => renderTicketCard(ticket, selectedTicketIds.includes(ticket.id)))}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          <button type="button" onClick={() => setShowTicketModal(true)} className="w-full py-3 border-2 border-gray-300 dark:border-neutral-700 border-dashed rounded-xl text-gray-500 dark:text-gray-400 text-sm hover:bg-gray-50 dark:hover:bg-neutral-800 hover:border-blue-400 dark:hover:border-blue-600 flex items-center justify-center gap-2 transition-all">
            <Plus size={18} /> 새 수강권 만들기
          </button>
        </div>
      )}

      {availableTickets.length > 0 && (
        <div className={`p-4 rounded-xl border-2 ${selectedTicketIds.length > 0 ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800' : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'}`}>
          {selectedTicketIds.length > 0 ? (
            <div className="flex items-start gap-2">
              <CheckSquare size={18} className="text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-blue-700 dark:text-blue-400">{selectedTicketIds.length}개의 수강권이 선택되었습니다</p>
                <p className="text-xs text-blue-600 dark:text-blue-500 mt-1">선택한 수강권으로 이 수업을 수강할 수 있습니다.</p>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-2">
              <div className="w-4 h-4 border-2 border-amber-600 dark:border-amber-400 rounded shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-700 dark:text-amber-400">수강권이 선택되지 않았습니다</p>
                <p className="text-xs text-amber-600 dark:text-amber-500 mt-1">수강권을 선택하지 않으면 이 수업은 어떤 수강권으로도 들을 수 없습니다.</p>
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
        <div className="p-6 border-b dark:border-neutral-800 flex justify-between items-center sticky top-0 bg-white dark:bg-neutral-900 z-10">
          <h3 className="text-xl font-bold text-gray-800 dark:text-white">
            {classData ? '클래스 수정' : '새 클래스 등록'}
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
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handlePrevStep(e);
                    }}
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
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleNextStep(e);
                    }}
                    className="flex items-center gap-2 px-6 py-3 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors"
                  >
                    다음
                    <ChevronRight size={20} />
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={loading}
                    onClick={(e) => {
                      // Step 3에서만 submit 허용
                      if (currentStep !== 3) {
                        e.preventDefault();
                        e.stopPropagation();
                        return;
                      }
                    }}
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
              {/* 활성화 상태 토글 */}
              <div className={`flex items-center justify-between p-3 rounded-lg ${
                formData.is_active 
                  ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800' 
                  : 'bg-gray-100 dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700'
              }`}>
                <div>
                  <span className={`font-medium ${
                    formData.is_active
                      ? 'text-blue-700 dark:text-blue-300'
                      : 'text-gray-600 dark:text-gray-400'
                  }`}>
                    {formData.is_active ? '활성화 상태' : '비활성화 상태'}
                  </span>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {formData.is_active 
                      ? '이 클래스로 스케줄을 생성할 수 있습니다.' 
                      : '비활성화된 클래스는 스케줄 생성 목록에서 숨겨집니다.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, is_active: !formData.is_active })}
                  className={`transition-colors ${
                    formData.is_active
                      ? 'text-blue-600 dark:text-blue-400 hover:text-blue-700'
                      : 'text-gray-400 dark:text-gray-500 hover:text-gray-500'
                  }`}
                >
                  {formData.is_active ? <ToggleRight size={32} /> : <ToggleLeft size={32} />}
                </button>
              </div>

          {/* 기본 정보 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              클래스명 *
            </label>
            <input
              type="text"
              required
              className="w-full border dark:border-neutral-700 rounded-lg px-3 py-2 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="예: KPOP 기초반"
            />
          </div>

              <input
                type="text"
                className="w-full border dark:border-neutral-700 rounded-lg px-3 py-2 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
                value={formData.instructor_name}
                onChange={(e) => {
                  setFormData({ ...formData, instructor_name: e.target.value, instructor_id: '' });
                }}
                placeholder="예: 홍길동"
              />

          <div className="grid grid-cols-2 gap-4">
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
                  <option key={genre} value={genre}>{genre}</option>
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
                <option value="">선택 안함</option>
                {DIFFICULTY_LEVELS.map((level) => (
                  <option key={level} value={level}>{level}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                클래스 유형 *
              </label>
              <div className="grid grid-cols-3 gap-2">
                {CLASS_TYPES.map((type) => (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => setFormData({ ...formData, class_type: type.value })}
                    className={`p-3 rounded-lg border-2 transition-colors ${
                      formData.class_type === type.value
                        ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-500 text-blue-700 dark:text-blue-400'
                        : 'bg-gray-50 dark:bg-neutral-800 border-gray-200 dark:border-neutral-700 hover:bg-gray-100 dark:hover:bg-neutral-750 text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    <div className="font-semibold text-sm">{type.label}</div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                기본 홀
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
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              최대 인원
            </label>
            <input
              type="number"
              min="0"
              className="w-full border dark:border-neutral-700 rounded-lg px-3 py-2 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
              value={formData.max_students || ''}
              onChange={(e) => setFormData({ ...formData, max_students: parseInt(e.target.value) || 0 })}
              placeholder="0 (선택 안함)"
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

          {/* 수강권 설정 - 정규/팝업/워크샵 아코디언 (Step3와 동일) */}
          <div className="border-t dark:border-neutral-800 pt-4 mt-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
              <Ticket size={14} /> 이 클래스를 들을 수 있는 수강권
            </label>
            <div className="relative mb-3">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="text" placeholder="수강권 검색..." value={ticketSearchQuery} onChange={(e) => setTicketSearchQuery(e.target.value)} className="w-full pl-9 pr-3 py-2 border dark:border-neutral-700 rounded-lg bg-gray-50 dark:bg-neutral-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            {loadingTickets ? (
              <div className="p-4 text-center text-gray-500 dark:text-gray-400 text-sm">수강권 목록 불러오는 중...</div>
            ) : availableTickets.length === 0 ? (
              <div className="p-4 text-center text-amber-600 dark:text-amber-400 text-sm">
                <Info size={16} className="inline mr-1" /> 등록된 수강권이 없습니다.
              </div>
            ) : (
              <div className="space-y-2">
                {step3Sections.map((cat) => {
                  const list = getTicketsByCategory(cat);
                  const config = TICKET_SECTION_CONFIG[cat];
                  const isOpen = expandedSections[cat] ?? false;
                  const sectionSelected = list.filter((t) => selectedTicketIds.includes(t.id)).length;
                  const sectionAllSelected = list.length > 0 && list.every((t) => selectedTicketIds.includes(t.id));
                  const Icon = cat === 'regular' ? Ticket : cat === 'popup' ? Zap : Tag;
                  return (
                    <div key={cat} className={`rounded-lg border-2 overflow-hidden ${config.border}`}>
                      <button type="button" onClick={() => toggleSection(cat)} className={`w-full p-3 flex items-center justify-between ${config.headerBg} transition-colors hover:opacity-90 text-left`}>
                        <div className="flex items-center gap-2">
                          <div className={`p-1.5 rounded ${config.iconBg}`}><Icon size={16} className={cat === 'regular' ? 'text-blue-500' : cat === 'popup' ? 'text-purple-500' : 'text-amber-500'} /></div>
                          <span className="font-bold text-sm text-gray-800 dark:text-white">{config.label}</span>
                          <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-white/60 dark:bg-black/20">{list.length}개</span>
                        </div>
                        {isOpen ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
                      </button>
                      {isOpen && (
                        <div className="p-3 space-y-2 border-t dark:border-neutral-800 bg-white dark:bg-neutral-900">
                          {list.length === 0 ? (
                            <div className="text-center py-2 text-gray-500 dark:text-gray-400 text-xs">{ticketSearchQuery ? `"${ticketSearchQuery}" 검색 결과 없음` : `${config.label} 없음`}</div>
                          ) : (
                            <>
                              <div onClick={() => handleSelectAllForCategory(cat)} className="flex items-center gap-2 p-2 rounded bg-gray-50 dark:bg-neutral-800 cursor-pointer hover:bg-gray-100 dark:hover:bg-neutral-750 text-sm">
                                {sectionAllSelected ? <CheckSquare size={16} className="text-blue-600 dark:text-blue-400 shrink-0" /> : sectionSelected > 0 ? <div className="w-4 h-4 border-2 border-blue-600 bg-blue-600 rounded flex items-center justify-center"><div className="w-2 h-0.5 bg-white" /></div> : <Square size={16} className="text-gray-400 shrink-0" />}
                                <span className="font-medium text-gray-900 dark:text-white">전체 선택</span>
                                <span className="ml-auto text-xs text-gray-500">{sectionSelected}/{list.length}</span>
                              </div>
                              <div className="grid gap-1.5 max-h-40 overflow-y-auto">
                                {list.map((ticket) => renderTicketCard(ticket, selectedTicketIds.includes(ticket.id)))}
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            <button type="button" onClick={() => setShowTicketModal(true)} className="w-full mt-4 py-3 border border-gray-300 dark:border-neutral-700 border-dashed rounded-lg text-gray-500 dark:text-gray-400 text-sm hover:bg-gray-100 dark:hover:bg-neutral-800 flex items-center justify-center gap-2 transition-colors">
              <Plus size={16} /> 새 수강권 만들기
            </button>
          </div>

              {/* 수정 모드 버튼 */}
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={handleDelete}
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
          ticketLabels={labels}
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
