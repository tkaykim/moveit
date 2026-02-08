"use client";

import { useState, useEffect, useCallback } from 'react';
import { SectionHeader } from '../common/section-header';
import { getSupabaseClient } from '@/lib/utils/supabase-client';
import { 
  SectionConfig, 
  SectionConfigItem, 
  DEFAULT_SECTION_CONFIG,
  SECTION_LABELS,
  SECTION_DESCRIPTIONS,
  migrateSectionConfig
} from '@/types/database';
import { GripVertical, Eye, EyeOff, ChevronUp, ChevronDown, ChevronRight, RotateCcw, LayoutList, Info, Building2, Link2, MessageSquare, FileText } from 'lucide-react';
import { ConsultationSettingsTab } from './consultations/consultation-settings-tab';
import { IntroductionEditor } from './introduction-editor';

interface SettingsViewProps {
  academyId: string;
}

// --- 섹션 순서/표시 관리 컴포넌트 ---
interface SectionOrderItemProps {
  item: SectionConfigItem;
  label: string;
  description: string;
  isFirst: boolean;
  isLast: boolean;
  onToggleVisible: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDragStart: (e: React.DragEvent, index: number) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, index: number) => void;
  index: number;
}

function SectionOrderItem({ 
  item, label, description, isFirst, isLast, 
  onToggleVisible, onMoveUp, onMoveDown,
  onDragStart, onDragOver, onDrop, index
}: SectionOrderItemProps) {
  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, index)}
      onDragOver={onDragOver}
      onDrop={(e) => onDrop(e, index)}
      className={`flex items-center gap-3 px-4 py-3 rounded-lg border transition-all ${
        item.visible
          ? 'bg-white dark:bg-neutral-800 border-gray-200 dark:border-neutral-700'
          : 'bg-gray-50 dark:bg-neutral-900 border-gray-100 dark:border-neutral-800 opacity-60'
      } cursor-grab active:cursor-grabbing hover:shadow-sm`}
    >
      <GripVertical size={16} className="text-gray-400 dark:text-neutral-500 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <span className={`block text-sm font-medium ${
          item.visible 
            ? 'text-gray-800 dark:text-white' 
            : 'text-gray-400 dark:text-neutral-500 line-through'
        }`}>
          {label}
        </span>
        <span className="block text-xs text-gray-400 dark:text-neutral-500 mt-0.5 truncate">
          {description}
        </span>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        <button
          type="button"
          onClick={onMoveUp}
          disabled={isFirst}
          className="p-1 rounded hover:bg-gray-100 dark:hover:bg-neutral-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          title="위로 이동"
        >
          <ChevronUp size={16} className="text-gray-500 dark:text-neutral-400" />
        </button>
        <button
          type="button"
          onClick={onMoveDown}
          disabled={isLast}
          className="p-1 rounded hover:bg-gray-100 dark:hover:bg-neutral-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          title="아래로 이동"
        >
          <ChevronDown size={16} className="text-gray-500 dark:text-neutral-400" />
        </button>
        <button
          type="button"
          onClick={onToggleVisible}
          className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-neutral-700 transition-colors"
          title={item.visible ? '숨기기' : '표시하기'}
        >
          {item.visible ? (
            <Eye size={16} className="text-blue-500 dark:text-blue-400" />
          ) : (
            <EyeOff size={16} className="text-gray-400 dark:text-neutral-500" />
          )}
        </button>
      </div>
    </div>
  );
}

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
  });
  const [sectionConfig, setSectionConfig] = useState<SectionConfig>(
    JSON.parse(JSON.stringify(DEFAULT_SECTION_CONFIG))
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingSections, setSavingSections] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [openPanels, setOpenPanels] = useState<Record<string, boolean>>({
    basicInfo: true,
    links: false,
    introduction: false,
    sections: false,
    consultation: false,
  });

  const togglePanel = (key: string) => {
    setOpenPanels(prev => ({ ...prev, [key]: !prev[key] }));
  };

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

  // 섹션 설정 초기화
  const handleResetSections = () => {
    if (confirm('섹션 설정을 기본값으로 초기화하시겠습니까?')) {
      setSectionConfig(JSON.parse(JSON.stringify(DEFAULT_SECTION_CONFIG)));
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

      {/* ─── 아코디언 1: 학원 기본 정보 ─── */}
      <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-sm border border-gray-100 dark:border-neutral-800 overflow-hidden">
        <button
          type="button"
          onClick={() => togglePanel('basicInfo')}
          className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-gray-50 dark:hover:bg-neutral-800/50 transition-colors"
        >
          <Building2 size={18} className="text-blue-500 dark:text-blue-400 flex-shrink-0" />
          <span className="flex-1 font-bold text-gray-800 dark:text-white">학원 기본 정보</span>
          <span className="text-xs text-gray-400 dark:text-neutral-500 mr-1">학원명, 주소, 소개 등</span>
          <ChevronRight
            size={18}
            className={`text-gray-400 dark:text-neutral-500 transition-transform duration-200 ${openPanels.basicInfo ? 'rotate-90' : ''}`}
          />
        </button>
        {openPanels.basicInfo && (
          <form onSubmit={handleSubmit} className="px-5 pb-5 border-t border-gray-100 dark:border-neutral-800">
            <div className="space-y-4 pt-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">학원명 (한글)</label>
                <input
                  type="text"
                  className="w-full border dark:border-neutral-700 rounded-lg px-3 py-2 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
                  value={formData.name_kr}
                  onChange={(e) => setFormData({ ...formData, name_kr: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">학원명 (영문)</label>
                <input
                  type="text"
                  className="w-full border dark:border-neutral-700 rounded-lg px-3 py-2 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
                  value={formData.name_en}
                  onChange={(e) => setFormData({ ...formData, name_en: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">대표 전화번호</label>
                <input
                  type="text"
                  className="w-full border dark:border-neutral-700 rounded-lg px-3 py-2 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
                  value={formData.contact_number}
                  onChange={(e) => setFormData({ ...formData, contact_number: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">주소</label>
                <input
                  type="text"
                  className="w-full border dark:border-neutral-700 rounded-lg px-3 py-2 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">학원 설명</label>
                <textarea
                  rows={4}
                  className="w-full border dark:border-neutral-700 rounded-lg px-3 py-2 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white resize-none"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="학원에 대한 상세 설명을 입력하세요..."
                />
              </div>
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-blue-600 dark:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors disabled:opacity-50"
                >
                  {saving ? '저장 중...' : '기본 정보 저장'}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>

      {/* ─── 아코디언 2: 학원 소개 편집 ─── */}
      <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-sm border border-gray-100 dark:border-neutral-800 overflow-hidden">
        <button
          type="button"
          onClick={() => togglePanel('introduction')}
          className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-gray-50 dark:hover:bg-neutral-800/50 transition-colors"
        >
          <FileText size={18} className="text-amber-500 dark:text-amber-400 flex-shrink-0" />
          <span className="flex-1 font-bold text-gray-800 dark:text-white">학원 소개 편집</span>
          <span className="text-xs text-gray-400 dark:text-neutral-500 mr-1">사진, 영상, 링크 포함 자유 작성</span>
          <ChevronRight
            size={18}
            className={`text-gray-400 dark:text-neutral-500 transition-transform duration-200 ${openPanels.introduction ? 'rotate-90' : ''}`}
          />
        </button>
        {openPanels.introduction && (
          <div className="px-5 pb-5 border-t border-gray-100 dark:border-neutral-800 pt-4">
            <IntroductionEditor academyId={academyId} />
          </div>
        )}
      </div>

      {/* ─── 아코디언 3: 링크 및 채널 설정 ─── */}
      <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-sm border border-gray-100 dark:border-neutral-800 overflow-hidden">
        <button
          type="button"
          onClick={() => togglePanel('links')}
          className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-gray-50 dark:hover:bg-neutral-800/50 transition-colors"
        >
          <Link2 size={18} className="text-green-500 dark:text-green-400 flex-shrink-0" />
          <span className="flex-1 font-bold text-gray-800 dark:text-white">링크 및 채널 설정</span>
          <span className="text-xs text-gray-400 dark:text-neutral-500 mr-1">SNS, 지도, 알림</span>
          <ChevronRight
            size={18}
            className={`text-gray-400 dark:text-neutral-500 transition-transform duration-200 ${openPanels.links ? 'rotate-90' : ''}`}
          />
        </button>
        {openPanels.links && (
          <form onSubmit={handleSubmit} className="px-5 pb-5 border-t border-gray-100 dark:border-neutral-800">
            <div className="space-y-4 pt-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">유튜브 링크</label>
                <input
                  type="url"
                  className="w-full border dark:border-neutral-700 rounded-lg px-3 py-2 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
                  value={formData.youtube_url}
                  onChange={(e) => setFormData({ ...formData, youtube_url: e.target.value })}
                  placeholder="https://www.youtube.com/@채널명"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">인스타그램 링크</label>
                <input
                  type="url"
                  className="w-full border dark:border-neutral-700 rounded-lg px-3 py-2 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
                  value={formData.instagram_handle}
                  onChange={(e) => setFormData({ ...formData, instagram_handle: e.target.value })}
                  placeholder="https://www.instagram.com/계정명"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">네이버지도 링크</label>
                <input
                  type="url"
                  className="w-full border dark:border-neutral-700 rounded-lg px-3 py-2 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
                  value={formData.naver_map_url}
                  onChange={(e) => setFormData({ ...formData, naver_map_url: e.target.value })}
                  placeholder="네이버지도 장소 공유 링크"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">카카오톡 채널 링크</label>
                <input
                  type="url"
                  className="w-full border dark:border-neutral-700 rounded-lg px-3 py-2 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
                  value={formData.kakao_channel_url}
                  onChange={(e) => setFormData({ ...formData, kakao_channel_url: e.target.value })}
                  placeholder="https://pf.kakao.com/..."
                />
              </div>

              <div className="pt-3 border-t border-gray-100 dark:border-neutral-800 space-y-3">
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">알림 설정</p>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-800 dark:text-white">수강료 납부 알림</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">만료 3일 전 자동 문자 발송</p>
                  </div>
                  <div className="w-10 h-5 bg-blue-600 dark:bg-blue-500 rounded-full relative cursor-pointer">
                    <div className="absolute right-1 top-1 w-3 h-3 bg-white rounded-full"></div>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-800 dark:text-white">상담 예약 리마인더</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">상담 당일 오전 10시 알림톡</p>
                  </div>
                  <div className="w-10 h-5 bg-blue-600 dark:bg-blue-500 rounded-full relative cursor-pointer">
                    <div className="absolute right-1 top-1 w-3 h-3 bg-white rounded-full"></div>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-800 dark:text-white">강사 급여 정산 알림</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">매월 1일 관리자에게 알림</p>
                  </div>
                  <div className="w-10 h-5 bg-gray-300 dark:bg-gray-600 rounded-full relative cursor-pointer">
                    <div className="absolute left-1 top-1 w-3 h-3 bg-white rounded-full"></div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-blue-600 dark:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors disabled:opacity-50"
                >
                  {saving ? '저장 중...' : '링크 설정 저장'}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>

      {/* ─── 아코디언 3: 학원 페이지 섹션 설정 ─── */}
      <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-sm border border-gray-100 dark:border-neutral-800 overflow-hidden">
        <button
          type="button"
          onClick={() => togglePanel('sections')}
          className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-gray-50 dark:hover:bg-neutral-800/50 transition-colors"
        >
          <LayoutList size={18} className="text-purple-500 dark:text-purple-400 flex-shrink-0" />
          <span className="flex-1 font-bold text-gray-800 dark:text-white">학원 페이지 섹션 설정</span>
          <span className="text-xs text-gray-400 dark:text-neutral-500 mr-1">순서 및 표시 여부</span>
          <ChevronRight
            size={18}
            className={`text-gray-400 dark:text-neutral-500 transition-transform duration-200 ${openPanels.sections ? 'rotate-90' : ''}`}
          />
        </button>
        {openPanels.sections && (
          <div className="px-5 pb-5 border-t border-gray-100 dark:border-neutral-800">
            {/* 안내 박스 */}
            <div className="flex items-start gap-2 bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/50 rounded-lg px-3 py-2.5 mt-4 mb-3">
              <Info size={14} className="text-blue-500 dark:text-blue-400 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
                학원 상세 페이지의 섹션 순서와 표시 여부를 설정합니다.
                위에 있을수록 상단에 배치되며, 눈 아이콘으로 숨김 처리할 수 있습니다.
              </p>
            </div>

            {/* 섹션 리스트 */}
            <div className="space-y-2">
              {sectionConfig.sections
                .sort((a, b) => a.order - b.order)
                .map((section, index) => (
                  <SectionOrderItem
                    key={section.id}
                    item={section}
                    label={SECTION_LABELS[section.id] || section.id}
                    description={SECTION_DESCRIPTIONS[section.id] || ''}
                    isFirst={index === 0}
                    isLast={index === sectionConfig.sections.length - 1}
                    onToggleVisible={() => handleToggleVisible(index)}
                    onMoveUp={() => handleMoveItem(index, index - 1)}
                    onMoveDown={() => handleMoveItem(index, index + 1)}
                    onDragStart={handleDragStart}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                    index={index}
                  />
                ))}
            </div>

            {/* 하단: 초기화 + 저장 */}
            <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100 dark:border-neutral-800">
              <button
                type="button"
                onClick={handleResetSections}
                className="flex items-center gap-1 text-xs text-gray-400 dark:text-neutral-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                <RotateCcw size={13} />
                기본값으로 초기화
              </button>
              <button
                type="button"
                onClick={handleSaveSections}
                disabled={savingSections}
                className="bg-blue-600 dark:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors disabled:opacity-50"
              >
                {savingSections ? '저장 중...' : '섹션 설정 저장'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ─── 아코디언 4: 상담 설정 ─── */}
      <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-sm border border-gray-100 dark:border-neutral-800 overflow-hidden">
        <button
          type="button"
          onClick={() => togglePanel('consultation')}
          className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-gray-50 dark:hover:bg-neutral-800/50 transition-colors"
        >
          <MessageSquare size={18} className="text-orange-500 dark:text-orange-400 flex-shrink-0" />
          <span className="flex-1 font-bold text-gray-800 dark:text-white">상담 설정</span>
          <span className="text-xs text-gray-400 dark:text-neutral-500 mr-1">카테고리, 가능 시간</span>
          <ChevronRight
            size={18}
            className={`text-gray-400 dark:text-neutral-500 transition-transform duration-200 ${openPanels.consultation ? 'rotate-90' : ''}`}
          />
        </button>
        {openPanels.consultation && (
          <div className="border-t border-gray-100 dark:border-neutral-800">
            <ConsultationSettingsTab academyId={academyId} />
          </div>
        )}
      </div>
    </div>
  );
}
