"use client";

import { useState, useEffect, useCallback } from 'react';
import { SectionHeader } from '../common/section-header';
import { getSupabaseClient } from '@/lib/utils/supabase-client';
import {
  SectionConfig,
  SectionConfigItem,
  DEFAULT_SECTION_CONFIG,
  migrateSectionConfig,
} from '@/types/database';
import { Building2, LayoutList, MessageSquare } from 'lucide-react';
import { ConsultationSettingsTab } from './consultations/consultation-settings-tab';
import { AcademyInfoTab } from './settings/AcademyInfoTab';
import { PageSectionsTab } from './settings/PageSectionsTab';
import { cn } from '@/lib/utils';

interface SettingsViewProps {
  academyId: string;
}

type SettingsTabId = 'academy' | 'page' | 'consultation';

export function SettingsView({ academyId }: SettingsViewProps) {
  const [formData, setFormData] = useState({
    name_kr: '',
    name_en: '',
    address: '',
    contact_number: '',
    description: '',
    instagram_handle: '',
    youtube_url: '',
    naver_map_url: '',
    kakao_channel_url: '',
    bank_name: '',
    bank_account_number: '',
    bank_depositor_name: '',
  });
  const [sectionConfig, setSectionConfig] = useState<SectionConfig>(
    JSON.parse(JSON.stringify(DEFAULT_SECTION_CONFIG))
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingSections, setSavingSections] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [activeSettingsTab, setActiveSettingsTab] = useState<SettingsTabId>('academy');

  useEffect(() => {
    loadAcademy();
  }, [academyId]);

  const loadAcademy = async () => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('academies')
        .select('*')
        .eq('id', academyId)
        .single();

      if (error) throw error;

      setFormData({
        name_kr: data.name_kr || '',
        name_en: data.name_en || '',
        address: data.address || '',
        contact_number: data.contact_number || '',
        description: data.description || '',
        instagram_handle: data.instagram_handle || '',
        youtube_url: data.youtube_url || '',
        naver_map_url: data.naver_map_url || '',
        kakao_channel_url: data.kakao_channel_url || '',
        bank_name: data.bank_name || '',
        bank_account_number: data.bank_account_number || '',
        bank_depositor_name: data.bank_depositor_name || '',
      });

      // section_config 로드 (레거시 tabs/homeSections 형식도 자동 변환)
      if (data.section_config) {
        const config = migrateSectionConfig(data.section_config);
        // 기존 설정에 새로 추가된 섹션이 있을 수 있으므로 병합
        setSectionConfig(mergeSectionConfigFlat(config));
      } else {
        setSectionConfig(JSON.parse(JSON.stringify(DEFAULT_SECTION_CONFIG)));
      }
    } catch (error) {
      console.error('Error loading academy:', error);
    } finally {
      setLoading(false);
    }
  };

  // 기존 설정과 기본 설정을 병합 (새 섹션이 추가된 경우 대응)
  const mergeSectionConfigFlat = (saved: SectionConfig): SectionConfig => {
    const result = [...(saved.sections || [])];
    for (const defaultItem of DEFAULT_SECTION_CONFIG.sections) {
      if (!result.find(item => item.id === defaultItem.id)) {
        result.push({ ...defaultItem, order: result.length });
      }
    }
    return { sections: result.sort((a, b) => a.order - b.order) };
  };

  // 섹션 순서 변경 핸들러
  const handleMoveItem = useCallback((fromIndex: number, toIndex: number) => {
    setSectionConfig(prev => {
      const items = [...prev.sections];
      const [moved] = items.splice(fromIndex, 1);
      items.splice(toIndex, 0, moved);
      const reordered = items.map((item, idx) => ({ ...item, order: idx }));
      return { sections: reordered };
    });
  }, []);

  // 섹션 표시/숨기기 토글
  const handleToggleVisible = useCallback((index: number) => {
    setSectionConfig(prev => {
      const items = [...prev.sections];
      items[index] = { ...items[index], visible: !items[index].visible };
      return { sections: items };
    });
  }, []);

  // 드래그앤드롭 핸들러
  const handleDragStart = useCallback((e: React.DragEvent, index: number) => {
    setDragIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, toIndex: number) => {
    e.preventDefault();
    if (dragIndex !== null && dragIndex !== toIndex) {
      handleMoveItem(dragIndex, toIndex);
    }
    setDragIndex(null);
  }, [dragIndex, handleMoveItem]);

  // 커스텀 섹션 추가
  const handleAddCustomSection = useCallback((sectionData: Partial<SectionConfigItem>) => {
    setSectionConfig(prev => {
      const newId = `custom_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const newSection: SectionConfigItem = {
        id: newId,
        visible: true,
        order: prev.sections.length,
        isCustom: true,
        type: sectionData.type,
        title: sectionData.title,
        content: sectionData.content,
        media_url: sectionData.media_url,
        link_url: sectionData.link_url,
      };
      return { sections: [...prev.sections, newSection] };
    });
  }, []);

  // 커스텀 섹션 편집
  const handleEditCustomSection = useCallback((sectionId: string, sectionData: Partial<SectionConfigItem>) => {
    setSectionConfig(prev => {
      const sections = prev.sections.map(s => (s.id === sectionId ? { ...s, ...sectionData } : s));
      return { sections };
    });
  }, []);

  // 커스텀 섹션 삭제
  const handleDeleteCustomSection = useCallback((sectionId: string) => {
    if (!confirm('이 커스텀 섹션을 삭제하시겠습니까?')) return;
    setSectionConfig(prev => {
      const sections = prev.sections
        .filter(s => s.id !== sectionId)
        .map((s, idx) => ({ ...s, order: idx }));
      return { sections };
    });
  }, []);

  // 섹션 설정 저장
  const handleSaveSections = async () => {
    setSavingSections(true);
    const supabase = getSupabaseClient();
    if (!supabase) {
      alert('데이터베이스 연결에 실패했습니다.');
      setSavingSections(false);
      return;
    }

    try {
      const { error } = await supabase
        .from('academies')
        .update({ section_config: sectionConfig as any })
        .eq('id', academyId);

      if (error) throw error;
      alert('페이지 섹션 설정이 저장되었습니다.');
    } catch (error: any) {
      console.error('Error saving section config:', error);
      alert(`섹션 설정 저장에 실패했습니다: ${error.message}`);
    } finally {
      setSavingSections(false);
    }
  };

  // 섹션 설정 초기화 (커스텀 섹션은 유지)
  const handleResetSections = () => {
    if (confirm('기본 섹션 설정을 초기화하시겠습니까?\n(커스텀 섹션은 유지됩니다)')) {
      setSectionConfig(prev => {
        const customSections = prev.sections.filter(s => s.isCustom);
        const defaultSections = JSON.parse(JSON.stringify(DEFAULT_SECTION_CONFIG.sections));
        const allSections = [
          ...defaultSections,
          ...customSections.map((s: SectionConfigItem, idx: number) => ({ ...s, order: defaultSections.length + idx }))
        ];
        return { sections: allSections };
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    const supabase = getSupabaseClient();
    if (!supabase) {
      alert('데이터베이스 연결에 실패했습니다.');
      setSaving(false);
      return;
    }

    try {
      const payload = {
        name_kr: formData.name_kr,
        name_en: formData.name_en,
        address: formData.address,
        contact_number: formData.contact_number,
        description: formData.description,
        instagram_handle: formData.instagram_handle.trim() ? formData.instagram_handle.trim() : null,
        youtube_url: formData.youtube_url.trim() ? formData.youtube_url.trim() : null,
        naver_map_url: formData.naver_map_url.trim() ? formData.naver_map_url.trim() : null,
        kakao_channel_url: formData.kakao_channel_url.trim() ? formData.kakao_channel_url.trim() : null,
        bank_name: formData.bank_name.trim() || null,
        bank_account_number: formData.bank_account_number.trim() || null,
        bank_depositor_name: formData.bank_depositor_name.trim() || null,
      };
      const { error } = await supabase
        .from('academies')
        .update(payload)
        .eq('id', academyId);

      if (error) throw error;
      alert('학원 정보가 수정되었습니다.');
      loadAcademy();
    } catch (error: any) {
      console.error('Error updating academy:', error);
      alert(`정보 수정에 실패했습니다: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveBankAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.bank_account_number?.trim()) {
      alert('계좌번호를 입력해 주세요. 계좌이체 결제 시 입금받을 계좌로 사용됩니다.');
      return;
    }
    if (!formData.bank_name?.trim() || !formData.bank_depositor_name?.trim()) {
      alert('은행명, 계좌번호, 입금자명을 모두 입력해 주세요.');
      return;
    }
    setSaving(true);
    const supabase = getSupabaseClient();
    if (!supabase) {
      setSaving(false);
      return;
    }
    try {
      const { error } = await supabase
        .from('academies')
        .update({
          bank_name: formData.bank_name.trim(),
          bank_account_number: formData.bank_account_number.trim(),
          bank_depositor_name: formData.bank_depositor_name.trim(),
        })
        .eq('id', academyId);
      if (error) throw error;
      alert('계좌 정보가 저장되었습니다.');
      loadAcademy();
    } catch (err: any) {
      console.error('Error updating bank account:', err);
      alert('계좌 정보 저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500 dark:text-gray-400">로딩 중...</div>
      </div>
    );
  }

  return (
    <div className="space-y-3" data-onboarding="page-settings-0">
      <SectionHeader title="시스템 설정" />

      {/* 상단 탭: 학원 정보 | 페이지 구성 | 상담 */}
      <div className="flex gap-1 p-1 bg-gray-100 dark:bg-neutral-800 rounded-lg">
        {(
          [
            { id: 'academy' as const, label: '학원 정보', icon: Building2 },
            { id: 'page' as const, label: '페이지 구성', icon: LayoutList },
            { id: 'consultation' as const, label: '상담', icon: MessageSquare },
          ] as const
        ).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveSettingsTab(id)}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition-colors',
              activeSettingsTab === id
                ? 'bg-white dark:bg-neutral-700 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-600 dark:text-neutral-400 hover:text-gray-800 dark:hover:text-neutral-200'
            )}
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
      </div>

      {activeSettingsTab === 'academy' && (
        <AcademyInfoTab
          formData={formData}
          setFormData={setFormData}
          saving={saving}
          onSaveBasic={handleSubmit}
          onSaveLinks={handleSubmit}
          onSaveBankAccount={handleSaveBankAccount}
        />
      )}

      {activeSettingsTab === 'page' && (
        <PageSectionsTab
          academyId={academyId}
          sectionConfig={sectionConfig}
          savingSections={savingSections}
          onMoveItem={handleMoveItem}
          onToggleVisible={handleToggleVisible}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onAddCustomSection={handleAddCustomSection}
          onEditCustomSection={handleEditCustomSection}
          onDeleteCustomSection={handleDeleteCustomSection}
          onSaveSections={handleSaveSections}
          onResetSections={handleResetSections}
        />
      )}

      {activeSettingsTab === 'consultation' && (
        <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-sm border border-gray-100 dark:border-neutral-800 overflow-hidden">
          <div className="border-t border-gray-100 dark:border-neutral-800">
            <ConsultationSettingsTab academyId={academyId} />
          </div>
        </div>
      )}
    </div>
  );
}
