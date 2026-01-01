"use client";

import { X, Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { useState, useEffect } from 'react';
import { ImageUpload } from '@/components/common/image-upload';
import { getSupabaseClient } from '@/lib/utils/supabase-client';
import { deleteFile, extractFilePathFromUrl } from '@/lib/utils/storage';

interface HallData {
  id?: string; // 수정 시에만 존재
  name: string;
  capacity: number;
  floor_info: string;
}

interface BranchData {
  id?: string; // 수정 시에만 존재
  name: string;
  address_primary: string;
  address_detail: string;
  contact_number: string;
  image_url?: string | null;
  imageFile?: File | null; // 업로드할 파일
  halls: HallData[];
}

interface AcademyFormData {
  name_kr: string | null;
  name_en: string | null;
  tags: string[];
  business_registration_number: string | null;
  logo_url: string | null;
  branches: BranchData[];
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
    business_registration_number: '',
    logo_url: '',
    branches: [],
  });
  const [tagInput, setTagInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [expandedBranches, setExpandedBranches] = useState<Set<number>>(new Set());

  // initialData가 변경될 때마다 폼 데이터 업데이트
  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setFormData({
          name_kr: initialData.name_kr || '',
          name_en: initialData.name_en || '',
          tags: initialData.tags || [],
          business_registration_number: initialData.business_registration_number || '',
          logo_url: initialData.logo_url || '',
          branches: initialData.branches && initialData.branches.length > 0 
            ? initialData.branches 
            : [{
                name: '',
                address_primary: '',
                address_detail: '',
                contact_number: '',
                image_url: null,
                halls: [],
              }],
        });
        // 지점이 1개일 때는 항상 확장, 여러 개일 때는 모두 확장
        if (initialData.branches && initialData.branches.length > 0) {
          setExpandedBranches(new Set(initialData.branches.map((_, idx) => idx)));
        } else {
          setExpandedBranches(new Set([0])); // 기본 지점 1개 확장
        }
      } else {
        // 새로 추가하는 경우: 기본 지점 1개 생성
        setFormData({
          name_kr: '',
          name_en: '',
          tags: [],
          business_registration_number: '',
          logo_url: '',
          branches: [{
            name: '',
            address_primary: '',
            address_detail: '',
            contact_number: '',
            image_url: null,
            halls: [],
          }],
        });
        setExpandedBranches(new Set([0])); // 기본 지점 1개 확장
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

  const handleAddBranch = () => {
    setFormData({
      ...formData,
      branches: [
        ...formData.branches,
        {
          name: '',
          address_primary: '',
          address_detail: '',
          contact_number: '',
          image_url: null,
          halls: [],
        },
      ],
    });
    // 새로 추가된 지점을 확장 상태로 설정
    setExpandedBranches(new Set([...expandedBranches, formData.branches.length]));
  };

  const handleRemoveBranch = async (index: number) => {
    // 지점이 1개만 남으면 삭제 불가
    if (formData.branches.length <= 1) {
      alert('최소 1개의 지점이 필요합니다.');
      return;
    }

    const branchToRemove = formData.branches[index];

    // 수정 모드이고 DB에 있는 지점(id가 있는 경우)이면 즉시 DB에서 삭제
    if (isEditing && branchToRemove.id) {
      if (!confirm('이 지점을 삭제하시겠습니까? 이 작업은 즉시 DB에서 삭제됩니다.')) {
        return;
      }

      const supabase = getSupabaseClient();
      if (!supabase) {
        alert('데이터베이스 연결에 실패했습니다.');
        return;
      }

      try {
        // 1. 해당 지점의 모든 홀 삭제
        const { error: hallsDeleteError } = await supabase
          .from('halls')
          .delete()
          .eq('branch_id', branchToRemove.id);

        if (hallsDeleteError) {
          console.error('Error deleting halls:', hallsDeleteError);
          throw new Error(`홀 삭제에 실패했습니다: ${hallsDeleteError.message}`);
        }

        console.log(`지점 ${branchToRemove.id}의 모든 홀이 삭제되었습니다.`);

        // 2. 이미지 삭제 (Supabase Storage에 있는 경우)
        if (branchToRemove.image_url && branchToRemove.image_url.includes('supabase.co/storage')) {
          try {
            const filePath = extractFilePathFromUrl(branchToRemove.image_url);
            if (filePath) {
              await deleteFile('academy-branches', filePath);
            }
          } catch (error) {
            console.error('Failed to delete old image:', error);
            // 이미지 삭제 실패해도 계속 진행
          }
        }

        // 3. 지점 삭제
        const { error: branchDeleteError } = await supabase
          .from('branches')
          .delete()
          .eq('id', branchToRemove.id);

        if (branchDeleteError) {
          console.error('Error deleting branch:', branchDeleteError);
          throw new Error(`지점 삭제에 실패했습니다: ${branchDeleteError.message}`);
        }

        console.log(`지점 ${branchToRemove.id}가 삭제되었습니다.`);
      } catch (error: any) {
        console.error('Error deleting branch from DB:', error);
        alert(`지점 삭제에 실패했습니다: ${error.message || '알 수 없는 오류'}`);
        return;
      }
    }

    // formData에서 제거
    const newBranches = formData.branches.filter((_, i) => i !== index);
    setFormData({
      ...formData,
      branches: newBranches,
    });
    // 확장 상태에서도 제거
    const newExpanded = new Set(expandedBranches);
    newExpanded.delete(index);
    // 인덱스 재조정
    const adjustedExpanded = new Set<number>();
    newExpanded.forEach((idx) => {
      if (idx < index) {
        adjustedExpanded.add(idx);
      } else if (idx > index) {
        adjustedExpanded.add(idx - 1);
      }
    });
    setExpandedBranches(adjustedExpanded);
  };

  const handleUpdateBranch = (index: number, updates: Partial<BranchData>) => {
    const newBranches = [...formData.branches];
    newBranches[index] = { ...newBranches[index], ...updates };
    setFormData({
      ...formData,
      branches: newBranches,
    });
  };

  const handleAddHall = (branchIndex: number) => {
    const newBranches = [...formData.branches];
    newBranches[branchIndex] = {
      ...newBranches[branchIndex],
      halls: [
        ...newBranches[branchIndex].halls,
        {
          name: '',
          capacity: 0,
          floor_info: '',
        },
      ],
    };
    setFormData({
      ...formData,
      branches: newBranches,
    });
  };

  const handleRemoveHall = (branchIndex: number, hallIndex: number) => {
    const newBranches = [...formData.branches];
    newBranches[branchIndex] = {
      ...newBranches[branchIndex],
      halls: newBranches[branchIndex].halls.filter(
        (_, i) => i !== hallIndex
      ),
    };
    setFormData({
      ...formData,
      branches: newBranches,
    });
  };

  const handleUpdateHall = (
    branchIndex: number,
    hallIndex: number,
    updates: Partial<HallData>
  ) => {
    const newBranches = [...formData.branches];
    const newHalls = [...newBranches[branchIndex].halls];
    newHalls[hallIndex] = {
      ...newHalls[hallIndex],
      ...updates,
    };
    newBranches[branchIndex] = {
      ...newBranches[branchIndex],
      halls: newHalls,
    };
    setFormData({
      ...formData,
      branches: newBranches,
    });
  };

  const toggleBranchExpanded = (index: number) => {
    // 지점이 1개일 때는 접기/펼치기 불가 (항상 확장)
    if (formData.branches.length === 1) {
      return;
    }

    const newExpanded = new Set(expandedBranches);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedBranches(newExpanded);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name_kr && !formData.name_en) {
      alert('한글명 또는 영문명 중 하나는 필수입니다.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(formData);
      // Reset form on success
      setFormData({
        name_kr: '',
        name_en: '',
        tags: [],
        business_registration_number: '',
        logo_url: '',
        branches: [{
          name: '',
          address_primary: '',
          address_detail: '',
          contact_number: '',
          image_url: null,
          halls: [],
        }],
      });
      setTagInput('');
      setExpandedBranches(new Set([0])); // 기본 지점 1개 확장
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
                    사업자 등록번호
                  </label>
                  <input
                    type="text"
                    value={formData.business_registration_number || ''}
                    onChange={(e) => setFormData({ ...formData, business_registration_number: e.target.value })}
                    className="w-full px-4 py-2 bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-black dark:text-white"
                  />
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

            {/* 지점 정보 */}
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-black dark:text-white">
                  지점 정보 {formData.branches.length > 1 && `(${formData.branches.length}개)`}
                </h3>
                <button
                  type="button"
                  onClick={handleAddBranch}
                  className="px-3 py-1.5 bg-primary dark:bg-[#CCFF00] text-black rounded-lg hover:opacity-90 flex items-center gap-2 text-sm"
                >
                  <Plus size={16} />
                  지점 추가
                </button>
              </div>

              <div className="space-y-4">
                {formData.branches.map((branch, branchIndex) => {
                  const isSingleBranch = formData.branches.length === 1;
                  const isExpanded = expandedBranches.has(branchIndex);
                  
                  return (
                    <div
                      key={branchIndex}
                      className="border border-neutral-200 dark:border-neutral-800 rounded-lg overflow-hidden"
                    >
                      {/* 지점이 1개일 때는 헤더를 간단하게, 여러 개일 때는 접기/펼치기 */}
                      {isSingleBranch ? (
                        <div className="bg-neutral-50 dark:bg-neutral-800/50 px-4 py-3">
                          <span className="font-medium text-black dark:text-white">지점 정보</span>
                        </div>
                      ) : (
                        <div className="bg-neutral-50 dark:bg-neutral-800/50 px-4 py-3 flex justify-between items-center">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => toggleBranchExpanded(branchIndex)}
                              className="text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100"
                            >
                              {isExpanded ? (
                                <ChevronUp size={20} />
                              ) : (
                                <ChevronDown size={20} />
                              )}
                            </button>
                            <span className="font-medium text-black dark:text-white">
                              지점 {branchIndex + 1}
                              {branch.name && ` - ${branch.name}`}
                            </span>
                          </div>
                          {/* 지점이 2개 이상일 때만 삭제 버튼 표시 */}
                          {formData.branches.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveBranch(branchIndex)}
                              className="text-red-500 hover:opacity-80"
                            >
                              <Trash2 size={18} />
                            </button>
                          )}
                        </div>
                      )}

                      {/* 지점이 1개일 때는 항상 표시, 여러 개일 때는 확장 상태에 따라 */}
                      {(isSingleBranch || isExpanded) && (
                        <div className="p-4 space-y-4">
                          <div>
                            <label className="block text-sm font-medium text-black dark:text-white mb-2">
                              지점명 *
                            </label>
                            <input
                              type="text"
                              required
                              value={branch.name}
                              onChange={(e) =>
                                handleUpdateBranch(branchIndex, { name: e.target.value })
                              }
                              className="w-full px-4 py-2 bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-black dark:text-white"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-black dark:text-white mb-2">
                              주소 *
                            </label>
                            <input
                              type="text"
                              required
                              value={branch.address_primary}
                              onChange={(e) =>
                                handleUpdateBranch(branchIndex, { address_primary: e.target.value })
                              }
                              className="w-full px-4 py-2 bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-black dark:text-white"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-black dark:text-white mb-2">
                              상세 주소
                            </label>
                            <input
                              type="text"
                              value={branch.address_detail}
                              onChange={(e) =>
                                handleUpdateBranch(branchIndex, { address_detail: e.target.value })
                              }
                              className="w-full px-4 py-2 bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-black dark:text-white"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-black dark:text-white mb-2">
                              연락처
                            </label>
                            <input
                              type="text"
                              value={branch.contact_number}
                              onChange={(e) =>
                                handleUpdateBranch(branchIndex, { contact_number: e.target.value })
                              }
                              className="w-full px-4 py-2 bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-black dark:text-white"
                            />
                          </div>

                          <div>
                            <ImageUpload
                              label="지점 이미지"
                              currentImageUrl={branch.image_url}
                              onImageChange={(file) =>
                                handleUpdateBranch(branchIndex, { imageFile: file })
                              }
                              onImageUrlChange={(url) =>
                                handleUpdateBranch(branchIndex, { image_url: url })
                              }
                              maxSizeMB={5}
                            />
                          </div>

                          {/* 홀 정보 */}
                          <div>
                            <div className="flex justify-between items-center mb-3">
                              <label className="block text-sm font-medium text-black dark:text-white">
                                홀 정보
                              </label>
                              <button
                                type="button"
                                onClick={() => handleAddHall(branchIndex)}
                                className="px-3 py-1.5 bg-neutral-200 dark:bg-neutral-800 text-black dark:text-white rounded-lg hover:bg-neutral-300 dark:hover:bg-neutral-700 flex items-center gap-2 text-sm"
                              >
                                <Plus size={14} />
                                홀 추가
                              </button>
                            </div>

                            {branch.halls.length === 0 ? (
                              <div className="text-center py-4 text-neutral-400 dark:text-neutral-500 text-sm border border-dashed border-neutral-300 dark:border-neutral-700 rounded-lg">
                                홀이 없습니다.
                              </div>
                            ) : (
                              <div className="space-y-3">
                                {branch.halls.map((hall, hallIndex) => (
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
                                        onClick={() => handleRemoveHall(branchIndex, hallIndex)}
                                        className="text-red-500 hover:opacity-80"
                                      >
                                        <Trash2 size={16} />
                                      </button>
                                    </div>
                                    <div className="grid grid-cols-3 gap-3">
                                      <div>
                                        <label className="block text-xs font-medium text-black dark:text-white mb-1">
                                          홀 이름 *
                                        </label>
                                        <input
                                          type="text"
                                          required
                                          value={hall.name}
                                          onChange={(e) =>
                                            handleUpdateHall(branchIndex, hallIndex, {
                                              name: e.target.value,
                                            })
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
                                            handleUpdateHall(branchIndex, hallIndex, {
                                              capacity: Number(e.target.value) || 0,
                                            })
                                          }
                                          className="w-full px-3 py-2 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg text-black dark:text-white text-sm"
                                        />
                                      </div>
                                      <div>
                                        <label className="block text-xs font-medium text-black dark:text-white mb-1">
                                          층수
                                        </label>
                                        <input
                                          type="text"
                                          value={hall.floor_info || ''}
                                          onChange={(e) =>
                                            handleUpdateHall(branchIndex, hallIndex, {
                                              floor_info: e.target.value,
                                            })
                                          }
                                          placeholder="예: 2층, B1"
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
                      )}
                    </div>
                  );
                })}
              </div>
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
