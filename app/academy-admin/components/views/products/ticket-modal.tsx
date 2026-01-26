"use client";

import { useState, useEffect, useMemo } from 'react';
import { X, Lock, Info, CheckSquare, Square, Ticket, Tag, Search } from 'lucide-react';
import { getSupabaseClient } from '@/lib/utils/supabase-client';

interface TicketModalProps {
  academyId: string;
  ticket?: any;
  initialCategory?: 'regular' | 'popup' | 'workshop';
  onClose: () => void;
}

interface ClassItem {
  id: string;
  title: string | null;
  genre: string | null;
  difficulty_level: string | null;
  class_type: string | null;
}

// 정규 수강권용 기간 프리셋
const PERIOD_PRESETS = [
  { label: '1개월', days: 30 },
  { label: '3개월', days: 90 },
  { label: '6개월', days: 180 },
  { label: '12개월', days: 365 },
];

// 팝업/워크샵 수강권용 횟수 프리셋
const COUNT_PRESETS = [
  { label: '1회', count: 1 },
  { label: '3회', count: 3 },
  { label: '5회', count: 5 },
  { label: '10회', count: 10 },
];

// 팝업 쿠폰용 유효기간 프리셋 (일수)
const POPUP_VALIDITY_PRESETS = [
  { label: '30일', days: 30 },
  { label: '60일', days: 60 },
  { label: '90일', days: 90 },
  { label: '무제한', days: null },
];

// 수강권 유형 정보
const TICKET_CATEGORY_INFO = {
  regular: {
    name: '정규 수강권',
    description: '특정 클래스를 기간 내 무제한 수강 가능. 구매 시 시작일 선택.',
    color: 'blue',
    icon: 'Ticket',
    ticketType: 'PERIOD' as const,
  },
  popup: {
    name: '팝업 쿠폰',
    description: '횟수 기반 수강권. 유효기간 내 횟수를 소진하지 않으면 잔여 수량 소멸.',
    color: 'purple',
    icon: 'Tag',
    ticketType: 'COUNT' as const,
  },
  workshop: {
    name: '워크샵 수강권',
    description: '특정 워크샵 수업 전용. 해당 워크샵에서만 사용 가능한 수강권.',
    color: 'amber',
    icon: 'Tag',
    ticketType: 'COUNT' as const,
  },
};

type ProductCategory = 'regular' | 'popup' | 'workshop';

export function TicketModal({ academyId, ticket, initialCategory, onClose }: TicketModalProps) {
  // 상품 카테고리: 정규 수강권 / 팝업 수강권 / 워크샵 수강권
  const [productCategory, setProductCategory] = useState<ProductCategory>(initialCategory || 'regular');
  
  const [formData, setFormData] = useState({
    name: '',
    price: 0,
    ticket_type: (initialCategory === 'popup' || initialCategory === 'workshop' ? 'COUNT' : 'PERIOD') as 'COUNT' | 'PERIOD',
    total_count: (initialCategory === 'popup' || initialCategory === 'workshop' ? 1 : null) as number | null,
    valid_days: null as number | null,
    is_on_sale: true,
  });
  
  const [loading, setLoading] = useState(false);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);
  const [useCustomPeriod, setUseCustomPeriod] = useState(false);
  const [useCustomCount, setUseCustomCount] = useState(false);
  const [useCustomPopupValidity, setUseCustomPopupValidity] = useState(false);
  const [popupValidDays, setPopupValidDays] = useState<number | null>(initialCategory === 'popup' ? 30 : null); // 팝업 쿠폰 기본 유효기간 30일
  const [classSearchQuery, setClassSearchQuery] = useState('');
  
  // 검색 필터링된 클래스 목록
  const filteredClasses = useMemo(() => {
    if (!classSearchQuery.trim()) return classes;
    const query = classSearchQuery.toLowerCase();
    return classes.filter(cls => 
      (cls.title?.toLowerCase().includes(query)) ||
      (cls.genre?.toLowerCase().includes(query)) ||
      (cls.difficulty_level?.toLowerCase().includes(query))
    );
  }, [classes, classSearchQuery]);

  useEffect(() => {
    loadClasses();
  }, [academyId]);

  useEffect(() => {
    if (ticket) {
      // 수강권 타입 확인: ticket_category 우선, 없으면 access_group 또는 is_coupon으로 판단
      let category: ProductCategory = 'regular';
      if (ticket.ticket_category === 'popup' || ticket.ticket_category === 'workshop') {
        category = ticket.ticket_category;
      } else if (ticket.access_group === 'popup') {
        category = 'popup';
      } else if (ticket.access_group === 'workshop') {
        category = 'workshop';
      } else if (ticket.is_coupon === true) {
        // 기존 쿠폰은 팝업으로 분류
        category = 'popup';
      }
      setProductCategory(category);
      
      setFormData({
        name: ticket.name || '',
        price: ticket.price || 0,
        ticket_type: ticket.ticket_type || (category === 'regular' ? 'PERIOD' : 'COUNT'),
        total_count: ticket.total_count,
        valid_days: ticket.valid_days,
        is_on_sale: ticket.is_on_sale !== false,
      });
      
      // 프리셋에 없는 값이면 커스텀 모드
      if (ticket.valid_days) {
        setUseCustomPeriod(!PERIOD_PRESETS.some(p => p.days === ticket.valid_days));
      }
      if (ticket.total_count && category !== 'regular') {
        setUseCustomCount(!COUNT_PRESETS.some(p => p.count === ticket.total_count));
      }
      
      // 팝업/워크샵 수강권의 유효기간 로드
      if (category === 'popup' || category === 'workshop') {
        setPopupValidDays(ticket.valid_days);
        if (ticket.valid_days !== null) {
          setUseCustomPopupValidity(!POPUP_VALIDITY_PRESETS.some(p => p.days === ticket.valid_days));
        }
      }
      
      // 기존 연결된 클래스 로드 (정규 수강권인 경우에만)
      if (ticket.id && category === 'regular') {
        loadLinkedClasses(ticket.id);
      }
    }
  }, [ticket]);

  const loadClasses = async () => {
    setLoadingClasses(true);
    const supabase = getSupabaseClient();
    if (!supabase) {
      setLoadingClasses(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('classes')
        .select('id, title, genre, difficulty_level, class_type')
        .eq('academy_id', academyId)
        .or('is_canceled.is.null,is_canceled.eq.false')
        .order('title');

      if (error) throw error;
      const loadedClasses = data || [];
      setClasses(loadedClasses);
      
      // 신규 생성 시 전체 선택
      if (!ticket) {
        setSelectedClassIds(loadedClasses.map((c: ClassItem) => c.id));
      }
    } catch (error) {
      console.error('Error loading classes:', error);
    } finally {
      setLoadingClasses(false);
    }
  };

  const loadLinkedClasses = async (ticketId: string) => {
    const supabase = getSupabaseClient();
    if (!supabase) return;

    try {
      const { data, error } = await supabase
        .from('ticket_classes')
        .select('class_id')
        .eq('ticket_id', ticketId);

      if (error) {
        console.error('Error loading ticket_classes:', error);
        // 에러가 발생해도 계속 진행 (테이블이 없을 수도 있음)
        return;
      }
      
      if (data && data.length > 0) {
        setSelectedClassIds(data.map((d: { class_id: string }) => d.class_id));
      } else {
        // ticket_classes에 데이터가 없으면 빈 배열로 설정
        setSelectedClassIds([]);
      }
    } catch (error) {
      console.error('Error loading linked classes:', error);
      setSelectedClassIds([]);
    }
  };

  const handleSelectAll = () => {
    if (selectedClassIds.length === classes.length) {
      setSelectedClassIds([]);
    } else {
      setSelectedClassIds(classes.map(c => c.id));
    }
  };

  const handleToggleClass = (classId: string) => {
    setSelectedClassIds(prev => 
      prev.includes(classId) 
        ? prev.filter(id => id !== classId)
        : [...prev, classId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // 정규 수강권인 경우 클래스 선택 필수
    if (productCategory === 'regular' && selectedClassIds.length === 0) {
      alert('최소 1개 이상의 클래스를 선택해주세요.');
      return;
    }
    
    // 전체 선택 여부 판단 (정규 수강권만 해당)
    const isGeneral = productCategory === 'regular' && selectedClassIds.length === classes.length;

    setLoading(true);

    const supabase = getSupabaseClient();
    if (!supabase) {
      alert('데이터베이스 연결에 실패했습니다.');
      setLoading(false);
      return;
    }

    try {
      // 정규 수강권: 기간제(PERIOD), 팝업/워크샵: 횟수제(COUNT)
      const ticketData = {
        academy_id: academyId,
        name: formData.name,
        price: formData.price,
        ticket_type: productCategory === 'regular' ? 'PERIOD' : 'COUNT',
        total_count: productCategory === 'regular' ? null : formData.total_count,
        // 정규: 이용 기간, 팝업/워크샵: 유효기간(소멸 기한)
        valid_days: productCategory === 'regular' 
          ? formData.valid_days 
          : popupValidDays,
        is_on_sale: formData.is_on_sale,
        is_coupon: productCategory !== 'regular', // 팝업/워크샵은 쿠폰으로 처리
        is_general: isGeneral,
        class_id: null,
        access_group: productCategory === 'regular' 
          ? (isGeneral ? 'general' : null)
          : productCategory, // 'popup' 또는 'workshop'
        ticket_category: productCategory, // 'regular' | 'popup' | 'workshop'
      };

      let ticketId: string;

      if (ticket) {
        const { error } = await supabase.from('tickets').update(ticketData).eq('id', ticket.id);
        if (error) throw error;
        ticketId = ticket.id;
      } else {
        const { data, error } = await supabase.from('tickets').insert([ticketData]).select('id').single();
        if (error) throw error;
        ticketId = data.id;
      }

      // ticket_classes 테이블 처리
      // 1. 기존 연결 삭제
      const { error: deleteError } = await supabase
        .from('ticket_classes')
        .delete()
        .eq('ticket_id', ticketId);
      
      if (deleteError) {
        console.error('Error deleting ticket_classes:', deleteError);
        // 삭제 실패는 치명적이지 않을 수 있으므로 경고만
        console.warn('기존 클래스 연결 삭제 실패했지만 계속 진행합니다:', deleteError.message);
      }
      
      // 2. 정규 수강권이고 전체 선택이 아닌 경우에만 클래스 연결 저장
      if (productCategory === 'regular' && !isGeneral && selectedClassIds.length > 0) {
        const linkData = selectedClassIds.map(classId => ({
          ticket_id: ticketId,
          class_id: classId,
        }));
        
        const { data: insertedData, error: linkError } = await supabase
          .from('ticket_classes')
          .insert(linkData)
          .select();
        
        if (linkError) {
          console.error('Error saving ticket_classes:', linkError);
          throw new Error(`클래스 연결 저장 실패: ${linkError.message}`);
        }
        
        // 저장 확인 로그
        console.log(`ticket_classes에 ${insertedData?.length || 0}개의 클래스 연결이 저장되었습니다.`, {
          ticketId,
          classIds: selectedClassIds,
        });
      } else if (productCategory === 'regular' && isGeneral) {
        // 전체 선택인 경우(is_general=true)는 ticket_classes에 저장하지 않음
        // 이미 위에서 삭제했으므로 추가 작업 불필요
        console.log('전체 수강권이므로 ticket_classes에 저장하지 않습니다.');
      }

      alert(ticket 
        ? `${TICKET_CATEGORY_INFO[productCategory].name}이(가) 수정되었습니다.`
        : `${TICKET_CATEGORY_INFO[productCategory].name}이(가) 등록되었습니다.`
      );
      onClose();
    } catch (error: any) {
      console.error('Error saving:', error);
      alert(`저장에 실패했습니다: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const isAllSelected = classes.length > 0 && selectedClassIds.length === classes.length;
  const isPartialSelected = selectedClassIds.length > 0 && selectedClassIds.length < classes.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 dark:bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b dark:border-neutral-800 flex justify-between items-center sticky top-0 bg-white dark:bg-neutral-900 z-10">
          <h3 className="text-xl font-bold text-gray-800 dark:text-white">
            {ticket 
              ? '수강권 수정'
              : '상품 등록'
            }
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* 상품 카테고리 선택 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              수강권 유형 *
            </label>
            <div className="grid grid-cols-1 gap-3">
              {/* 정규 수강권 */}
              <button
                type="button"
                onClick={() => {
                  setProductCategory('regular');
                  setFormData({ ...formData, ticket_type: 'PERIOD', total_count: null });
                }}
                className={`p-4 rounded-lg border flex flex-col items-start gap-2 transition-colors ${
                  productCategory === 'regular'
                    ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-500 text-blue-700 dark:text-blue-400'
                    : 'bg-gray-50 dark:bg-neutral-800 border-gray-200 dark:border-neutral-700 hover:bg-gray-100 dark:hover:bg-neutral-750'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Ticket className="w-5 h-5" />
                  <span className="font-semibold">{TICKET_CATEGORY_INFO.regular.name}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 font-medium">
                    기간제
                  </span>
                </div>
                <span className="text-xs text-gray-600 dark:text-gray-300 text-left">
                  1개월/3개월/6개월/1년권 등. 구매 시 시작일 선택, 기간 내 무제한 수강.
                </span>
              </button>

              {/* 팝업 쿠폰 */}
              <button
                type="button"
                onClick={() => {
                  setProductCategory('popup');
                  setFormData({ ...formData, ticket_type: 'COUNT', total_count: 1 });
                  setPopupValidDays(30);
                }}
                className={`p-4 rounded-lg border flex flex-col items-start gap-2 transition-colors ${
                  productCategory === 'popup'
                    ? 'bg-purple-50 dark:bg-purple-900/20 border-purple-500 text-purple-700 dark:text-purple-400'
                    : 'bg-gray-50 dark:bg-neutral-800 border-gray-200 dark:border-neutral-700 hover:bg-gray-100 dark:hover:bg-neutral-750'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Tag className="w-5 h-5" />
                  <span className="font-semibold">{TICKET_CATEGORY_INFO.popup.name}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 font-medium">
                    횟수제
                  </span>
                </div>
                <span className="text-xs text-gray-600 dark:text-gray-300 text-left">
                  1회/5회/10회권 등. 유효기간 내 미소진 시 잔여 수량 소멸.
                </span>
              </button>

              {/* 워크샵 수강권 */}
              <button
                type="button"
                onClick={() => {
                  setProductCategory('workshop');
                  setFormData({ ...formData, ticket_type: 'COUNT', total_count: 1 });
                  setPopupValidDays(null);
                }}
                className={`p-4 rounded-lg border flex flex-col items-start gap-2 transition-colors ${
                  productCategory === 'workshop'
                    ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-500 text-amber-700 dark:text-amber-400'
                    : 'bg-gray-50 dark:bg-neutral-800 border-gray-200 dark:border-neutral-700 hover:bg-gray-100 dark:hover:bg-neutral-750'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Tag className="w-5 h-5" />
                  <span className="font-semibold">{TICKET_CATEGORY_INFO.workshop.name}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 font-medium">
                    특정 수업 전용
                  </span>
                </div>
                <span className="text-xs text-gray-600 dark:text-gray-300 text-left">
                  특정 워크샵 수업에서만 사용 가능한 전용 수강권.
                </span>
              </button>
            </div>
          </div>

          {/* 상품명 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              수강권명 *
            </label>
            <input
              type="text"
              required
              className="w-full border dark:border-neutral-700 rounded-lg px-3 py-2 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder={
                productCategory === 'regular' 
                  ? '예: 3개월 정기권' 
                  : productCategory === 'popup'
                  ? '예: 팝업 5회권'
                  : '예: 워크샵 3회권'
              }
            />
          </div>

          {/* 가격 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              가격 *
            </label>
            <input
              type="number"
              required
              min="0"
              className="w-full border dark:border-neutral-700 rounded-lg px-3 py-2 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
              value={formData.price}
              onChange={(e) => setFormData({ ...formData, price: parseInt(e.target.value) || 0 })}
            />
          </div>

          {/* 횟수 선택 (팝업/워크샵 수강권) */}
          {(productCategory === 'popup' || productCategory === 'workshop') && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                사용 가능 횟수 *
              </label>
              <div className="flex flex-wrap gap-2 mb-2">
                {COUNT_PRESETS.map((preset) => (
                  <button
                    key={preset.count}
                    type="button"
                    onClick={() => {
                      setFormData({ ...formData, total_count: preset.count });
                      setUseCustomCount(false);
                    }}
                    className={`px-4 py-2 rounded-full border font-medium text-sm transition-colors ${
                      !useCustomCount && formData.total_count === preset.count
                        ? productCategory === 'popup'
                          ? 'bg-purple-600 text-white border-purple-600'
                          : 'bg-amber-600 text-white border-amber-600'
                        : 'border-gray-300 dark:border-neutral-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-neutral-800'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setUseCustomCount(true)}
                  className={`px-4 py-2 rounded-full border font-medium text-sm transition-colors ${
                    useCustomCount
                      ? productCategory === 'popup'
                        ? 'bg-purple-600 text-white border-purple-600'
                        : 'bg-amber-600 text-white border-amber-600'
                      : 'border-gray-300 dark:border-neutral-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-neutral-800'
                  }`}
                >
                  직접 입력
                </button>
              </div>
              {useCustomCount && (
                <input
                  type="number"
                  min="1"
                  required
                  placeholder="횟수를 입력하세요"
                  className="w-full border dark:border-neutral-700 rounded-lg px-3 py-2 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
                  value={formData.total_count || ''}
                  onChange={(e) => setFormData({ ...formData, total_count: parseInt(e.target.value) || null })}
                />
              )}
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {productCategory === 'popup' ? 'Popup' : 'Workshop'} 클래스에서 {formData.total_count || 0}회 수강 가능
              </p>
            </div>
          )}

          {/* 유효기간 선택 (팝업/워크샵 수강권) */}
          {(productCategory === 'popup' || productCategory === 'workshop') && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                유효기간 (구매일 기준)
              </label>
              <div className="flex flex-wrap gap-2 mb-2">
                {POPUP_VALIDITY_PRESETS.map((preset) => (
                  <button
                    key={preset.days ?? 'unlimited'}
                    type="button"
                    onClick={() => {
                      setPopupValidDays(preset.days);
                      setUseCustomPopupValidity(false);
                    }}
                    className={`px-4 py-2 rounded-full border font-medium text-sm transition-colors ${
                      !useCustomPopupValidity && popupValidDays === preset.days
                        ? productCategory === 'popup'
                          ? 'bg-purple-600 text-white border-purple-600'
                          : 'bg-amber-600 text-white border-amber-600'
                        : 'border-gray-300 dark:border-neutral-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-neutral-800'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setUseCustomPopupValidity(true)}
                  className={`px-4 py-2 rounded-full border font-medium text-sm transition-colors ${
                    useCustomPopupValidity
                      ? productCategory === 'popup'
                        ? 'bg-purple-600 text-white border-purple-600'
                        : 'bg-amber-600 text-white border-amber-600'
                      : 'border-gray-300 dark:border-neutral-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-neutral-800'
                  }`}
                >
                  직접 입력
                </button>
              </div>
              {useCustomPopupValidity && (
                <input
                  type="number"
                  min="1"
                  placeholder="일수를 입력하세요"
                  className="w-full border dark:border-neutral-700 rounded-lg px-3 py-2 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
                  value={popupValidDays || ''}
                  onChange={(e) => setPopupValidDays(parseInt(e.target.value) || null)}
                />
              )}
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {popupValidDays 
                  ? `구매 시점으로부터 ${popupValidDays}일 안에 ${formData.total_count || 0}회를 소진해야 합니다. 미소진 잔여 수량은 소멸됩니다.`
                  : '유효기간 없이 횟수가 소진될 때까지 사용 가능합니다.'}
              </p>
            </div>
          )}

          {/* 기간 선택 (수강권 전용 - 기간제만 지원) */}
          {productCategory === 'regular' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                기간 선택 *
              </label>
              <div className="flex flex-wrap gap-2 mb-2">
                {PERIOD_PRESETS.map((preset) => (
                  <button
                    key={preset.days}
                    type="button"
                    onClick={() => {
                      setFormData({ ...formData, valid_days: preset.days });
                      setUseCustomPeriod(false);
                    }}
                    className={`px-4 py-2 rounded-full border font-medium text-sm transition-colors ${
                      !useCustomPeriod && formData.valid_days === preset.days
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'border-gray-300 dark:border-neutral-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-neutral-800'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setUseCustomPeriod(true)}
                  className={`px-4 py-2 rounded-full border font-medium text-sm transition-colors ${
                    useCustomPeriod
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'border-gray-300 dark:border-neutral-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-neutral-800'
                  }`}
                >
                  직접 입력
                </button>
              </div>
              {useCustomPeriod && (
                <input
                  type="number"
                  min="1"
                  required
                  placeholder="일수를 입력하세요"
                  className="w-full border dark:border-neutral-700 rounded-lg px-3 py-2 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
                  value={formData.valid_days || ''}
                  onChange={(e) => setFormData({ ...formData, valid_days: parseInt(e.target.value) || null })}
                />
              )}
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                구매 시 시작일부터 {formData.valid_days || 0}일간 유효
              </p>
            </div>
          )}


          {/* 수강 가능 클래스 (정규 수강권만) */}
          {productCategory === 'regular' && (
            <div className="border-t dark:border-neutral-800 pt-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                <Lock size={14} /> 이 수강권으로 수강 가능한 클래스
              </label>

              <div className="border dark:border-neutral-700 rounded-lg overflow-hidden">
                {/* 검색 입력 */}
                <div className="p-3 border-b dark:border-neutral-700 bg-white dark:bg-neutral-900">
                  <div className="relative">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      placeholder="클래스 검색..."
                      value={classSearchQuery}
                      onChange={(e) => setClassSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 border dark:border-neutral-700 rounded-lg bg-gray-50 dark:bg-neutral-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* 전체 선택 헤더 */}
                <div
                  onClick={handleSelectAll}
                  className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-neutral-800 border-b dark:border-neutral-700 cursor-pointer hover:bg-gray-100 dark:hover:bg-neutral-750"
                >
                  {isAllSelected ? (
                    <CheckSquare size={20} className="text-blue-600" />
                  ) : isPartialSelected ? (
                    <div className="w-5 h-5 border-2 border-blue-600 bg-blue-600 rounded flex items-center justify-center">
                      <div className="w-2.5 h-0.5 bg-white" />
                    </div>
                  ) : (
                    <Square size={20} className="text-gray-400" />
                  )}
                  <span className="font-medium text-gray-900 dark:text-white">
                    전체 선택
                  </span>
                  <span className="ml-auto text-sm text-gray-500 dark:text-gray-400">
                    {selectedClassIds.length} / {classes.length}
                  </span>
                </div>

                {/* 클래스 목록 */}
                <div className="max-h-48 overflow-y-auto">
                  {loadingClasses ? (
                    <div className="p-4 text-center text-gray-500 dark:text-gray-400">
                      클래스 목록 불러오는 중...
                    </div>
                  ) : classes.length === 0 ? (
                    <div className="p-4 text-center text-amber-600 dark:text-amber-400">
                      <Info size={16} className="inline mr-1" />
                      등록된 클래스가 없습니다.
                    </div>
                  ) : filteredClasses.length === 0 ? (
                    <div className="p-4 text-center text-gray-500 dark:text-gray-400">
                      <Search size={16} className="inline mr-1" />
                      &quot;{classSearchQuery}&quot;에 대한 검색 결과가 없습니다.
                    </div>
                  ) : (
                    filteredClasses.map((cls) => (
                      <div
                        key={cls.id}
                        onClick={() => handleToggleClass(cls.id)}
                        className="flex items-center gap-3 p-3 border-b dark:border-neutral-700 last:border-b-0 cursor-pointer hover:bg-gray-50 dark:hover:bg-neutral-800"
                      >
                        {selectedClassIds.includes(cls.id) ? (
                          <CheckSquare size={18} className="text-blue-600 shrink-0" />
                        ) : (
                          <Square size={18} className="text-gray-400 shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-gray-900 dark:text-white truncate">
                            {cls.title || '제목 없음'}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-2">
                            {cls.genre || '-'} • {cls.difficulty_level || '-'}
                            {cls.class_type && (
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                cls.class_type === 'regular' 
                                  ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                                  : cls.class_type === 'popup'
                                  ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400'
                                  : 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'
                              }`}>
                                {cls.class_type === 'regular' ? 'Regular' :
                                 cls.class_type === 'popup' ? 'Popup' :
                                 cls.class_type === 'workshop' ? 'Workshop' : cls.class_type}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
              
              {isAllSelected && (
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">
                  모든 클래스에서 사용 가능한 일반 수강권입니다.
                </p>
              )}
            </div>
          )}

          {/* 수강권 사용 안내 */}
          <div className={`${
            productCategory === 'regular'
              ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
              : productCategory === 'popup'
              ? 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800'
              : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
          } border rounded-lg p-4`}>
            <p className={`text-sm font-semibold ${
              productCategory === 'regular'
                ? 'text-blue-700 dark:text-blue-400'
                : productCategory === 'popup'
                ? 'text-purple-700 dark:text-purple-400'
                : 'text-amber-700 dark:text-amber-400'
            }`}>
              {TICKET_CATEGORY_INFO[productCategory].name} 사용 안내
            </p>
            <ul className={`text-xs mt-2 space-y-1 ${
              productCategory === 'regular'
                ? 'text-blue-600 dark:text-blue-500'
                : productCategory === 'popup'
                ? 'text-purple-600 dark:text-purple-500'
                : 'text-amber-600 dark:text-amber-500'
            }`}>
              {productCategory === 'regular' ? (
                <>
                  <li>• 선택한 Regular 클래스에서만 사용 가능합니다.</li>
                  <li>• 구매 시 시작일을 선택하고, 해당일부터 설정 기간 동안 무제한 수강 가능합니다.</li>
                  <li>• 1개월, 3개월, 6개월, 1년 등 다양한 기간 옵션을 제공할 수 있습니다.</li>
                </>
              ) : productCategory === 'popup' ? (
                <>
                  <li>• Popup 클래스 및 Popup 허용된 Regular 클래스에서 사용 가능합니다.</li>
                  <li>• 1회권, 5회권, 10회권 등 횟수 기반으로 판매됩니다.</li>
                  <li>• 유효기간 내 횟수를 소진하지 않으면 잔여 수량은 소멸됩니다.</li>
                </>
              ) : (
                <>
                  <li>• 특정 Workshop 클래스에서만 사용 가능한 전용 수강권입니다.</li>
                  <li>• 해당 워크샵 수업에만 사용할 수 있는 특수 수강권입니다.</li>
                  <li>• 횟수가 소진되면 추가 구매가 필요합니다.</li>
                </>
              )}
            </ul>
          </div>

          {/* 판매 상태 */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_on_sale"
              className="w-4 h-4 rounded"
              checked={formData.is_on_sale}
              onChange={(e) => setFormData({ ...formData, is_on_sale: e.target.checked })}
            />
            <label htmlFor="is_on_sale" className="text-sm text-gray-700 dark:text-gray-300">
              판매 중
            </label>
          </div>

          {/* 버튼 */}
          <div className="flex gap-3 pt-4">
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
              className={`flex-1 px-4 py-2 text-white rounded-lg transition-colors disabled:opacity-50 ${
                productCategory === 'regular'
                  ? 'bg-blue-600 hover:bg-blue-700'
                  : productCategory === 'popup'
                  ? 'bg-purple-600 hover:bg-purple-700'
                  : 'bg-amber-600 hover:bg-amber-700'
              }`}
            >
              {loading ? '저장 중...' : '저장'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
