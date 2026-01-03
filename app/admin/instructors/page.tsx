"use client";

import { useState, useEffect, useCallback } from 'react';
import { Plus, Edit, Trash2, X, Clipboard } from 'lucide-react';
import { getSupabaseClient } from '@/lib/utils/supabase-client';
import { Instructor } from '@/lib/supabase/types';
import { ImageUpload } from '@/components/common/image-upload';
import { uploadFile, deleteFile, extractFilePathFromUrl } from '@/lib/utils/storage';

const GENRES = ['Choreo', 'hiphop', 'locking', 'waacking', 'popping', 'krump', 'voguing', 'breaking(bboying)'] as const;

export default function InstructorsPage() {
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name_kr: '',
    name_en: '',
    bio: '',
    instagram_url: '',
    selectedGenres: [] as string[],
    profileImageFile: null as File | null,
    profileImageUrl: null as string | null,
  });
  const [profileImageUrls, setProfileImageUrls] = useState<Record<string, string>>({});
  const [updatingIds, setUpdatingIds] = useState<Set<string>>(new Set());
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const loadInstructors = useCallback(async () => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await (supabase as any)
        .from('instructors')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setInstructors(data || []);
      
      // 프로필 이미지 URL 초기화
      const initialProfileImageUrls: Record<string, string> = {};
      (data || []).forEach((instructor: any) => {
        initialProfileImageUrls[instructor.id] = instructor.profile_image_url || '';
      });
      setProfileImageUrls(initialProfileImageUrls);
    } catch (error) {
      console.error('Error loading instructors:', error);
      alert('강사 목록을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInstructors();
  }, [loadInstructors]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = getSupabaseClient() as any;
    if (!supabase) return;

    try {
      if (!formData.name_kr && !formData.name_en) {
        alert('한글명 또는 영문명 중 하나는 필수입니다.');
        return;
      }

      // 이미지 처리: 파일이 있으면 업로드, URL이 있으면 그대로 사용
      let profileImageUrl = formData.profileImageUrl;
      if (formData.profileImageFile) {
        // 파일 업로드
        try {
          const instructorId = editingId || 'temp';
          profileImageUrl = await uploadFile(
            'instructor-profiles',
            formData.profileImageFile,
            `instructors/${instructorId}`
          );
        } catch (error: any) {
          console.error('Image upload error:', error);
          alert(`이미지 업로드에 실패했습니다: ${error.message}`);
          return;
        }
      } else if (formData.profileImageUrl) {
        // URL이 직접 입력된 경우 그대로 사용
        profileImageUrl = formData.profileImageUrl;
      }

      const submitData: any = {
        name_kr: formData.name_kr || null,
        name_en: formData.name_en || null,
        instagram_url: formData.instagram_url || null,
        profile_image_url: profileImageUrl,
      };

      // bio와 specialties는 컬럼이 있을 때만 추가
      if (formData.bio && formData.bio.trim() !== '') {
        submitData.bio = formData.bio;
      }
      if (formData.selectedGenres.length > 0) {
        submitData.specialties = formData.selectedGenres.join(', ');
      }

      if (editingId) {
        // 기존 이미지 삭제 (새 파일이 업로드된 경우에만, URL 변경은 Storage에서 삭제하지 않음)
        if (formData.profileImageFile) {
          const { data: existingInstructor } = await (supabase as any)
            .from('instructors')
            .select('profile_image_url')
            .eq('id', editingId)
            .single();

          if (existingInstructor && (existingInstructor as any).profile_image_url) {
            // 기존 이미지가 Supabase Storage에 있는 경우에만 삭제
            const existingUrl = (existingInstructor as any).profile_image_url;
            if (existingUrl && existingUrl.includes('supabase.co/storage')) {
              try {
                const filePath = extractFilePathFromUrl(existingUrl);
                if (filePath) {
                  await deleteFile('instructor-profiles', filePath);
                }
              } catch (error) {
                console.error('Failed to delete old image:', error);
                // 이미지 삭제 실패해도 계속 진행
              }
            }
          }
        }

        const { error } = await (supabase as any)
          .from('instructors')
          .update(submitData)
          .eq('id', editingId);

        if (error) throw error;
      } else {
        const { data: newInstructor, error } = await (supabase as any)
          .from('instructors')
          .insert([submitData])
          .select()
          .single();

        if (error) throw error;
      }

      await loadInstructors();
      setShowForm(false);
      setEditingId(null);
      setFormData({
        name_kr: '',
        name_en: '',
        bio: '',
        instagram_url: '',
        selectedGenres: [],
        profileImageFile: null,
        profileImageUrl: null,
      });
    } catch (error) {
      console.error('Error saving instructor:', error);
      alert('강사 저장에 실패했습니다.');
    }
  };

  const handleEdit = (instructor: Instructor) => {
    setEditingId(instructor.id);
    const genres = instructor.specialties
      ? instructor.specialties.split(',').map(g => g.trim()).filter(g => GENRES.includes(g as typeof GENRES[number]))
      : [];
    
    const instructorAny = instructor;
    setFormData({
      name_kr: instructor.name_kr || '',
      name_en: instructor.name_en || '',
      bio: instructor.bio || '',
      instagram_url: instructor.instagram_url || '',
      selectedGenres: genres,
      profileImageFile: null,
      profileImageUrl: instructor.profile_image_url || null,
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('정말 삭제하시겠습니까?')) return;

    const supabase = getSupabaseClient() as any;
    if (!supabase) return;

    try {
      const { error } = await (supabase as any)
        .from('instructors')
        .delete()
        .eq('id', id);

      if (error) throw error;
      await loadInstructors();
    } catch (error) {
      console.error('Error deleting instructor:', error);
      alert('강사 삭제에 실패했습니다.');
    }
  };

  const toggleGenre = (genre: string) => {
    setFormData((prev) => ({
      ...prev,
      selectedGenres: prev.selectedGenres.includes(genre)
        ? prev.selectedGenres.filter((g) => g !== genre)
        : [...prev.selectedGenres, genre],
    }));
  };

  const removeGenre = (genre: string) => {
    setFormData((prev) => ({
      ...prev,
      selectedGenres: prev.selectedGenres.filter((g) => g !== genre),
    }));
  };

  const getGenresFromSpecialties = (specialties: string | null): string[] => {
    if (!specialties) return [];
    return specialties.split(',').map(g => g.trim()).filter(g => GENRES.includes(g as typeof GENRES[number]));
  };

  const handleProfileImageUrlChange = (instructorId: string, value: string) => {
    setProfileImageUrls((prev) => ({
      ...prev,
      [instructorId]: value,
    }));
  };

  const handleUpdateProfileImage = async (instructorId: string) => {
    const supabaseClient = getSupabaseClient();
    if (!supabaseClient) return;
    const supabase = supabaseClient as any;

    if (updatingIds.has(instructorId)) return; // 이미 업데이트 중이면 무시

    setUpdatingIds((prev) => new Set(prev).add(instructorId));

    try {
      const profileImageUrl = profileImageUrls[instructorId]?.trim() || null;

      const { error } = await supabase
        .from('instructors')
        .update({ profile_image_url: profileImageUrl })
        .eq('id', instructorId);

      if (error) throw error;

      await loadInstructors();
    } catch (error: any) {
      console.error('Error updating profile image:', error);
      alert(`프로필 이미지 URL 업데이트에 실패했습니다: ${error?.message || '알 수 없는 오류'}`);
    } finally {
      setUpdatingIds((prev) => {
        const next = new Set(prev);
        next.delete(instructorId);
        return next;
      });
    }
  };

  const handleCopyToClipboard = async (instructorName: string) => {
    try {
      await navigator.clipboard.writeText(instructorName);
      setToastMessage('강사명이 클립보드에 복사되었습니다.');
      setTimeout(() => setToastMessage(null), 2000);
    } catch (error) {
      console.error('클립보드 복사 실패:', error);
      setToastMessage('클립보드 복사에 실패했습니다.');
      setTimeout(() => setToastMessage(null), 2000);
    }
  };

  if (loading) {
    return <div className="text-center py-12">로딩 중...</div>;
  }

  return (
    <div>
      {/* Toast Message */}
      {toastMessage && (
        <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4 fade-in">
          <div className="bg-neutral-900 dark:bg-neutral-800 text-white px-4 py-2 rounded-lg shadow-lg text-sm">
            {toastMessage}
          </div>
        </div>
      )}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-black dark:text-white">강사 관리</h1>
          <p className="text-neutral-600 dark:text-neutral-400 mt-1">
            강사를 등록하고 관리할 수 있습니다.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              setShowForm(!showForm);
              setEditingId(null);
              setFormData({
                name_kr: '',
                name_en: '',
                bio: '',
                instagram_url: '',
                selectedGenres: [],
                profileImageFile: null,
                profileImageUrl: null,
              });
            }}
            className="px-4 py-2 bg-primary dark:bg-[#CCFF00] text-black rounded-lg hover:opacity-90 flex items-center gap-2"
          >
            <Plus size={20} />
            {showForm ? '취소' : '강사 추가'}
          </button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white dark:bg-neutral-900 rounded-xl p-6 border border-neutral-200 dark:border-neutral-800 mb-6">
          <h2 className="text-xl font-bold text-black dark:text-white mb-4">
            {editingId ? '강사 수정' : '새 강사 등록'}
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-black dark:text-white mb-2">
                댄서네임 (한글) *
              </label>
              <input
                type="text"
                value={formData.name_kr}
                onChange={(e) => setFormData({ ...formData, name_kr: e.target.value })}
                placeholder="예: 홍길동"
                className="w-full px-4 py-2 bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-black dark:text-white"
              />
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                한글명 또는 영문명 중 하나는 필수입니다
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-black dark:text-white mb-2">
                댄서네임 (영문)
              </label>
              <input
                type="text"
                value={formData.name_en}
                onChange={(e) => setFormData({ ...formData, name_en: e.target.value })}
                placeholder="예: Hong Gildong"
                className="w-full px-4 py-2 bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-black dark:text-white"
              />
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                한글명 또는 영문명 중 하나는 필수입니다
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-black dark:text-white mb-2">
                소개
              </label>
              <textarea
                value={formData.bio}
                onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                rows={3}
                className="w-full px-4 py-2 bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-black dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-black dark:text-white mb-2">
                Instagram URL
              </label>
              <input
                type="url"
                value={formData.instagram_url}
                onChange={(e) => setFormData({ ...formData, instagram_url: e.target.value })}
                className="w-full px-4 py-2 bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-black dark:text-white"
              />
            </div>
            <div>
              <ImageUpload
                label="프로필 이미지"
                currentImageUrl={formData.profileImageUrl}
                onImageChange={(file) =>
                  setFormData({ ...formData, profileImageFile: file })
                }
                onImageUrlChange={(url) =>
                  setFormData({ ...formData, profileImageUrl: url })
                }
                maxSizeMB={5}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-black dark:text-white mb-2">
                장르 *
              </label>
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  {GENRES.map((genre) => {
                    const isSelected = formData.selectedGenres.includes(genre);
                    return (
                      <button
                        key={genre}
                        type="button"
                        onClick={() => toggleGenre(genre)}
                        className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                          isSelected
                            ? 'bg-primary dark:bg-[#CCFF00] text-black'
                            : 'bg-neutral-200 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-300 dark:hover:bg-neutral-700'
                        }`}
                      >
                        {genre}
                      </button>
                    );
                  })}
                </div>
                {formData.selectedGenres.length > 0 && (
                  <div className="flex flex-wrap gap-2 items-center">
                    <span className="text-xs text-neutral-500 dark:text-neutral-400">선택된 장르:</span>
                    {formData.selectedGenres.map((genre) => (
                      <span
                        key={genre}
                        className="inline-flex items-center gap-1 px-3 py-1 bg-primary/20 dark:bg-[#CCFF00]/20 text-primary dark:text-[#CCFF00] rounded-full text-sm"
                      >
                        {genre}
                        <button
                          type="button"
                          onClick={() => removeGenre(genre)}
                          className="hover:opacity-70"
                        >
                          <X size={14} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <button
              type="submit"
              className="w-full px-4 py-2 bg-primary dark:bg-[#CCFF00] text-black font-bold rounded-lg hover:opacity-90"
            >
              {editingId ? '수정' : '등록'}
            </button>
          </div>
        </form>
      )}

      <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-neutral-100 dark:bg-neutral-800">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">
                  댄서네임
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">
                  장르
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">
                  등록일
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">
                  프로필 이미지 URL
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">
                  작업
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
              {instructors.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-neutral-500 dark:text-neutral-400">
                    등록된 강사가 없습니다.
                  </td>
                </tr>
              ) : (
                instructors.map((instructor) => {
                  const genres = getGenresFromSpecialties(instructor.specialties);
                  const nameKr = instructor.name_kr;
                  const nameEn = instructor.name_en;
                  const displayName = nameKr && nameEn 
                    ? `${nameKr} (${nameEn})` 
                    : nameKr || nameEn || '-';
                  
                  return (
                    <tr key={instructor.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-black dark:text-white">
                        {displayName}
                      </td>
                      <td className="px-6 py-4 text-sm text-neutral-600 dark:text-neutral-400">
                        {genres.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {genres.map((genre) => (
                              <span
                                key={genre}
                                className="px-2 py-1 bg-primary/10 dark:bg-[#CCFF00]/10 text-primary dark:text-[#CCFF00] rounded-full text-xs font-medium"
                              >
                                {genre}
                              </span>
                            ))}
                          </div>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-600 dark:text-neutral-400">
                        {instructor.created_at ? new Date(instructor.created_at).toLocaleDateString('ko-KR') : '-'}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-2 min-w-[300px]">
                          <input
                            type="text"
                            placeholder="프로필 이미지 URL"
                            value={profileImageUrls[instructor.id] || ''}
                            onChange={(e) => handleProfileImageUrlChange(instructor.id, e.target.value)}
                            className="px-3 py-1.5 text-xs bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded text-black dark:text-white placeholder-neutral-400"
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleUpdateProfileImage(instructor.id)}
                              disabled={updatingIds.has(instructor.id)}
                              className="flex-1 px-3 py-1.5 text-xs bg-primary dark:bg-[#CCFF00] text-black rounded hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                            >
                              {updatingIds.has(instructor.id) ? '저장 중...' : '저장'}
                            </button>
                            <button
                              onClick={() => handleCopyToClipboard(instructor.name_kr || instructor.name_en || '')}
                              className="px-3 py-1.5 text-xs bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300 rounded hover:opacity-80 transition-opacity"
                              title="강사명 복사"
                            >
                              <Clipboard size={14} />
                            </button>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => handleEdit(instructor)}
                            className="text-primary dark:text-[#CCFF00] hover:opacity-80"
                          >
                            <Edit size={18} />
                          </button>
                          <button
                            onClick={() => handleDelete(instructor.id)}
                            className="text-red-500 hover:opacity-80"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
