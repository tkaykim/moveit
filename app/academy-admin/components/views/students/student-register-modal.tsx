"use client";

import { useState } from 'react';
import { X } from 'lucide-react';
import { getSupabaseClient } from '@/lib/utils/supabase-client';
import { normalizePhone, formatPhoneDisplay, parsePhoneInput } from '@/lib/utils/phone';
import { ProfileImageUpload } from '@/components/common/profile-image-upload';
import { fetchWithAuth } from '@/lib/api/auth-fetch';

const GENRES = ['Choreo', 'hiphop', 'locking', 'waacking', 'popping', 'krump', 'voguing', 'breaking(bboying)', 'heels', 'kpop', 'house', '기타'] as const;

const REFERRAL_SOURCES = [
  { value: 'INSTAGRAM', label: '인스타그램' },
  { value: 'YOUTUBE', label: '유튜브' },
  { value: 'REFERRAL', label: '지인추천' },
  { value: 'INSTRUCTOR_ACCOUNT', label: '강사 계정을 보고' },
  { value: 'NAVER', label: '네이버' },
  { value: 'EVENT', label: '행사나 공연' },
] as const;

interface StudentRegisterModalProps {
  academyId: string;
  onClose: () => void;
}

export function StudentRegisterModal({ academyId, onClose }: StudentRegisterModalProps) {
  const [formData, setFormData] = useState({
    // 기본 정보
    name: '',
    name_en: '',
    nickname: '',
    phone: '',
    email: '',
    birth_date: '',
    gender: '',
    address: '',
    nationality: '한국', // 기본값: 한국
    // 학원별 정보
    referral_source: '',
    interested_genres: [] as string[],
    level: '',
  });
  const [loading, setLoading] = useState(false);
  const [profileImageFile, setProfileImageFile] = useState<File | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // 이미 제출 중이면 무시
    if (loading) return;
    
    // 필수 필드 검증
    if (!formData.name || !formData.name.trim()) {
      alert('이름을 입력해주세요.');
      return;
    }
    
    const phoneDigits = normalizePhone(formData.phone);
    if (!phoneDigits || phoneDigits.length < 10) {
      alert('전화번호를 10~11자리 숫자로 입력해주세요.');
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
      let userId: string;

      // 1. 기존 사용자 확인: 전화번호 기준. DB에 하이픈 있음/없음 혼재하므로 숫자·하이픈 형식 둘 다 조회.
      const phoneForDb = normalizePhone(formData.phone);
      const phoneFormatted = formatPhoneDisplay(phoneForDb);
      let existingUser = null;

      const { data: byDigits } = await supabase
        .from('users')
        .select('id, name, nickname, email, phone')
        .eq('phone', phoneForDb)
        .maybeSingle();
      if (byDigits) {
        existingUser = byDigits;
      } else {
        const { data: byFormatted } = await supabase
          .from('users')
          .select('id, name, nickname, email, phone')
          .eq('phone', phoneFormatted)
          .maybeSingle();
        if (byFormatted) existingUser = byFormatted;
      }

      // 중복 체크는 연락처(전화번호)만 함. 이메일/이름/닉네임은 부수 정보.

      // 2. 기존 사용자가 있는 경우
      if (existingUser) {
        userId = existingUser.id;
        
        // 기존 사용자 정보 업데이트
        const updateData: any = {};
        if (formData.name?.trim() && formData.name.trim() !== existingUser.name) {
          updateData.name = formData.name.trim();
        }
        if (formData.nickname?.trim() && formData.nickname.trim() !== existingUser.nickname) {
          updateData.nickname = formData.nickname.trim();
        }
        if (formData.email?.trim() && formData.email.trim() !== existingUser.email) {
          updateData.email = formData.email.trim();
        }
        if (phoneForDb && phoneForDb !== normalizePhone(existingUser.phone || '')) {
          updateData.phone = phoneForDb;
        }
        if (formData.name_en?.trim()) updateData.name_en = formData.name_en.trim();
        if (formData.birth_date) updateData.birth_date = formData.birth_date;
        if (formData.gender) updateData.gender = formData.gender;
        if (formData.address?.trim()) updateData.address = formData.address.trim();
        if (formData.nationality?.trim()) updateData.nationality = formData.nationality.trim();

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

        // 4. 학원-학생 관계가 없으면 생성, 있으면 업데이트
        const academyStudentData: any = {
          academy_id: academyId,
          user_id: userId,
        };
        if (formData.referral_source) academyStudentData.referral_source = formData.referral_source;
        if (formData.interested_genres.length > 0) academyStudentData.interested_genres = formData.interested_genres;
        if (formData.level) academyStudentData.level = formData.level;

        if (!existingRelation) {
          const { error: relationError } = await supabase
            .from('academy_students')
            .insert([academyStudentData]);

          if (relationError) {
            if (relationError.code === '42P01') {
              throw new Error('academy_students 테이블이 없습니다. 마이그레이션을 실행해주세요.');
            }
            if (relationError.code === '23505') {
              alert('이미 해당 학원에 등록된 회원입니다. 목록에서 확인해주세요.');
              onClose();
              return;
            }
            throw relationError;
          }
        } else {
          // 기존 관계가 있으면 업데이트
          const { error: updateRelationError } = await supabase
            .from('academy_students')
            .update(academyStudentData)
            .eq('id', existingRelation.id);

          if (updateRelationError) throw updateRelationError;
        }

        // 프로필 이미지 업로드 (파일이 선택되어 있으면)
        if (profileImageFile) {
          await uploadProfileImage(userId, profileImageFile);
        }

        alert('기존 학생을 해당 학원의 수강생으로 등록했습니다. 이제 해당 학원에서 조회 가능합니다.');
      } else {
        // 5. 신규 사용자 생성 (RPC로 id를 서버에서 생성해 users_pkey 오류 방지)
        const { data: newUserRows, error: insertError } = await supabase.rpc('create_student_user', {
          p_name: formData.name.trim(),
          p_nickname: formData.nickname?.trim() || null,
          p_email: (formData.email?.trim() && formData.email.trim()) ? formData.email.trim() : null,
          p_phone: phoneForDb,
          p_name_en: formData.name_en?.trim() || null,
          p_birth_date: formData.birth_date || null,
          p_gender: formData.gender || null,
          p_address: formData.address?.trim() || null,
          p_nationality: formData.nationality?.trim() || null,
        });

        if (insertError) {
          if (insertError.code === '23505') {
            const raw = `${insertError.message || ''} ${(insertError as any).details || ''}`.toLowerCase();
            if (raw.includes('phone')) {
              throw new Error('이미 등록된 전화번호입니다. 해당 번호로 등록된 회원이 있습니다. 학원에 추가만 하시려면 전화번호를 정확히 입력해주세요.');
            }
            throw new Error('중복된 정보가 있습니다. 연락처를 확인해주세요.');
          }
          throw insertError;
        }

        const newUser = Array.isArray(newUserRows) && newUserRows.length > 0 ? newUserRows[0] : newUserRows;
        if (!newUser?.id) throw new Error('회원 생성 후 데이터를 받지 못했습니다.');
        userId = newUser.id;

        // 6. 학원-학생 관계 생성
        const academyStudentData: any = {
          academy_id: academyId,
          user_id: userId,
        };
        if (formData.referral_source) academyStudentData.referral_source = formData.referral_source;
        if (formData.interested_genres.length > 0) academyStudentData.interested_genres = formData.interested_genres;
        if (formData.level) academyStudentData.level = formData.level;

        const { error: relationError } = await supabase
          .from('academy_students')
          .insert([academyStudentData]);

        if (relationError) {
          if (relationError.code === '42P01') {
            throw new Error('academy_students 테이블이 없습니다. 마이그레이션을 실행해주세요.');
          }
          throw relationError;
        }

        // 프로필 이미지 업로드 (파일이 선택되어 있으면)
        if (profileImageFile) {
          await uploadProfileImage(userId, profileImageFile);
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

  // 프로필 이미지 업로드 헬퍼
  const uploadProfileImage = async (userId: string, file: File) => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('targetUserId', userId);
      const res = await fetchWithAuth('/api/upload/profile-image', {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) {
        console.error('프로필 이미지 업로드 실패:', await res.text());
      }
    } catch (err) {
      console.error('프로필 이미지 업로드 오류:', err);
    }
  };

  const toggleGenre = (genre: string) => {
    setFormData((prev) => ({
      ...prev,
      interested_genres: prev.interested_genres.includes(genre)
        ? prev.interested_genres.filter((g) => g !== genre)
        : [...prev.interested_genres, genre],
    }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 dark:bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b dark:border-neutral-800 flex justify-between items-center flex-shrink-0">
          <h3 className="text-xl font-bold text-gray-800 dark:text-white">학생 등록</h3>
          <button
            onClick={onClose}
            className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
          {/* 프로필 사진 */}
          <div className="flex justify-center py-2">
            <ProfileImageUpload
              localOnly
              onFileSelect={(file) => setProfileImageFile(file)}
              size={80}
              displayName={formData.name || '학생'}
            />
          </div>

          {/* 기본 정보 섹션 */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 border-b dark:border-neutral-700 pb-2">
              기본 정보
            </h4>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                이름 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                className="w-full border dark:border-neutral-700 rounded-lg px-3 py-2 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="홍길동"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                영어이름
              </label>
              <input
                type="text"
                className="w-full border dark:border-neutral-700 rounded-lg px-3 py-2 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
                value={formData.name_en}
                onChange={(e) => setFormData({ ...formData, name_en: e.target.value })}
                placeholder="Hong Gildong"
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
                placeholder="닉네임"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  전화번호 <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel"
                  required
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
                  placeholder="example@email.com"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  생년월일
                </label>
                <input
                  type="date"
                  className="w-full border dark:border-neutral-700 rounded-lg px-3 py-2 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
                  value={formData.birth_date}
                  onChange={(e) => setFormData({ ...formData, birth_date: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  성별
                </label>
                <select
                  className="w-full border dark:border-neutral-700 rounded-lg px-3 py-2 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
                  value={formData.gender}
                  onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                >
                  <option value="">선택</option>
                  <option value="MALE">남성</option>
                  <option value="FEMALE">여성</option>
                  <option value="OTHER">기타</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  주소 (동까지만 입력 가능)
                </label>
                <input
                  type="text"
                  className="w-full border dark:border-neutral-700 rounded-lg px-3 py-2 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="서울시 강남구 역삼동"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  국적
                </label>
                <input
                  type="text"
                  className="w-full border dark:border-neutral-700 rounded-lg px-3 py-2 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
                  value={formData.nationality}
                  onChange={(e) => setFormData({ ...formData, nationality: e.target.value })}
                  placeholder="한국"
                />
              </div>
            </div>
          </div>

          {/* 학원별 정보 섹션 */}
          <div className="space-y-4 pt-4 border-t dark:border-neutral-700">
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 border-b dark:border-neutral-700 pb-2">
              학원별 정보
            </h4>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                학원을 알게 된 경로
              </label>
              <select
                className="w-full border dark:border-neutral-700 rounded-lg px-3 py-2 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
                value={formData.referral_source}
                onChange={(e) => setFormData({ ...formData, referral_source: e.target.value })}
              >
                <option value="">선택</option>
                {REFERRAL_SOURCES.map((source) => (
                  <option key={source.value} value={source.value}>
                    {source.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                관심있는 장르 (여러개 선택 가능)
              </label>
              <div className="flex flex-wrap gap-2">
                {GENRES.map((genre) => (
                  <button
                    key={genre}
                    type="button"
                    onClick={() => toggleGenre(genre)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                      formData.interested_genres.includes(genre)
                        ? 'bg-primary dark:bg-[#CCFF00] text-black'
                        : 'bg-neutral-200 dark:bg-neutral-700 text-gray-700 dark:text-gray-300 hover:bg-neutral-300 dark:hover:bg-neutral-600'
                    }`}
                  >
                    {genre}
                  </button>
                ))}
              </div>
              {formData.interested_genres.length > 0 && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  선택된 장르: {formData.interested_genres.join(', ')}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Level
              </label>
              <input
                type="text"
                className="w-full border dark:border-neutral-700 rounded-lg px-3 py-2 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
                value={formData.level}
                onChange={(e) => setFormData({ ...formData, level: e.target.value })}
                placeholder="예: 초급, 중급, 고급"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-4 border-t dark:border-neutral-700">
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

