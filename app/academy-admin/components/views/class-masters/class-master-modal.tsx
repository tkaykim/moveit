"use client";

import { useState, useEffect } from 'react';
import { X, Ticket, Info, ToggleLeft, ToggleRight } from 'lucide-react';
import { getSupabaseClient } from '@/lib/utils/supabase-client';
import { InstructorSelector } from '../classes/instructor-selector';

interface ClassMasterModalProps {
  academyId: string;
  classData?: any;
  onClose: () => void;
}

interface LinkedTicket {
  id: string;
  name: string;
  ticket_type: string;
  price: number | null;
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
    allowRegularTicket: true,
    allowCoupon: false,
    is_active: true,
  });
  const [halls, setHalls] = useState<any[]>([]);
  const [linkedTickets, setLinkedTickets] = useState<LinkedTicket[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingTickets, setLoadingTickets] = useState(false);

  useEffect(() => {
    loadHalls();
    if (classData) {
      setFormData({
        title: classData.title || '',
        genre: classData.genre || '',
        difficulty_level: classData.difficulty_level || 'BEGINNER',
        class_type: classData.class_type || 'regular',
        description: classData.description || '',
        instructor_id: classData.instructor_id || '',
        hall_id: classData.hall_id || '',
        max_students: classData.max_students || 20,
        allowRegularTicket: classData.access_config?.allowRegularTicket !== false,
        allowCoupon: classData.access_config?.allowCoupon === true,
        is_active: classData.is_active !== false,
      });
      loadLinkedTickets(classData.id);
    }
  }, [classData, academyId]);

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

  const loadLinkedTickets = async (classId: string) => {
    setLoadingTickets(true);
    const supabase = getSupabaseClient();
    if (!supabase) {
      setLoadingTickets(false);
      return;
    }

    try {
      // 이 클래스에 연결된 수강권 조회
      const { data, error } = await supabase
        .from('tickets')
        .select('id, name, ticket_type, price')
        .eq('class_id', classId);

      if (error) throw error;
      setLinkedTickets(data || []);
    } catch (error) {
      console.error('Error loading linked tickets:', error);
    } finally {
      setLoadingTickets(false);
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
        is_active: formData.is_active,
        access_config: {
          requiredGroup: null,
          allowRegularTicket: formData.allowRegularTicket,
          allowCoupon: formData.allowCoupon,
        },
        start_time: null,
        end_time: null,
      };

      if (classData) {
        const { error } = await supabase
          .from('classes')
          .update(dataToSave)
          .eq('id', classData.id);

        if (error) throw error;
        alert('클래스가 수정되었습니다.');
      } else {
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
              설명
            </label>
            <textarea
              className="w-full border dark:border-neutral-700 rounded-lg px-3 py-2 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
              rows={3}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
          </div>

          {/* 연결된 수강권 표시 */}
          {classData && (
            <div className="border-t dark:border-neutral-800 pt-4 mt-4">
              <h4 className="text-lg font-semibold text-gray-800 dark:text-white mb-3 flex items-center gap-2">
                <Ticket className="w-5 h-5" /> 연결된 수강권
              </h4>

              {loadingTickets ? (
                <div className="text-sm text-gray-500 dark:text-gray-400 p-3 bg-gray-100 dark:bg-neutral-800 rounded-lg">
                  수강권 정보 불러오는 중...
                </div>
              ) : linkedTickets.length > 0 ? (
                <div className="space-y-2">
                  {linkedTickets.map((ticket) => (
                    <div
                      key={ticket.id}
                      className="flex items-center justify-between p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg"
                    >
                      <div>
                        <div className="font-medium text-indigo-700 dark:text-indigo-300">
                          {ticket.name}
                        </div>
                        <div className="text-xs text-indigo-600 dark:text-indigo-400">
                          {ticket.ticket_type === 'COUNT' ? '횟수제' : '기간제'}
                          {ticket.price && ` • ${ticket.price.toLocaleString()}원`}
                        </div>
                      </div>
                      <span className="text-xs px-2 py-1 bg-indigo-100 dark:bg-indigo-800 text-indigo-600 dark:text-indigo-300 rounded">
                        전용
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-gray-500 dark:text-gray-400 p-3 bg-gray-100 dark:bg-neutral-800 rounded-lg">
                  <div className="flex items-start gap-2">
                    <Info size={14} className="mt-0.5 shrink-0" />
                    <div>
                      <p>이 클래스에 연결된 전용 수강권이 없습니다.</p>
                      <p className="text-xs mt-1">
                        수강권/상품 관리에서 이 클래스를 선택하여 전용 수강권을 등록할 수 있습니다.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 수강 권한 설정 */}
          <div className="border-t dark:border-neutral-800 pt-4 mt-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              수강 권한 설정
            </label>
            <div className="space-y-3">
              {/* 일반 수강권 허용 */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="allowRegularTicket"
                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                  checked={formData.allowRegularTicket}
                  onChange={(e) => setFormData({ ...formData, allowRegularTicket: e.target.checked })}
                />
                <label htmlFor="allowRegularTicket" className="text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer">
                  일반 수강권 허용
                </label>
              </div>
              
              {/* 쿠폰 허용 */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="allowCoupon"
                  className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500"
                  checked={formData.allowCoupon}
                  onChange={(e) => setFormData({ ...formData, allowCoupon: e.target.checked })}
                />
                <label htmlFor="allowCoupon" className="text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer">
                  쿠폰 허용
                </label>
              </div>
            </div>
            
            {!formData.allowRegularTicket && !formData.allowCoupon && (
              <p className="text-xs text-red-500 font-medium mt-3">
                ※ 둘 다 해제 시, 이 클래스와 연결된 전용 수강권 보유자만 신청할 수 있습니다.
              </p>
            )}
            {formData.allowCoupon && (
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-3">
                ※ 쿠폰 허용 시, 쿠폰 보유자도 이 수업을 신청할 수 있습니다.
              </p>
            )}
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
