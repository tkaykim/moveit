"use client";

import { useState, useEffect } from 'react';
import { X, Lock, Info } from 'lucide-react';
import { getSupabaseClient } from '@/lib/utils/supabase-client';

interface TicketModalProps {
  academyId: string;
  ticket?: any;
  onClose: () => void;
}

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
  const [isExclusive, setIsExclusive] = useState(false);
  const [exclusiveGroup, setExclusiveGroup] = useState('');
  const [existingGroups, setExistingGroups] = useState<string[]>([]);

  useEffect(() => {
    loadExistingGroups();
    if (ticket) {
      const hasExclusiveGroup = ticket.access_group && ticket.access_group !== 'general';
      setFormData({
        name: ticket.name || '',
        price: ticket.price || 0,
        ticket_type: ticket.ticket_type || 'COUNT',
        total_count: ticket.total_count,
        valid_days: ticket.valid_days,
        is_on_sale: ticket.is_on_sale !== false,
      });
      setIsExclusive(hasExclusiveGroup);
      setExclusiveGroup(hasExclusiveGroup ? ticket.access_group : '');
    }
  }, [ticket, academyId]);

  const loadExistingGroups = async () => {
    const supabase = getSupabaseClient();
    if (!supabase) return;

    try {
      const { data } = await supabase
        .from('tickets')
        .select('access_group')
        .eq('academy_id', academyId)
        .not('access_group', 'is', null)
        .not('access_group', 'eq', 'general');
      
      if (data) {
        const uniqueGroups = [...new Set(data.map((t: { access_group: string | null }) => t.access_group).filter(Boolean))] as string[];
        setExistingGroups(uniqueGroups);
      }
    } catch (error) {
      console.error('Error loading groups:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // 전용 수강권인데 그룹명이 없으면 에러
    if (isExclusive && !exclusiveGroup.trim()) {
      alert('전용 수강권의 그룹명을 입력해주세요.');
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
      // access_group 결정
      const finalAccessGroup = isExclusive ? exclusiveGroup.trim() : 'general';

      const data = {
        academy_id: academyId,
        name: formData.name,
        price: formData.price,
        ticket_type: formData.ticket_type,
        total_count: formData.ticket_type === 'COUNT' ? formData.total_count : null,
        valid_days: formData.ticket_type === 'PERIOD' ? formData.valid_days : null,
        is_on_sale: formData.is_on_sale,
        access_group: finalAccessGroup,
        is_general: !isExclusive,
      };

      if (ticket) {
        const { error } = await supabase.from('tickets').update(data).eq('id', ticket.id);

        if (error) throw error;
        alert('수강권이 수정되었습니다.');
      } else {
        const { error } = await supabase.from('tickets').insert([data]);

        if (error) throw error;
        alert('수강권이 등록되었습니다.');
      }

      onClose();
    } catch (error: any) {
      console.error('Error saving ticket:', error);
      alert(`수강권 저장에 실패했습니다: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 dark:bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
        <div className="p-6 border-b dark:border-neutral-800 flex justify-between items-center">
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

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
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
            />
          </div>

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

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              수강권 유형 *
            </label>
            <select
              className="w-full border dark:border-neutral-700 rounded-lg px-3 py-2 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
              value={formData.ticket_type}
              onChange={(e) => setFormData({ ...formData, ticket_type: e.target.value })}
            >
              <option value="COUNT">횟수제</option>
              <option value="PERIOD">기간제</option>
            </select>
          </div>

          {formData.ticket_type === 'COUNT' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                총 횟수 *
              </label>
              <input
                type="number"
                required
                min="1"
                className="w-full border dark:border-neutral-700 rounded-lg px-3 py-2 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
                value={formData.total_count || ''}
                onChange={(e) =>
                  setFormData({ ...formData, total_count: parseInt(e.target.value) || null })
                }
              />
            </div>
          )}

          {formData.ticket_type === 'PERIOD' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                유효 기간 (일) *
              </label>
              <input
                type="number"
                required
                min="1"
                className="w-full border dark:border-neutral-700 rounded-lg px-3 py-2 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
                value={formData.valid_days || ''}
                onChange={(e) =>
                  setFormData({ ...formData, valid_days: parseInt(e.target.value) || null })
                }
              />
            </div>
          )}

          {/* 수강권 유형 선택 */}
          <div className="border-t dark:border-neutral-800 pt-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
              <Lock size={14} /> 수강권 사용 범위
            </label>
            
            <div className="space-y-3">
              {/* 일반 수강권 */}
              <label className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                !isExclusive 
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                  : 'border-gray-200 dark:border-neutral-700 hover:bg-gray-50 dark:hover:bg-neutral-800'
              }`}>
                <input
                  type="radio"
                  name="ticketType"
                  checked={!isExclusive}
                  onChange={() => setIsExclusive(false)}
                  className="mt-1"
                />
                <div>
                  <div className="font-medium text-gray-900 dark:text-white">일반 수강권</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    쿠폰 허용된 모든 수업에서 1회씩 차감되어 사용됩니다.
                  </div>
                </div>
              </label>

              {/* 전용 수강권 */}
              <label className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                isExclusive 
                  ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20' 
                  : 'border-gray-200 dark:border-neutral-700 hover:bg-gray-50 dark:hover:bg-neutral-800'
              }`}>
                <input
                  type="radio"
                  name="ticketType"
                  checked={isExclusive}
                  onChange={() => setIsExclusive(true)}
                  className="mt-1"
                />
                <div className="flex-1">
                  <div className="font-medium text-gray-900 dark:text-white">전용 수강권</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    지정된 그룹의 수업만 무제한 수강 (횟수 차감 없음)
                  </div>
                </div>
              </label>
            </div>

            {/* 전용 그룹 입력 */}
            {isExclusive && (
              <div className="mt-3 space-y-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  전용 그룹명 *
                </label>
                
                {existingGroups.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-2">
                    {existingGroups.map((group) => (
                      <button
                        key={group}
                        type="button"
                        onClick={() => setExclusiveGroup(group)}
                        className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                          exclusiveGroup === group
                            ? 'bg-indigo-500 text-white border-indigo-500'
                            : 'border-gray-300 dark:border-neutral-600 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-neutral-800'
                        }`}
                      >
                        {group}
                      </button>
                    ))}
                  </div>
                )}
                
                <input
                  type="text"
                  className="w-full border dark:border-neutral-700 rounded-lg px-3 py-2 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
                  placeholder="예: 입시반, 키즈반, KPOP기초"
                  value={exclusiveGroup}
                  onChange={(e) => setExclusiveGroup(e.target.value)}
                />
                
                <div className="flex items-start gap-2 p-2 bg-amber-50 dark:bg-amber-900/20 rounded text-xs text-amber-700 dark:text-amber-400">
                  <Info size={14} className="mt-0.5 shrink-0" />
                  <span>
                    같은 그룹명을 가진 수강권들은 동일한 수업을 수강할 수 있습니다.
                    클래스 생성 시 이 그룹을 지정하면 연동됩니다.
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_on_sale"
              className="w-4 h-4"
              checked={formData.is_on_sale}
              onChange={(e) => setFormData({ ...formData, is_on_sale: e.target.checked })}
            />
            <label htmlFor="is_on_sale" className="text-sm text-gray-700 dark:text-gray-300">
              판매 중
            </label>
          </div>

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










