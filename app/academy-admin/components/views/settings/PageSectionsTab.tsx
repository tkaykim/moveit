"use client";

import { useState, useCallback } from 'react';
import {
  SectionConfig,
  SectionConfigItem,
  SECTION_LABELS,
  SECTION_DESCRIPTIONS,
  CUSTOM_SECTION_TYPE_LABELS,
} from '@/types/database';
import {
  GripVertical,
  Eye,
  EyeOff,
  ChevronUp,
  ChevronDown,
  Plus,
  Trash2,
  ImageIcon,
  Type,
  Video,
  Pencil,
  RotateCcw,
  LayoutList,
  Info,
  X,
} from 'lucide-react';
import { CustomSectionModal } from './CustomSectionModal';
import { IntroductionEditor } from '../introduction-editor';

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
  onEdit?: () => void;
  onDelete?: () => void;
}

function SectionOrderItem({
  item,
  label,
  description,
  isFirst,
  isLast,
  onToggleVisible,
  onMoveUp,
  onMoveDown,
  onDragStart,
  onDragOver,
  onDrop,
  index,
  onEdit,
  onDelete,
}: SectionOrderItemProps) {
  const typeIcon = item.isCustom
    ? item.type === 'image'
      ? <ImageIcon size={14} className="text-pink-500" />
      : item.type === 'video'
        ? <Video size={14} className="text-red-500" />
        : <Type size={14} className="text-indigo-500" />
    : null;

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, index)}
      onDragOver={onDragOver}
      onDrop={(e) => onDrop(e, index)}
      className={`flex items-center gap-3 px-4 py-3 rounded-lg border transition-all ${
        item.visible
          ? item.isCustom
            ? 'bg-gradient-to-r from-purple-50/50 to-white dark:from-purple-950/20 dark:to-neutral-800 border-purple-200 dark:border-purple-800/50'
            : 'bg-white dark:bg-neutral-800 border-gray-200 dark:border-neutral-700'
          : 'bg-gray-50 dark:bg-neutral-900 border-gray-100 dark:border-neutral-800 opacity-60'
      } cursor-grab active:cursor-grabbing hover:shadow-sm`}
    >
      <GripVertical size={16} className="text-gray-400 dark:text-neutral-500 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          {typeIcon}
          <span className={`block text-sm font-medium ${item.visible ? 'text-gray-800 dark:text-white' : 'text-gray-400 dark:text-neutral-500 line-through'}`}>{label}</span>
          {item.isCustom && <span className="text-[10px] bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-300 px-1.5 py-0.5 rounded-full font-medium">커스텀</span>}
        </div>
        <span className="block text-xs text-gray-400 dark:text-neutral-500 mt-0.5 truncate">{description}</span>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        {onEdit && (
          <button type="button" onClick={onEdit} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-neutral-700 transition-colors" title="편집"><Pencil size={14} className="text-gray-500 dark:text-neutral-400" /></button>
        )}
        {item.isCustom && onDelete && (
          <button type="button" onClick={onDelete} className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors" title="삭제"><Trash2 size={14} className="text-red-400 dark:text-red-500" /></button>
        )}
        <button type="button" onClick={onMoveUp} disabled={isFirst} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-neutral-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors" title="위로 이동"><ChevronUp size={16} className="text-gray-500 dark:text-neutral-400" /></button>
        <button type="button" onClick={onMoveDown} disabled={isLast} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-neutral-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors" title="아래로 이동"><ChevronDown size={16} className="text-gray-500 dark:text-neutral-400" /></button>
        <button type="button" onClick={onToggleVisible} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-neutral-700 transition-colors" title={item.visible ? '숨기기' : '표시하기'}>
          {item.visible ? <Eye size={16} className="text-blue-500 dark:text-blue-400" /> : <EyeOff size={16} className="text-gray-400 dark:text-neutral-500" />}
        </button>
      </div>
    </div>
  );
}

function IntroductionEditorModal({ isOpen, onClose, academyId }: { isOpen: boolean; onClose: () => void; academyId: string }) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl w-full max-w-3xl mx-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-neutral-800">
          <h3 className="font-bold text-gray-900 dark:text-white">학원 소개 편집</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors"><X size={18} className="text-gray-500" /></button>
        </div>
        <div className="px-6 py-5">
          <IntroductionEditor academyId={academyId} />
        </div>
      </div>
    </div>
  );
}

export interface PageSectionsTabProps {
  academyId: string;
  sectionConfig: SectionConfig;
  savingSections: boolean;
  onMoveItem: (fromIndex: number, toIndex: number) => void;
  onToggleVisible: (index: number) => void;
  onDragStart: (e: React.DragEvent, index: number) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, toIndex: number) => void;
  onAddCustomSection: (sectionData: Partial<SectionConfigItem>) => void;
  onEditCustomSection: (sectionId: string, sectionData: Partial<SectionConfigItem>) => void;
  onDeleteCustomSection: (sectionId: string) => void;
  onSaveSections: () => void;
  onResetSections: () => void;
}

export function PageSectionsTab({
  academyId,
  sectionConfig,
  savingSections,
  onMoveItem,
  onToggleVisible,
  onDragStart,
  onDragOver,
  onDrop,
  onAddCustomSection,
  onEditCustomSection,
  onDeleteCustomSection,
  onSaveSections,
  onResetSections,
}: PageSectionsTabProps) {
  const [showCustomSectionModal, setShowCustomSectionModal] = useState(false);
  const [editingCustomSection, setEditingCustomSection] = useState<SectionConfigItem | null>(null);
  const [showIntroEditor, setShowIntroEditor] = useState(false);

  const handleSaveModal = useCallback(
    (sectionData: Partial<SectionConfigItem>) => {
      if (editingCustomSection) {
        onEditCustomSection(editingCustomSection.id, sectionData);
      } else {
        onAddCustomSection(sectionData);
      }
      setEditingCustomSection(null);
      setShowCustomSectionModal(false);
    },
    [editingCustomSection, onEditCustomSection, onAddCustomSection]
  );

  return (
    <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-sm border border-gray-100 dark:border-neutral-800 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 dark:border-neutral-800">
        <div className="flex items-center gap-2">
          <LayoutList size={18} className="text-purple-500 dark:text-purple-400 flex-shrink-0" />
          <h3 className="font-bold text-gray-800 dark:text-white">학원 페이지 섹션 설정</h3>
        </div>
        <p className="text-xs text-gray-500 dark:text-neutral-400 mt-1">순서 및 표시 여부</p>
      </div>
      <div className="px-5 pb-5 pt-4">
        <div className="flex items-start gap-2 bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/50 rounded-lg px-3 py-2.5 mb-4">
          <Info size={14} className="text-blue-500 dark:text-blue-400 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
            학원 상세 페이지의 섹션 순서와 표시 여부를 설정합니다. 위에 있을수록 상단에 배치되며, 눈 아이콘으로 숨김 처리할 수 있습니다.
            <br />
            <strong>커스텀 섹션</strong>을 추가하여 이미지, 영상, 글 섹션을 자유롭게 구성할 수 있습니다.
          </p>
        </div>
        <div className="space-y-2">
          {sectionConfig.sections
            .slice()
            .sort((a, b) => a.order - b.order)
            .map((section, index) => {
              const isCustom = !!section.isCustom;
              const label = isCustom ? (section.title || '커스텀 섹션') : (SECTION_LABELS[section.id] || section.id);
              const description = isCustom ? `${CUSTOM_SECTION_TYPE_LABELS[section.type || 'text']} 섹션${section.link_url ? ' · 링크 설정됨' : ''}` : (SECTION_DESCRIPTIONS[section.id] || '');
              const actualIndex = sectionConfig.sections.findIndex((s) => s.id === section.id);
              return (
                <SectionOrderItem
                  key={section.id}
                  item={section}
                  label={label}
                  description={description}
                  isFirst={index === 0}
                  isLast={index === sectionConfig.sections.length - 1}
                  onToggleVisible={() => onToggleVisible(actualIndex)}
                  onMoveUp={() => onMoveItem(actualIndex, actualIndex - 1)}
                  onMoveDown={() => onMoveItem(actualIndex, actualIndex + 1)}
                  onDragStart={onDragStart}
                  onDragOver={onDragOver}
                  onDrop={onDrop}
                  index={actualIndex}
                  onEdit={
                    isCustom
                      ? () => {
                          setEditingCustomSection(section);
                          setShowCustomSectionModal(true);
                        }
                      : section.id === 'info'
                        ? () => setShowIntroEditor(true)
                        : undefined
                  }
                  onDelete={isCustom ? () => onDeleteCustomSection(section.id) : undefined}
                />
              );
            })}
        </div>
        <button
          type="button"
          onClick={() => {
            setEditingCustomSection(null);
            setShowCustomSectionModal(true);
          }}
          className="w-full mt-3 flex items-center justify-center gap-2 py-3 rounded-lg border-2 border-dashed border-purple-300 dark:border-purple-700 text-purple-600 dark:text-purple-400 text-sm font-medium hover:border-purple-400 dark:hover:border-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950/20 transition-all"
        >
          <Plus size={16} />
          커스텀 섹션 추가 (이미지 / 영상 / 글)
        </button>
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100 dark:border-neutral-800">
          <button type="button" onClick={onResetSections} className="flex items-center gap-1 text-xs text-gray-400 dark:text-neutral-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors" title="기본 섹션만 초기화됩니다. 커스텀 섹션은 유지됩니다.">
            <RotateCcw size={13} />
            기본값으로 초기화
          </button>
          <button type="button" onClick={onSaveSections} disabled={savingSections} className="bg-blue-600 dark:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors disabled:opacity-50">
            {savingSections ? '저장 중...' : '섹션 설정 저장'}
          </button>
        </div>
        <CustomSectionModal
          isOpen={showCustomSectionModal}
          onClose={() => {
            setShowCustomSectionModal(false);
            setEditingCustomSection(null);
          }}
          onSave={handleSaveModal}
          editingSection={editingCustomSection}
          academyId={academyId}
        />
        <IntroductionEditorModal isOpen={showIntroEditor} onClose={() => setShowIntroEditor(false)} academyId={academyId} />
      </div>
    </div>
  );
}
