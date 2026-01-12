"use client";

import { useState, useEffect } from 'react';
import { X, Lock, Info, Check, CheckSquare, Square } from 'lucide-react';
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

// 기간 프리셋 옵션
const PERIOD_PRESETS = [
  { label: '1개월', days: 30 },
  { label: '3개월', days: 90 },
  { label: '6개월', days: 180 },
  { label: '12개월', days: 365 },
];

// 횟수 프리셋 옵션
const COUNT_PRESETS = [
  { label: '10회', count: 10 },
  { label: '20회', count: 20 },
  { label: '30회', count: 30 },
  { label: '50회', count: 50 },
];

export function TicketModal({ academyId, ticket, onClose }: TicketModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    price: 0,
    ticket_type: 'COUNT',
    total_count: null as number | null,
    valid_days: null as number | null,
    is_on_sale: true,
  });
  const [loading, setLoading] = useState(false);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);
  const [initialIsGeneral, setInitialIsGeneral] = useState(true); // 초기 is_general 값 저장
  const [useCustomPeriod, setUseCustomPeriod] = useState(false);
  const [useCustomCount, setUseCustomCount] = useState(false);
  const [hasExpiryForCount, setHasExpiryForCount] = useState(false); // 횟수권 유효기간 설정 여부

  useEffect(() => {
    loadClasses();
  }, [academyId]);

  useEffect(() => {
    if (ticket) {
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
      if (ticket.total_count) {
        setUseCustomCount(!COUNT_PRESETS.some(p => p.count === ticket.total_count));
      }
      
      // 횟수권에 유효기간이 설정되어 있으면 토글 활성화
      if (ticket.ticket_type === 'COUNT' && ticket.valid_days) {
        setHasExpiryForCount(true);
      }
      
      setInitialIsGeneral(ticket.is_general);
      
      // 기존 연결된 클래스 로드
      if (ticket.id && !ticket.is_general) {
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
      
      // 신규 생성이거나 is_general인 경우 전체 선택
      if (!ticket || initialIsGeneral) {
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
        // 테이블이 없을 경우 무시 (마이그레이션 전)
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

    // 클래스가 하나도 선택되지 않았으면 에러
    if (selectedClassIds.length === 0) {
      alert('최소 1개 이상의 클래스를 선택해주세요.');
      return;
    }
    
    // 전체 선택 여부 판단
    const isGeneral = selectedClassIds.length === classes.length;

    setLoading(true);

    const supabase = getSupabaseClient();
    if (!supabase) {
      alert('데이터베이스 연결에 실패했습니다.');
      setLoading(false);
      return;
    }

    try {
      // 횟수권도 유효기간을 가질 수 있음
      const validDays = formData.ticket_type === 'PERIOD' 
        ? formData.valid_days 
        : (hasExpiryForCount ? formData.valid_days : null);

      const ticketData = {
        academy_id: academyId,
        name: formData.name,
        price: formData.price,
        ticket_type: formData.ticket_type,
        total_count: formData.ticket_type === 'COUNT' ? formData.total_count : null,
        valid_days: validDays,
        is_on_sale: formData.is_on_sale,
        is_general: isGeneral,
        class_id: null, // 기존 단일 class_id는 더 이상 사용하지 않음
        access_group: isGeneral ? 'general' : null,
      };

      let ticketId: string;

      if (ticket) {
        // 수정
        const { error } = await supabase.from('tickets').update(ticketData).eq('id', ticket.id);
        if (error) throw error;
        ticketId = ticket.id;
      } else {
        // 신규
        const { data, error } = await supabase.from('tickets').insert([ticketData]).select('id').single();
        if (error) throw error;
        ticketId = data.id;
      }

      // 기존 연결 삭제
      await supabase.from('ticket_classes').delete().eq('ticket_id', ticketId);
      
      // 전용 수강권이면 (전체 선택이 아니면) ticket_classes 테이블에 연결 저장
      if (!isGeneral) {
        const linkData = selectedClassIds.map(classId => ({
          ticket_id: ticketId,
          class_id: classId,
        }));
        
        const { error: linkError } = await supabase.from('ticket_classes').insert(linkData);
        if (linkError) {
          console.error('Error saving ticket_classes:', linkError);
        }
      }

      alert(ticket ? '수강권이 수정되었습니다.' : '수강권이 등록되었습니다.');
      onClose();
    } catch (error: any) {
      console.error('Error saving ticket:', error);
      alert(`수강권 저장에 실패했습니다: ${error.message}`);
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
            {ticket ? '수강권 수정' : '수강권 등록'}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* 수강권명 */}
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
              placeholder="예: 3개월 정기권"
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

          {/* 수강권 유형 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              수강권 유형 *
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, ticket_type: 'COUNT' })}
                className={`flex-1 px-4 py-2 rounded-lg border font-medium transition-colors ${
                  formData.ticket_type === 'COUNT'
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'border-gray-300 dark:border-neutral-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-neutral-800'
                }`}
              >
                횟수제
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, ticket_type: 'PERIOD' })}
                className={`flex-1 px-4 py-2 rounded-lg border font-medium transition-colors ${
                  formData.ticket_type === 'PERIOD'
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'border-gray-300 dark:border-neutral-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-neutral-800'
                }`}
              >
                기간제
              </button>
            </div>
          </div>

          {/* 횟수제 옵션 */}
          {formData.ticket_type === 'COUNT' && (
            <div className="space-y-4">
              {/* 횟수 선택 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  횟수 선택 *
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
                          ? 'bg-blue-600 text-white border-blue-600'
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
                        ? 'bg-blue-600 text-white border-blue-600'
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

              {/* 유효기간 설정 토글 */}
              <div className="border-t dark:border-neutral-700 pt-4">
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    유효기간 설정
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setHasExpiryForCount(!hasExpiryForCount);
                      if (hasExpiryForCount) {
                        setFormData({ ...formData, valid_days: null });
                      }
                    }}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      hasExpiryForCount ? 'bg-blue-600' : 'bg-gray-300 dark:bg-neutral-600'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        hasExpiryForCount ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
                
                {hasExpiryForCount && (
                  <div>
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
                        placeholder="일수를 입력하세요"
                        className="w-full border dark:border-neutral-700 rounded-lg px-3 py-2 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
                        value={formData.valid_days || ''}
                        onChange={(e) => setFormData({ ...formData, valid_days: parseInt(e.target.value) || null })}
                      />
                    )}
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                      {formData.total_count || 0}회권, 구매 시점부터 {formData.valid_days || 0}일 이내 사용
                    </p>
                  </div>
                )}
                
                {!hasExpiryForCount && (
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    유효기간 제한 없이 횟수 소진 시까지 사용 가능
                  </p>
                )}
              </div>
            </div>
          )}

          {/* 기간제 옵션 */}
          {formData.ticket_type === 'PERIOD' && (
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

          {/* 수강 가능 클래스 */}
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
