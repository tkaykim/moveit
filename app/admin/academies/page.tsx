"use client";

import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2 } from 'lucide-react';
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
        .select(`
          *,
          academy_images (*)
        `)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Supabase query error:', error);
        throw error;
      }

      setAcademies(data || []);
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
        };

        const { data: newAcademy, error } = await supabase
          .from('academies')
          .insert([submitData])
          .select()
          .single();

        if (error) throw error;
        academyId = newAcademy.id;
      }

      // 2. 학원 이미지 처리
      if (editingId) {
        // 기존 이미지 로드
        const { data: existingImages } = await supabase
          .from('academy_images')
          .select('id, image_url')
          .eq('academy_id', academyId);

        const existingImageIds = (existingImages || []).map((img: any) => img.id);
        const formImageIds = formData.academy_images
          .filter((img) => img.id)
          .map((img) => img.id!);

        // 삭제할 이미지 찾기
        const deletedImageIds = existingImageIds.filter(
          (id: string) => !formImageIds.includes(id)
        );

        // 삭제할 이미지 삭제
        for (const imageId of deletedImageIds) {
          const imageToDelete = existingImages?.find((img: any) => img.id === imageId);
          if (imageToDelete?.image_url && imageToDelete.image_url.includes('supabase.co/storage')) {
            try {
              const filePath = extractFilePathFromUrl(imageToDelete.image_url);
              if (filePath) {
                await deleteFile('academy-images', filePath);
              }
            } catch (error) {
              console.error('Failed to delete image from storage:', error);
            }
          }
          await supabase.from('academy_images').delete().eq('id', imageId);
        }
      }

      // 이미지 업로드 및 저장
      let validImageIndex = 0;
      for (let i = 0; i < formData.academy_images.length; i++) {
        const image = formData.academy_images[i];
        let imageUrl = image.image_url;

        console.log(`Processing image ${i + 1}:`, {
          hasImageFile: !!image.imageFile,
          imageUrl: imageUrl,
          hasImageId: !!image.id,
          image: image, // 전체 이미지 객체 로그
        });

        // 새 파일이 업로드된 경우 (파일이 있으면 우선)
        if (image.imageFile) {
          try {
            // 기존 이미지가 있으면 삭제
            if (image.id && editingId) {
              const { data: existingImage } = await supabase
                .from('academy_images')
                .select('image_url')
                .eq('id', image.id)
                .single();

              if (existingImage?.image_url && existingImage.image_url.includes('supabase.co/storage')) {
                try {
                  const filePath = extractFilePathFromUrl(existingImage.image_url);
                  if (filePath) {
                    await deleteFile('academy-images', filePath);
                  }
                } catch (error) {
                  console.error('Failed to delete old image:', error);
                }
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

        // imageUrl이 유효한 경우에만 저장 (파일 업로드 성공했거나 유효한 URL이 있는 경우)
        // 파일이 있었지만 업로드 실패한 경우는 위에서 에러가 발생했을 것
        // 여기서는 업로드 성공 후 imageUrl이 설정되었거나, 원래 유효한 URL이 있는 경우만 저장
        if (!imageUrl || (typeof imageUrl === 'string' && imageUrl.trim() === '')) {
          console.warn(`이미지 ${i + 1}번째 항목에 유효한 URL 또는 파일이 없어 건너뜁니다.`, {
            hasImageFile: !!image.imageFile,
            imageUrl: imageUrl,
            originalImageUrl: image.image_url,
          });
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

        // 이미지 저장 또는 업데이트
        const imageData = {
          image_url: imageUrl,
          display_order: validImageIndex,
        };

        if (image.id && editingId) {
          console.log(`Updating image with id: ${image.id}`, imageData);
          const { data: updateData, error: updateError } = await supabase
            .from('academy_images')
            .update(imageData)
            .eq('id', image.id)
            .select();

          if (updateError) {
            console.error('Error updating image:', updateError);
            throw new Error(`이미지 업데이트에 실패했습니다: ${updateError.message}`);
          }
          console.log('Image updated successfully:', updateData);
        } else {
          const insertData = {
            academy_id: academyId,
            ...imageData,
          };
          console.log(`Inserting new image for academy: ${academyId}`, insertData);
          const { data: insertDataResult, error: insertError } = await supabase.from('academy_images').insert([insertData]).select();

          if (insertError) {
            console.error('Error inserting image:', insertError);
            throw new Error(`이미지 저장에 실패했습니다: ${insertError.message}`);
          }
          console.log('Image inserted successfully:', insertDataResult);
        }

        validImageIndex++;
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

      // 이미지 데이터 로드
      const { data: images, error: imagesError } = await supabase
        .from('academy_images')
        .select('*')
        .eq('academy_id', academy.id)
        .order('display_order', { ascending: true });

      if (imagesError) {
        console.error('Error loading images:', imagesError);
        throw imagesError;
      }

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
        halls: (halls || []).map((hall: any) => ({
          id: hall.id,
          name: hall.name,
          capacity: hall.capacity || 0,
        })),
        academy_images: (images || []).map((img: any) => ({
          id: img.id,
          image_url: img.image_url || '',
          display_order: img.display_order || 0,
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

      // 2. 이미지 삭제
      const { data: images } = await supabase
        .from('academy_images')
        .select('image_url')
        .eq('academy_id', id);

      if (images) {
        for (const image of images) {
          if (image.image_url && image.image_url.includes('supabase.co/storage')) {
            try {
              const filePath = extractFilePathFromUrl(image.image_url);
              if (filePath) {
                await deleteFile('academy-images', filePath);
              }
            } catch (error) {
              console.error('Failed to delete image:', error);
            }
          }
        }
      }
      await supabase.from('academy_images').delete().eq('academy_id', id);

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

  if (loading) {
    return <div className="text-center py-12">로딩 중...</div>;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-black dark:text-white">학원 관리</h1>
          <p className="text-neutral-600 dark:text-neutral-400 mt-1">
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
            className="px-4 py-2 bg-primary dark:bg-[#CCFF00] text-black rounded-lg hover:opacity-90 flex items-center gap-2"
          >
            <Plus size={20} />
            학원 추가
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
        <div className="overflow-x-auto">
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
                <th className="px-6 py-3 text-right text-xs font-medium text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">
                  작업
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
              {academies.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-neutral-500 dark:text-neutral-400">
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
                                className="px-2 py-1 bg-primary/10 dark:bg-[#CCFF00]/10 text-primary dark:text-[#CCFF00] rounded-full text-xs"
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
      </div>
    </div>
  );
}
