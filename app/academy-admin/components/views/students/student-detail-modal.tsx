"use client";

import { useState, useEffect } from 'react';
import { X, User } from 'lucide-react';
import { getSupabaseClient } from '@/lib/utils/supabase-client';
import { normalizePhone, formatPhoneDisplay, parsePhoneInput } from '@/lib/utils/phone';
import { ProfileImageUpload } from '@/components/common/profile-image-upload';
import { useAcademyTicketLabels } from '../hooks/useAcademyTicketLabels';

interface StudentDetailModalProps {
  student: any;
  academyId: string;
  onClose: () => void;
}

export function StudentDetailModal({ student, academyId, onClose }: StudentDetailModalProps) {
  const { labels } = useAcademyTicketLabels(academyId);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    nickname: '',
    phone: '',
    email: '',
  });
  const [loading, setLoading] = useState(false);
  const [profileImageUrl, setProfileImageUrl] = useState<string | null>(null);

  useEffect(() => {
    if (student) {
      setFormData({
        name: student.name || '',
        nickname: student.nickname || '',
        phone: normalizePhone(student.phone || ''),
        email: student.email || '',
      });
      setProfileImageUrl(student.profile_image || null);
    }
  }, [student]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const supabase = getSupabaseClient();
    if (!supabase || !student) {
      alert('데이터베이스 연결에 실패했습니다.');
      setLoading(false);
      return;
    }

    try {
      const updatePayload = {
        name: formData.name,
        nickname: formData.nickname,
        phone: formData.phone ? normalizePhone(formData.phone) : null,
        email: formData.email,
      };
      const { error } = await supabase
        .from('users')
        .update(updatePayload)
        .eq('id', student.id);

      if (error) throw error;
      alert('학생 정보가 수정되었습니다.');
      setIsEditing(false);
      onClose();
    } catch (error: any) {
      console.error('Error updating student:', error);
      alert(`학생 정보 수정에 실패했습니다: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 dark:bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b dark:border-neutral-800 flex justify-between items-center sticky top-0 bg-white dark:bg-neutral-900">
          <h3 className="text-xl font-bold text-gray-800 dark:text-white">
            {student.name || student.nickname || '학생 정보'}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X size={20} />
          </button>
        </div>

        {isEditing ? (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {/* 프로필 사진 수정 */}
            <div className="flex justify-center py-2">
              <ProfileImageUpload
                currentImageUrl={profileImageUrl}
                targetUserId={student.id}
                onImageUploaded={(url) => setProfileImageUrl(url)}
                size={80}
                displayName={formData.name || student.name || '학생'}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                이름
              </label>
              <input
                type="text"
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
                inputMode="numeric"
                className="w-full border dark:border-neutral-700 rounded-lg px-3 py-2 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
                value={formatPhoneDisplay(formData.phone)}
                onChange={(e) => setFormData({ ...formData, phone: parsePhoneInput(e.target.value) })}
                placeholder="010-1234-5678"
                maxLength={13}
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
                onClick={() => setIsEditing(false)}
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
        ) : (
          <div className="p-6 space-y-6">
            {/* 프로필 사진 표시 */}
            <div className="flex justify-center">
              <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-primary dark:from-[#CCFF00] to-green-500 p-[2px]">
                <div className="w-full h-full rounded-full bg-white dark:bg-neutral-900 flex items-center justify-center overflow-hidden">
                  {profileImageUrl ? (
                    <img src={profileImageUrl} alt={student.name || '학생'} className="w-full h-full object-cover" />
                  ) : (
                    <User className="text-neutral-400 dark:text-neutral-500" size={32} />
                  )}
                </div>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">기본 정보</h4>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">이름</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {student.name || '-'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">닉네임</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {student.nickname || '-'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">전화번호</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {student.phone ? formatPhoneDisplay(student.phone) : '-'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">이메일</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {student.email || '-'}
                  </span>
                </div>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">보유 수강권</h4>
              <div className="space-y-3">
                {student.user_tickets && student.user_tickets.length > 0 ? (
                  student.user_tickets.map((ticket: any) => {
                    const ticketType = ticket.tickets?.ticket_type;
                    const cat = ticket.tickets?.ticket_category || ticket.tickets?.access_group;
                    const categoryLabel =
                      ticketType === 'COUNT'
                        ? (cat === 'workshop' ? labels.workshop : labels.popup)
                        : labels.regular;
                    const isPeriod = ticketType === 'PERIOD';
                    
                    // 실제 상태 계산 (DB가 ACTIVE지만 실제 만료/소진인 경우)
                    const today = new Date().toISOString().split('T')[0];
                    let effectiveStatus = ticket.status || 'ACTIVE';
                    if (effectiveStatus === 'ACTIVE') {
                      if (ticket.expiry_date && ticket.expiry_date < today) {
                        effectiveStatus = 'EXPIRED';
                      } else if (!isPeriod && ticket.remaining_count !== null && ticket.remaining_count <= 0) {
                        effectiveStatus = 'USED';
                      }
                    }
                    
                    const statusConfig: Record<string, { label: string; color: string }> = {
                      ACTIVE: { label: '사용 중', color: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' },
                      EXPIRED: { label: '만료', color: 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400' },
                      USED: { label: '소진', color: 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400' },
                    };
                    const statusInfo = statusConfig[effectiveStatus] || { label: effectiveStatus, color: 'bg-gray-200 dark:bg-gray-700 text-gray-600' };
                    
                    // 만료 임박 (7일 이내)
                    let isExpiringSoon = false;
                    if (effectiveStatus === 'ACTIVE' && ticket.expiry_date) {
                      const daysLeft = Math.ceil((new Date(ticket.expiry_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                      isExpiringSoon = daysLeft <= 7 && daysLeft > 0;
                    }
                    
                    return (
                      <div
                        key={ticket.id}
                        className={`p-3 border rounded-lg space-y-1.5 ${
                          effectiveStatus === 'ACTIVE' 
                            ? 'border-green-200 dark:border-green-900/50 bg-green-50/50 dark:bg-green-900/10' 
                            : 'border-neutral-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-800'
                        }`}
                      >
                        <div className="flex justify-between items-center flex-wrap gap-1">
                          <span className="font-medium text-gray-900 dark:text-white">
                            {ticket.tickets?.name || '-'}
                          </span>
                          <div className="flex items-center gap-1">
                            <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-slate-200 dark:bg-neutral-700 text-slate-700 dark:text-slate-300">
                              {categoryLabel}
                            </span>
                            <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${statusInfo.color}`}>
                              {statusInfo.label}
                            </span>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-sm text-gray-600 dark:text-gray-400">
                          {isPeriod ? (
                            <span>잔여: 무제한</span>
                          ) : (
                            <span>잔여: {ticket.remaining_count ?? 0}회 / {ticket.tickets?.total_count ?? '-'}회</span>
                          )}
                          {ticket.start_date && ticket.expiry_date ? (
                            <span>기간: {new Date(ticket.start_date).toLocaleDateString('ko-KR')} ~ {new Date(ticket.expiry_date).toLocaleDateString('ko-KR')}</span>
                          ) : ticket.expiry_date ? (
                            <span>만료: {new Date(ticket.expiry_date).toLocaleDateString('ko-KR')}</span>
                          ) : (
                            <span>만료: 무기한</span>
                          )}
                        </div>
                        {isExpiringSoon && (
                          <div className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                            ⚠ 곧 만료됩니다
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div className="text-gray-500 dark:text-gray-400 text-sm py-2">수강권이 없습니다.</div>
                )}
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                onClick={() => setIsEditing(true)}
                className="flex-1 px-4 py-2 border dark:border-neutral-700 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors"
              >
                수정
              </button>
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors"
              >
                닫기
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

