"use client";

import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Clipboard } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { getSupabaseClient } from '@/lib/utils/supabase-client';
import { Academy, Hall } from '@/lib/supabase/types';
import { AcademyFormModal } from './components/academy-form-modal';
import { uploadFile, deleteFile, extractFilePathFromUrl } from '@/lib/utils/storage';

interface HallData {
  id?: string;
  name: string;
  capacity: number;
}

interface AcademyImageData {
  id?: string;
  image_url: string;
  imageFile?: File | null;
  display_order: number;
}

interface AcademyFormData {
  name_kr: string | null;
  name_en: string | null;
  tags: string[];
  address: string | null;
  contact_number: string | null;
  logo_url: string | null;
  instagram_handle: string | null;
  youtube_url: string | null;
  tiktok_handle: string | null;
  website_url: string | null;
  other_url: string | null;
  halls: HallData[];
  academy_images: AcademyImageData[];
}

export default function AcademiesPage() {
  const router = useRouter();
  const [academies, setAcademies] = useState<Academy[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingData, setEditingData] = useState<AcademyFormData | null>(null);
  const [imageUrls, setImageUrls] = useState<Record<string, [string, string, string]>>({});
  const [updatingIds, setUpdatingIds] = useState<Set<string>>(new Set());
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    loadAcademies();
  }, []);

  const loadAcademies = async () => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      console.error('Supabase client is null. Check environment variables.');
      alert('데이터베이스 연결에 실패했습니다. 환경 변수를 확인해주세요.');
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await (supabase as any)
        .from('academies')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Supabase query error:', error);
        throw error;
      }

      setAcademies(data || []);
      
      // 이미지 URL 초기화
      const initialImageUrls: Record<string, [string, string, string]> = {};
      (data || []).forEach((academy: any) => {
        const images = (academy.images && Array.isArray(academy.images)) ? academy.images : [];
        initialImageUrls[academy.id] = [
          images[0]?.url || '',
          images[1]?.url || '',
          images[2]?.url || '',
        ];
      });
      setImageUrls(initialImageUrls);
    } catch (error: any) {
      console.error('Error loading academies:', error);
      const errorMessage = error?.message || '알 수 없는 오류가 발생했습니다.';
      alert(`학원 목록을 불러오는데 실패했습니다: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (formData: AcademyFormData) => {
    const supabaseClient = getSupabaseClient();
    if (!supabaseClient) return;
    const supabase = supabaseClient as any;

    try {
      let academyId: string;

      // 1. 학원 정보 저장/업데이트
      if (editingId) {
        const submitData: any = {
          name_kr: formData.name_kr || null,
          name_en: formData.name_en || null,
          tags: formData.tags.length > 0 ? formData.tags.join(', ') : null,
          address: formData.address || null,
          contact_number: formData.contact_number || null,
          logo_url: formData.logo_url || null,
          instagram_handle: formData.instagram_handle || null,
          youtube_url: formData.youtube_url || null,
          tiktok_handle: formData.tiktok_handle || null,
          website_url: formData.website_url || null,
          other_url: formData.other_url || null,
        };

        const { error } = await supabase
          .from('academies')
          .update(submitData)
          .eq('id', editingId);

        if (error) throw error;
        academyId = editingId;
      } else {
        const submitData: any = {
          name_kr: formData.name_kr || null,
          name_en: formData.name_en || null,
          tags: formData.tags.length > 0 ? formData.tags.join(', ') : null,
          address: formData.address || null,
          contact_number: formData.contact_number || null,
          logo_url: formData.logo_url || null,
          instagram_handle: formData.instagram_handle || null,
          youtube_url: formData.youtube_url || null,
          tiktok_handle: formData.tiktok_handle || null,
          website_url: formData.website_url || null,
          other_url: formData.other_url || null,
        };

        const { data: newAcademy, error } = await supabase
          .from('academies')
          .insert([submitData])
          .select()
          .single();

        if (error) throw error;
        academyId = newAcademy.id;
      }

      // 2. 학원 이미지 처리 (JSONB 기반)
      if (editingId) {
        // 기존 이미지 로드 (JSONB에서)
        const { data: existingAcademy } = await supabase
          .from('academies')
          .select('images')
          .eq('id', academyId)
          .single();

        const existingImages = (existingAcademy?.images && Array.isArray(existingAcademy.images)) 
          ? existingAcademy.images 
          : [];

        // 삭제할 이미지 찾기 (formData에 없는 기존 이미지)
        const formImageUrls = formData.academy_images
          .filter((img) => img.image_url && img.image_url.trim() !== '')
          .map((img) => img.image_url);

        for (const existingImg of existingImages) {
          if (!formImageUrls.includes(existingImg.url)) {
            // Storage에서 삭제
            if (existingImg.url && existingImg.url.includes('supabase.co/storage')) {
              try {
                const filePath = extractFilePathFromUrl(existingImg.url);
                if (filePath) {
                  await deleteFile('academy-images', filePath);
                }
              } catch (error) {
                console.error('Failed to delete image from storage:', error);
              }
            }
          }
        }
      }

      // 이미지 업로드 및 JSONB 배열 생성
      const imagesArray: Array<{ url: string; order: number }> = [];
      
      for (let i = 0; i < formData.academy_images.length; i++) {
        const image = formData.academy_images[i];
        let imageUrl = image.image_url;

        console.log(`Processing image ${i + 1}:`, {
          hasImageFile: !!image.imageFile,
          imageUrl: imageUrl,
          image: image,
        });

        // 새 파일이 업로드된 경우
        if (image.imageFile) {
          try {
            // 기존 이미지가 있으면 삭제 (수정 모드에서)
            if (editingId && image.image_url && image.image_url.includes('supabase.co/storage')) {
              try {
                const filePath = extractFilePathFromUrl(image.image_url);
                if (filePath) {
                  await deleteFile('academy-images', filePath);
                }
              } catch (error) {
                console.error('Failed to delete old image:', error);
              }
            }

            imageUrl = await uploadFile(
              'academy-images',
              image.imageFile,
              `academies/${academyId}`
            );
          } catch (error: any) {
            console.error('Image upload error:', error);
            throw new Error(`이미지 업로드에 실패했습니다: ${error.message}`);
          }
        }

        // imageUrl이 유효한 경우에만 배열에 추가
        if (!imageUrl || (typeof imageUrl === 'string' && imageUrl.trim() === '')) {
          console.warn(`이미지 ${i + 1}번째 항목에 유효한 URL 또는 파일이 없어 건너뜁니다.`);
          continue;
        }

        // URL 유효성 검사 (파일이 아닌 경우 URL 형식인지 확인)
        if (!image.imageFile) {
          try {
            const urlObj = new URL(imageUrl);
            console.log(`Valid URL detected: ${urlObj.href}`);
          } catch (urlError) {
            console.warn(`이미지 ${i + 1}번째 항목의 URL이 유효하지 않아 건너뜁니다: ${imageUrl}`, urlError);
            continue;
          }
        }

        // JSONB 배열에 추가
        imagesArray.push({
          url: imageUrl,
          order: imagesArray.length,
        });
      }

      // JSONB 배열을 academies 테이블에 업데이트
      const { error: imagesUpdateError } = await supabase
        .from('academies')
        .update({ images: imagesArray })
        .eq('id', academyId);

      if (imagesUpdateError) {
        console.error('Error updating images:', imagesUpdateError);
        throw new Error(`이미지 저장에 실패했습니다: ${imagesUpdateError.message}`);
      }

      // 3. 홀 처리
      if (editingId) {
        // 기존 홀 로드
        const { data: existingHalls } = await supabase
          .from('halls')
          .select('id')
          .eq('academy_id', academyId);

        const existingHallIds = (existingHalls || []).map((h: any) => h.id);
        const formHallIds = formData.halls.filter((h) => h.id).map((h) => h.id!);

        // 삭제할 홀 찾기
        const deletedHallIds = existingHallIds.filter(
          (id: string) => !formHallIds.includes(id)
        );

        // 삭제할 홀 삭제
        if (deletedHallIds.length > 0) {
          await supabase.from('halls').delete().in('id', deletedHallIds);
        }
      }

      // 홀 저장 또는 업데이트
      for (const hall of formData.halls) {
        if (!hall.name || hall.capacity <= 0) continue;

        const hallData: any = {
          academy_id: academyId,
          name: hall.name,
          capacity: hall.capacity,
        };

        if (hall.id && editingId) {
          await supabase.from('halls').update(hallData).eq('id', hall.id);
        } else {
          await supabase.from('halls').insert([hallData]);
        }
      }

      await loadAcademies();
      setShowModal(false);
      setEditingId(null);
      setEditingData(null);
    } catch (error: any) {
      console.error('Error saving academy:', error);
      const errorMessage = error?.message || error?.details || '알 수 없는 오류가 발생했습니다.';
      throw new Error(errorMessage);
    }
  };

  const handleEdit = async (academy: Academy) => {
    const supabaseClient = getSupabaseClient();
    if (!supabaseClient) return;
    const supabase = supabaseClient as any;

    try {
      // 홀 데이터 로드
      const { data: halls, error: hallsError } = await supabase
        .from('halls')
        .select('*')
        .eq('academy_id', academy.id)
        .order('created_at', { ascending: true });

      if (hallsError) {
        console.error('Error loading halls:', hallsError);
        throw hallsError;
      }

      // 이미지 데이터는 JSONB에서 로드
      const images = (academy.images && Array.isArray(academy.images)) ? academy.images : [];

      const tags = academy.tags
        ? (academy.tags as string).split(',').map((t: string) => t.trim()).filter((t: string) => t)
        : [];

      setEditingData({
        name_kr: academy.name_kr || '',
        name_en: academy.name_en || '',
        tags,
        address: (academy as any).address || '',
        contact_number: (academy as any).contact_number || '',
        logo_url: academy.logo_url || '',
        instagram_handle: (academy as any).instagram_handle || '',
        youtube_url: (academy as any).youtube_url || '',
        tiktok_handle: (academy as any).tiktok_handle || '',
        website_url: (academy as any).website_url || '',
        other_url: (academy as any).other_url || '',
        halls: (halls || []).map((hall: any) => ({
          id: hall.id,
          name: hall.name,
          capacity: hall.capacity || 0,
        })),
        academy_images: images.map((img: any) => ({
          id: undefined, // JSONB에는 id가 없음
          image_url: img.url || '',
          display_order: img.order || 0,
        })),
      });
      setEditingId(academy.id);
      setShowModal(true);
    } catch (error: any) {
      console.error('Error loading academy data:', error);
      const errorMessage = error?.message || error?.details || '알 수 없는 오류가 발생했습니다.';
      alert(`학원 데이터를 불러오는데 실패했습니다: ${errorMessage}`);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('정말 삭제하시겠습니까? 관련된 홀, 클래스 등도 함께 삭제됩니다.')) return;

    const supabaseClient = getSupabaseClient();
    if (!supabaseClient) return;
    const supabase = supabaseClient as any;

    try {
      // 관련 데이터 확인
      const { data: classes } = await supabase
        .from('classes')
        .select('id')
        .eq('academy_id', id)
        .limit(1);

      if (classes && classes.length > 0) {
        if (!confirm('이 학원에 연결된 클래스가 있습니다. 정말 삭제하시겠습니까?')) return;
      }

      // 관련 데이터 삭제
      // 1. 클래스 관련 삭제
      const { data: classesData } = await supabase
        .from('classes')
        .select('id')
        .eq('academy_id', id);

      if (classesData && classesData.length > 0) {
        const classIds = classesData.map((c: any) => c.id);

        const { data: schedules } = await supabase
          .from('schedules')
          .select('id')
          .in('class_id', classIds);

        if (schedules && schedules.length > 0) {
          const scheduleIds = schedules.map((s: any) => s.id);
          await supabase.from('bookings').delete().in('schedule_id', scheduleIds);
        }

        await supabase.from('schedules').delete().in('class_id', classIds);
        await supabase.from('classes').delete().eq('academy_id', id);
      }

      // 2. 이미지 삭제 (JSONB에서)
      const { data: academy } = await supabase
        .from('academies')
        .select('images')
        .eq('id', id)
        .single();

      if (academy?.images && Array.isArray(academy.images)) {
        for (const image of academy.images) {
          if (image.url && image.url.includes('supabase.co/storage')) {
            try {
              const filePath = extractFilePathFromUrl(image.url);
              if (filePath) {
                await deleteFile('academy-images', filePath);
              }
            } catch (error) {
              console.error('Failed to delete image:', error);
            }
          }
        }
      }

      // 3. 홀 삭제
      await supabase.from('halls').delete().eq('academy_id', id);

      // 4. 학원 삭제
      const { error } = await supabase.from('academies').delete().eq('id', id);

      if (error) throw error;

      await loadAcademies();
    } catch (error: any) {
      console.error('Error deleting academy:', error);
      const errorMessage = error?.message || error?.details || '알 수 없는 오류가 발생했습니다.';
      alert(`학원 삭제에 실패했습니다: ${errorMessage}`);
    }
  };

  const getDisplayName = (academy: Academy) => {
    const nameKr = academy.name_kr;
    const nameEn = academy.name_en;
    if (nameKr && nameEn) {
      return `${nameKr} (${nameEn})`;
    }
    return nameKr || nameEn || '-';
  };

  const getTags = (academy: Academy) => {
    const tags = academy.tags;
    if (!tags) return [];
    return tags.split(',').map((t: string) => t.trim()).filter((t: string) => t);
  };

  const handleImageUrlsChange = (academyId: string, index: number, value: string) => {
    setImageUrls((prev) => {
      const current = prev[academyId] || ['', '', ''];
      const updated = [...current];
      updated[index] = value;
      return { ...prev, [academyId]: updated as [string, string, string] };
    });
  };

  const handleUpdateImages = async (academyId: string) => {
    const supabaseClient = getSupabaseClient();
    if (!supabaseClient) return;
    const supabase = supabaseClient as any;

    if (updatingIds.has(academyId)) return; // 이미 업데이트 중이면 무시

    setUpdatingIds((prev) => new Set(prev).add(academyId));

    try {
      const urls = imageUrls[academyId] || ['', '', ''];
      const imagesArray = urls
        .filter((url) => url && url.trim() !== '')
        .map((url, index) => ({
          url: url.trim(),
          order: index + 1,
        }));

      const { error } = await supabase
        .from('academies')
        .update({ images: imagesArray })
        .eq('id', academyId);

      if (error) throw error;

      await loadAcademies();
    } catch (error: any) {
      console.error('Error updating images:', error);
      alert(`이미지 URL 업데이트에 실패했습니다: ${error?.message || '알 수 없는 오류'}`);
    } finally {
      setUpdatingIds((prev) => {
        const next = new Set(prev);
        next.delete(academyId);
        return next;
      });
    }
  };

  const handleToggleActive = async (academy: Academy) => {
    const supabaseClient = getSupabaseClient();
    if (!supabaseClient) return;
    const supabase = supabaseClient as any;

    setUpdatingIds((prev) => new Set(prev).add(academy.id));

    try {
      const newActiveStatus = !(academy as any).is_active;
      const { error } = await supabase
        .from('academies')
        .update({ is_active: newActiveStatus })
        .eq('id', academy.id);

      if (error) throw error;

      await loadAcademies();
    } catch (error: any) {
      console.error('Error toggling active status:', error);
      alert(`상태 변경에 실패했습니다: ${error?.message || '알 수 없는 오류'}`);
    } finally {
      setUpdatingIds((prev) => {
        const next = new Set(prev);
        next.delete(academy.id);
        return next;
      });
    }
  };

  const handleCopyToClipboard = async (academyName: string) => {
    try {
      await navigator.clipboard.writeText(academyName);
      setToastMessage('학원명이 클립보드에 복사되었습니다.');
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
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-black dark:text-white">학원 관리</h1>
          <p className="text-sm sm:text-base text-neutral-600 dark:text-neutral-400 mt-1">
            학원을 등록하고 관리할 수 있습니다.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              setEditingId(null);
              setEditingData(null);
              setShowModal(true);
            }}
            className="w-full sm:w-auto px-4 py-2 bg-primary dark:bg-[#CCFF00] text-black rounded-lg hover:opacity-90 flex items-center justify-center gap-2 text-sm sm:text-base"
          >
            <Plus size={20} />
            <span className="hidden sm:inline">학원 추가</span>
            <span className="sm:hidden">추가</span>
          </button>
        </div>
      </div>

      <AcademyFormModal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setEditingId(null);
          setEditingData(null);
        }}
        onSubmit={async (data) => {
          try {
            await handleSubmit(data);
          } catch (error: any) {
            const errorMessage = error?.message || error?.details || '알 수 없는 오류가 발생했습니다.';
            alert(`학원 저장에 실패했습니다: ${errorMessage}`);
            throw error;
          }
        }}
        initialData={editingData}
        isEditing={!!editingId}
      />

      <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 overflow-hidden">
        {/* 데스크톱 테이블 뷰 */}
        <div className="hidden lg:block overflow-x-auto">
          <table className="w-full">
            <thead className="bg-neutral-100 dark:bg-neutral-800">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">
                  학원명
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">
                  주소
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">
                  연락처
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">
                  태그
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">
                  등록일
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">
                  상태
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">
                  이미지 URL
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">
                  작업
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
              {academies.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-neutral-500 dark:text-neutral-400">
                    등록된 학원이 없습니다.
                  </td>
                </tr>
              ) : (
                academies.map((academy) => {
                  const tags = getTags(academy);
                  return (
                    <tr key={academy.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50">
                      <td className="px-6 py-4 text-sm font-medium text-black dark:text-white">
                        <button
                          onClick={() => router.push(`/academy-admin/${academy.id}`)}
                          className="hover:text-primary dark:hover:text-[#CCFF00] hover:underline transition-colors text-left"
                        >
                          {getDisplayName(academy)}
                        </button>
                      </td>
                      <td className="px-6 py-4 text-sm text-neutral-600 dark:text-neutral-400">
                        {academy.address || '-'}
                      </td>
                      <td className="px-6 py-4 text-sm text-neutral-600 dark:text-neutral-400">
                        {academy.contact_number || '-'}
                      </td>
                      <td className="px-6 py-4">
                        {tags.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {tags.map((tag) => (
                              <span
                                key={tag}
                                className="px-2 py-1 bg-neutral-200 dark:bg-[#CCFF00]/10 text-neutral-900 dark:text-[#CCFF00] rounded-full text-xs font-medium"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-neutral-400 dark:text-neutral-500 text-sm">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-600 dark:text-neutral-400">
                        {academy.created_at ? new Date(academy.created_at).toLocaleDateString('ko-KR') : '-'}
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => handleToggleActive(academy)}
                          disabled={updatingIds.has(academy.id)}
                          className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                            (academy as any).is_active !== false
                              ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                              : 'bg-neutral-200 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-400'
                          } ${updatingIds.has(academy.id) ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-80 cursor-pointer'}`}
                        >
                          {(academy as any).is_active !== false ? '활성' : '비활성'}
                        </button>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-2 min-w-[300px]">
                          {[0, 1, 2].map((index) => (
                            <input
                              key={index}
                              type="text"
                              placeholder={`이미지 URL ${index + 1}`}
                              value={imageUrls[academy.id]?.[index] || ''}
                              onChange={(e) => handleImageUrlsChange(academy.id, index, e.target.value)}
                              className="px-3 py-1.5 text-xs bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded text-black dark:text-white placeholder-neutral-400"
                            />
                          ))}
                          <div className="flex gap-2 mt-1">
                            <button
                              onClick={() => handleUpdateImages(academy.id)}
                              disabled={updatingIds.has(academy.id)}
                              className="flex-1 px-3 py-1.5 text-xs bg-primary dark:bg-[#CCFF00] text-black rounded hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                            >
                              {updatingIds.has(academy.id) ? '저장 중...' : '저장'}
                            </button>
                            <button
                              onClick={() => handleCopyToClipboard(academy.name_kr || academy.name_en || '')}
                              className="px-3 py-1.5 text-xs bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300 rounded hover:opacity-80 transition-opacity"
                              title="학원명 복사"
                            >
                              <Clipboard size={14} />
                            </button>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => handleEdit(academy)}
                            className="text-primary dark:text-[#CCFF00] hover:opacity-80"
                          >
                            <Edit size={18} />
                          </button>
                          <button
                            onClick={() => handleDelete(academy.id)}
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

        {/* 모바일 카드 뷰 */}
        <div className="lg:hidden">
          {academies.length === 0 ? (
            <div className="px-4 py-12 text-center text-neutral-500 dark:text-neutral-400">
              등록된 학원이 없습니다.
            </div>
          ) : (
            <div className="divide-y divide-neutral-200 dark:divide-neutral-800">
              {academies.map((academy) => {
                const tags = getTags(academy);
                return (
                  <div key={academy.id} className="p-4 hover:bg-neutral-50 dark:hover:bg-neutral-800/50">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <button
                        onClick={() => router.push(`/academy-admin/${academy.id}`)}
                        className="flex-1 text-left hover:text-primary dark:hover:text-[#CCFF00] hover:underline transition-colors"
                      >
                        <h3 className="font-semibold text-black dark:text-white text-base">
                          {getDisplayName(academy)}
                        </h3>
                      </button>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEdit(academy)}
                          className="text-primary dark:text-[#CCFF00] hover:opacity-80 p-1"
                          aria-label="수정"
                        >
                          <Edit size={18} />
                        </button>
                        <button
                          onClick={() => handleDelete(academy.id)}
                          className="text-red-500 hover:opacity-80 p-1"
                          aria-label="삭제"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                    <div className="space-y-3 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-neutral-700 dark:text-neutral-300">상태: </span>
                        <button
                          onClick={() => handleToggleActive(academy)}
                          disabled={updatingIds.has(academy.id)}
                          className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                            (academy as any).is_active !== false
                              ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                              : 'bg-neutral-200 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-400'
                          } ${updatingIds.has(academy.id) ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-80 cursor-pointer'}`}
                        >
                          {(academy as any).is_active !== false ? '활성' : '비활성'}
                        </button>
                      </div>
                      <div>
                        <div className="font-medium text-neutral-700 dark:text-neutral-300 mb-2">이미지 URL:</div>
                        <div className="flex flex-col gap-2">
                          {[0, 1, 2].map((index) => (
                            <input
                              key={index}
                              type="text"
                              placeholder={`이미지 URL ${index + 1}`}
                              value={imageUrls[academy.id]?.[index] || ''}
                              onChange={(e) => handleImageUrlsChange(academy.id, index, e.target.value)}
                              className="px-3 py-1.5 text-xs bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded text-black dark:text-white placeholder-neutral-400"
                            />
                          ))}
                          <div className="flex gap-2 mt-1">
                            <button
                              onClick={() => handleUpdateImages(academy.id)}
                              disabled={updatingIds.has(academy.id)}
                              className="flex-1 px-3 py-1.5 text-xs bg-primary dark:bg-[#CCFF00] text-black rounded hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                            >
                              {updatingIds.has(academy.id) ? '저장 중...' : '저장'}
                            </button>
                            <button
                              onClick={() => handleCopyToClipboard(academy.name_kr || academy.name_en || '')}
                              className="px-3 py-1.5 text-xs bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300 rounded hover:opacity-80 transition-opacity"
                              title="학원명 복사"
                            >
                              <Clipboard size={14} />
                            </button>
                          </div>
                        </div>
                      </div>
                      {academy.address && (
                        <div className="text-neutral-600 dark:text-neutral-400">
                          <span className="font-medium text-neutral-700 dark:text-neutral-300">주소: </span>
                          {academy.address}
                        </div>
                      )}
                      {academy.contact_number && (
                        <div className="text-neutral-600 dark:text-neutral-400">
                          <span className="font-medium text-neutral-700 dark:text-neutral-300">연락처: </span>
                          {academy.contact_number}
                        </div>
                      )}
                      {tags.length > 0 && (
                        <div>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {tags.map((tag) => (
                              <span
                                key={tag}
                                className="px-2 py-1 bg-neutral-200 dark:bg-[#CCFF00]/10 text-neutral-900 dark:text-[#CCFF00] rounded-full text-xs font-medium"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {academy.created_at && (
                        <div className="text-neutral-500 dark:text-neutral-400 text-xs pt-1">
                          등록일: {new Date(academy.created_at).toLocaleDateString('ko-KR')}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
