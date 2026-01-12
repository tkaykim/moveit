"use client";

import { useState, useEffect } from 'react';
import { X, Lock, Info, CheckSquare, Square, Ticket, Tag } from 'lucide-react';
import { getSupabaseClient } from '@/lib/utils/supabase-client';

interface TicketModalProps {
  academyId: string;
  ticket?: any;
  onClose: () => void;
}

interface ClassItem {
  id: string;
  title: string | null;
  genre: string | null;
  difficulty_level: string | null;
}

// 수강권용 기간 프리셋
const PERIOD_PRESETS = [
  { label: '1개월', days: 30 },
  { label: '3개월', days: 90 },
  { label: '6개월', days: 180 },
  { label: '12개월', days: 365 },
];

// 쿠폰용 횟수 프리셋
const COUPON_COUNT_PRESETS = [
  { label: '1회', count: 1 },
  { label: '3회', count: 3 },
  { label: '5회', count: 5 },
  { label: '10회', count: 10 },
];

type ProductCategory = 'regular' | 'coupon';

export function TicketModal({ academyId, ticket, onClose }: TicketModalProps) {
  // 상품 카테고리: 일반 수강권 vs 쿠폰
  const [productCategory, setProductCategory] = useState<ProductCategory>('regular');
  
  const [formData, setFormData] = useState({
    name: '',
    price: 0,
    ticket_type: 'PERIOD' as 'COUNT' | 'PERIOD', // 수강권은 기간제, 쿠폰은 횟수제
    total_count: null as number | null,
    valid_days: null as number | null,
    is_on_sale: true,
  });
  
  const [loading, setLoading] = useState(false);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);
  const [useCustomPeriod, setUseCustomPeriod] = useState(false);
  const [useCustomCount, setUseCustomCount] = useState(false);

  useEffect(() => {
    loadClasses();
  }, [academyId]);

  useEffect(() => {
    if (ticket) {
      // 쿠폰 여부 확인
      const isCoupon = ticket.is_coupon === true;
      setProductCategory(isCoupon ? 'coupon' : 'regular');
      
      setFormData({
        name: ticket.name || '',
        price: ticket.price || 0,
        ticket_type: ticket.ticket_type || 'COUNT',
        total_count: ticket.total_count,
        valid_days: ticket.valid_days,
        is_on_sale: ticket.is_on_sale !== false,
      });
      
      // 프리셋에 없는 값이면 커스텀 모드
      if (ticket.valid_days) {
        setUseCustomPeriod(!PERIOD_PRESETS.some(p => p.days === ticket.valid_days));
      }
      if (ticket.total_count && isCoupon) {
        setUseCustomCount(!COUPON_COUNT_PRESETS.some(p => p.count === ticket.total_count));
      }
      
      // 기존 연결된 클래스 로드 (수강권인 경우에만)
      if (ticket.id && !isCoupon) {
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
        .select('id, title, genre, difficulty_level')
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
        console.log('ticket_classes table may not exist yet:', error.message);
        return;
      }
      
      if (data && data.length > 0) {
        setSelectedClassIds(data.map((d: { class_id: string }) => d.class_id));
      }
    } catch (error) {
      console.error('Error loading linked classes:', error);
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

    // 일반 수강권인 경우 클래스 선택 필수
    if (productCategory === 'regular' && selectedClassIds.length === 0) {
      alert('최소 1개 이상의 클래스를 선택해주세요.');
      return;
    }
    
    // 전체 선택 여부 판단 (수강권만 해당)
    const isGeneral = productCategory === 'regular' && selectedClassIds.length === classes.length;

    setLoading(true);

    const supabase = getSupabaseClient();
    if (!supabase) {
      alert('데이터베이스 연결에 실패했습니다.');
      setLoading(false);
      return;
    }

    try {
      // 수강권: 기간제(PERIOD), 쿠폰: 횟수제(COUNT)
      const ticketData = {
        academy_id: academyId,
        name: formData.name,
        price: formData.price,
        ticket_type: productCategory === 'coupon' ? 'COUNT' : 'PERIOD',
        total_count: productCategory === 'coupon' ? formData.total_count : null,
        valid_days: formData.valid_days,
        is_on_sale: formData.is_on_sale,
        is_coupon: productCategory === 'coupon',
        is_general: isGeneral,
        class_id: null,
        access_group: productCategory === 'coupon' ? 'coupon' : (isGeneral ? 'general' : null),
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

      // 기존 연결 삭제
      await supabase.from('ticket_classes').delete().eq('ticket_id', ticketId);
      
      // 일반 수강권이고 전체 선택이 아닌 경우에만 클래스 연결 저장
      if (productCategory === 'regular' && !isGeneral && selectedClassIds.length > 0) {
        const linkData = selectedClassIds.map(classId => ({
          ticket_id: ticketId,
          class_id: classId,
        }));
        
        const { error: linkError } = await supabase.from('ticket_classes').insert(linkData);
        if (linkError) {
          console.error('Error saving ticket_classes:', linkError);
        }
      }

      alert(ticket 
        ? (productCategory === 'coupon' ? '쿠폰이 수정되었습니다.' : '수강권이 수정되었습니다.')
        : (productCategory === 'coupon' ? '쿠폰이 등록되었습니다.' : '수강권이 등록되었습니다.')
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
              ? (productCategory === 'coupon' ? '쿠폰 수정' : '수강권 수정')
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
              상품 유형 *
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  setProductCategory('regular');
                  setFormData({ ...formData, ticket_type: 'PERIOD', total_count: null });
                }}
                className={`p-4 rounded-lg border flex flex-col items-center gap-2 transition-colors ${
                  productCategory === 'regular'
                    ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-500 text-blue-700 dark:text-blue-400'
                    : 'bg-gray-50 dark:bg-neutral-800 border-gray-200 dark:border-neutral-700 hover:bg-gray-100 dark:hover:bg-neutral-750'
                }`}
              >
                <Ticket className="w-6 h-6" />
                <span className="font-semibold">수강권</span>
                <span className="text-xs text-gray-500 dark:text-gray-400">기간제 정규수업</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setProductCategory('coupon');
                  setFormData({ ...formData, ticket_type: 'COUNT', total_count: 1 });
                }}
                className={`p-4 rounded-lg border flex flex-col items-center gap-2 transition-colors ${
                  productCategory === 'coupon'
                    ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-500 text-amber-700 dark:text-amber-400'
                    : 'bg-gray-50 dark:bg-neutral-800 border-gray-200 dark:border-neutral-700 hover:bg-gray-100 dark:hover:bg-neutral-750'
                }`}
              >
                <Tag className="w-6 h-6" />
                <span className="font-semibold">쿠폰</span>
                <span className="text-xs text-gray-500 dark:text-gray-400">1회권, 체험권</span>
              </button>
            </div>
          </div>

          {/* 상품명 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {productCategory === 'coupon' ? '쿠폰명' : '수강권명'} *
            </label>
            <input
              type="text"
              required
              className="w-full border dark:border-neutral-700 rounded-lg px-3 py-2 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder={productCategory === 'coupon' ? '예: 1회 쿠폰' : '예: 3개월 정기권'}
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

          {/* 횟수 선택 (쿠폰만) */}
          {productCategory === 'coupon' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                횟수 선택 *
              </label>
              <div className="flex flex-wrap gap-2 mb-2">
                {COUPON_COUNT_PRESETS.map((preset) => (
                  <button
                    key={preset.count}
                    type="button"
                    onClick={() => {
                      setFormData({ ...formData, total_count: preset.count });
                      setUseCustomCount(false);
                    }}
                    className={`px-4 py-2 rounded-full border font-medium text-sm transition-colors ${
                      !useCustomCount && formData.total_count === preset.count
                        ? 'bg-amber-600 text-white border-amber-600'
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
                      ? 'bg-amber-600 text-white border-amber-600'
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


          {/* 수강 가능 클래스 (일반 수강권만) */}
          {productCategory === 'regular' && (
            <div className="border-t dark:border-neutral-800 pt-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                <Lock size={14} /> 이 수강권으로 수강 가능한 클래스
              </label>

              <div className="border dark:border-neutral-700 rounded-lg overflow-hidden">
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
                  ) : (
                    classes.map((cls) => (
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
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {cls.genre || '-'} • {cls.difficulty_level || '-'}
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

          {/* 쿠폰 안내 */}
          {productCategory === 'coupon' && (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
              <p className="text-sm text-amber-700 dark:text-amber-400">
                <strong>쿠폰 사용 안내</strong>
              </p>
              <ul className="text-xs text-amber-600 dark:text-amber-500 mt-2 space-y-1">
                <li>• 쿠폰은 [쿠폰 허용]이 설정된 클래스에서만 사용 가능합니다.</li>
                <li>• 팝업/특강 수업은 기본적으로 쿠폰 사용이 가능합니다.</li>
                <li>• 정규 수업도 쿠폰 허용 설정 시 사용 가능합니다.</li>
              </ul>
            </div>
          )}

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
                productCategory === 'coupon'
                  ? 'bg-amber-600 hover:bg-amber-700'
                  : 'bg-blue-600 hover:bg-blue-700'
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
