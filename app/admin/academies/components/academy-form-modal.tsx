"use client";

import { X, Plus, Trash2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { ImageUpload } from '@/components/common/image-upload';
import { getSupabaseClient } from '@/lib/utils/supabase-client';
import { uploadFile, deleteFile, extractFilePathFromUrl } from '@/lib/utils/storage';

interface HallData {
  id?: string; // 수정 시에만 존재
  name: string;
  capacity: number;
}

interface AcademyImageData {
  id?: string; // 수정 시에만 존재
  image_url: string;
  imageFile?: File | null; // 업로드할 파일
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

interface AcademyFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: AcademyFormData) => Promise<void>;
  initialData?: AcademyFormData | null;
  isEditing: boolean;
}

export function AcademyFormModal({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  isEditing,
}: AcademyFormModalProps) {
  const [formData, setFormData] = useState<AcademyFormData>({
    name_kr: '',
    name_en: '',
    tags: [],
    address: '',
    contact_number: '',
    logo_url: '',
    halls: [],
    academy_images: [],
  });
  const [tagInput, setTagInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // initialData가 변경될 때마다 폼 데이터 업데이트
  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setFormData({
          name_kr: initialData.name_kr || '',
          name_en: initialData.name_en || '',
          tags: initialData.tags || [],
          address: initialData.address || '',
          contact_number: initialData.contact_number || '',
          logo_url: initialData.logo_url || '',
          halls: initialData.halls || [],
          academy_images: initialData.academy_images || [],
        });
      } else {
        // 새로 추가하는 경우
        setFormData({
          name_kr: '',
          name_en: '',
          tags: [],
          address: '',
          contact_number: '',
          logo_url: '',
          halls: [],
          academy_images: [],
        });
      }
      setTagInput('');
    }
  }, [isOpen, initialData]);

  if (!isOpen) return null;

  const handleAddTag = () => {
    const trimmedTag = tagInput.trim();
    if (trimmedTag && !formData.tags.includes(trimmedTag)) {
      setFormData({
        ...formData,
        tags: [...formData.tags, trimmedTag],
      });
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setFormData({
      ...formData,
      tags: formData.tags.filter((tag) => tag !== tagToRemove),
    });
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTag();
    }
  };

  const handleAddHall = () => {
    setFormData({
      ...formData,
      halls: [
        ...formData.halls,
        {
          name: '',
          capacity: 0,
        },
      ],
    });
  };

  const handleRemoveHall = async (hallIndex: number) => {
    const hallToRemove = formData.halls[hallIndex];
    
    // 수정 모드이고 DB에 있는 홀(id가 있는 경우)이면 즉시 DB에서 삭제
    if (isEditing && hallToRemove.id) {
      if (!confirm('이 홀을 삭제하시겠습니까?')) {
        return;
      }

      const supabase = getSupabaseClient() as any;
      if (!supabase) {
        alert('데이터베이스 연결에 실패했습니다.');
        return;
      }

      try {
        const { error } = await supabase
          .from('halls')
          .delete()
          .eq('id', hallToRemove.id);

        if (error) {
          console.error('Error deleting hall:', error);
          throw new Error(`홀 삭제에 실패했습니다: ${error.message}`);
        }
      } catch (error: any) {
        console.error('Error deleting hall from DB:', error);
        alert(`홀 삭제에 실패했습니다: ${error.message || '알 수 없는 오류'}`);
        return;
      }
    }

    setFormData({
      ...formData,
      halls: formData.halls.filter((_, i) => i !== hallIndex),
    });
  };

  const handleUpdateHall = (hallIndex: number, updates: Partial<HallData>) => {
    const newHalls = [...formData.halls];
    newHalls[hallIndex] = { ...newHalls[hallIndex], ...updates };
    setFormData({
      ...formData,
      halls: newHalls,
    });
  };

  const handleAddImage = () => {
    setFormData({
      ...formData,
      academy_images: [
        ...formData.academy_images,
        {
          image_url: '',
          display_order: formData.academy_images.length,
        },
      ],
    });
  };

  const handleRemoveImage = async (imageIndex: number) => {
    const imageToRemove = formData.academy_images[imageIndex];
    
    // 수정 모드이고 DB에 있는 이미지(id가 있는 경우)이면 즉시 DB에서 삭제
    if (isEditing && imageToRemove.id) {
      if (!confirm('이 이미지를 삭제하시겠습니까?')) {
        return;
      }

      const supabase = getSupabaseClient() as any;
      if (!supabase) {
        alert('데이터베이스 연결에 실패했습니다.');
        return;
      }

      try {
        // Storage에서 이미지 삭제
        if (imageToRemove.image_url && imageToRemove.image_url.includes('supabase.co/storage')) {
          try {
            const filePath = extractFilePathFromUrl(imageToRemove.image_url);
            if (filePath) {
              await deleteFile('academy-images', filePath);
            }
          } catch (error) {
            console.error('Failed to delete image from storage:', error);
          }
        }

        const { error } = await supabase
          .from('academy_images')
          .delete()
          .eq('id', imageToRemove.id);

        if (error) {
          console.error('Error deleting image:', error);
          throw new Error(`이미지 삭제에 실패했습니다: ${error.message}`);
        }
      } catch (error: any) {
        console.error('Error deleting image from DB:', error);
        alert(`이미지 삭제에 실패했습니다: ${error.message || '알 수 없는 오류'}`);
        return;
      }
    }

    // display_order 재조정
    const newImages = formData.academy_images.filter((_, i) => i !== imageIndex);
    newImages.forEach((img, idx) => {
      img.display_order = idx;
    });

    setFormData({
      ...formData,
      academy_images: newImages,
    });
  };

  const handleUpdateImage = (imageIndex: number, updates: Partial<AcademyImageData>) => {
    setFormData((prevFormData) => {
      const newImages = [...prevFormData.academy_images];
      const currentImage = newImages[imageIndex];
      
      // null이나 undefined가 아닌 값만 업데이트
      const cleanUpdates: Partial<AcademyImageData> = {};
      if (updates.imageFile !== undefined) {
        cleanUpdates.imageFile = updates.imageFile;
      }
      // image_url은 빈 문자열이 아닌 경우만 업데이트
      if (updates.image_url !== undefined && updates.image_url !== null && updates.image_url.trim() !== '') {
        cleanUpdates.image_url = updates.image_url;
      } else if (updates.image_url === null || updates.image_url === '') {
        // null이나 빈 문자열이 명시적으로 전달된 경우만 초기화 (파일 선택 시에는 초기화하지 않음)
        // 파일이 선택된 경우 image_url을 유지
        if (!updates.imageFile) {
          // 파일이 없고 URL을 초기화하려는 경우만 초기화
          cleanUpdates.image_url = '';
        }
      }
      if (updates.display_order !== undefined) {
        cleanUpdates.display_order = updates.display_order;
      }
      if (updates.id !== undefined) {
        cleanUpdates.id = updates.id;
      }
      
      newImages[imageIndex] = { ...currentImage, ...cleanUpdates };
      
      console.log(`Updating image ${imageIndex + 1}:`, {
        current: currentImage,
        updates: updates,
        cleanUpdates: cleanUpdates,
        result: newImages[imageIndex],
      });
      
      return {
        ...prevFormData,
        academy_images: newImages,
      };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name_kr && !formData.name_en) {
      alert('한글명 또는 영문명 중 하나는 필수입니다.');
      return;
    }

    // 디버깅: 제출 전 formData 확인
    console.log('Form submission - academy_images:', formData.academy_images);
    formData.academy_images.forEach((img, idx) => {
      console.log(`Image ${idx + 1}:`, {
        id: img.id,
        image_url: img.image_url,
        hasImageFile: !!img.imageFile,
        display_order: img.display_order,
      });
    });

    setIsSubmitting(true);
    try {
      await onSubmit(formData);
      // Reset form on success
      setFormData({
        name_kr: '',
        name_en: '',
        tags: [],
        address: '',
        contact_number: '',
        logo_url: '',
        halls: [],
        academy_images: [],
      });
      setTagInput('');
    } catch (error) {
      console.error('Form submission error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 px-6 py-4 flex justify-between items-center z-10">
          <h2 className="text-xl font-bold text-black dark:text-white">
            {isEditing ? '학원 수정' : '새 학원 등록'}
          </h2>
          <button
            onClick={onClose}
            className="text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
          >
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <div className="space-y-6">
            {/* 학원 기본 정보 */}
            <div>
              <h3 className="text-lg font-semibold text-black dark:text-white mb-4">학원 정보</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-black dark:text-white mb-2">
                    학원명 (한글) *
                  </label>
                  <input
                    type="text"
                    value={formData.name_kr || ''}
                    onChange={(e) => setFormData({ ...formData, name_kr: e.target.value })}
                    placeholder="예: 댄스 아카데미"
                    className="w-full px-4 py-2 bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-black dark:text-white"
                  />
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                    한글명 또는 영문명 중 하나는 필수입니다
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-black dark:text-white mb-2">
                    학원명 (영문)
                  </label>
                  <input
                    type="text"
                    value={formData.name_en || ''}
                    onChange={(e) => setFormData({ ...formData, name_en: e.target.value })}
                    placeholder="예: Dance Academy"
                    className="w-full px-4 py-2 bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-black dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-black dark:text-white mb-2">
                    주소
                  </label>
                  <input
                    type="text"
                    value={formData.address || ''}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    placeholder="예: 서울시 마포구 합정동"
                    className="w-full px-4 py-2 bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-black dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-black dark:text-white mb-2">
                    연락처
                  </label>
                  <input
                    type="text"
                    value={formData.contact_number || ''}
                    onChange={(e) => setFormData({ ...formData, contact_number: e.target.value })}
                    placeholder="예: 02-1234-5678"
                    className="w-full px-4 py-2 bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-black dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-black dark:text-white mb-2">
                    검색 태그
                  </label>
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={tagInput}
                        onChange={(e) => setTagInput(e.target.value)}
                        onKeyPress={handleKeyPress}
                        placeholder="태그 입력 후 Enter"
                        className="flex-1 px-4 py-2 bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-black dark:text-white"
                      />
                      <button
                        type="button"
                        onClick={handleAddTag}
                        className="px-4 py-2 bg-neutral-200 dark:bg-neutral-800 text-black dark:text-white rounded-lg hover:bg-neutral-300 dark:hover:bg-neutral-700"
                      >
                        추가
                      </button>
                    </div>
                    {formData.tags.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {formData.tags.map((tag) => (
                          <span
                            key={tag}
                            className="inline-flex items-center gap-1 px-3 py-1 bg-primary/20 dark:bg-[#CCFF00]/20 text-primary dark:text-[#CCFF00] rounded-full text-sm"
                          >
                            {tag}
                            <button
                              type="button"
                              onClick={() => handleRemoveTag(tag)}
                              className="hover:opacity-70"
                            >
                              <X size={14} />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                    이름 외에 자주 불리는 별명이 있다면 입력해주세요 (ex. 줄임말)
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-black dark:text-white mb-2">
                    로고 URL
                  </label>
                  <input
                    type="url"
                    value={formData.logo_url || ''}
                    onChange={(e) => setFormData({ ...formData, logo_url: e.target.value })}
                    className="w-full px-4 py-2 bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-black dark:text-white"
                  />
                </div>
              </div>
            </div>

            {/* 학원 이미지 */}
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-black dark:text-white">
                  학원 이미지 {formData.academy_images.length > 0 && `(${formData.academy_images.length}개)`}
                </h3>
                <button
                  type="button"
                  onClick={handleAddImage}
                  className="px-3 py-1.5 bg-primary dark:bg-[#CCFF00] text-black rounded-lg hover:opacity-90 flex items-center gap-2 text-sm"
                >
                  <Plus size={16} />
                  이미지 추가
                </button>
              </div>

              {formData.academy_images.length === 0 ? (
                <div className="text-center py-4 text-neutral-400 dark:text-neutral-500 text-sm border border-dashed border-neutral-300 dark:border-neutral-700 rounded-lg">
                  이미지가 없습니다.
                </div>
              ) : (
                <div className="space-y-3">
                  {formData.academy_images.map((image, imageIndex) => (
                    <div
                      key={imageIndex}
                      className="bg-neutral-50 dark:bg-neutral-800/30 p-4 rounded-lg border border-neutral-200 dark:border-neutral-700"
                    >
                      <div className="flex justify-between items-center mb-3">
                        <span className="text-sm font-medium text-black dark:text-white">
                          이미지 {imageIndex + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveImage(imageIndex)}
                          className="text-red-500 hover:opacity-80"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                      <ImageUpload
                        label=""
                        currentImageUrl={image.image_url}
                        onImageChange={(file) =>
                          handleUpdateImage(imageIndex, { imageFile: file })
                        }
                        onImageUrlChange={(url) => {
                          console.log(`Image URL changed for image ${imageIndex + 1}:`, url);
                          handleUpdateImage(imageIndex, { image_url: url || '' });
                        }}
                        maxSizeMB={5}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 홀 정보 */}
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-black dark:text-white">
                  홀 정보 {formData.halls.length > 0 && `(${formData.halls.length}개)`}
                </h3>
                <button
                  type="button"
                  onClick={handleAddHall}
                  className="px-3 py-1.5 bg-primary dark:bg-[#CCFF00] text-black rounded-lg hover:opacity-90 flex items-center gap-2 text-sm"
                >
                  <Plus size={16} />
                  홀 추가
                </button>
              </div>

              {formData.halls.length === 0 ? (
                <div className="text-center py-4 text-neutral-400 dark:text-neutral-500 text-sm border border-dashed border-neutral-300 dark:border-neutral-700 rounded-lg">
                  홀이 없습니다.
                </div>
              ) : (
                <div className="space-y-3">
                  {formData.halls.map((hall, hallIndex) => (
                    <div
                      key={hallIndex}
                      className="bg-neutral-50 dark:bg-neutral-800/30 p-4 rounded-lg border border-neutral-200 dark:border-neutral-700"
                    >
                      <div className="flex justify-between items-center mb-3">
                        <span className="text-sm font-medium text-black dark:text-white">
                          홀 {hallIndex + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveHall(hallIndex)}
                          className="text-red-500 hover:opacity-80"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-black dark:text-white mb-1">
                            홀 이름 *
                          </label>
                          <input
                            type="text"
                            required
                            value={hall.name}
                            onChange={(e) =>
                              handleUpdateHall(hallIndex, { name: e.target.value })
                            }
                            className="w-full px-3 py-2 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg text-black dark:text-white text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-black dark:text-white mb-1">
                            정원 *
                          </label>
                          <input
                            type="number"
                            required
                            min="1"
                            value={hall.capacity || ''}
                            onChange={(e) =>
                              handleUpdateHall(hallIndex, {
                                capacity: Number(e.target.value) || 0,
                              })
                            }
                            className="w-full px-3 py-2 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg text-black dark:text-white text-sm"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-2 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-neutral-200 dark:bg-neutral-800 text-black dark:text-white rounded-lg hover:bg-neutral-300 dark:hover:bg-neutral-700"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 px-4 py-2 bg-primary dark:bg-[#CCFF00] text-black font-bold rounded-lg hover:opacity-90 disabled:opacity-50"
            >
              {isSubmitting ? '저장 중...' : isEditing ? '수정' : '등록'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
