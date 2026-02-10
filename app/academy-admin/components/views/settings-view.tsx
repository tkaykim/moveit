"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { SectionHeader } from '../common/section-header';
import { getSupabaseClient } from '@/lib/utils/supabase-client';
import { 
  SectionConfig, 
  SectionConfigItem, 
  DEFAULT_SECTION_CONFIG,
  SECTION_LABELS,
  SECTION_DESCRIPTIONS,
  CUSTOM_SECTION_TYPE_LABELS,
  BUILTIN_SECTION_IDS,
  migrateSectionConfig
} from '@/types/database';
import { GripVertical, Eye, EyeOff, ChevronUp, ChevronDown, ChevronRight, RotateCcw, LayoutList, Info, Building2, Link2, MessageSquare, FileText, Plus, Trash2, ImageIcon, Type, Video, Pencil, X, Upload, ExternalLink, Bold, Italic, Underline as UnderlineIcon, Strikethrough, Heading1, Heading2, Heading3, AlignLeft, AlignCenter, AlignRight, List, ListOrdered } from 'lucide-react';
import { ConsultationSettingsTab } from './consultations/consultation-settings-tab';
import { IntroductionEditor } from './introduction-editor';
import Image from 'next/image';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import UnderlineExt from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Placeholder from '@tiptap/extension-placeholder';

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
  onEdit?: () => void;
  onDelete?: () => void;
}

function SectionOrderItem({ 
  item, label, description, isFirst, isLast, 
  onToggleVisible, onMoveUp, onMoveDown,
  onDragStart, onDragOver, onDrop, index,
  onEdit, onDelete
}: SectionOrderItemProps) {
  const typeIcon = item.isCustom ? (
    item.type === 'image' ? <ImageIcon size={14} className="text-pink-500" /> :
    item.type === 'video' ? <Video size={14} className="text-red-500" /> :
    <Type size={14} className="text-indigo-500" />
  ) : null;

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
          <span className={`block text-sm font-medium ${
            item.visible 
              ? 'text-gray-800 dark:text-white' 
              : 'text-gray-400 dark:text-neutral-500 line-through'
          }`}>
            {label}
          </span>
          {item.isCustom && (
            <span className="text-[10px] bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-300 px-1.5 py-0.5 rounded-full font-medium">
              커스텀
            </span>
          )}
        </div>
        <span className="block text-xs text-gray-400 dark:text-neutral-500 mt-0.5 truncate">
          {description}
        </span>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        {onEdit && (
          <button
            type="button"
            onClick={onEdit}
            className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-neutral-700 transition-colors"
            title="편집"
          >
            <Pencil size={14} className="text-gray-500 dark:text-neutral-400" />
          </button>
        )}
        {item.isCustom && onDelete && (
          <button
            type="button"
            onClick={onDelete}
            className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            title="삭제"
          >
            <Trash2 size={14} className="text-red-400 dark:text-red-500" />
          </button>
        )}
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

// --- 미니 리치 텍스트 에디터 (커스텀 텍스트 섹션용) ---
function MiniRichToolbarBtn({ onClick, active, disabled, title, children }: {
  onClick: () => void; active?: boolean; disabled?: boolean; title: string; children: React.ReactNode;
}) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} title={title}
      className={`p-1.5 rounded transition-colors ${
        active ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300'
               : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-neutral-700'
      } disabled:opacity-30 disabled:cursor-not-allowed`}
    >{children}</button>
  );
}

function MiniRichTextEditor({ initialContent, onContentChange }: { initialContent: string; onContentChange: (html: string) => void }) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      UnderlineExt,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Placeholder.configure({ placeholder: '섹션에 표시할 내용을 작성하세요...' }),
    ],
    content: initialContent || '',
    editorProps: {
      attributes: {
        class: 'prose prose-sm dark:prose-invert max-w-none focus:outline-none min-h-[180px] px-4 py-3',
      },
    },
    onUpdate: ({ editor: ed }) => {
      onContentChange(ed.getHTML());
    },
  });

  if (!editor) return <div className="text-sm text-gray-400 py-4 text-center">에디터 로딩 중...</div>;

  return (
    <div>
      {/* 툴바 */}
      <div className="bg-gray-50 dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-t-lg p-1.5 flex flex-wrap items-center gap-0.5">
        <MiniRichToolbarBtn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="굵게">
          <Bold size={15} />
        </MiniRichToolbarBtn>
        <MiniRichToolbarBtn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="기울임">
          <Italic size={15} />
        </MiniRichToolbarBtn>
        <MiniRichToolbarBtn onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')} title="밑줄">
          <UnderlineIcon size={15} />
        </MiniRichToolbarBtn>
        <MiniRichToolbarBtn onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive('strike')} title="취소선">
          <Strikethrough size={15} />
        </MiniRichToolbarBtn>
        <div className="w-px h-5 bg-gray-200 dark:bg-neutral-700 mx-0.5" />
        <MiniRichToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive('heading', { level: 1 })} title="제목 1">
          <Heading1 size={15} />
        </MiniRichToolbarBtn>
        <MiniRichToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} title="제목 2">
          <Heading2 size={15} />
        </MiniRichToolbarBtn>
        <MiniRichToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive('heading', { level: 3 })} title="제목 3">
          <Heading3 size={15} />
        </MiniRichToolbarBtn>
        <div className="w-px h-5 bg-gray-200 dark:bg-neutral-700 mx-0.5" />
        <MiniRichToolbarBtn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} title="글머리 기호">
          <List size={15} />
        </MiniRichToolbarBtn>
        <MiniRichToolbarBtn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="번호 매기기">
          <ListOrdered size={15} />
        </MiniRichToolbarBtn>
        <div className="w-px h-5 bg-gray-200 dark:bg-neutral-700 mx-0.5" />
        <MiniRichToolbarBtn onClick={() => editor.chain().focus().setTextAlign('left').run()} active={editor.isActive({ textAlign: 'left' })} title="왼쪽 정렬">
          <AlignLeft size={15} />
        </MiniRichToolbarBtn>
        <MiniRichToolbarBtn onClick={() => editor.chain().focus().setTextAlign('center').run()} active={editor.isActive({ textAlign: 'center' })} title="가운데 정렬">
          <AlignCenter size={15} />
        </MiniRichToolbarBtn>
        <MiniRichToolbarBtn onClick={() => editor.chain().focus().setTextAlign('right').run()} active={editor.isActive({ textAlign: 'right' })} title="오른쪽 정렬">
          <AlignRight size={15} />
        </MiniRichToolbarBtn>
      </div>
      {/* 에디터 본문 */}
      <div className="border border-t-0 border-gray-200 dark:border-neutral-700 rounded-b-lg overflow-hidden bg-white dark:bg-neutral-900">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

// --- 커스텀 섹션 추가/편집 모달 ---
interface CustomSectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (section: Partial<SectionConfigItem>) => void;
  editingSection?: SectionConfigItem | null;
  academyId: string;
}

function CustomSectionModal({ isOpen, onClose, onSave, editingSection, academyId }: CustomSectionModalProps) {
  const [sectionType, setSectionType] = useState<'image' | 'text' | 'video'>(editingSection?.type || 'image');
  const [title, setTitle] = useState(editingSection?.title || '');
  const [content, setContent] = useState(editingSection?.content || '');
  const [mediaUrl, setMediaUrl] = useState(editingSection?.media_url || '');
  const [linkUrl, setLinkUrl] = useState(editingSection?.link_url || '');
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (editingSection) {
      setSectionType(editingSection.type || 'image');
      setTitle(editingSection.title || '');
      setContent(editingSection.content || '');
      setMediaUrl(editingSection.media_url || '');
      setLinkUrl(editingSection.link_url || '');
    } else {
      setSectionType('image');
      setTitle('');
      setContent('');
      setMediaUrl('');
      setLinkUrl('');
    }
  }, [editingSection, isOpen]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert('파일 크기는 5MB 이하여야 합니다.');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('academyId', academyId);

      const response = await fetch('/api/upload/image', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || '업로드 실패');
      }

      const data = await response.json();
      setMediaUrl(data.url);
    } catch (error: any) {
      alert(`이미지 업로드 실패: ${error.message}`);
    } finally {
      setUploading(false);
    }
  };

  const handleSave = () => {
    if (!title.trim()) {
      alert('섹션 제목을 입력해주세요.');
      return;
    }
    if (sectionType === 'text' && (!content.trim() || content === '<p></p>')) {
      alert('글 내용을 입력해주세요.');
      return;
    }
    if ((sectionType === 'image' || sectionType === 'video') && !mediaUrl.trim()) {
      alert(sectionType === 'image' ? '이미지를 업로드하거나 URL을 입력해주세요.' : '영상 URL을 입력해주세요.');
      return;
    }

    onSave({
      type: sectionType,
      title: title.trim(),
      content: sectionType === 'text' ? content : undefined,
      media_url: (sectionType === 'image' || sectionType === 'video') ? mediaUrl.trim() : undefined,
      link_url: linkUrl.trim() || undefined,
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div 
        className="bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-neutral-800">
          <h3 className="font-bold text-gray-900 dark:text-white">
            {editingSection ? '커스텀 섹션 편집' : '커스텀 섹션 추가'}
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors">
            <X size={18} className="text-gray-500" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* 섹션 타입 선택 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">섹션 타입</label>
            <div className="flex gap-2">
              {(['image', 'text', 'video'] as const).map(type => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setSectionType(type)}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border-2 text-sm font-medium transition-all ${
                    sectionType === type
                      ? 'border-purple-500 bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-300'
                      : 'border-gray-200 dark:border-neutral-700 text-gray-500 dark:text-neutral-400 hover:border-gray-300 dark:hover:border-neutral-600'
                  }`}
                >
                  {type === 'image' && <ImageIcon size={16} />}
                  {type === 'text' && <Type size={16} />}
                  {type === 'video' && <Video size={16} />}
                  {CUSTOM_SECTION_TYPE_LABELS[type]}
                </button>
              ))}
            </div>
          </div>

          {/* 제목 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">섹션 제목</label>
            <input
              type="text"
              className="w-full border dark:border-neutral-700 rounded-lg px-3 py-2 bg-white dark:bg-neutral-800 text-gray-900 dark:text-white text-sm"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="예: 학원 갤러리, 공지사항 등"
            />
          </div>

          {/* 이미지 업로드 (image 타입) */}
          {sectionType === 'image' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">이미지</label>
              {mediaUrl ? (
                <div className="relative rounded-lg overflow-hidden border border-gray-200 dark:border-neutral-700">
                  <div className="relative w-full h-48">
                    <Image src={mediaUrl} alt="업로드된 이미지" fill className="object-cover" />
                  </div>
                  <button
                    type="button"
                    onClick={() => setMediaUrl('')}
                    className="absolute top-2 right-2 p-1.5 bg-black/50 hover:bg-black/70 rounded-full text-white transition-colors"
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <label className="flex flex-col items-center justify-center w-full h-36 border-2 border-dashed border-gray-300 dark:border-neutral-600 rounded-lg cursor-pointer hover:border-purple-400 dark:hover:border-purple-500 transition-colors bg-gray-50 dark:bg-neutral-800/50">
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/gif,image/webp"
                      className="hidden"
                      onChange={handleImageUpload}
                      disabled={uploading}
                    />
                    {uploading ? (
                      <div className="text-sm text-gray-500 dark:text-neutral-400">업로드 중...</div>
                    ) : (
                      <>
                        <Upload size={24} className="text-gray-400 dark:text-neutral-500 mb-2" />
                        <span className="text-sm text-gray-500 dark:text-neutral-400">클릭하여 이미지 업로드</span>
                        <span className="text-xs text-gray-400 dark:text-neutral-500 mt-1">JPG, PNG, GIF, WebP (최대 5MB)</span>
                      </>
                    )}
                  </label>
                  <div className="flex items-center gap-2">
                    <div className="h-px flex-1 bg-gray-200 dark:bg-neutral-700" />
                    <span className="text-xs text-gray-400">또는 URL 입력</span>
                    <div className="h-px flex-1 bg-gray-200 dark:bg-neutral-700" />
                  </div>
                  <input
                    type="url"
                    className="w-full border dark:border-neutral-700 rounded-lg px-3 py-2 bg-white dark:bg-neutral-800 text-gray-900 dark:text-white text-sm"
                    value={mediaUrl}
                    onChange={e => setMediaUrl(e.target.value)}
                    placeholder="https://example.com/image.jpg"
                  />
                </div>
              )}
            </div>
          )}

          {/* 영상 URL (video 타입) */}
          {sectionType === 'video' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">영상 URL</label>
              <input
                type="url"
                className="w-full border dark:border-neutral-700 rounded-lg px-3 py-2 bg-white dark:bg-neutral-800 text-gray-900 dark:text-white text-sm"
                value={mediaUrl}
                onChange={e => setMediaUrl(e.target.value)}
                placeholder="유튜브 또는 영상 링크를 입력하세요"
              />
              <p className="text-xs text-gray-400 dark:text-neutral-500 mt-1">유튜브 링크를 입력하면 자동으로 임베드됩니다.</p>
            </div>
          )}

          {/* 글 내용 (text 타입) - 리치 텍스트 에디터 */}
          {sectionType === 'text' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">글 내용</label>
              <MiniRichTextEditor
                initialContent={content}
                onContentChange={setContent}
              />
            </div>
          )}

          {/* 링크 URL */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              <span className="flex items-center gap-1">
                <ExternalLink size={14} />
                클릭 시 이동 URL <span className="text-gray-400 font-normal">(선택)</span>
              </span>
            </label>
            <input
              type="url"
              className="w-full border dark:border-neutral-700 rounded-lg px-3 py-2 bg-white dark:bg-neutral-800 text-gray-900 dark:text-white text-sm"
              value={linkUrl}
              onChange={e => setLinkUrl(e.target.value)}
              placeholder="https://example.com"
            />
            <p className="text-xs text-gray-400 dark:text-neutral-500 mt-1">설정 시 섹션 클릭 시 해당 URL로 이동합니다.</p>
          </div>
        </div>

        {/* 하단 버튼 */}
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100 dark:border-neutral-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-neutral-400 hover:bg-gray-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={uploading}
            className="px-4 py-2 text-sm font-medium bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
          >
            {editingSection ? '수정' : '추가'}
          </button>
        </div>
      </div>
    </div>
  );
}

// --- 학원 소개 편집 모달 ---
function IntroductionEditorModal({ isOpen, onClose, academyId }: { isOpen: boolean; onClose: () => void; academyId: string }) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl w-full max-w-3xl mx-4 max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-neutral-800">
          <h3 className="font-bold text-gray-900 dark:text-white">학원 소개 편집</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors">
            <X size={18} className="text-gray-500" />
          </button>
        </div>
        <div className="px-6 py-5">
          <IntroductionEditor academyId={academyId} />
        </div>
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
  const [showCustomSectionModal, setShowCustomSectionModal] = useState(false);
  const [editingCustomSection, setEditingCustomSection] = useState<SectionConfigItem | null>(null);
  const [showIntroEditor, setShowIntroEditor] = useState(false);
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
    setShowCustomSectionModal(false);
  }, []);

  // 커스텀 섹션 편집
  const handleEditCustomSection = useCallback((sectionData: Partial<SectionConfigItem>) => {
    if (!editingCustomSection) return;
    setSectionConfig(prev => {
      const sections = prev.sections.map(s => {
        if (s.id === editingCustomSection.id) {
          return { ...s, ...sectionData };
        }
        return s;
      });
      return { sections };
    });
    setEditingCustomSection(null);
    setShowCustomSectionModal(false);
  }, [editingCustomSection]);

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

      {/* ─── 아코디언 2: 링크 및 채널 설정 ─── */}
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
                <br />
                <strong>커스텀 섹션</strong>을 추가하여 이미지, 영상, 글 섹션을 자유롭게 구성할 수 있습니다.
              </p>
            </div>

            {/* 섹션 리스트 */}
            <div className="space-y-2">
              {sectionConfig.sections
                .sort((a, b) => a.order - b.order)
                .map((section, index) => {
                  const isCustom = !!section.isCustom;
                  const label = isCustom 
                    ? (section.title || '커스텀 섹션') 
                    : (SECTION_LABELS[section.id] || section.id);
                  const description = isCustom 
                    ? `${CUSTOM_SECTION_TYPE_LABELS[section.type || 'text']} 섹션${section.link_url ? ' · 링크 설정됨' : ''}` 
                    : (SECTION_DESCRIPTIONS[section.id] || '');

                  return (
                    <SectionOrderItem
                      key={section.id}
                      item={section}
                      label={label}
                      description={description}
                      isFirst={index === 0}
                      isLast={index === sectionConfig.sections.length - 1}
                      onToggleVisible={() => handleToggleVisible(index)}
                      onMoveUp={() => handleMoveItem(index, index - 1)}
                      onMoveDown={() => handleMoveItem(index, index + 1)}
                      onDragStart={handleDragStart}
                      onDragOver={handleDragOver}
                      onDrop={handleDrop}
                      index={index}
                      onEdit={
                        isCustom 
                          ? () => { setEditingCustomSection(section); setShowCustomSectionModal(true); }
                          : section.id === 'info'
                            ? () => setShowIntroEditor(true)
                            : undefined
                      }
                      onDelete={isCustom ? () => handleDeleteCustomSection(section.id) : undefined}
                    />
                  );
                })}
            </div>

            {/* 커스텀 섹션 추가 버튼 */}
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

            {/* 하단: 초기화 + 저장 */}
            <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100 dark:border-neutral-800">
              <button
                type="button"
                onClick={handleResetSections}
                className="flex items-center gap-1 text-xs text-gray-400 dark:text-neutral-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                title="기본 섹션만 초기화됩니다. 커스텀 섹션은 유지됩니다."
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

            {/* 커스텀 섹션 모달 */}
            <CustomSectionModal
              isOpen={showCustomSectionModal}
              onClose={() => {
                setShowCustomSectionModal(false);
                setEditingCustomSection(null);
              }}
              onSave={editingCustomSection ? handleEditCustomSection : handleAddCustomSection}
              editingSection={editingCustomSection}
              academyId={academyId}
            />

            {/* 학원 소개 편집 모달 */}
            <IntroductionEditorModal
              isOpen={showIntroEditor}
              onClose={() => setShowIntroEditor(false)}
              academyId={academyId}
            />
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
