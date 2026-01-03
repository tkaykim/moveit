"use client";

import { useState } from 'react';
import { X } from 'lucide-react';
import { getSupabaseClient } from '@/lib/utils/supabase-client';

interface StudentRegisterModalProps {
  academyId: string;
  onClose: () => void;
}

export function StudentRegisterModal({ academyId, onClose }: StudentRegisterModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    nickname: '',
    email: '',
    phone: '',
  });
  const [loading, setLoading] = useState(false);

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
      let userId: string;

      // 1. 기존 사용자 확인 (전화번호 또는 이메일로)
      let existingUser = null;
      
      if (formData.phone) {
        const { data: phoneUser } = await supabase
          .from('users')
          .select('id, name, nickname, email, phone')
          .eq('phone', formData.phone)
          .maybeSingle();
        
        if (phoneUser) {
          existingUser = phoneUser;
        }
      }

      // 전화번호로 찾지 못했고 이메일이 있으면 이메일로 확인
      if (!existingUser && formData.email) {
        const { data: emailUser } = await supabase
          .from('users')
          .select('id, name, nickname, email, phone')
          .eq('email', formData.email)
          .maybeSingle();
        
        if (emailUser) {
          existingUser = emailUser;
        }
      }

      // 2. 기존 사용자가 있는 경우
      if (existingUser) {
        userId = existingUser.id;
        
        // 기존 사용자 정보 업데이트 (이름, 닉네임 등이 변경되었을 수 있음)
        const updateData: any = {};
        if (formData.name && formData.name !== existingUser.name) {
          updateData.name = formData.name;
        }
        if (formData.nickname && formData.nickname !== existingUser.nickname) {
          updateData.nickname = formData.nickname;
        }
        if (formData.email && formData.email !== existingUser.email) {
          updateData.email = formData.email;
        }
        if (formData.phone && formData.phone !== existingUser.phone) {
          updateData.phone = formData.phone;
        }

        if (Object.keys(updateData).length > 0) {
          const { error: updateError } = await supabase
            .from('users')
            .update(updateData)
            .eq('id', userId);

          if (updateError) throw updateError;
        }

        // 3. 해당 학원의 학생으로 이미 등록되어 있는지 확인
        const { data: existingRelation } = await supabase
          .from('academy_students')
          .select('id')
          .eq('academy_id', academyId)
          .eq('user_id', userId)
          .maybeSingle();

        // 4. 학원-학생 관계가 없으면 생성
        if (!existingRelation) {
          const { error: relationError } = await supabase
            .from('academy_students')
            .insert([{
              academy_id: academyId,
              user_id: userId,
            }]);

          if (relationError) {
            // 테이블이 없을 수 있으므로 에러를 무시하지 않고 확인
            if (relationError.code === '42P01') {
              throw new Error('academy_students 테이블이 없습니다. 마이그레이션을 실행해주세요.');
            }
            throw relationError;
          }
        }

        alert('기존 학생을 해당 학원의 수강생으로 등록했습니다.');
      } else {
        // 5. 신규 사용자 생성
        const { data: newUser, error: insertError } = await supabase
          .from('users')
          .insert([formData])
          .select()
          .single();

        if (insertError) {
          // 이메일 중복 에러 처리
          if (insertError.code === '23505' && insertError.message.includes('email')) {
            throw new Error('이미 등록된 이메일입니다.');
          }
          throw insertError;
        }

        userId = newUser.id;

        // 6. 학원-학생 관계 생성
        const { error: relationError } = await supabase
          .from('academy_students')
          .insert([{
            academy_id: academyId,
            user_id: userId,
          }]);

        if (relationError) {
          // 테이블이 없을 수 있으므로 에러를 무시하지 않고 확인
          if (relationError.code === '42P01') {
            throw new Error('academy_students 테이블이 없습니다. 마이그레이션을 실행해주세요.');
          }
          throw relationError;
        }

        alert('학생이 등록되었습니다.');
      }

      // 성공 시 모달 닫기
      onClose();
    } catch (error: any) {
      console.error('Error creating student:', error);
      const errorMessage = error?.message || '알 수 없는 오류가 발생했습니다.';
      alert(`학생 등록에 실패했습니다: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 dark:bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
        <div className="p-6 border-b dark:border-neutral-800 flex justify-between items-center">
          <h3 className="text-xl font-bold text-gray-800 dark:text-white">학생 등록</h3>
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
              이름 *
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
              닉네임
            </label>
            <input
              type="text"
              className="w-full border dark:border-neutral-700 rounded-lg px-3 py-2 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
              value={formData.nickname}
              onChange={(e) => setFormData({ ...formData, nickname: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              전화번호
            </label>
            <input
              type="tel"
              className="w-full border dark:border-neutral-700 rounded-lg px-3 py-2 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              이메일
            </label>
            <input
              type="email"
              className="w-full border dark:border-neutral-700 rounded-lg px-3 py-2 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
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
              {loading ? '등록 중...' : '등록'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

