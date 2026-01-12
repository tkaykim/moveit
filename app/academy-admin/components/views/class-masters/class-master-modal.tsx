"use client";

import { useState, useEffect } from 'react';
import { X, Lock } from 'lucide-react';
import { getSupabaseClient } from '@/lib/utils/supabase-client';
import { InstructorSelector } from '../classes/instructor-selector';
import { AccessConfig } from '@/types/database';

interface ClassMasterModalProps {
  academyId: string;
  classData?: any;
  onClose: () => void;
}

const GENRES = ['Choreo', 'hiphop', 'locking', 'waacking', 'popping', 'krump', 'voguing', 'breaking(bboying)'];
const DIFFICULTY_LEVELS = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'];
const CLASS_TYPES = ['regular', 'popup', 'workshop', 'ONE_DAY', 'PRIVATE', 'RENTAL'];

export function ClassMasterModal({ academyId, classData, onClose }: ClassMasterModalProps) {
  const [formData, setFormData] = useState({
    title: '',
    genre: '',
    difficulty_level: 'BEGINNER',
    class_type: 'regular',
    description: '',
    instructor_id: '',
    hall_id: '',
    max_students: 20,
    price: 0,
    // access_config
    requiredGroup: '',
    allowStandardCoupon: true,
  });
  const [halls, setHalls] = useState<any[]>([]);
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [customGroup, setCustomGroup] = useState('');

  useEffect(() => {
    loadData();
    if (classData) {
      const accessConfig = classData.access_config as AccessConfig | null;
      setFormData({
        title: classData.title || '',
        genre: classData.genre || '',
        difficulty_level: classData.difficulty_level || 'BEGINNER',
        class_type: classData.class_type || 'regular',
        description: classData.description || '',
        instructor_id: classData.instructor_id || '',
        hall_id: classData.hall_id || '',
        max_students: classData.max_students || 20,
        price: classData.price || 0,
        requiredGroup: accessConfig?.requiredGroup || '',
        allowStandardCoupon: accessConfig?.allowStandardCoupon !== false,
      });
    }
  }, [classData, academyId]);

  const loadData = async () => {
    const supabase = getSupabaseClient();
    if (!supabase) return;

    try {
      // 홀 목록
      const { data: hallsData } = await supabase
        .from('halls')
        .select('*')
        .eq('academy_id', academyId);
      setHalls(hallsData || []);

      // 수강권 목록 (access_group 옵션 가져오기)
      const { data: ticketsData } = await supabase
        .from('tickets')
        .select('id, name, access_group')
        .eq('academy_id', academyId)
        .not('access_group', 'eq', 'general');
      setTickets(ticketsData || []);
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  // 학원의 실제 수강권에서 전용 그룹 목록 추출
  const getAccessGroupOptions = () => {
    const options: { value: string; label: string; ticketName?: string }[] = [
      { value: '', label: '제한 없음 (모든 수강권 허용)' },
    ];
    
    // 실제 학원 수강권에서 전용 그룹 추출
    const groupMap = new Map<string, string[]>();
    tickets.forEach((ticket) => {
      if (ticket.access_group && ticket.access_group !== 'general') {
        if (!groupMap.has(ticket.access_group)) {
          groupMap.set(ticket.access_group, []);
        }
        groupMap.get(ticket.access_group)!.push(ticket.name);
      }
    });
    
    // 그룹별로 옵션 추가
    groupMap.forEach((ticketNames, groupValue) => {
      options.push({
        value: groupValue,
        label: `${ticketNames.join(', ')} 전용`,
        ticketName: ticketNames.join(', '),
      });
    });
    
    return options;
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
      // access_config 구성
      const accessConfig: AccessConfig = {
        requiredGroup: formData.requiredGroup || null,
        allowStandardCoupon: formData.allowStandardCoupon,
      };

      const dataToSave = {
        academy_id: academyId,
        title: formData.title || null,
        genre: formData.genre || null,
        difficulty_level: formData.difficulty_level,
        class_type: formData.class_type,
        description: formData.description || null,
        instructor_id: formData.instructor_id || null,
        hall_id: formData.hall_id || null,
        max_students: formData.max_students,
        price: formData.price,
        access_config: accessConfig,
        // Master는 start_time/end_time을 사용하지 않음
        start_time: null,
        end_time: null,
      };

      if (classData) {
        // 수정
        const { error } = await supabase
          .from('classes')
          .update(dataToSave)
          .eq('id', classData.id);

        if (error) throw error;
        alert('클래스가 수정되었습니다.');
      } else {
        // 신규 등록
        const { error } = await supabase
          .from('classes')
          .insert([dataToSave]);

        if (error) throw error;
        alert('클래스가 등록되었습니다.');
      }

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

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
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

          <InstructorSelector
            academyId={academyId}
            selectedInstructorId={formData.instructor_id}
            onSelect={(instructorId) => setFormData({ ...formData, instructor_id: instructorId })}
          />

          <div className="grid grid-cols-2 gap-4">
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
                {DIFFICULTY_LEVELS.map((level) => (
                  <option key={level} value={level}>{level}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
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
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
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

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                최대 인원
              </label>
              <input
                type="number"
                min="1"
                className="w-full border dark:border-neutral-700 rounded-lg px-3 py-2 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
                value={formData.max_students}
                onChange={(e) => setFormData({ ...formData, max_students: parseInt(e.target.value) || 20 })}
              />
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

          {/* 수강 권한 설정 */}
          <div className="border-t dark:border-neutral-800 pt-4 mt-4">
            <h4 className="text-lg font-semibold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
              <Lock className="w-5 h-5" /> 수강 권한 설정 (Access Control)
            </h4>
            
            <div className="bg-slate-50 dark:bg-neutral-800 p-4 rounded-lg space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  전용 수강권 지정
                </label>
                {getAccessGroupOptions().length > 1 ? (
                  <>
                    <select
                      className="w-full border dark:border-neutral-700 rounded-lg px-3 py-2 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
                      value={formData.requiredGroup}
                      onChange={(e) => setFormData({ ...formData, requiredGroup: e.target.value })}
                    >
                      {getAccessGroupOptions().map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      전용 수강권 소유 회원은 쿠폰 차감 없이 무제한 수강 가능합니다.
                    </p>
                  </>
                ) : (
                  <div className="text-sm text-gray-500 dark:text-gray-400 p-3 bg-gray-100 dark:bg-neutral-800 rounded-lg">
                    <p>등록된 전용 수강권이 없습니다.</p>
                    <p className="text-xs mt-1">
                      수강권/상품 관리에서 전용 그룹이 지정된 수강권을 먼저 등록해주세요.
                    </p>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="allowStandardCoupon"
                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                  checked={formData.allowStandardCoupon}
                  onChange={(e) => setFormData({ ...formData, allowStandardCoupon: e.target.checked })}
                />
                <label htmlFor="allowStandardCoupon" className="text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer">
                  일반 쿠폰(general) 사용 허용
                </label>
              </div>
              {!formData.allowStandardCoupon && (
                <p className="text-xs text-red-500 font-medium">
                  ※ 체크 해제 시, 전용 수강권이 없는 회원은 이 수업을 신청할 수 없습니다.
                </p>
              )}
            </div>
          </div>

          {/* 버튼 */}
          <div className="flex gap-3 pt-4">
            {classData && (
              <button
                type="button"
                onClick={handleDelete}
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
