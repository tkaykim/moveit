"use client";

import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2 } from 'lucide-react';
import { getSupabaseClient } from '@/lib/utils/supabase-client';
import { Academy, Branch, Hall } from '@/lib/supabase/types';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { AcademyFormModal } from './components/academy-form-modal';
import { uploadFile, deleteFile, extractFilePathFromUrl } from '@/lib/utils/storage';

interface HallData {
  id?: string;
  name: string;
  capacity: number;
  floor_info: string;
}

interface BranchData {
  id?: string;
  name: string;
  address_primary: string;
  address_detail: string;
  contact_number: string;
  halls: HallData[];
}

interface AcademyFormData {
  name_kr: string;
  name_en: string;
  tags: string[];
  business_registration_number: string;
  logo_url: string;
  branches: BranchData[];
}

export default function AcademiesPage() {
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
      console.log('Loading academies from database...');
      const { data, error } = await supabase
        .from('academies')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Supabase query error:', error);
        throw error;
      }

      console.log('Academies loaded:', data);
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
    // TypeScript 타입 추론을 위한 타입 단언
    const supabase = supabaseClient as SupabaseClient<Database>;

    try {
      let academyId: string;

      // 1. 학원 정보 저장/업데이트
      if (editingId) {
        // 수정 모드: 학원 정보 업데이트
        const submitData: any = {
          name_kr: formData.name_kr || null,
          name_en: formData.name_en || null,
          tags: formData.tags.length > 0 ? formData.tags.join(', ') : null,
          business_registration_number: formData.business_registration_number || null,
          logo_url: formData.logo_url || null,
        };

        const { error } = await (supabase as any)
          .from('academies')
          .update(submitData)
          .eq('id', editingId);

        if (error) {
          console.error('Update error details:', error);
          throw error;
        }

        academyId = editingId;
      } else {
        // 생성 모드: 새 학원 생성
        const submitData: any = {
          name_kr: formData.name_kr || null,
          name_en: formData.name_en || null,
          tags: formData.tags.length > 0 ? formData.tags.join(', ') : null,
          business_registration_number: formData.business_registration_number || null,
          logo_url: formData.logo_url || null,
          owner_id: 'system',
        };

        const { data: newAcademy, error } = await (supabase as any)
          .from('academies')
          .insert([submitData])
          .select()
          .single();

        if (error) {
          console.error('Insert error details:', error);
          throw error;
        }

        academyId = newAcademy.id;
      }

      // 2. 유효한 지점 필터링 (id가 있는 기존 지점과 id가 없는 새 지점 구분)
      const validBranches = formData.branches.filter(
        (branch) => branch.name && branch.address_primary
      );

      if (validBranches.length === 0) {
        throw new Error('최소 1개의 지점 정보(지점명, 주소)를 입력해주세요.');
      }

      // 디버깅: 유효한 지점 정보 로그
      console.log('유효한 지점 개수:', validBranches.length);
      console.log('기존 지점 (id 있음):', validBranches.filter(b => b.id).map(b => b.id));
      console.log('새 지점 (id 없음):', validBranches.filter(b => !b.id).length);

      // 3. 수정 모드일 때만: 지점 삭제 처리
      if (editingId) {
        // DB에서 기존 지점들 모두 가져오기
        const { data: existingBranches, error: loadError } = await (supabase as any)
          .from('branches')
          .select('id, image_url')
          .eq('academy_id', academyId);

        if (loadError) {
          console.error('Error loading existing branches:', loadError);
          throw loadError;
        }

        const existingBranchIds = (existingBranches || []).map((b: any) => b.id);
        const formBranchIds = validBranches
          .filter(b => b.id && b.name && b.address_primary) // 유효하고 id가 있는 지점만
          .map(b => b.id!);

        console.log('DB에 있는 지점 IDs:', existingBranchIds);
        console.log('폼에 있는 지점 IDs:', formBranchIds);

        // 삭제할 지점 찾기 (DB에 있지만 formData에 없는 지점)
        const deletedBranchIds = existingBranchIds.filter(
          (id: any) => !formBranchIds.includes(id)
        );

        console.log('삭제할 지점 개수:', deletedBranchIds.length);

        // 삭제할 지점이 있으면 개별 삭제 (409 에러 방지를 위해)
        if (deletedBranchIds.length > 0) {
          console.log(`삭제할 지점 IDs:`, deletedBranchIds);
          
          // 각 지점을 개별적으로 삭제 (409 에러 방지)
          for (const branchId of deletedBranchIds) {
            try {
              // 1. 해당 지점의 모든 홀 삭제
              const { error: hallsDeleteError } = await (supabase as any)
                .from('halls')
                .delete()
                .eq('branch_id', branchId);

              if (hallsDeleteError) {
                console.error(`지점 ${branchId}의 홀 삭제 실패:`, hallsDeleteError);
                throw new Error(`지점 ${branchId}의 홀 삭제에 실패했습니다: ${hallsDeleteError.message}`);
              }

              // 2. 이미지 삭제
              const branchToDelete = existingBranches?.find((b: any) => b.id === branchId);
              if (branchToDelete && (branchToDelete as any).image_url) {
                const existingUrl = (branchToDelete as any).image_url;
                if (existingUrl && existingUrl.includes('supabase.co/storage')) {
                  try {
                    const filePath = extractFilePathFromUrl(existingUrl);
                    if (filePath) {
                      await deleteFile('academy-branches', filePath);
                    }
                  } catch (error) {
                    console.error('Failed to delete old image:', error);
                    // 이미지 삭제 실패해도 계속 진행
                  }
                }
              }

              // 3. 지점 삭제
              const { error: branchDeleteError } = await (supabase as any)
                .from('branches')
                .delete()
                .eq('id', branchId);

              if (branchDeleteError) {
                console.error(`지점 ${branchId} 삭제 실패:`, branchDeleteError);
                throw new Error(`지점 ${branchId} 삭제에 실패했습니다: ${branchDeleteError.message}`);
              }

              console.log(`지점 ${branchId} 삭제 완료`);
            } catch (error: any) {
              console.error(`지점 ${branchId} 삭제 중 오류:`, error);
              throw error;
            }
          }

          console.log(`${deletedBranchIds.length}개 지점이 모두 삭제되었습니다.`);
          
          // 삭제 후 DB 상태 확인
          const { data: verifyBranches } = await (supabase as any)
            .from('branches')
            .select('id')
            .eq('academy_id', academyId);
          
          console.log('삭제 후 DB에 남은 지점 개수:', verifyBranches?.length || 0);
          console.log('삭제 후 DB에 남은 지점 IDs:', verifyBranches?.map((b: any) => b.id) || []);
        }
      }

      // 4. 지점 저장/업데이트
      console.log('지점 저장/업데이트 시작. 처리할 지점 개수:', validBranches.length);
      
      // 삭제 후 다시 DB 상태 확인 (중복 생성 방지)
      if (editingId) {
        const { data: currentBranches } = await (supabase as any)
          .from('branches')
          .select('id')
          .eq('academy_id', academyId);
        
        const currentBranchIds = (currentBranches || []).map((b: any) => b.id);
        console.log('저장 전 DB에 있는 지점 IDs:', currentBranchIds);
        
        // formData에 있는 지점 중 DB에 없는 것만 새로 생성
        for (const branch of validBranches) {
          // id가 없거나, id가 있지만 DB에 없는 경우만 새로 생성
          if (!branch.id || !currentBranchIds.includes(branch.id)) {
            if (branch.id) {
              console.warn(`경고: 지점 ${branch.id}가 DB에 없습니다. 새로 생성합니다.`);
            }
          }
        }
      }
      
      for (const branch of validBranches) {
        // 이미지 처리
        let imageUrl: string | null = null;

        if (branch.imageFile) {
          // 새 파일이 업로드된 경우
          try {
            // 기존 지점이고 기존 이미지가 있으면 삭제
            if (branch.id && editingId) {
              const { data: existingBranch } = await (supabase as any)
                .from('branches')
                .select('image_url')
                .eq('id', branch.id)
                .single();

              if (existingBranch?.image_url && existingBranch.image_url.includes('supabase.co/storage')) {
                try {
                  const filePath = extractFilePathFromUrl(existingBranch.image_url);
                  if (filePath) {
                    await deleteFile('academy-branches', filePath);
                  }
                } catch (error) {
                  console.error('Failed to delete old image:', error);
                }
              }
            }

            imageUrl = await uploadFile(
              'academy-branches',
              branch.imageFile,
              `branches/${academyId}`
            );
          } catch (error: any) {
            console.error('Image upload error:', error);
            throw new Error(`지점 이미지 업로드에 실패했습니다: ${error.message}`);
          }
        } else if (branch.id && editingId) {
          // 기존 지점이고 새 파일이 없는 경우: 기존 이미지 URL 유지
          const { data: existingBranch } = await (supabase as any)
            .from('branches')
            .select('image_url')
            .eq('id', branch.id)
            .single();

          imageUrl = existingBranch?.image_url || branch.image_url || null;
        } else if (branch.image_url) {
          // 새 지점이고 URL이 직접 입력된 경우
          imageUrl = branch.image_url;
        }

        if (branch.id && editingId) {
          // 기존 지점 업데이트 (id가 있고 수정 모드인 경우만)
          // 먼저 DB에 해당 지점이 실제로 존재하는지 확인
          const { data: checkBranch } = await (supabase as any)
            .from('branches')
            .select('id')
            .eq('id', branch.id)
            .single();

          if (!checkBranch) {
            console.error(`오류: 지점 ${branch.id}가 DB에 존재하지 않습니다.`);
            throw new Error(`지점 ${branch.id}가 DB에 존재하지 않습니다.`);
          }

          console.log('기존 지점 업데이트:', branch.id, branch.name);
          
          const branchData: any = {
            name: branch.name,
            address_primary: branch.address_primary,
            address_detail: branch.address_detail || null,
            contact_number: branch.contact_number || null,
            image_url: imageUrl,
            is_active: true,
          };

          const { error: branchUpdateError } = await (supabase as any)
            .from('branches')
            .update(branchData)
            .eq('id', branch.id);

          if (branchUpdateError) {
            console.error('Branch update error:', branchUpdateError);
            throw branchUpdateError;
          }
          
          console.log('지점 업데이트 완료:', branch.id);

          // 기존 홀 정보 로드
          const { data: existingHalls } = await (supabase as any)
            .from('halls')
            .select('id')
            .eq('branch_id', branch.id);

          const existingHallIds = (existingHalls || []).map(h => h.id);
          const formHallIds = branch.halls
            .filter(h => h.id)
            .map(h => h.id!);

          // 삭제된 홀 삭제
          const deletedHallIds = existingHallIds.filter(
            id => !formHallIds.includes(id)
          );

          if (deletedHallIds.length > 0) {
            const { error: deleteHallsError } = await (supabase as any)
              .from('halls')
              .delete()
              .in('id', deletedHallIds);

            if (deleteHallsError) {
              console.error('Error deleting halls:', deleteHallsError);
              throw deleteHallsError;
            }
          }

          // 홀 업데이트 또는 생성
          for (const hall of branch.halls) {
            if (!hall.name || hall.capacity <= 0) {
              continue;
            }

            const hallData: any = {
              branch_id: branch.id,
              name: hall.name,
              capacity: hall.capacity,
              floor_info: hall.floor_info || null,
            };

            if (hall.id) {
              // 기존 홀 업데이트
              const { error: hallUpdateError } = await (supabase as any)
                .from('halls')
                .update(hallData)
                .eq('id', hall.id);

              if (hallUpdateError) {
                console.error('Hall update error:', hallUpdateError);
                throw hallUpdateError;
              }
            } else {
              // 새 홀 생성
              const hallInsertData: any = {
                branch_id: branch.id,
                name: hall.name,
                capacity: hall.capacity,
                floor_info: hall.floor_info || null,
              };
              const { error: hallInsertError } = await (supabase as any)
                .from('halls')
                .insert([hallInsertData]);

              if (hallInsertError) {
                console.error('Hall insert error:', hallInsertError);
                throw hallInsertError;
              }
            }
          }
        } else {
          // 새 지점 생성 (id가 없거나, id가 있지만 DB에 없는 경우)
          // 수정 모드에서는 id가 없는 지점만 새로 생성해야 함
          if (editingId && branch.id) {
            // 수정 모드에서 id가 있는데 여기로 온 경우는 문제임
            console.error(`오류: 지점 ${branch.id}가 업데이트되지 않고 새로 생성되려고 합니다.`);
            throw new Error(`지점 처리 중 오류가 발생했습니다. 지점 ID: ${branch.id}`);
          }
          
          console.log('새 지점 생성:', branch.name, editingId ? '(수정 모드)' : '(생성 모드)');

          const branchData: any = {
            academy_id: academyId,
            name: branch.name,
            address_primary: branch.address_primary,
            address_detail: branch.address_detail || null,
            contact_number: branch.contact_number || null,
            image_url: imageUrl,
            is_active: true,
          };

          const { data: newBranch, error: branchInsertError } = await (supabase as any)
            .from('branches')
            .insert([branchData])
            .select()
            .single();

          if (branchInsertError) {
            console.error('Branch insert error:', branchInsertError);
            throw branchInsertError;
          }

          // 새 지점의 홀 생성
          for (const hall of branch.halls) {
            if (!hall.name || hall.capacity <= 0) {
              continue;
            }

            const hallData: any = {
              branch_id: newBranch.id,
              name: hall.name,
              capacity: hall.capacity,
              floor_info: hall.floor_info || null,
            };

            const { error: hallInsertError } = await (supabase as any)
              .from('halls')
              .insert([hallData]);

            if (hallInsertError) {
              console.error('Hall insert error:', hallInsertError);
              throw hallInsertError;
            }
          }
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
    const supabase = getSupabaseClient();
    if (!supabase) return;

    try {
      // 1. 지점 데이터 먼저 로드
      const { data: branches, error: branchesError } = await supabase
        .from('branches')
        .select('*')
        .eq('academy_id', academy.id)
        .order('created_at', { ascending: true });

      if (branchesError) {
        console.error('Error loading branches:', branchesError);
        throw branchesError;
      }

      // 2. 지점이 있으면 각 지점의 홀을 별도로 로드
      const branchData: BranchData[] = [];
      
      if (branches && branches.length > 0) {
        const branchIds = branches.filter(b => b.id).map(b => b.id!);
        
        // 홀 로드 (배치 처리, 최대 100개씩 처리)
        const hallsByBranchId = new Map<string, Hall[]>();
        
        if (branchIds.length > 0) {
          try {
            // Supabase의 in() 쿼리는 최대 100개까지 지원하므로 배치로 나눔
            const batchSize = 100;
            for (let i = 0; i < branchIds.length; i += batchSize) {
              const batch = branchIds.slice(i, i + batchSize);
              
              const { data: batchHalls, error: hallsError } = await supabase
                .from('halls')
                .select('*')
                .in('branch_id', batch)
                .order('created_at', { ascending: true });

              if (hallsError) {
                console.error('Error loading halls batch:', hallsError);
                // 홀 로드 실패해도 지점은 표시
                continue;
              }

              if (batchHalls) {
                batchHalls.forEach((hall: Hall) => {
                  if (!hallsByBranchId.has(hall.branch_id)) {
                    hallsByBranchId.set(hall.branch_id, []);
                  }
                  hallsByBranchId.get(hall.branch_id)!.push(hall);
                });
              }
            }
          } catch (error) {
            console.error('Error loading halls:', error);
            // 홀 로드 실패해도 지점은 표시
          }
        }

        // 지점 데이터 매핑
        for (const branch of branches) {
          if (!branch.id) continue; // id가 없는 지점은 건너뛰기
          
          const branchHalls = hallsByBranchId.get(branch.id) || [];
          
          branchData.push({
            id: branch.id,
            name: branch.name,
            address_primary: branch.address_primary,
            address_detail: branch.address_detail || '',
            contact_number: branch.contact_number || '',
            image_url: (branch as any).image_url || null,
            halls: branchHalls
              .filter((hall: Hall) => hall.id) // id가 있는 홀만
              .map((hall: Hall) => ({
                id: hall.id,
                name: hall.name,
                capacity: hall.capacity || 0,
                floor_info: hall.floor_info || '',
              })),
          });
        }
      }

      const tags = (academy as any).tags
        ? ((academy as any).tags as string).split(',').map(t => t.trim()).filter(t => t)
        : [];

      setEditingData({
        name_kr: (academy as any).name_kr || '',
        name_en: (academy as any).name_en || '',
        tags,
        business_registration_number: academy.business_registration_number || '',
        logo_url: academy.logo_url || '',
        branches: branchData,
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
    if (!confirm('정말 삭제하시겠습니까? 관련된 지점, 홀, 클래스 등도 함께 삭제됩니다.')) return;

    const supabase = getSupabaseClient();
    if (!supabase) return;

    try {
      // 관련 데이터 확인
      const [branchesRes, classesRes] = await Promise.all([
        supabase.from('branches').select('id').eq('academy_id', id).limit(1),
        supabase.from('classes').select('id').eq('academy_id', id).limit(1),
      ]);

      const hasBranches = branchesRes.data && branchesRes.data.length > 0;
      const hasClasses = classesRes.data && classesRes.data.length > 0;

      if (hasBranches || hasClasses) {
        const confirmMessage = `이 학원에 연결된 데이터가 있습니다.\n` +
          `${hasBranches ? '- 지점이 있습니다\n' : ''}` +
          `${hasClasses ? '- 클래스가 있습니다\n' : ''}` +
          `정말 삭제하시겠습니까? (관련 데이터도 함께 삭제됩니다)`;
        
        if (!confirm(confirmMessage)) return;
      }

      // 관련 데이터 삭제 (CASCADE 대신 수동 삭제)
      // 1. 클래스 관련 삭제 (schedules -> bookings -> classes)
      const { data: classes } = await supabase
        .from('classes')
        .select('id')
        .eq('academy_id', id);

      if (classes && classes.length > 0) {
        const classIds = classes.map(c => c.id);
        
        // 각 클래스의 schedules 찾기
        const { data: schedules } = await supabase
          .from('schedules')
          .select('id')
          .in('class_id', classIds);

        if (schedules && schedules.length > 0) {
          const scheduleIds = schedules.map(s => s.id);
          
          // bookings 삭제
          await supabase
            .from('bookings')
            .delete()
            .in('schedule_id', scheduleIds);
        }

        // schedules 삭제
        await supabase
          .from('schedules')
          .delete()
          .in('class_id', classIds);

        // classes 삭제
        await supabase
          .from('classes')
          .delete()
          .eq('academy_id', id);
      }

      // 2. 지점 관련 삭제 (halls -> branches)
      const { data: branches } = await supabase
        .from('branches')
        .select('id')
        .eq('academy_id', id);

      if (branches && branches.length > 0) {
        const branchIds = branches.map(b => b.id);
        
        // halls 삭제
        await supabase
          .from('halls')
          .delete()
          .in('branch_id', branchIds);

        // branches 삭제
        await supabase
          .from('branches')
          .delete()
          .eq('academy_id', id);
      }

      // 3. academy_instructors 삭제
      await supabase
        .from('academy_instructors')
        .delete()
        .eq('academy_id', id);

      // 4. 학원 삭제
      const { error } = await supabase
        .from('academies')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Delete error details:', error);
        throw error;
      }

      await loadAcademies();
    } catch (error: any) {
      console.error('Error deleting academy:', error);
      const errorMessage = error?.message || error?.details || '알 수 없는 오류가 발생했습니다.';
      alert(`학원 삭제에 실패했습니다: ${errorMessage}`);
    }
  };

  const getDisplayName = (academy: Academy) => {
    const nameKr = (academy as any).name_kr;
    const nameEn = (academy as any).name_en;
    if (nameKr && nameEn) {
      return `${nameKr} (${nameEn})`;
    }
    return nameKr || nameEn || '-';
  };

  const getTags = (academy: Academy) => {
    const tags = (academy as any).tags;
    if (!tags) return [];
    return (tags as string).split(',').map(t => t.trim()).filter(t => t);
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
                  태그
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">
                  사업자 등록번호
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
                  <td colSpan={5} className="px-6 py-12 text-center text-neutral-500 dark:text-neutral-400">
                    등록된 학원이 없습니다.
                  </td>
                </tr>
              ) : (
                academies.map((academy) => {
                  const tags = getTags(academy);
                  return (
                    <tr key={academy.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50">
                      <td className="px-6 py-4 text-sm font-medium text-black dark:text-white">
                        {getDisplayName(academy)}
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
                        {academy.business_registration_number || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-600 dark:text-neutral-400">
                        {new Date(academy.created_at).toLocaleDateString('ko-KR')}
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
